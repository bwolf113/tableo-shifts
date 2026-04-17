import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, canManageShifts } from "@/lib/auth";
import {
  getRestaurantForSession,
  getOrCreateScheduleWeek,
  getShiftsForWeek,
  createShift,
  getEmployeeById,
  getDailyStaffingData,
} from "@/lib/queries";
import {
  calculateShiftHours,
  calculateShiftCost,
} from "@/lib/scheduler/staffing-calculator";

/**
 * GET /api/shifts?week_start=2026-04-13
 * Get all shifts for a given week.
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

    const weekStart = request.nextUrl.searchParams.get("week_start");
    if (!weekStart) {
      return NextResponse.json(
        { error: "Missing week_start parameter" },
        { status: 400 }
      );
    }

    const scheduleWeek = await getOrCreateScheduleWeek(
      restaurant.id,
      weekStart
    );

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().split("T")[0];

    const [shifts, staffingData] = await Promise.all([
      getShiftsForWeek(scheduleWeek.id),
      getDailyStaffingData(restaurant.id, weekStart, weekEndStr),
    ]);

    // Build a date-keyed map for easy frontend lookup
    const coversByDate: Record<string, number> = {};
    for (const d of staffingData) {
      coversByDate[d.date] = d.booked_covers;
    }

    return NextResponse.json({
      data: {
        schedule_week: scheduleWeek,
        shifts,
        covers_by_date: coversByDate,
      },
    });
  } catch (error) {
    console.error("Get shifts error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/shifts
 * Create a new shift.
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

    const body = await request.json();

    const {
      date,
      start_time,
      end_time,
      role,
      department,
      employee_id,
    } = body;

    if (!date || !start_time || !end_time || !role || !department) {
      return NextResponse.json(
        { error: "Missing required fields: date, start_time, end_time, role, department" },
        { status: 400 }
      );
    }

    // Check if the restaurant is open on this day
    const dayOfWeek = new Date(date).getDay();
    const dayHours = restaurant.opening_hours.find(
      (h) => h.day === dayOfWeek
    );
    if (dayHours?.closed) {
      return NextResponse.json(
        { error: `Restaurant is closed on this day` },
        { status: 400 }
      );
    }

    // Get or create the schedule week
    const weekStartDate = getWeekStart(date);
    const scheduleWeek = await getOrCreateScheduleWeek(
      restaurant.id,
      weekStartDate
    );

    // Calculate hours and cost
    const breakMinutes = body.break_minutes || 0;
    const hours = calculateShiftHours(start_time, end_time, breakMinutes);

    let estimatedCost = 0;
    if (employee_id) {
      const employee = await getEmployeeById(employee_id);
      if (employee) {
        estimatedCost = calculateShiftCost(hours, employee.hourly_rate);
      }
    }

    const shift = await createShift({
      schedule_week_id: scheduleWeek.id,
      restaurant_id: restaurant.id,
      employee_id: employee_id || null,
      date,
      start_time,
      end_time,
      role,
      department,
      break_minutes: breakMinutes,
      dining_area_id: body.dining_area_id || null,
      section_label: body.section_label || null,
      is_training: body.is_training || false,
      is_open: !employee_id,
      notes: body.notes || null,
      scheduled_hours: hours,
      estimated_cost: estimatedCost,
    });

    return NextResponse.json({ data: shift }, { status: 201 });
  } catch (error) {
    console.error("Create shift error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Get the Monday (ISO week start) for a given date.
 */
function getWeekStart(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDay();
  // Monday = 1, Sunday = 0
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().split("T")[0];
}
