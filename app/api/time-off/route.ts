import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, canManageShifts } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getRestaurantForSession } from "@/lib/queries";
import { addDays, format } from "date-fns";

/**
 * GET /api/time-off?week_start=YYYY-MM-DD&status=approved
 * Returns time-off requests that overlap the given week (or all if no week_start).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session || !canManageShifts(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const restaurant = await getRestaurantForSession(session);
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get("week_start");
    const status = searchParams.get("status");

    let query = getDb()
      .from("time_off_requests")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("start_date");

    if (status) {
      query = query.eq("status", status);
    }

    // Filter to requests that overlap the week (start_date <= week_end AND end_date >= week_start)
    if (weekStart) {
      const weekEnd = format(addDays(new Date(weekStart), 6), "yyyy-MM-dd");
      query = query.lte("start_date", weekEnd).gte("end_date", weekStart);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error("Time-off GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
