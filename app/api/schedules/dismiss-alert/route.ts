import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, canManageShifts } from "@/lib/auth";
import {
  getRestaurantForSession,
  getScheduleWeek,
  updateScheduleWeekAlert,
  getDailyStaffingData,
} from "@/lib/queries";

/**
 * POST /api/schedules/dismiss-alert
 *
 * Dismiss the booking change alert for a published week.
 * Resets the covers snapshot to current values so future changes
 * are measured from this point forward.
 *
 * Body: { week_start: "2026-04-20" }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session || !canManageShifts(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const restaurant = await getRestaurantForSession(session);
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    const { week_start } = await request.json();
    if (!week_start) {
      return NextResponse.json({ error: "Missing week_start" }, { status: 400 });
    }

    const scheduleWeek = await getScheduleWeek(restaurant.id, week_start);
    if (!scheduleWeek) {
      return NextResponse.json({ error: "Schedule week not found" }, { status: 404 });
    }

    // Reset snapshot to current covers so future alerts measure from now
    const weekEndDate = new Date(week_start);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    const weekEndStr = weekEndDate.toISOString().split("T")[0];
    const staffingData = await getDailyStaffingData(restaurant.id, week_start, weekEndStr);
    const newSnapshot: Record<string, number> = {};
    for (const d of staffingData) newSnapshot[d.date] = d.booked_covers;

    await updateScheduleWeekAlert(scheduleWeek.id, null, newSnapshot);

    return NextResponse.json({ data: { dismissed: true } });
  } catch (error) {
    console.error("Dismiss alert error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
