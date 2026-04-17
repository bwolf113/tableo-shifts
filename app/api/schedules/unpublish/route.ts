import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, canManageShifts } from "@/lib/auth";
import { getRestaurantForSession, getScheduleWeek } from "@/lib/queries";

/**
 * POST /api/schedules/unpublish
 * Revert a published schedule back to draft so it can be edited/regenerated.
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

    const { getDb } = await import("@/lib/db");
    const { data, error } = await getDb()
      .from("schedule_weeks")
      .update({
        status: "draft",
        published_at: null,
        covers_snapshot: null,
        booking_alert: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", scheduleWeek.id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ data: { schedule_week: data } });
  } catch (error) {
    console.error("Unpublish error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
