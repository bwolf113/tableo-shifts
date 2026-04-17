/**
 * Compliance Checker
 *
 * Validates shifts against labor law rules for the restaurant's jurisdiction.
 * Runs pre-publish to flag violations before the schedule goes live.
 */

import type {
  ComplianceProfile,
  ComplianceViolation,
  Employee,
  Shift,
} from "@/types";
import { calculateShiftHours } from "@/lib/scheduler/staffing-calculator";

interface ComplianceInput {
  profile: ComplianceProfile;
  employee: Employee;
  /** All shifts for this employee in the relevant period (typically the week) */
  shifts: Shift[];
  /** The shift being validated (if checking a single new/edited shift) */
  newShift?: Shift;
}

/**
 * Run all compliance checks for an employee's schedule.
 * Returns an array of violations (empty = compliant).
 */
export function checkCompliance(input: ComplianceInput): ComplianceViolation[] {
  const { profile, employee, shifts } = input;
  const violations: ComplianceViolation[] = [];
  const employeeName = `${employee.first_name} ${employee.last_name}`;

  // Use minor-specific limits if applicable
  const maxDaily = employee.is_minor
    ? profile.minor_max_daily_hours
    : profile.max_daily_hours;
  const maxWeekly = employee.is_minor
    ? profile.minor_max_weekly_hours
    : profile.max_weekly_hours;

  // 1. Check daily hours
  if (maxDaily !== null) {
    violations.push(
      ...checkDailyHours(shifts, maxDaily, employee.id, employeeName)
    );
  }

  // 2. Check weekly hours
  violations.push(
    ...checkWeeklyHours(shifts, maxWeekly, employee.id, employeeName)
  );

  // 3. Check rest between shifts (clopening detection)
  violations.push(
    ...checkRestBetweenShifts(
      shifts,
      profile.min_rest_between_shifts_hours,
      employee.id,
      employeeName
    )
  );

  // 4. Check consecutive days
  violations.push(
    ...checkConsecutiveDays(
      shifts,
      profile.max_consecutive_days,
      employee.id,
      employeeName
    )
  );

  // 5. Check overtime threshold
  violations.push(
    ...checkOvertime(
      shifts,
      profile.overtime_weekly_threshold,
      profile.overtime_daily_threshold,
      employee.id,
      employeeName
    )
  );

  // 6. Check breaks
  violations.push(
    ...checkBreaks(
      shifts,
      profile.break_required_after_hours,
      profile.break_duration_minutes,
      employee.id,
      employeeName
    )
  );

  // 7. Check minor prohibited hours
  if (employee.is_minor) {
    violations.push(
      ...checkMinorHours(
        shifts,
        profile.minor_prohibited_hours_start,
        profile.minor_prohibited_hours_end,
        employee.id,
        employeeName
      )
    );
  }

  // 8. Check casual minimum shift duration
  if (
    employee.employment_type === "casual" &&
    profile.casual_min_shift_hours
  ) {
    violations.push(
      ...checkMinimumShiftDuration(
        shifts,
        profile.casual_min_shift_hours,
        employee.id,
        employeeName
      )
    );
  }

  return violations;
}

function checkDailyHours(
  shifts: Shift[],
  maxDaily: number,
  employeeId: string,
  employeeName: string
): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];
  const byDate = groupShiftsByDate(shifts);

  for (const [date, dayShifts] of Object.entries(byDate)) {
    const totalHours = dayShifts.reduce((sum, s) => sum + s.scheduled_hours, 0);
    if (totalHours > maxDaily) {
      violations.push({
        type: "max_hours",
        severity: "error",
        employeeId,
        employeeName,
        message: `${employeeName} is scheduled for ${totalHours.toFixed(1)}h on ${date} (max: ${maxDaily}h)`,
        details: { date, totalHours, maxDaily },
      });
    }
  }

  return violations;
}

function checkWeeklyHours(
  shifts: Shift[],
  maxWeekly: number,
  employeeId: string,
  employeeName: string
): ComplianceViolation[] {
  const totalHours = shifts.reduce((sum, s) => sum + s.scheduled_hours, 0);
  if (totalHours > maxWeekly) {
    return [
      {
        type: "max_hours",
        severity: "error",
        employeeId,
        employeeName,
        message: `${employeeName} is scheduled for ${totalHours.toFixed(1)}h this week (max: ${maxWeekly}h)`,
        details: { totalHours, maxWeekly },
      },
    ];
  }
  return [];
}

function checkRestBetweenShifts(
  shifts: Shift[],
  minRestHours: number,
  employeeId: string,
  employeeName: string
): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];
  const sorted = [...shifts].sort(
    (a, b) =>
      new Date(`${a.date}T${a.start_time}`).getTime() -
      new Date(`${b.date}T${b.start_time}`).getTime()
  );

  for (let i = 0; i < sorted.length - 1; i++) {
    const currentEnd = new Date(`${sorted[i].date}T${sorted[i].end_time}`);
    const nextStart = new Date(
      `${sorted[i + 1].date}T${sorted[i + 1].start_time}`
    );

    // Handle overnight shifts
    if (sorted[i].end_time <= sorted[i].start_time) {
      currentEnd.setDate(currentEnd.getDate() + 1);
    }

    const restHours =
      (nextStart.getTime() - currentEnd.getTime()) / (1000 * 60 * 60);

    if (restHours >= 0 && restHours < minRestHours) {
      violations.push({
        type: "clopening",
        severity: "error",
        employeeId,
        employeeName,
        message: `${employeeName} has only ${restHours.toFixed(1)}h rest between ${sorted[i].date} ${sorted[i].end_time} and ${sorted[i + 1].date} ${sorted[i + 1].start_time} (min: ${minRestHours}h)`,
        details: {
          shift1End: `${sorted[i].date} ${sorted[i].end_time}`,
          shift2Start: `${sorted[i + 1].date} ${sorted[i + 1].start_time}`,
          restHours,
          minRestHours,
        },
      });
    }
  }

  return violations;
}

function checkConsecutiveDays(
  shifts: Shift[],
  maxConsecutive: number,
  employeeId: string,
  employeeName: string
): ComplianceViolation[] {
  const dates = [...new Set(shifts.map((s) => s.date))].sort();
  if (dates.length <= maxConsecutive) return [];

  let consecutive = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diffDays =
      (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays === 1) {
      consecutive++;
      if (consecutive > maxConsecutive) {
        return [
          {
            type: "consecutive_days",
            severity: "error",
            employeeId,
            employeeName,
            message: `${employeeName} is scheduled for ${consecutive} consecutive days (max: ${maxConsecutive})`,
            details: { consecutive, maxConsecutive, dates },
          },
        ];
      }
    } else {
      consecutive = 1;
    }
  }

  return [];
}

function checkOvertime(
  shifts: Shift[],
  weeklyThreshold: number,
  dailyThreshold: number | null,
  employeeId: string,
  employeeName: string
): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];

  // Weekly overtime
  const totalHours = shifts.reduce((sum, s) => sum + s.scheduled_hours, 0);
  if (totalHours > weeklyThreshold) {
    const overtimeHours = totalHours - weeklyThreshold;
    violations.push({
      type: "overtime",
      severity: "warning",
      employeeId,
      employeeName,
      message: `${employeeName} will have ${overtimeHours.toFixed(1)}h overtime this week (over ${weeklyThreshold}h threshold)`,
      details: { totalHours, weeklyThreshold, overtimeHours },
    });
  }

  // Daily overtime (e.g., California)
  if (dailyThreshold !== null) {
    const byDate = groupShiftsByDate(shifts);
    for (const [date, dayShifts] of Object.entries(byDate)) {
      const dayHours = dayShifts.reduce(
        (sum, s) => sum + s.scheduled_hours,
        0
      );
      if (dayHours > dailyThreshold) {
        violations.push({
          type: "overtime",
          severity: "warning",
          employeeId,
          employeeName,
          message: `${employeeName} has ${(dayHours - dailyThreshold).toFixed(1)}h daily overtime on ${date} (over ${dailyThreshold}h)`,
          details: { date, dayHours, dailyThreshold },
        });
      }
    }
  }

  return violations;
}

function checkBreaks(
  shifts: Shift[],
  breakAfterHours: number,
  breakMinutes: number,
  employeeId: string,
  employeeName: string
): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];

  for (const shift of shifts) {
    const shiftHours = calculateShiftHours(
      shift.start_time,
      shift.end_time,
      0 // Don't subtract break here, we're checking if it's assigned
    );

    if (shiftHours > breakAfterHours && shift.break_minutes < breakMinutes) {
      violations.push({
        type: "break_missing",
        severity: "warning",
        employeeId,
        employeeName,
        message: `${employeeName}'s ${shift.date} shift (${shift.start_time}-${shift.end_time}, ${shiftHours.toFixed(1)}h) needs a ${breakMinutes}min break`,
        details: {
          date: shift.date,
          shiftHours,
          breakAfterHours,
          requiredBreak: breakMinutes,
          currentBreak: shift.break_minutes,
        },
      });
    }
  }

  return violations;
}

function checkMinorHours(
  shifts: Shift[],
  prohibitedStart: string,
  prohibitedEnd: string,
  employeeId: string,
  employeeName: string
): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];

  for (const shift of shifts) {
    // Check if shift overlaps with prohibited hours
    if (
      shift.end_time > prohibitedStart ||
      shift.start_time < prohibitedEnd
    ) {
      violations.push({
        type: "minor_hours",
        severity: "error",
        employeeId,
        employeeName,
        message: `${employeeName} (minor) is scheduled during prohibited hours (${prohibitedStart}-${prohibitedEnd}) on ${shift.date}`,
        details: {
          date: shift.date,
          shiftStart: shift.start_time,
          shiftEnd: shift.end_time,
          prohibitedStart,
          prohibitedEnd,
        },
      });
    }
  }

  return violations;
}

function checkMinimumShiftDuration(
  shifts: Shift[],
  minHours: number,
  employeeId: string,
  employeeName: string
): ComplianceViolation[] {
  const violations: ComplianceViolation[] = [];

  for (const shift of shifts) {
    if (shift.scheduled_hours < minHours) {
      violations.push({
        type: "max_hours",
        severity: "error",
        employeeId,
        employeeName,
        message: `${employeeName}'s shift on ${shift.date} (${shift.scheduled_hours.toFixed(1)}h) is below the ${minHours}h casual minimum`,
        details: {
          date: shift.date,
          scheduledHours: shift.scheduled_hours,
          minHours,
        },
      });
    }
  }

  return violations;
}

// --- Helpers ---

function groupShiftsByDate(shifts: Shift[]): Record<string, Shift[]> {
  const grouped: Record<string, Shift[]> = {};
  for (const shift of shifts) {
    if (!grouped[shift.date]) grouped[shift.date] = [];
    grouped[shift.date].push(shift);
  }
  return grouped;
}
