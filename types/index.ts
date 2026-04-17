// =====================================================
// Tableo Shifts - Core Types
// =====================================================

// --- Enums ---

export type EmployeeRole =
  | "server" | "bartender" | "host" | "runner" | "busser"
  | "line_cook" | "prep_cook" | "sous_chef" | "head_chef" | "dishwasher"
  | "manager" | "assistant_manager" | "barista" | "sommelier" | "other";

export type Department = "foh" | "boh";

export type EmploymentType = "full_time" | "part_time" | "casual";

export type ShiftStatus = "draft" | "published";

export type TimeOffStatus = "pending" | "approved" | "denied";

export type LeaveType = "time_off" | "sick_leave" | "personal" | "holiday" | "other";

export type SwapStatus = "pending" | "approved" | "denied" | "cancelled";

export type StaffingStatus = "understaffed" | "optimal" | "overstaffed" | "unknown";

export type PlanStatus = "trial" | "active" | "expired" | "cancelled";

export type NotificationType =
  | "schedule_published" | "shift_assigned" | "shift_changed" | "shift_cancelled"
  | "swap_requested" | "swap_approved" | "swap_denied"
  | "timeoff_approved" | "timeoff_denied"
  | "open_shift_available" | "staffing_alert" | "compliance_warning"
  | "large_booking_alert";

// --- Data structures ---

export interface OpeningHoursPeriod {
  day: number;       // 0 = Sunday, 6 = Saturday
  open: string;      // "HH:MM"
  close: string;     // "HH:MM"
  closed: boolean;
}

export interface ServicePeriod {
  name: string;      // "Lunch", "Dinner"
  start: string;     // "12:00"
  end: string;       // "15:00"
}

export interface CoversPerStaff {
  server: number;
  bartender: number;
  line_cook: number;
  host: number;
  runner: number;
  dishwasher: number;
  [key: string]: number;
}

export interface PenaltyRates {
  saturday?: number;
  sunday?: number;
  public_holiday?: number;
  evening?: number;
  night?: number;
}

// --- Database Models ---

export interface Restaurant {
  id: string;
  tableo_restaurant_id: number | null;
  slug: string;
  name: string;
  api_token: string | null;
  api_url: string;
  timezone: string;
  country_code: string;
  currency: string;
  opening_hours: OpeningHoursPeriod[];
  service_periods: ServicePeriod[];
  covers_per_staff: CoversPerStaff;
  avg_spend_per_cover: number;
  target_labor_cost_pct: number;
  walkin_factor_pct: number;
  noshow_factor_pct: number;
  compliance_profile_id: string | null;
  plan_status: PlanStatus;
  trial_started_at: string;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: string;
  restaurant_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  role: EmployeeRole;
  department: Department;
  employment_type: EmploymentType;
  contracted_hours_per_week: number | null;
  hourly_rate: number;
  currency: string;
  skills: string[];
  dining_area_ids: number[];
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  is_minor: boolean;
  color: string;
  invite_token: string | null;
  invite_sent_at: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeAvailability {
  id: string;
  employee_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

export interface TimeOffRequest {
  id: string;
  employee_id: string;
  restaurant_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: TimeOffStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
}

export interface ScheduleWeek {
  id: string;
  restaurant_id: string;
  week_start: string;
  status: ShiftStatus;
  published_at: string | null;
  published_by: string | null;
  total_scheduled_hours: number;
  total_labor_cost: number;
  notes: string | null;
  /** Covers per day at time of publish. { "2026-04-20": 45, "2026-04-21": 32, ... } */
  covers_snapshot: Record<string, number> | null;
  /** Set by sync when covers change post-publish. { "2026-04-20": { at_publish: 45, current: 58, diff: 13 } } */
  booking_alert: Record<string, { at_publish: number; current: number; diff: number }> | null;
  created_at: string;
  updated_at: string;
}

export interface Shift {
  id: string;
  schedule_week_id: string;
  restaurant_id: string;
  employee_id: string | null;
  date: string;
  start_time: string;
  end_time: string;
  role: EmployeeRole;
  department: Department;
  break_minutes: number;
  dining_area_id: number | null;
  section_label: string | null;
  is_training: boolean;
  is_open: boolean;
  notes: string | null;
  scheduled_hours: number;
  estimated_cost: number;
  created_at: string;
  updated_at: string;
  // Joined fields
  employee?: Employee;
}

export interface ShiftSwapRequest {
  id: string;
  shift_id: string;
  requesting_employee_id: string;
  target_employee_id: string | null;
  status: SwapStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  message: string | null;
  created_at: string;
}

export interface ShiftTemplate {
  id: string;
  restaurant_id: string;
  name: string;
  is_default: boolean;
  template_shifts: TemplateShift[];
  created_at: string;
  updated_at: string;
}

export interface TemplateShift {
  day_of_week: number;
  start_time: string;
  end_time: string;
  role: EmployeeRole;
  department: Department;
  count: number;  // how many of this shift to create
}

export interface DailyStaffingData {
  id: string;
  restaurant_id: string;
  date: string;
  booked_covers: number;
  booking_count: number;
  covers_by_period: Record<string, { covers: number; bookings: number }>;
  recommended_staff: Record<string, number>;
  scheduled_staff: Record<string, number>;
  staffing_status: StaffingStatus;
  last_synced_at: string;
}

export interface ComplianceProfile {
  id: string;
  country_code: string;
  state_code: string | null;
  city_code: string | null;
  name: string;
  max_weekly_hours: number;
  standard_weekly_hours: number;
  weekly_hours_averaging_period_weeks: number;
  max_daily_hours: number | null;
  overtime_daily_threshold: number | null;
  overtime_weekly_threshold: number;
  overtime_rate_1: number;
  overtime_rate_2: number;
  overtime_daily_threshold_2: number | null;
  min_rest_between_shifts_hours: number;
  min_weekly_rest_hours: number;
  max_consecutive_days: number;
  break_required_after_hours: number;
  break_duration_minutes: number;
  break_is_paid: boolean;
  night_start_time: string;
  night_end_time: string;
  max_night_hours_per_day: number;
  casual_min_shift_hours: number | null;
  part_time_min_weekly_hours: number | null;
  schedule_advance_notice_days: number | null;
  schedule_change_premium_hours: number | null;
  penalty_rates: PenaltyRates;
  annual_overtime_cap_hours: number | null;
  minor_max_daily_hours: number;
  minor_max_weekly_hours: number;
  minor_prohibited_hours_start: string;
  minor_prohibited_hours_end: string;
  is_default: boolean;
}

export interface Notification {
  id: string;
  restaurant_id: string;
  employee_id: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

// --- UI / Computed Types ---

export interface DaySchedule {
  date: string;
  dayOfWeek: number;
  isClosed: boolean;
  shifts: Shift[];
  staffingData: DailyStaffingData | null;
}

export interface WeekSchedule {
  scheduleWeek: ScheduleWeek;
  days: DaySchedule[];
  totalHours: number;
  totalCost: number;
}

export interface StaffingSuggestion {
  date: string;
  period: string;
  expectedCovers: number;
  role: string;
  currentStaffed: number;
  recommended: number;
  status: StaffingStatus;
  message: string;
}

export interface ComplianceViolation {
  type: "max_hours" | "min_rest" | "consecutive_days" | "overtime" | "minor_hours" | "break_missing" | "night_hours" | "clopening";
  severity: "error" | "warning";
  employeeId: string;
  employeeName: string;
  message: string;
  details: Record<string, unknown>;
}
