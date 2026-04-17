import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  calculateExpectedCovers,
  groupBookingsByPeriod,
} from "@/lib/tableo-api";

/**
 * POST /api/dev/setup
 *
 * Creates a restaurant from real Tableo data, syncs bookings,
 * calculates staffing recommendations, and assigns compliance profile.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      api_token,
      api_url,
      name,
      slug,
      country_code,
      timezone,
      currency,
      opening_hours,
      dining_areas,
      bookings,
    } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: "Missing restaurant name or slug" },
        { status: 400 }
      );
    }

    const db = getDb();

    // Default service periods (can be customized in settings later)
    const servicePeriods = detectServicePeriods(opening_hours || []);

    const defaultRatios = {
      server: 15,
      bartender: 25,
      line_cook: 35,
      host: 50,
      runner: 20,
      dishwasher: 60,
    };

    // 1. Create / update restaurant
    const { data: restaurant, error: restError } = await db
      .from("restaurants")
      .upsert(
        {
          slug,
          name,
          api_token: api_token || null,
          api_url: api_url || "https://app.tableo.com",
          timezone: timezone || "Europe/Malta",
          country_code: country_code || "MT",
          currency: currency || "EUR",
          opening_hours: opening_hours || [],
          service_periods: servicePeriods,
          covers_per_staff: defaultRatios,
          avg_spend_per_cover: 45.0,
          target_labor_cost_pct: 30.0,
          walkin_factor_pct: 20.0,
          noshow_factor_pct: 10.0,
          plan_status: "active",
        },
        { onConflict: "slug" }
      )
      .select()
      .single();

    if (restError) {
      return NextResponse.json(
        { error: `Restaurant creation failed: ${restError.message}` },
        { status: 500 }
      );
    }

    // 2. Assign compliance profile
    const { data: compProfile } = await db
      .from("compliance_profiles")
      .select("id")
      .eq("country_code", country_code || "MT")
      .eq("is_default", true)
      .limit(1)
      .single();

    if (compProfile) {
      await db
        .from("restaurants")
        .update({ compliance_profile_id: compProfile.id })
        .eq("id", restaurant.id);
    }

    // 3. Sync booking data into daily_staffing_data
    let bookingsSynced = 0;
    let daysSynced = 0;

    if (bookings && typeof bookings === "object") {
      // Clear existing staffing data
      await db
        .from("daily_staffing_data")
        .delete()
        .eq("restaurant_id", restaurant.id);

      const staffingRows = [];

      for (const [date, dayBookings] of Object.entries(bookings)) {
        const bookingList = dayBookings as any[];
        if (!Array.isArray(bookingList)) continue;

        const activeBookings = bookingList.filter(
          (b: any) => b.status !== "cancelled" && b.status !== "no_show"
        );

        const bookedCovers = activeBookings.reduce(
          (sum: number, b: any) => sum + (b.adults || 0) + (b.children || 0),
          0
        );

        const expectedCovers = calculateExpectedCovers(
          activeBookings as any,
          10, // noshow factor
          20  // walkin factor
        );

        // Group by service period
        const coversByPeriod = groupBookingsByPeriod(
          activeBookings as any,
          servicePeriods
        );

        // Calculate recommended staff
        const recommended: Record<string, number> = {};
        if (expectedCovers > 0) {
          for (const [role, ratio] of Object.entries(defaultRatios)) {
            recommended[role] = Math.max(1, Math.ceil(expectedCovers / ratio));
          }
        }

        staffingRows.push({
          restaurant_id: restaurant.id,
          date,
          booked_covers: bookedCovers,
          booking_count: activeBookings.length,
          covers_by_period: coversByPeriod,
          recommended_staff: recommended,
          scheduled_staff: {},
          staffing_status:
            expectedCovers === 0
              ? "unknown"
              : expectedCovers > 80
                ? "understaffed"
                : "optimal",
          last_synced_at: new Date().toISOString(),
        });

        bookingsSynced += activeBookings.length;
        daysSynced++;
      }

      if (staffingRows.length > 0) {
        const { error: staffErr } = await db
          .from("daily_staffing_data")
          .insert(staffingRows);
        if (staffErr) {
          console.error("Staffing sync error:", staffErr.message);
        }
      }
    }

    // 4. Store the API token for future syncs (in restaurant record)
    // We store it so the staffing page can resync without re-entering
    await db
      .from("restaurants")
      .update({
        // Store API token in a safe way - in production this would be encrypted
        // Using the service_periods field won't work, so we add it as a note
        // TODO: Add api_token column to restaurants table
      })
      .eq("id", restaurant.id);

    return NextResponse.json({
      success: true,
      restaurant_id: restaurant.id,
      restaurant_name: name,
      bookings_synced: bookingsSynced,
      days_synced: daysSynced,
      compliance_profile: compProfile ? "assigned" : "none",
    });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Setup failed" },
      { status: 500 }
    );
  }
}

/**
 * Auto-detect service periods from opening hours.
 */
function detectServicePeriods(
  openingHours: Array<{ day: number; open: string; close: string; closed: boolean }>
) {
  // Find the earliest open and latest close across all open days
  const openDays = openingHours.filter((h) => !h.closed);
  if (openDays.length === 0) {
    return [
      { name: "Lunch", start: "12:00", end: "15:00" },
      { name: "Dinner", start: "18:00", end: "23:00" },
    ];
  }

  const earliestOpen = openDays
    .map((h) => h.open)
    .sort()[0];

  const [eh] = earliestOpen.split(":").map(Number);

  // If restaurant opens before 15:00, assume they have lunch service
  if (eh < 15) {
    return [
      { name: "Lunch", start: earliestOpen, end: "15:00" },
      { name: "Dinner", start: "18:00", end: "23:00" },
    ];
  }

  // Otherwise dinner only
  return [{ name: "Dinner", start: earliestOpen, end: "23:00" }];
}
