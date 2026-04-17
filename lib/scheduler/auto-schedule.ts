/**
 * Auto-Schedule Generator
 *
 * Generates an optimal weekly schedule by:
 * 1. Calculating required staff per day from booking covers + ratios
 * 2. Assigning employees to shifts to fill their contracted hours
 * 3. Prioritising full-timers first, then part-timers, then casuals
 * 4. Spreading hours evenly and respecting closed days
 * 5. Creating shift times that match service periods
 */

import type {
  Restaurant,
  Employee,
  EmployeeAvailability,
  DailyStaffingData,
  EmployeeRole,
  Department,
  OpeningHoursPeriod,
  ServicePeriod,
} from "@/types";
import { getBookingCovers } from "@/lib/tableo-api";

// --- Types ---

export interface GeneratedShift {
  date: string;
  start_time: string;
  end_time: string;
  role: EmployeeRole;
  department: Department;
  employee_id: string;
  employee_name: string;
  break_minutes: number;
  scheduled_hours: number;
  estimated_cost: number;
  is_open: boolean;
}

export interface ScheduleGenerationResult {
  shifts: GeneratedShift[];
  warnings: string[];
  summary: {
    total_shifts: number;
    total_hours: number;
    total_cost: number;
    employees_scheduled: number;
    unfilled_roles: Array<{ date: string; role: string; needed: number }>;
  };
}

interface DayDemand {
  date: string;
  dayOfWeek: number;
  isClosed: boolean;
  openTime: string;
  closeTime: string;
  expectedCovers: number;
  requiredByRole: Record<string, number>;
  servicePeriods: ServicePeriod[];
}

interface EmployeeState {
  employee: Employee;
  availability: EmployeeAvailability[];
  hoursAssigned: number;
  daysAssigned: Set<string>;
  shiftsAssigned: GeneratedShift[];
}

// --- Main Generator ---

export function generateSchedule(
  restaurant: Restaurant,
  employees: Employee[],
  staffingData: DailyStaffingData[],
  weekStart: string,
  weekDays: number = 7,
  availabilityByEmployee: Map<string, EmployeeAvailability[]> = new Map()
): ScheduleGenerationResult {
  const warnings: string[] = [];
  const shifts: GeneratedShift[] = [];

  // 1. Calculate demand for each day
  const days = buildDayDemands(restaurant, staffingData, weekStart, weekDays);

  // 2. Initialise employee state
  const activeEmployees = employees.filter((e) => e.is_active);
  const employeeStates = new Map<string, EmployeeState>(
    activeEmployees.map((e) => [
      e.id,
      {
        employee: e,
        availability: availabilityByEmployee.get(e.id) || [],
        hoursAssigned: 0,
        daysAssigned: new Set(),
        shiftsAssigned: [],
      },
    ])
  );

  // 3. For each day, assign staff by role
  const unfilled: Array<{ date: string; role: string; needed: number }> = [];

  for (const day of days) {
    if (day.isClosed) continue;

    for (const [role, needed] of Object.entries(day.requiredByRole)) {
      if (needed <= 0) continue;

      // Find eligible employees for this role
      const candidates = rankCandidates(
        role as EmployeeRole,
        day,
        employeeStates,
        restaurant
      );

      let assigned = 0;
      for (const candidate of candidates) {
        if (assigned >= needed) break;

        const state = employeeStates.get(candidate.employee.id)!;

        // Check if employee can work this day
        if (state.daysAssigned.has(day.date)) continue; // Already assigned today

        // Create the shift — clip to employee's availability window if set
        let shiftTimes = getShiftTimes(day, role as EmployeeRole, restaurant);
        const availWindow = getEmployeeAvailableWindow(state, day);
        if (availWindow) {
          // Clip shift to availability: don't start before available, don't end after available
          if (shiftTimes.start < availWindow.start) {
            shiftTimes = { ...shiftTimes, start: availWindow.start };
          }
          if (timeToMinutes(shiftTimes.end) > timeToMinutes(availWindow.end)) {
            shiftTimes = { ...shiftTimes, end: availWindow.end };
          }
        }

        // Recalculate hours after clipping
        const actualHours = calculateTimeSpan(shiftTimes.start, shiftTimes.end);
        const breakMins = actualHours > 6 ? 30 : 0;
        const netHours = actualHours - breakMins / 60;

        // Skip if clipped shift is too short (less than 2 hours)
        if (netHours < 2) continue;

        // Check contracted hours limit
        if (wouldExceedHours(state, netHours, restaurant)) continue;

        const shift: GeneratedShift = {
          date: day.date,
          start_time: shiftTimes.start,
          end_time: shiftTimes.end,
          role: role as EmployeeRole,
          department: candidate.employee.department,
          employee_id: candidate.employee.id,
          employee_name: `${candidate.employee.first_name} ${candidate.employee.last_name}`,
          break_minutes: breakMins,
          scheduled_hours: Math.round(netHours * 100) / 100,
          estimated_cost: Math.round(netHours * candidate.employee.hourly_rate * 100) / 100,
          is_open: false,
        };

        shifts.push(shift);
        state.hoursAssigned += netHours;
        state.daysAssigned.add(day.date);
        state.shiftsAssigned.push(shift);
        assigned++;
      }

      // If we couldn't fill all positions, create open shifts
      if (assigned < needed) {
        const shortfall = needed - assigned;
        unfilled.push({ date: day.date, role, needed: shortfall });

        for (let i = 0; i < shortfall; i++) {
          const shiftTimes = getShiftTimes(day, role as EmployeeRole, restaurant);
          const shiftHours = calculateDayShiftHours(day, role as EmployeeRole, restaurant);
          const breakMins = shiftHours > 6 ? 30 : 0;

          shifts.push({
            date: day.date,
            start_time: shiftTimes.start,
            end_time: shiftTimes.end,
            role: role as EmployeeRole,
            department: getDepartmentForRole(role as EmployeeRole),
            employee_id: "",
            employee_name: "",
            break_minutes: breakMins,
            scheduled_hours: Math.round((shiftHours - breakMins / 60) * 100) / 100,
            estimated_cost: 0,
            is_open: true,
          });
        }

        warnings.push(
          `${day.date}: Need ${shortfall} more ${role}${shortfall > 1 ? "s" : ""} — created as open shift${shortfall > 1 ? "s" : ""}`
        );
      }
    }
  }

  // 4. Check for employees with too few hours
  for (const [, state] of employeeStates) {
    const emp = state.employee;
    if (emp.employment_type === "casual") continue;
    if (!emp.contracted_hours_per_week) continue;

    const target = emp.contracted_hours_per_week;
    const assigned = Math.round(state.hoursAssigned * 10) / 10;

    if (assigned < target * 0.8) {
      warnings.push(
        `${emp.first_name} ${emp.last_name} (${emp.role}): ${assigned}h assigned vs ${target}h contracted — ${Math.round(target - assigned)}h short`
      );
    }
  }

  // 5. Build summary
  const scheduledEmployeeIds = new Set(
    shifts.filter((s) => s.employee_id).map((s) => s.employee_id)
  );

  return {
    shifts,
    warnings,
    summary: {
      total_shifts: shifts.length,
      total_hours: Math.round(shifts.reduce((s, sh) => s + sh.scheduled_hours, 0) * 10) / 10,
      total_cost: Math.round(shifts.reduce((s, sh) => s + sh.estimated_cost, 0) * 100) / 100,
      employees_scheduled: scheduledEmployeeIds.size,
      unfilled_roles: unfilled,
    },
  };
}

// --- Helpers ---

function buildDayDemands(
  restaurant: Restaurant,
  staffingData: DailyStaffingData[],
  weekStart: string,
  weekDays: number
): DayDemand[] {
  const staffingByDate = new Map(staffingData.map((d) => [d.date, d]));
  const days: DayDemand[] = [];

  for (let i = 0; i < weekDays; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split("T")[0];
    const dayOfWeek = date.getDay();

    const hours = restaurant.opening_hours.find((h) => h.day === dayOfWeek);
    const isClosed = hours?.closed ?? true;

    // Get covers from staffing data, or estimate from historical average
    const staffing = staffingByDate.get(dateStr);
    const bookedCovers = staffing?.booked_covers || 0;

    // Apply walk-in and no-show factors
    const expectedCovers = Math.round(
      bookedCovers * (1 - restaurant.noshow_factor_pct / 100) *
      (1 + restaurant.walkin_factor_pct / 100)
    );

    // Calculate required staff per role from covers-per-staff ratios
    const requiredByRole: Record<string, number> = {};
    if (expectedCovers > 0) {
      for (const [role, ratio] of Object.entries(restaurant.covers_per_staff)) {
        if (ratio > 0) {
          requiredByRole[role] = Math.max(1, Math.ceil(expectedCovers / ratio));
        }
      }
    }

    days.push({
      date: dateStr,
      dayOfWeek,
      isClosed,
      openTime: hours?.open || "12:00",
      closeTime: hours?.close || "23:00",
      expectedCovers,
      requiredByRole,
      servicePeriods: restaurant.service_periods,
    });
  }

  return days;
}

/**
 * Rank candidate employees for a role+day.
 * Priority: available > matching role > contracted hours remaining > fewer days worked > full-time first
 */
function rankCandidates(
  role: EmployeeRole,
  day: DayDemand,
  states: Map<string, EmployeeState>,
  restaurant: Restaurant
): EmployeeState[] {
  const candidates: Array<{ state: EmployeeState; score: number }> = [];

  for (const [, state] of states) {
    const emp = state.employee;
    if (!emp.is_active) continue;
    if (state.daysAssigned.has(day.date)) continue; // Already working this day

    // Role must match (exact match or same department as fallback)
    const roleMatch = emp.role === role;
    const deptMatch = emp.department === getDepartmentForRole(role);
    if (!roleMatch && !deptMatch) continue;

    // Check availability — skip if explicitly unavailable on this day
    if (!isEmployeeAvailable(state, day)) continue;

    // Score: higher = better candidate
    let score = 0;

    // Exact role match is strongly preferred
    if (roleMatch) score += 1000;

    // Full-timers first, then part-timers, then casuals
    if (emp.employment_type === "full_time") score += 300;
    else if (emp.employment_type === "part_time") score += 200;
    else score += 100;

    // Prefer employees who still need hours to hit their contracted amount
    if (emp.contracted_hours_per_week) {
      const remaining = emp.contracted_hours_per_week - state.hoursAssigned;
      score += Math.max(0, remaining) * 10; // More remaining hours = higher priority
    }

    // Prefer employees with fewer days assigned (spread the work)
    score -= state.daysAssigned.size * 50;

    candidates.push({ state, score });
  }

  // Sort by score descending
  return candidates
    .sort((a, b) => b.score - a.score)
    .map((c) => c.state);
}

/**
 * Check if an employee is available on a given day.
 * If no availability is set, assume they're available (backwards compatible).
 */
function isEmployeeAvailable(state: EmployeeState, day: DayDemand): boolean {
  const avail = state.availability;

  // No availability set = available any day (default for employees without availability configured)
  if (!avail || avail.length === 0) return true;

  const slot = avail.find((a) => a.day_of_week === day.dayOfWeek);

  // No entry for this day = unavailable (if they have some availability set, missing days are off)
  if (!slot) return false;

  return slot.is_available;
}

/**
 * Get the available time window for an employee on a given day.
 * Returns null if unavailable, or the start/end times if available.
 */
function getEmployeeAvailableWindow(
  state: EmployeeState,
  day: DayDemand
): { start: string; end: string } | null {
  const avail = state.availability;

  if (!avail || avail.length === 0) return null; // No constraint

  const slot = avail.find((a) => a.day_of_week === day.dayOfWeek);
  if (!slot || !slot.is_available) return null;

  return { start: slot.start_time, end: slot.end_time };
}

/**
 * Calculate how many hours a shift should be for a given role on a day.
 */
function calculateDayShiftHours(
  day: DayDemand,
  role: EmployeeRole,
  restaurant: Restaurant
): number {
  const dept = getDepartmentForRole(role);

  // If there are service periods, assign to the longer one or split
  if (day.servicePeriods.length >= 2) {
    // For roles like manager/head_chef, cover both periods (full day)
    if (["manager", "assistant_manager", "head_chef"].includes(role)) {
      return calculateTimeSpan(day.openTime, day.closeTime);
    }
    // For other roles, assign to the busier period (dinner typically)
    // Default to dinner period
    const dinner = day.servicePeriods.find((p) => p.name.toLowerCase().includes("dinner"));
    const lunch = day.servicePeriods.find((p) => p.name.toLowerCase().includes("lunch"));

    if (dinner) {
      return calculateTimeSpan(dinner.start, dinner.end);
    }
    if (lunch) {
      return calculateTimeSpan(lunch.start, lunch.end);
    }
  }

  // Default: use opening hours
  return calculateTimeSpan(day.openTime, day.closeTime);
}

/**
 * Get shift start/end times for a role on a given day.
 */
function getShiftTimes(
  day: DayDemand,
  role: EmployeeRole,
  restaurant: Restaurant
): { start: string; end: string } {
  // Management roles: full day with prep time before opening
  if (["manager", "assistant_manager", "head_chef"].includes(role)) {
    const prepStart = subtractMinutes(day.openTime, 60); // 1 hour before opening
    return { start: prepStart, end: day.closeTime };
  }

  // BOH prep roles: start earlier
  if (["sous_chef", "prep_cook"].includes(role)) {
    const prepStart = subtractMinutes(day.openTime, 30);
    return { start: prepStart, end: day.closeTime };
  }

  // If two service periods exist, assign most staff to dinner
  if (day.servicePeriods.length >= 2) {
    const dinner = day.servicePeriods.find((p) => p.name.toLowerCase().includes("dinner"));
    if (dinner) {
      // FOH dinner staff: start 30 min before dinner service
      const start = subtractMinutes(dinner.start, 30);
      return { start, end: day.closeTime };
    }
  }

  // Default: match opening hours
  return { start: day.openTime, end: day.closeTime };
}

function wouldExceedHours(
  state: EmployeeState,
  additionalHours: number,
  restaurant: Restaurant
): boolean {
  const emp = state.employee;
  const newTotal = state.hoursAssigned + additionalHours;

  // Casual workers: soft cap at 38 hours/week
  if (emp.employment_type === "casual") {
    return newTotal > 38;
  }

  // Contracted workers: allow up to 120% of contracted hours to account for rounding
  if (emp.contracted_hours_per_week) {
    return newTotal > emp.contracted_hours_per_week * 1.2;
  }

  // Default: max 48 hours/week (EU baseline)
  return newTotal > 48;
}

function getDepartmentForRole(role: EmployeeRole): Department {
  const bohRoles: EmployeeRole[] = [
    "line_cook", "prep_cook", "sous_chef", "head_chef", "dishwasher",
  ];
  return bohRoles.includes(role) ? "boh" : "foh";
}

function calculateTimeSpan(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60; // Handle midnight crossover
  return mins / 60;
}

function subtractMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  let totalMins = h * 60 + m - minutes;
  if (totalMins < 0) totalMins += 24 * 60;
  const newH = Math.floor(totalMins / 60) % 24;
  const newM = totalMins % 60;
  return `${newH.toString().padStart(2, "0")}:${newM.toString().padStart(2, "0")}`;
}

/**
 * Convert time string to minutes since midnight.
 * Handles after-midnight times (00:00-04:59) as next-day.
 */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  const adjusted = h < 5 ? h + 24 : h;
  return adjusted * 60 + m;
}
