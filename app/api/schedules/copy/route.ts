import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, canManageShifts } from "@/lib/auth";
import {
  getRestaurantForSession,
  getOrCreateScheduleWeek,
  getShiftsForWeek,
  createShift,
} from "@/lib/queries";
import { getDb } from "@/lib/db";
import { subWeeks, format } from "date-fns";

/**
 * POST /api/schedules/copy
 *
 * Copies shifts from a source week to a target week.
 * Shifts are duplicated with dates adjusted, keeping the same
 * employees, roles, times, and breaks.
 *
 * Body: {
 *   target_week_start: "2026-04-20",
 *   source_week_start?: "2026-04-13",  // defaults to previous week
 *   clear_existing?: boolean
 * }
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

    const { target_week_start, source_week_start, clear_existing } =
      await request.json();

    if (!target_week_start) {
      return NextResponse.json(
        { error: "Missing target_week_start" },
        { status: 400 }
      );
    }

    // Default source = previous week
    const sourceStart =
      source_week_start ||
      format(subWeeks(new Date(target_week_start), 1), "yyyy-MM-dd");

    // Get source schedule
    const sourceWeek = await getOrCreateScheduleWeek(
      restaurant.id,
      sourceStart
    );
    const sourceShifts = await getShiftsForWeek(sourceWeek.id);

    if (sourceShifts.length === 0) {
      return NextResponse.json(
        {
          error: "No shifts found in source week",
          source_week: sourceStart,
        },
        { status: 404 }
      );
    }

    // Get or create target schedule
    const targetWeek = await getOrCreateScheduleWeek(
      restaurant.id,
      target_week_start
    );

    // Check existing shifts in target
    const existingShifts = await getShiftsForWeek(targetWeek.id);
    if (existingShifts.length > 0 && !clear_existing) {
      return NextResponse.json(
        {
          error: "Target week already has shifts",
          existing_count: existingShifts.length,
          message:
            "Set clear_existing: true to replace them.",
        },
        { status: 409 }
      );
    }

    // Clear existing if requested
    if (existingShifts.length > 0 && clear_existing) {
      await getDb()
        .from("shifts")
        .delete()
        .eq("schedule_week_id", targetWeek.id);
    }

    // Calculate date offset (source monday -> target monday)
    const sourceDate = new Date(sourceStart);
    const targetDate = new Date(target_week_start);
    const dayOffset = Math.round(
      (targetDate.getTime() - sourceDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Copy shifts with adjusted dates
    let copied = 0;
    for (const shift of sourceShifts) {
      const shiftDate = new Date(shift.date);
      shiftDate.setDate(shiftDate.getDate() + dayOffset);
      const newDate = shiftDate.toISOString().split("T")[0];

      // Check if the restaurant is closed on the target day
      const dayOfWeek = shiftDate.getDay();
      const dayHours = restaurant.opening_hours.find(
        (h) => h.day === dayOfWeek
      );
      if (dayHours?.closed) continue; // Skip closed days

      await createShift({
        schedule_week_id: targetWeek.id,
        restaurant_id: restaurant.id,
        employee_id: shift.employee_id,
        date: newDate,
        start_time: shift.start_time,
        end_time: shift.end_time,
        role: shift.role,
        department: shift.department,
        break_minutes: shift.break_minutes,
        dining_area_id: shift.dining_area_id,
        section_label: shift.section_label,
        is_training: shift.is_training,
        is_open: shift.is_open,
        notes: shift.notes,
        scheduled_hours: shift.scheduled_hours,
        estimated_cost: shift.estimated_cost,
      });
      copied++;
    }

    return NextResponse.json({
      data: {
        schedule_week: targetWeek,
        shifts_copied: copied,
        source_week: sourceStart,
        skipped_closed_days:
          sourceShifts.length - copied > 0
            ? sourceShifts.length - copied
            : 0,
      },
    });
  } catch (error) {
    console.error("Copy schedule error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Copy failed" },
      { status: 500 }
    );
  }
}
