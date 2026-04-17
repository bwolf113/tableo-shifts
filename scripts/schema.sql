-- =====================================================
-- Tableo Shifts - Database Schema
-- =====================================================
-- Designed for Supabase (PostgreSQL) in development
-- MySQL-compatible version in schema-mysql.sql
-- =====================================================

-- =====================================================
-- 1. RESTAURANTS (linked to Tableo core platform)
-- =====================================================
CREATE TABLE IF NOT EXISTS restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tableo_restaurant_id INTEGER UNIQUE,
  slug VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  timezone VARCHAR(100) NOT NULL DEFAULT 'Europe/London',
  country_code VARCHAR(3) NOT NULL DEFAULT 'MT',
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',

  -- Opening hours from Tableo (cached, synced via webhook/API)
  -- Format: [{ day: 0-6, open: "HH:MM", close: "HH:MM", closed: boolean }]
  opening_hours JSONB NOT NULL DEFAULT '[]',

  -- Service periods (e.g., lunch 12-15, dinner 18-23)
  -- Format: [{ name: "Lunch", start: "12:00", end: "15:00" }, ...]
  service_periods JSONB NOT NULL DEFAULT '[]',

  -- Staffing configuration
  -- Covers-per-staff ratios by role
  -- Format: { "server": 15, "bartender": 25, "line_cook": 35, "host": 50, "runner": 20, "dishwasher": 60 }
  covers_per_staff JSONB NOT NULL DEFAULT '{"server": 15, "bartender": 25, "line_cook": 35, "host": 50, "runner": 20, "dishwasher": 60}',

  -- Average spend per cover (for labor cost % calculations)
  avg_spend_per_cover DECIMAL(10,2) DEFAULT 45.00,

  -- Target labor cost as % of revenue
  target_labor_cost_pct DECIMAL(5,2) DEFAULT 30.00,

  -- Walk-in factor: estimated walk-ins as % of booked covers
  walkin_factor_pct DECIMAL(5,2) DEFAULT 20.00,

  -- No-show factor: estimated no-shows as % of booked covers
  noshow_factor_pct DECIMAL(5,2) DEFAULT 10.00,

  -- Compliance jurisdiction
  compliance_profile_id UUID,

  -- Subscription
  plan_status VARCHAR(20) NOT NULL DEFAULT 'trial' CHECK (plan_status IN ('trial', 'active', 'expired', 'cancelled')),
  trial_started_at TIMESTAMPTZ DEFAULT NOW(),
  trial_ends_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 2. COMPLIANCE PROFILES (labor law rules per jurisdiction)
-- =====================================================
CREATE TABLE IF NOT EXISTS compliance_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(3) NOT NULL,
  state_code VARCHAR(10),       -- e.g., 'CA', 'NSW', 'ON'
  city_code VARCHAR(50),        -- e.g., 'NYC', 'SF' for local ordinances
  name VARCHAR(255) NOT NULL,   -- e.g., 'United States - California'

  -- Weekly hours
  max_weekly_hours DECIMAL(5,2) NOT NULL DEFAULT 48,
  standard_weekly_hours DECIMAL(5,2) NOT NULL DEFAULT 40,
  weekly_hours_averaging_period_weeks INTEGER DEFAULT 1,

  -- Daily hours
  max_daily_hours DECIMAL(5,2) DEFAULT NULL,  -- NULL = no daily limit (e.g., US federal)

  -- Overtime thresholds
  overtime_daily_threshold DECIMAL(5,2) DEFAULT NULL,   -- e.g., 8 for California
  overtime_weekly_threshold DECIMAL(5,2) DEFAULT 40,
  overtime_rate_1 DECIMAL(4,2) DEFAULT 1.50,           -- e.g., 1.5x
  overtime_rate_2 DECIMAL(4,2) DEFAULT 2.00,           -- e.g., 2x (CA >12h/day)
  overtime_daily_threshold_2 DECIMAL(5,2) DEFAULT NULL, -- e.g., 12 for California

  -- Rest periods
  min_rest_between_shifts_hours DECIMAL(4,2) DEFAULT 11,   -- EU: 11h, AU: 10h
  min_weekly_rest_hours DECIMAL(5,2) DEFAULT 24,
  max_consecutive_days INTEGER DEFAULT 6,

  -- Breaks
  break_required_after_hours DECIMAL(4,2) DEFAULT 6,
  break_duration_minutes INTEGER DEFAULT 30,
  break_is_paid BOOLEAN DEFAULT FALSE,

  -- Night work
  night_start_time VARCHAR(5) DEFAULT '23:00',
  night_end_time VARCHAR(5) DEFAULT '06:00',
  max_night_hours_per_day DECIMAL(4,2) DEFAULT 8,

  -- Casual/part-time
  casual_min_shift_hours DECIMAL(4,2) DEFAULT NULL,  -- e.g., 3 for Australia
  part_time_min_weekly_hours DECIMAL(5,2) DEFAULT NULL,  -- e.g., 24 for France

  -- Predictive scheduling
  schedule_advance_notice_days INTEGER DEFAULT NULL,  -- e.g., 14 for NYC/Oregon
  schedule_change_premium_hours DECIMAL(4,2) DEFAULT NULL,

  -- Penalty rates (JSON for flexible structure)
  -- Format: { "saturday": 1.25, "sunday": 1.50, "public_holiday": 2.25, "evening": 1.15, "night": 1.25 }
  penalty_rates JSONB DEFAULT '{}',

  -- Annual overtime cap
  annual_overtime_cap_hours DECIMAL(6,2) DEFAULT NULL,  -- e.g., 220 for France, 80 for Spain

  -- Minor worker rules
  minor_max_daily_hours DECIMAL(4,2) DEFAULT 8,
  minor_max_weekly_hours DECIMAL(5,2) DEFAULT 40,
  minor_prohibited_hours_start VARCHAR(5) DEFAULT '22:00',
  minor_prohibited_hours_end VARCHAR(5) DEFAULT '06:00',

  is_default BOOLEAN DEFAULT FALSE,  -- default profile for a country

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_compliance_country ON compliance_profiles(country_code);
CREATE INDEX idx_compliance_country_state ON compliance_profiles(country_code, state_code);

-- =====================================================
-- 3. EMPLOYEES
-- =====================================================
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,

  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),

  -- Role & department
  role VARCHAR(50) NOT NULL CHECK (role IN (
    'server', 'bartender', 'host', 'runner', 'busser',
    'line_cook', 'prep_cook', 'sous_chef', 'head_chef', 'dishwasher',
    'manager', 'assistant_manager', 'barista', 'sommelier', 'other'
  )),
  department VARCHAR(10) NOT NULL CHECK (department IN ('foh', 'boh')),

  -- Employment details
  employment_type VARCHAR(20) NOT NULL CHECK (employment_type IN ('full_time', 'part_time', 'casual')),
  contracted_hours_per_week DECIMAL(5,2),  -- NULL for casual workers
  hourly_rate DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',

  -- Skills/qualifications (for smart scheduling)
  -- Format: ["bar_trained", "espresso", "wine_service", "pos_trained", "first_aid"]
  skills JSONB DEFAULT '[]',

  -- Can work in which dining areas (from Tableo floor plan)
  -- Format: [1, 2, 5] (dining area IDs from Tableo)
  dining_area_ids JSONB DEFAULT '[]',

  -- Dates
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,  -- NULL = still employed
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_minor BOOLEAN NOT NULL DEFAULT FALSE,

  -- Profile
  color VARCHAR(7) DEFAULT '#3B82F6',  -- for calendar display

  -- Auth (optional - for staff portal access)
  invite_token VARCHAR(255),
  invite_sent_at TIMESTAMPTZ,
  portal_password_hash VARCHAR(255),
  last_login_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_employees_restaurant ON employees(restaurant_id);
CREATE INDEX idx_employees_role ON employees(restaurant_id, role);
CREATE INDEX idx_employees_active ON employees(restaurant_id, is_active);

-- =====================================================
-- 4. EMPLOYEE AVAILABILITY (recurring weekly pattern)
-- =====================================================
CREATE TABLE IF NOT EXISTS employee_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
  start_time VARCHAR(5) NOT NULL,  -- "09:00"
  end_time VARCHAR(5) NOT NULL,    -- "17:00"
  is_available BOOLEAN NOT NULL DEFAULT TRUE,  -- false = explicitly unavailable

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_availability_employee ON employee_availability(employee_id);

-- =====================================================
-- 5. TIME-OFF REQUESTS
-- =====================================================
CREATE TABLE IF NOT EXISTS time_off_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,

  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,

  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  reviewed_by UUID REFERENCES employees(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_timeoff_employee ON time_off_requests(employee_id);
CREATE INDEX idx_timeoff_restaurant_dates ON time_off_requests(restaurant_id, start_date, end_date);

-- =====================================================
-- 6. SCHEDULE WEEKS (publishing unit)
-- =====================================================
CREATE TABLE IF NOT EXISTS schedule_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,

  -- Week starts on Monday (ISO standard)
  week_start DATE NOT NULL,

  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES employees(id),

  -- Cached labor cost for the week
  total_scheduled_hours DECIMAL(8,2) DEFAULT 0,
  total_labor_cost DECIMAL(10,2) DEFAULT 0,

  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(restaurant_id, week_start)
);

CREATE INDEX idx_schedule_weeks_restaurant ON schedule_weeks(restaurant_id, week_start);

-- =====================================================
-- 7. SHIFTS (the core scheduling unit)
-- =====================================================
CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_week_id UUID NOT NULL REFERENCES schedule_weeks(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,  -- NULL = open shift

  -- When
  date DATE NOT NULL,
  start_time VARCHAR(5) NOT NULL,  -- "17:00"
  end_time VARCHAR(5) NOT NULL,    -- "23:00"

  -- What role is this shift for
  role VARCHAR(50) NOT NULL,
  department VARCHAR(10) NOT NULL CHECK (department IN ('foh', 'boh')),

  -- Break (auto-calculated from compliance, editable)
  break_minutes INTEGER NOT NULL DEFAULT 0,

  -- Section assignment (Phase 2 - links to Tableo dining areas)
  dining_area_id INTEGER,  -- from Tableo floor plan
  section_label VARCHAR(100),  -- e.g., "Patio - Tables 7-12"

  -- Shift properties
  is_training BOOLEAN NOT NULL DEFAULT FALSE,
  is_open BOOLEAN NOT NULL DEFAULT FALSE,       -- open for claiming

  -- Notes visible to staff
  notes TEXT,

  -- Computed fields (cached for performance)
  scheduled_hours DECIMAL(5,2) NOT NULL DEFAULT 0,  -- end - start - break
  estimated_cost DECIMAL(10,2) NOT NULL DEFAULT 0,   -- hours * hourly_rate

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shifts_schedule ON shifts(schedule_week_id);
CREATE INDEX idx_shifts_employee ON shifts(employee_id);
CREATE INDEX idx_shifts_restaurant_date ON shifts(restaurant_id, date);
CREATE INDEX idx_shifts_open ON shifts(restaurant_id, is_open) WHERE is_open = TRUE;

-- =====================================================
-- 8. SHIFT SWAP REQUESTS
-- =====================================================
CREATE TABLE IF NOT EXISTS shift_swap_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  requesting_employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  target_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,  -- NULL = open to anyone

  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')),
  reviewed_by UUID REFERENCES employees(id),
  reviewed_at TIMESTAMPTZ,

  message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_swaps_shift ON shift_swap_requests(shift_id);

-- =====================================================
-- 9. SHIFT TEMPLATES (reusable weekly patterns)
-- =====================================================
CREATE TABLE IF NOT EXISTS shift_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,  -- e.g., "Standard Week", "Summer Schedule", "Christmas"
  is_default BOOLEAN NOT NULL DEFAULT FALSE,

  -- Template shifts stored as JSON array
  -- Format: [{ day_of_week: 0-6, start_time: "17:00", end_time: "23:00", role: "server", department: "foh", count: 3 }]
  template_shifts JSONB NOT NULL DEFAULT '[]',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_templates_restaurant ON shift_templates(restaurant_id);

-- =====================================================
-- 10. DAILY STAFFING SNAPSHOTS (cached from Tableo API)
-- =====================================================
CREATE TABLE IF NOT EXISTS daily_staffing_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,

  date DATE NOT NULL,

  -- Booking data from Tableo (refreshed periodically)
  booked_covers INTEGER NOT NULL DEFAULT 0,
  booking_count INTEGER NOT NULL DEFAULT 0,

  -- Per-service-period breakdown
  -- Format: { "Lunch": { "covers": 45, "bookings": 12 }, "Dinner": { "covers": 95, "bookings": 28 } }
  covers_by_period JSONB DEFAULT '{}',

  -- Computed staffing recommendations
  -- Format: { "server": 5, "bartender": 2, "line_cook": 3, "host": 1, "runner": 2, "dishwasher": 1 }
  recommended_staff JSONB DEFAULT '{}',

  -- Actual scheduled (for comparison)
  scheduled_staff JSONB DEFAULT '{}',

  -- Staffing status
  staffing_status VARCHAR(20) DEFAULT 'unknown' CHECK (staffing_status IN ('understaffed', 'optimal', 'overstaffed', 'unknown')),

  last_synced_at TIMESTAMPTZ DEFAULT NOW(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(restaurant_id, date)
);

CREATE INDEX idx_staffing_data_restaurant_date ON daily_staffing_data(restaurant_id, date);

-- =====================================================
-- 11. NOTIFICATIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,  -- NULL = restaurant-wide

  type VARCHAR(50) NOT NULL CHECK (type IN (
    'schedule_published', 'shift_assigned', 'shift_changed', 'shift_cancelled',
    'swap_requested', 'swap_approved', 'swap_denied',
    'timeoff_approved', 'timeoff_denied',
    'open_shift_available', 'staffing_alert', 'compliance_warning',
    'large_booking_alert'
  )),

  title VARCHAR(255) NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}',  -- type-specific payload

  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_employee ON notifications(employee_id, is_read);
CREATE INDEX idx_notifications_restaurant ON notifications(restaurant_id, created_at);

-- =====================================================
-- FK: Link restaurants to compliance profiles
-- =====================================================
ALTER TABLE restaurants
  ADD CONSTRAINT fk_restaurant_compliance
  FOREIGN KEY (compliance_profile_id)
  REFERENCES compliance_profiles(id)
  ON DELETE SET NULL;
