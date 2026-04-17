import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, canManageShifts } from "@/lib/auth";
import {
  getRestaurantForSession,
  getEmployees,
  getEmployeeAvailability,
  getDailyStaffingData,
  getOrCreateScheduleWeek,
  getShiftsForWeek,
  createShift,
} from "@/lib/queries";
import type { EmployeeAvailability } from "@/types";
import { generateSchedule } from "@/lib/scheduler/auto-schedule";
import { addDays, format } from "date-fns";

/**
 * POST /api/schedules/generate
 *
 * Auto-generates an optimal schedule for a week.
 * Body: { week_start: "2026-04-14", clear_existing?: boolean }
 *
 * Returns the generated shifts and warnings.
 * Shifts are saved as draft (not published).
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

    const { week_start, clear_existing } = await request.json();

    if (!week_start) {
      return NextResponse.json(
        { error: "Missing week_start" },
        { status: 400 }
      );
    }

    // Get employees
    const employees = await getEmployees(restaurant.id);
    if (employees.length === 0) {
      return NextResponse.json(
        { error: "No employees found. Add staff before generating a schedule." },
        { status: 400 }
      );
    }

    // Get staffing/booking data for the week
    const weekEnd = format(addDays(new Date(week_start), 6), "yyyy-MM-dd");
    const staffingData = await getDailyStaffingData(
      restaurant.id,
      week_start,
      weekEnd
    );

    // Get or create the schedule week
    const scheduleWeek = await getOrCreateScheduleWeek(restaurant.id, week_start);

    // Check for existing shifts
    const existingShifts = await getShiftsForWeek(scheduleWeek.id);
    if (existingShifts.length > 0 && !clear_existing) {
      return NextResponse.json(
        {
          error: "Schedule already has shifts",
          existing_count: existingShifts.length,
          message: "Set clear_existing: true to replace them, or edit manually.",
        },
        { status: 409 }
      );
    }

    // Clear existing shifts if requested
    if (existingShifts.length > 0 && clear_existing) {
      const { getDb } = await import("@/lib/db");
      await getDb()
        .from("shifts")
        .delete()
        .eq("schedule_week_id", scheduleWeek.id);
    }

    // Fetch availability for all employees
    const availabilityByEmployee = new Map<string, EmployeeAvailability[]>();
    for (const emp of employees) {
      const avail = await getEmployeeAvailability(emp.id);
      if (avail.length > 0) {
        availabilityByEmployee.set(emp.id, avail);
      }
    }

    // Generate the optimal schedule
    const result = generateSchedule(
      restaurant,
      employees,
      staffingData,
      week_start,
      7,
      availabilityByEmployee
    );

    // Save generated shifts to database
    const savedShifts = [];
    for (const shift of result.shifts) {
      const saved = await createShift({
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
      savedShifts.push(saved);
    }

    return NextResponse.json({
      data: {
        schedule_week: scheduleWeek,
        shifts_created: savedShifts.length,
        summary: result.summary,
        warnings: result.warnings,
      },
    });
  } catch (error) {
    console.error("Generate schedule error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
