/**
 * Database query functions.
 *
 * All Supabase queries are isolated here so swapping to MySQL
 * in production only requires changing this file.
 */

import { getDb } from "./db";
import type {
  Restaurant,
  Employee,
  EmployeeAvailability,
  ScheduleWeek,
  Shift,
  TimeOffRequest,
  ShiftTemplate,
  DailyStaffingData,
  ComplianceProfile,
  Notification,
} from "@/types";

// =====================================================
// RESTAURANTS
// =====================================================

export async function getRestaurantByTableoId(
  tableoRestaurantId: number
): Promise<Restaurant | null> {
  const { data, error } = await getDb()
    .from("restaurants")
    .select("*")
    .eq("tableo_restaurant_id", tableoRestaurantId)
    .single();

  if (error || !data) return null;
  return data as Restaurant;
}

export async function getRestaurantBySlug(
  slug: string
): Promise<Restaurant | null> {
  const { data, error } = await getDb()
    .from("restaurants")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !data) return null;
  return data as Restaurant;
}

/**
 * Get restaurant for the current session.
 * Tries slug first, then falls back to numeric Tableo ID.
 */
export async function getRestaurantForSession(session: {
  restaurantSlug?: string;
  restaurantId?: number;
}): Promise<Restaurant | null> {
  if (session.restaurantSlug) {
    const r = await getRestaurantBySlug(session.restaurantSlug);
    if (r) return r;
  }
  if (session.restaurantId) {
    return getRestaurantByTableoId(session.restaurantId);
  }
  return null;
}

export async function getRestaurantById(id: string): Promise<Restaurant | null> {
  const { data, error } = await getDb()
    .from("restaurants")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as Restaurant;
}

export async function upsertRestaurant(
  restaurant: Partial<Restaurant> & { tableo_restaurant_id: number }
): Promise<Restaurant> {
  const { data, error } = await getDb()
    .from("restaurants")
    .upsert(
      { ...restaurant, updated_at: new Date().toISOString() },
      { onConflict: "tableo_restaurant_id" }
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to upsert restaurant: ${error.message}`);
  return data as Restaurant;
}

export async function updateRestaurant(
  id: string,
  updates: Partial<Restaurant>
): Promise<Restaurant> {
  const { data, error } = await getDb()
    .from("restaurants")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update restaurant: ${error.message}`);
  return data as Restaurant;
}

// =====================================================
// EMPLOYEES
// =====================================================

export async function getEmployees(
  restaurantId: string,
  activeOnly: boolean = true
): Promise<Employee[]> {
  let query = getDb()
    .from("employees")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("first_name");

  if (activeOnly) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to get employees: ${error.message}`);
  return (data || []) as Employee[];
}

export async function getEmployeeById(id: string): Promise<Employee | null> {
  const { data, error } = await getDb()
    .from("employees")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as Employee;
}

export async function createEmployee(
  employee: Omit<Employee, "id" | "created_at" | "updated_at">
): Promise<Employee> {
  const { data, error } = await getDb()
    .from("employees")
    .insert(employee)
    .select()
    .single();

  if (error) throw new Error(`Failed to create employee: ${error.message}`);
  return data as Employee;
}

export async function updateEmployee(
  id: string,
  updates: Partial<Employee>
): Promise<Employee> {
  const { data, error } = await getDb()
    .from("employees")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update employee: ${error.message}`);
  return data as Employee;
}

export async function deleteEmployee(id: string): Promise<void> {
  const { error } = await getDb().from("employees").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete employee: ${error.message}`);
}

// =====================================================
// EMPLOYEE AVAILABILITY
// =====================================================

export async function getEmployeeAvailability(
  employeeId: string
): Promise<EmployeeAvailability[]> {
  const { data, error } = await getDb()
    .from("employee_availability")
    .select("*")
    .eq("employee_id", employeeId)
    .order("day_of_week");

  if (error) throw new Error(`Failed to get availability: ${error.message}`);
  return (data || []) as EmployeeAvailability[];
}

export async function setEmployeeAvailability(
  employeeId: string,
  availability: Omit<EmployeeAvailability, "id" | "created_at">[]
): Promise<void> {
  // Replace all availability for this employee
  const { error: deleteError } = await getDb()
    .from("employee_availability")
    .delete()
    .eq("employee_id", employeeId);
  if (deleteError) throw new Error(`Failed to clear availability: ${deleteError.message}`);

  if (availability.length > 0) {
    const { error: insertError } = await getDb()
      .from("employee_availability")
      .insert(availability);
    if (insertError) throw new Error(`Failed to set availability: ${insertError.message}`);
  }
}

// =====================================================
// SCHEDULE WEEKS
// =====================================================

export async function getScheduleWeek(
  restaurantId: string,
  weekStart: string
): Promise<ScheduleWeek | null> {
  const { data, error } = await getDb()
    .from("schedule_weeks")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("week_start", weekStart)
    .single();

  if (error || !data) return null;
  return data as ScheduleWeek;
}

export async function getOrCreateScheduleWeek(
  restaurantId: string,
  weekStart: string
): Promise<ScheduleWeek> {
  const existing = await getScheduleWeek(restaurantId, weekStart);
  if (existing) return existing;

  const { data, error } = await getDb()
    .from("schedule_weeks")
    .insert({ restaurant_id: restaurantId, week_start: weekStart })
    .select()
    .single();

  if (error) throw new Error(`Failed to create schedule week: ${error.message}`);
  return data as ScheduleWeek;
}

export async function publishScheduleWeek(
  id: string,
  publishedBy?: string,
  coversSnapshot?: Record<string, number>
): Promise<ScheduleWeek> {
  const updates: Record<string, unknown> = {
    status: "published",
    published_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    booking_alert: null, // clear any previous alert on re-publish
  };
  if (publishedBy && publishedBy.includes("-")) {
    updates.published_by = publishedBy;
  }
  if (coversSnapshot) {
    updates.covers_snapshot = coversSnapshot;
  }

  const { data, error } = await getDb()
    .from("schedule_weeks")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to publish schedule: ${error.message}`);
  return data as ScheduleWeek;
}

export async function updateScheduleWeekAlert(
  id: string,
  bookingAlert: Record<string, { at_publish: number; current: number; diff: number }> | null,
  coversSnapshot?: Record<string, number>
): Promise<void> {
  const updates: Record<string, unknown> = {
    booking_alert: bookingAlert,
    updated_at: new Date().toISOString(),
  };
  if (coversSnapshot !== undefined) {
    updates.covers_snapshot = coversSnapshot;
  }
  const { error } = await getDb()
    .from("schedule_weeks")
    .update(updates)
    .eq("id", id);
  if (error) throw new Error(`Failed to update schedule alert: ${error.message}`);
}

// =====================================================
// SHIFTS
// =====================================================

export async function getShiftsForWeek(
  scheduleWeekId: string
): Promise<Shift[]> {
  const { data, error } = await getDb()
    .from("shifts")
    .select("*, employee:employees(*)")
    .eq("schedule_week_id", scheduleWeekId)
    .order("date")
    .order("start_time");

  if (error) throw new Error(`Failed to get shifts: ${error.message}`);
  return (data || []) as Shift[];
}

export async function getShiftsForDate(
  restaurantId: string,
  date: string
): Promise<Shift[]> {
  const { data, error } = await getDb()
    .from("shifts")
    .select("*, employee:employees(*)")
    .eq("restaurant_id", restaurantId)
    .eq("date", date)
    .order("start_time");

  if (error) throw new Error(`Failed to get shifts: ${error.message}`);
  return (data || []) as Shift[];
}

export async function getShiftsForEmployee(
  employeeId: string,
  startDate: string,
  endDate: string
): Promise<Shift[]> {
  const { data, error } = await getDb()
    .from("shifts")
    .select("*")
    .eq("employee_id", employeeId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date")
    .order("start_time");

  if (error) throw new Error(`Failed to get employee shifts: ${error.message}`);
  return (data || []) as Shift[];
}

export async function getShiftsForRestaurantRange(
  restaurantId: string,
  startDate: string,
  endDate: string
): Promise<Shift[]> {
  const { data, error } = await getDb()
    .from("shifts")
    .select("*, employee:employees(id, first_name, last_name, role, color)")
    .eq("restaurant_id", restaurantId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date")
    .order("start_time");

  if (error) throw new Error(`Failed to get restaurant shifts: ${error.message}`);
  return (data || []) as Shift[];
}

export async function createShift(
  shift: Omit<Shift, "id" | "created_at" | "updated_at" | "employee">
): Promise<Shift> {
  const { data, error } = await getDb()
    .from("shifts")
    .insert(shift)
    .select()
    .single();

  if (error) throw new Error(`Failed to create shift: ${error.message}`);
  return data as Shift;
}

export async function updateShift(
  id: string,
  updates: Partial<Shift>
): Promise<Shift> {
  const { data, error } = await getDb()
    .from("shifts")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update shift: ${error.message}`);
  return data as Shift;
}

export async function deleteShift(id: string): Promise<void> {
  const { error } = await getDb().from("shifts").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete shift: ${error.message}`);
}

// =====================================================
// TIME-OFF REQUESTS
// =====================================================

export async function getTimeOffRequests(
  restaurantId: string,
  status?: string
): Promise<TimeOffRequest[]> {
  let query = getDb()
    .from("time_off_requests")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("start_date");

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to get time-off requests: ${error.message}`);
  return (data || []) as TimeOffRequest[];
}

export async function createTimeOffRequest(
  request: Omit<TimeOffRequest, "id" | "created_at">
): Promise<TimeOffRequest> {
  const { data, error } = await getDb()
    .from("time_off_requests")
    .insert(request)
    .select()
    .single();

  if (error) throw new Error(`Failed to create time-off request: ${error.message}`);
  return data as TimeOffRequest;
}

export async function reviewTimeOffRequest(
  id: string,
  status: "approved" | "denied",
  reviewedBy?: string,
  note?: string
): Promise<TimeOffRequest> {
  const updates: Record<string, unknown> = {
    status,
    reviewed_at: new Date().toISOString(),
    review_note: note || null,
  };
  if (reviewedBy) {
    updates.reviewed_by = reviewedBy;
  }

  const { data, error } = await getDb()
    .from("time_off_requests")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to review time-off request: ${error.message}`);
  return data as TimeOffRequest;
}

// =====================================================
// DAILY STAFFING DATA
// =====================================================

export async function upsertDailyStaffingData(
  data: Omit<DailyStaffingData, "id" | "created_at" | "updated_at">
): Promise<DailyStaffingData> {
  const { data: result, error } = await getDb()
    .from("daily_staffing_data")
    .upsert(
      {
        ...data,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "restaurant_id,date" }
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to upsert staffing data: ${error.message}`);
  return result as DailyStaffingData;
}

export async function getDailyStaffingData(
  restaurantId: string,
  startDate: string,
  endDate: string
): Promise<DailyStaffingData[]> {
  const { data, error } = await getDb()
    .from("daily_staffing_data")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date");

  if (error) throw new Error(`Failed to get staffing data: ${error.message}`);
  return (data || []) as DailyStaffingData[];
}

// =====================================================
// COMPLIANCE PROFILES
// =====================================================

export async function getComplianceProfile(
  id: string
): Promise<ComplianceProfile | null> {
  const { data, error } = await getDb()
    .from("compliance_profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as ComplianceProfile;
}

export async function getDefaultComplianceProfile(
  countryCode: string,
  stateCode?: string
): Promise<ComplianceProfile | null> {
  let query = getDb()
    .from("compliance_profiles")
    .select("*")
    .eq("country_code", countryCode)
    .eq("is_default", true);

  if (stateCode) {
    query = query.eq("state_code", stateCode);
  }

  const { data, error } = await query.limit(1).single();
  if (error || !data) return null;
  return data as ComplianceProfile;
}

// =====================================================
// SHIFT TEMPLATES
// =====================================================

export async function getShiftTemplates(
  restaurantId: string
): Promise<ShiftTemplate[]> {
  const { data, error } = await getDb()
    .from("shift_templates")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("name");

  if (error) throw new Error(`Failed to get templates: ${error.message}`);
  return (data || []) as ShiftTemplate[];
}

// =====================================================
// NOTIFICATIONS
// =====================================================

export async function createNotification(
  notification: Omit<Notification, "id" | "created_at" | "is_read" | "read_at">
): Promise<void> {
  const { error } = await getDb()
    .from("notifications")
    .insert(notification);
  if (error) throw new Error(`Failed to create notification: ${error.message}`);
}

export async function getUnreadNotifications(
  employeeId: string
): Promise<Notification[]> {
  const { data, error } = await getDb()
    .from("notifications")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("is_read", false)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(`Failed to get notifications: ${error.message}`);
  return (data || []) as Notification[];
}
