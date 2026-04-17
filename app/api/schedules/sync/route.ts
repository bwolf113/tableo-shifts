import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  getRestaurantForSession,
  getEmployees,
  getEmployeeAvailability,
  getDailyStaffingData,
  upsertDailyStaffingData,
  getScheduleWeek,
  getShiftsForWeek,
  updateScheduleWeekAlert,
} from "@/lib/queries";
import {
  getBookings,
  calculateExpectedCovers,
  groupBookingsByPeriod,
  getBookingCovers,
} from "@/lib/tableo-api";
import { generateSchedule } from "@/lib/scheduler/auto-schedule";
import type { EmployeeAvailability } from "@/types";

/**
 * POST /api/schedules/sync
 *
 * Auto-sync booking data from Tableo for a given week.
 * If no draft schedule exists yet for that week, auto-generates one.
 *
 * Body: { week_start: "2026-04-14" }
 *
 * Called automatically by the frontend when:
 * - The schedule page loads and data is stale (>30 min)
 * - The staffing page loads
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

    if (!restaurant.api_token) {
      return NextResponse.json({
        data: { synced: false, reason: "no_api_token" },
      });
    }

    const { week_start } = await request.json();
    if (!week_start) {
      return NextResponse.json(
        { error: "Missing week_start" },
        { status: 400 }
      );
    }

    const apiOpts = {
      apiToken: restaurant.api_token,
      baseUrl: `${restaurant.api_url || "https://app.tableo.com"}/api/restaurant`,
    };

    // Sync 7 days of booking data
    let totalCovers = 0;
    let totalBookings = 0;
    let daysSynced = 0;

    for (let i = 0; i < 7; i++) {
      const date = new Date(week_start);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split("T")[0];
      const dayOfWeek = date.getDay();

      // Skip closed days
      const dayHours = restaurant.opening_hours.find(
        (h) => h.day === dayOfWeek
      );
      if (dayHours?.closed) continue;

      try {
        const bookings = await getBookings(dateStr, apiOpts);

        // Match Tableo's cover count: exclude tentative, cancelled, no_show
        const activeBookings = bookings.filter(
          (b) => b.status !== "cancelled" && b.status !== "no_show" && b.status !== "tentative"
        );

        const bookedCovers = activeBookings.reduce(
          (sum, b) => sum + getBookingCovers(b),
          0
        );

        const expectedCovers = calculateExpectedCovers(
          activeBookings,
          restaurant.noshow_factor_pct,
          restaurant.walkin_factor_pct
        );

        const coversByPeriod = groupBookingsByPeriod(
          activeBookings,
          restaurant.service_periods
        );

        // Calculate recommended staff
        const recommended: Record<string, number> = {};
        if (expectedCovers > 0) {
          for (const [role, ratio] of Object.entries(
            restaurant.covers_per_staff
          )) {
            if (ratio > 0) {
              recommended[role] = Math.max(
                1,
                Math.ceil(expectedCovers / ratio)
              );
            }
          }
        }

        // Count currently scheduled staff for this date
        const scheduled: Record<string, number> = {};
        const { getShiftsForDate } = await import("@/lib/queries");
        const dayShifts = await getShiftsForDate(restaurant.id, dateStr);
        for (const shift of dayShifts) {
          if (shift.employee_id && !shift.is_open && !shift.is_training) {
            scheduled[shift.role] = (scheduled[shift.role] || 0) + 1;
          }
        }

        // Determine status
        let status: "understaffed" | "optimal" | "overstaffed" | "unknown" =
          "unknown";
        if (expectedCovers > 0) {
          const totalRecommended = Object.values(recommended).reduce(
            (s, v) => s + v,
            0
          );
          const totalScheduled = Object.values(scheduled).reduce(
            (s, v) => s + v,
            0
          );
          const ratio =
            totalRecommended > 0 ? totalScheduled / totalRecommended : 1;
          status =
            ratio < 0.85
              ? "understaffed"
              : ratio > 1.15
                ? "overstaffed"
                : "optimal";
        }

        await upsertDailyStaffingData({
          restaurant_id: restaurant.id,
          date: dateStr,
          booked_covers: bookedCovers,
          booking_count: activeBookings.length,
          covers_by_period: coversByPeriod,
          recommended_staff: recommended,
          scheduled_staff: scheduled,
          staffing_status: status,
          last_synced_at: new Date().toISOString(),
        });

        totalCovers += bookedCovers;
        totalBookings += activeBookings.length;
        daysSynced++;
      } catch (err) {
        // Skip individual day errors, continue syncing
        console.error(`Sync error for ${dateStr}:`, err);
      }
    }

    // Check if a published schedule has significant booking changes
    const existingWeek = await getScheduleWeek(restaurant.id, week_start);

    if (existingWeek?.status === "published") {
      // Fetch the synced covers for this week
      const weekEndDate = new Date(week_start);
      weekEndDate.setDate(weekEndDate.getDate() + 6);
      const weekEndStr = weekEndDate.toISOString().split("T")[0];
      const freshStaffing = await getDailyStaffingData(restaurant.id, week_start, weekEndStr);
      const currentCovers: Record<string, number> = {};
      for (const d of freshStaffing) currentCovers[d.date] = d.booked_covers;

      const snapshot = existingWeek.covers_snapshot;

      if (!snapshot) {
        // First sync after publish with no snapshot — create one now
        await updateScheduleWeekAlert(existingWeek.id, null, currentCovers);
      } else {
        // Compare current covers to snapshot, flag days with ≥5 cover change
        const ALERT_THRESHOLD = 5;
        const changedDays: Record<string, { at_publish: number; current: number; diff: number }> = {};

        for (const [date, atPublish] of Object.entries(snapshot)) {
          const current = currentCovers[date] ?? 0;
          const diff = current - atPublish;
          if (Math.abs(diff) >= ALERT_THRESHOLD) {
            changedDays[date] = { at_publish: atPublish, current, diff };
          }
        }
        // Also catch new days that weren't in snapshot (e.g., a day had 0 covers at publish)
        for (const [date, current] of Object.entries(currentCovers)) {
          if (!(date in snapshot) && current >= ALERT_THRESHOLD) {
            changedDays[date] = { at_publish: 0, current, diff: current };
          }
        }

        const hasChanges = Object.keys(changedDays).length > 0;
        await updateScheduleWeekAlert(
          existingWeek.id,
          hasChanges ? changedDays : null
        );
      }
    }

    // Check if a draft schedule should be auto-generated
    let autoGenerated = false;

    // Check if schedule has any shifts
    let existingShiftCount = 0;
    if (existingWeek) {
      const existingShifts = await getShiftsForWeek(existingWeek.id);
      existingShiftCount = existingShifts.length;
    }

    // Only auto-generate if:
    // - No shifts exist yet for this week (empty or no schedule)
    // - Schedule is not published
    // - There are bookings (covers > 0)
    // - The week is in the future or current
    const weekStartDate = new Date(week_start);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isFutureOrCurrent = weekStartDate >= today ||
      (weekStartDate <= today && new Date(week_start + "T23:59:59") >= today);
    const isNotPublished = !existingWeek || existingWeek.status === "draft";

    if (existingShiftCount === 0 && isNotPublished && totalCovers > 0 && isFutureOrCurrent) {
      try {
        // Fetch employees and availability
        const employees = await getEmployees(restaurant.id);
        if (employees.length > 0) {
          const staffingData = await getDailyStaffingData(
            restaurant.id,
            week_start,
            (() => {
              const end = new Date(week_start);
              end.setDate(end.getDate() + 6);
              return end.toISOString().split("T")[0];
            })()
          );

          const availMap = new Map<string, EmployeeAvailability[]>();
          for (const emp of employees) {
            const avail = await getEmployeeAvailability(emp.id);
            if (avail.length > 0) availMap.set(emp.id, avail);
          }

          // Import createShift and getOrCreateScheduleWeek
          const { getOrCreateScheduleWeek, createShift } = await import(
            "@/lib/queries"
          );

          const scheduleWeek = await getOrCreateScheduleWeek(
            restaurant.id,
            week_start
          );

          const result = generateSchedule(
            restaurant,
            employees,
            staffingData,
            week_start,
            7,
            availMap
          );

          for (const shift of result.shifts) {
            await createShift({
              schedule_week_id: scheduleWeek.id,
              restaurant_id: restaurant.id,
              employee_id: shift.employee_id || null,
              date: shift.date,
              start_time: shift.start_time,
              end_time: shift.end_time,
              role: shift.role,
              department: shift.department,
              break_minutes: shift.break_minutes,
              dining_area_id: null,
              section_label: null,
              is_training: false,
              is_open: shift.is_open,
              notes: null,
              scheduled_hours: shift.scheduled_hours,
              estimated_cost: shift.estimated_cost,
            });
          }

          autoGenerated = true;
        }
      } catch (err) {
        console.error("Auto-generate error:", err);
        // Non-blocking — sync still succeeded
      }
    }

    return NextResponse.json({
      data: {
        synced: true,
        days_synced: daysSynced,
        total_covers: totalCovers,
        total_bookings: totalBookings,
        auto_generated: autoGenerated,
      },
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
