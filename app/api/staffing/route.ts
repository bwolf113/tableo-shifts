import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  getRestaurantForSession,
  getShiftsForDate,
  upsertDailyStaffingData,
  getDailyStaffingData,
} from "@/lib/queries";
import {
  getBookings,
  calculateExpectedCovers,
  groupBookingsByPeriod,
} from "@/lib/tableo-api";
import { calculateStaffing } from "@/lib/scheduler/staffing-calculator";

/**
 * GET /api/staffing?date=2026-04-15&days=7
 *
 * Get staffing data for a date range.
 * Optionally syncs fresh data from Tableo if ?sync=true.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const restaurant = await getRestaurantForSession(session);
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    const date = request.nextUrl.searchParams.get("date");
    const days = parseInt(request.nextUrl.searchParams.get("days") || "7");
    const sync = request.nextUrl.searchParams.get("sync") === "true";

    if (!date) {
      return NextResponse.json(
        { error: "Missing date parameter" },
        { status: 400 }
      );
    }

    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + days - 1);
    const endDateStr = endDate.toISOString().split("T")[0];

    if (sync) {
      // Sync fresh data from Tableo API
      // This requires the restaurant's API token (stored separately or passed)
      // For now, return cached data
      // TODO: Implement Tableo API sync with stored API tokens
    }

    const staffingData = await getDailyStaffingData(
      restaurant.id,
      date,
      endDateStr
    );

    return NextResponse.json({ data: staffingData });
  } catch (error) {
    console.error("Get staffing error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/staffing/sync
 *
 * Sync staffing data from Tableo for a specific date.
 * Pulls bookings and calculates recommended staffing.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const restaurant = await getRestaurantForSession(session);
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    const { date, api_token } = await request.json();

    if (!date || !api_token) {
      return NextResponse.json(
        { error: "Missing date or api_token" },
        { status: 400 }
      );
    }

    // Fetch bookings from Tableo
    const bookings = await getBookings(date, { apiToken: api_token });

    // Get current shifts for this date
    const currentShifts = await getShiftsForDate(restaurant.id, date);

    // Calculate staffing
    const result = calculateStaffing({
      restaurant,
      date,
      bookings,
      currentShifts,
    });

    // Save to database
    const staffingData = await upsertDailyStaffingData({
      restaurant_id: restaurant.id,
      date,
      booked_covers: bookings
        .filter((b) => b.status !== "cancelled" && b.status !== "no_show")
        .reduce((sum, b) => sum + (b.adults || 0) + (b.children || 0), 0),
      booking_count: bookings.length,
      covers_by_period: result.coversByPeriod,
      recommended_staff: result.recommended,
      scheduled_staff: result.currentlyScheduled,
      staffing_status: result.status,
      last_synced_at: new Date().toISOString(),
    });

    return NextResponse.json({
      data: {
        staffing: staffingData,
        suggestions: result.suggestions,
        financials: {
          projected_revenue: result.projectedRevenue,
          projected_labor_cost: result.projectedLaborCost,
          labor_cost_pct: result.laborCostPct,
          target_pct: restaurant.target_labor_cost_pct,
        },
      },
    });
  } catch (error) {
    console.error("Sync staffing error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
