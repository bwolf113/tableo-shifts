/**
 * Staffing Calculator
 *
 * The core intelligence that makes Tableo Shifts unique:
 * Given reservation data from Tableo, calculates optimal staffing levels.
 *
 * Phase 1: Rules-based (covers-per-staff ratios)
 * Phase 2: Time-series forecasting from historical patterns
 */

import type {
  CoversPerStaff,
  StaffingStatus,
  StaffingSuggestion,
  ServicePeriod,
  Restaurant,
  Shift,
  EmployeeRole,
} from "@/types";
import {
  calculateExpectedCovers,
  groupBookingsByPeriod,
  type TableoBooking,
} from "@/lib/tableo-api";

interface StaffingInput {
  restaurant: Restaurant;
  date: string;
  bookings: TableoBooking[];
  currentShifts: Shift[];
}

interface StaffingResult {
  date: string;
  expectedCovers: number;
  coversByPeriod: Record<string, { covers: number; bookings: number }>;
  recommended: Record<string, number>;
  currentlyScheduled: Record<string, number>;
  status: StaffingStatus;
  suggestions: StaffingSuggestion[];
  projectedRevenue: number;
  projectedLaborCost: number;
  laborCostPct: number;
}

/**
 * Calculate recommended staffing for a given day based on Tableo booking data.
 */
export function calculateStaffing(input: StaffingInput): StaffingResult {
  const { restaurant, date, bookings, currentShifts } = input;

  // 1. Calculate expected covers (bookings - no-shows + walk-ins)
  const expectedCovers = calculateExpectedCovers(
    bookings,
    restaurant.noshow_factor_pct,
    restaurant.walkin_factor_pct
  );

  // 2. Break down by service period
  const coversByPeriod = groupBookingsByPeriod(
    bookings,
    restaurant.service_periods
  );

  // 3. Calculate recommended staff per role
  const recommended = calculateRecommendedStaff(
    expectedCovers,
    restaurant.covers_per_staff
  );

  // 4. Count currently scheduled staff per role
  const currentlyScheduled = countScheduledStaff(currentShifts);

  // 5. Determine overall staffing status
  const status = determineStaffingStatus(recommended, currentlyScheduled);

  // 6. Generate specific suggestions
  const suggestions = generateSuggestions(
    date,
    recommended,
    currentlyScheduled,
    expectedCovers,
    restaurant.service_periods
  );

  // 7. Financial projections
  const projectedRevenue = expectedCovers * restaurant.avg_spend_per_cover;
  const projectedLaborCost = calculateProjectedLaborCost(currentShifts);
  const laborCostPct =
    projectedRevenue > 0
      ? (projectedLaborCost / projectedRevenue) * 100
      : 0;

  return {
    date,
    expectedCovers,
    coversByPeriod,
    recommended,
    currentlyScheduled,
    status,
    suggestions,
    projectedRevenue,
    projectedLaborCost,
    laborCostPct,
  };
}

/**
 * Calculate recommended number of each role based on expected covers.
 */
function calculateRecommendedStaff(
  expectedCovers: number,
  ratios: CoversPerStaff
): Record<string, number> {
  const result: Record<string, number> = {};

  if (expectedCovers === 0) {
    // Restaurant is likely closed or no bookings - minimum skeleton crew
    return result;
  }

  for (const [role, coversPerPerson] of Object.entries(ratios)) {
    if (coversPerPerson > 0) {
      const needed = Math.ceil(expectedCovers / coversPerPerson);
      // Minimum 1 of each role if there are any covers
      result[role] = Math.max(1, needed);
    }
  }

  return result;
}

/**
 * Count currently scheduled staff grouped by role.
 */
function countScheduledStaff(shifts: Shift[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const shift of shifts) {
    if (shift.employee_id && !shift.is_training) {
      counts[shift.role] = (counts[shift.role] || 0) + 1;
    }
  }

  return counts;
}

/**
 * Determine overall staffing status by comparing recommended vs scheduled.
 */
function determineStaffingStatus(
  recommended: Record<string, number>,
  scheduled: Record<string, number>
): StaffingStatus {
  const allRoles = new Set([
    ...Object.keys(recommended),
    ...Object.keys(scheduled),
  ]);

  let totalRecommended = 0;
  let totalScheduled = 0;

  for (const role of allRoles) {
    totalRecommended += recommended[role] || 0;
    totalScheduled += scheduled[role] || 0;
  }

  if (totalRecommended === 0) return "unknown";

  const ratio = totalScheduled / totalRecommended;

  if (ratio < 0.85) return "understaffed";
  if (ratio > 1.15) return "overstaffed";
  return "optimal";
}

/**
 * Generate actionable staffing suggestions.
 */
function generateSuggestions(
  date: string,
  recommended: Record<string, number>,
  scheduled: Record<string, number>,
  expectedCovers: number,
  servicePeriods: ServicePeriod[]
): StaffingSuggestion[] {
  const suggestions: StaffingSuggestion[] = [];
  const period =
    servicePeriods.length > 0 ? servicePeriods[0].name : "Service";

  for (const [role, needed] of Object.entries(recommended)) {
    const current = scheduled[role] || 0;
    const diff = needed - current;

    if (diff > 0) {
      suggestions.push({
        date,
        period,
        expectedCovers,
        role,
        currentStaffed: current,
        recommended: needed,
        status: "understaffed",
        message: `Need ${diff} more ${formatRole(role)}${diff > 1 ? "s" : ""} for ${expectedCovers} expected covers`,
      });
    } else if (diff < -1) {
      // Only flag overstaffing if it's more than 1 extra (allow some buffer)
      suggestions.push({
        date,
        period,
        expectedCovers,
        role,
        currentStaffed: current,
        recommended: needed,
        status: "overstaffed",
        message: `${Math.abs(diff)} extra ${formatRole(role)}${Math.abs(diff) > 1 ? "s" : ""} scheduled for ${expectedCovers} expected covers`,
      });
    }
  }

  return suggestions;
}

/**
 * Calculate total labor cost for a set of shifts.
 */
function calculateProjectedLaborCost(shifts: Shift[]): number {
  return shifts.reduce((sum, shift) => sum + shift.estimated_cost, 0);
}

/**
 * Format role names for display.
 */
function formatRole(role: string): string {
  const labels: Record<string, string> = {
    server: "Server",
    bartender: "Bartender",
    host: "Host",
    runner: "Runner",
    busser: "Busser",
    line_cook: "Line Cook",
    prep_cook: "Prep Cook",
    sous_chef: "Sous Chef",
    head_chef: "Head Chef",
    dishwasher: "Dishwasher",
    manager: "Manager",
    assistant_manager: "Assistant Manager",
    barista: "Barista",
    sommelier: "Sommelier",
    other: "Staff",
  };

  return labels[role] || role;
}

/**
 * Calculate shift duration in hours (accounting for break).
 */
export function calculateShiftHours(
  startTime: string,
  endTime: string,
  breakMinutes: number
): number {
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);

  let totalMinutes = endH * 60 + endM - (startH * 60 + startM);
  // Handle overnight shifts (e.g., 22:00 - 02:00)
  if (totalMinutes < 0) totalMinutes += 24 * 60;

  return Math.max(0, (totalMinutes - breakMinutes) / 60);
}

/**
 * Calculate estimated cost for a shift.
 */
export function calculateShiftCost(
  hours: number,
  hourlyRate: number
): number {
  return Math.round(hours * hourlyRate * 100) / 100;
}
