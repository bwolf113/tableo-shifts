import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, canManageShifts } from "@/lib/auth";
import {
  getRestaurantForSession,
  getScheduleWeek,
  getShiftsForWeek,
  getEmployeeById,
  publishScheduleWeek,
  getComplianceProfile,
  createNotification,
  getDailyStaffingData,
} from "@/lib/queries";
import { checkCompliance } from "@/lib/compliance/checker";
import type { ComplianceViolation } from "@/types";

/**
 * POST /api/schedules/publish
 *
 * Publish a schedule week. Runs compliance checks first.
 * Body: { week_start: "2026-04-13", force?: boolean }
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

    const { week_start, force } = await request.json();

    if (!week_start) {
      return NextResponse.json(
        { error: "Missing week_start" },
        { status: 400 }
      );
    }

    const scheduleWeek = await getScheduleWeek(restaurant.id, week_start);
    if (!scheduleWeek) {
      return NextResponse.json(
        { error: "Schedule week not found" },
        { status: 404 }
      );
    }

    if (scheduleWeek.status === "published") {
      return NextResponse.json(
        { error: "Schedule is already published" },
        { status: 400 }
      );
    }

    // Get all shifts for the week
    const shifts = await getShiftsForWeek(scheduleWeek.id);

    // Run compliance checks if the restaurant has a compliance profile
    let violations: ComplianceViolation[] = [];
    if (restaurant.compliance_profile_id) {
      const profile = await getComplianceProfile(
        restaurant.compliance_profile_id
      );
      if (profile) {
        // Group shifts by employee and check each
        const shiftsByEmployee = new Map<string, typeof shifts>();
        for (const shift of shifts) {
          if (!shift.employee_id) continue;
          const existing = shiftsByEmployee.get(shift.employee_id) || [];
          existing.push(shift);
          shiftsByEmployee.set(shift.employee_id, existing);
        }

        for (const [employeeId, employeeShifts] of shiftsByEmployee) {
          const employee = await getEmployeeById(employeeId);
          if (employee) {
            const empViolations = checkCompliance({
              profile,
              employee,
              shifts: employeeShifts,
            });
            violations.push(...empViolations);
          }
        }
      }
    }

    // If there are errors (not just warnings) and not forcing, block publish
    const errors = violations.filter((v) => v.severity === "error");
    if (errors.length > 0 && !force) {
      return NextResponse.json(
        {
          error: "Compliance violations found",
          violations,
          can_force: true,
        },
        { status: 422 }
      );
    }

    // Snapshot current covers for booking change detection post-publish
    const weekEndDate = new Date(week_start);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    const weekEndStr = weekEndDate.toISOString().split("T")[0];
    const staffingData = await getDailyStaffingData(restaurant.id, week_start, weekEndStr);
    const coversSnapshot: Record<string, number> = {};
    for (const d of staffingData) coversSnapshot[d.date] = d.booked_covers;

    // Publish the schedule
    const published = await publishScheduleWeek(
      scheduleWeek.id,
      session.userId.toString(),
      coversSnapshot
    );

    // Create notifications for all employees with shifts
    const employeeIds = [
      ...new Set(shifts.filter((s) => s.employee_id).map((s) => s.employee_id!)),
    ];

    for (const employeeId of employeeIds) {
      await createNotification({
        restaurant_id: restaurant.id,
        employee_id: employeeId,
        type: "schedule_published",
        title: "New schedule published",
        body: `The schedule for the week of ${week_start} has been published.`,
        data: { week_start, schedule_week_id: scheduleWeek.id },
      });
    }

    return NextResponse.json({
      data: {
        schedule_week: published,
        violations: violations.filter((v) => v.severity === "warning"),
        notified_employees: employeeIds.length,
      },
    });
  } catch (error) {
    console.error("Publish error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
