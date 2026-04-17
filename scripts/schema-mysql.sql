-- =====================================================
-- Tableo Shifts - MySQL Production Schema
-- =====================================================
-- This is the MySQL-compatible version of schema.sql
-- Import this into your production MySQL database
-- =====================================================

-- =====================================================
-- 1. RESTAURANTS
-- =====================================================
CREATE TABLE IF NOT EXISTS restaurants (
  id CHAR(36) PRIMARY KEY,
  tableo_restaurant_id INT UNIQUE,
  slug VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  timezone VARCHAR(100) NOT NULL DEFAULT 'Europe/London',
  country_code VARCHAR(3) NOT NULL DEFAULT 'MT',
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',

  opening_hours JSON NOT NULL,
  service_periods JSON NOT NULL,
  covers_per_staff JSON NOT NULL,

  avg_spend_per_cover DECIMAL(10,2) DEFAULT 45.00,
  target_labor_cost_pct DECIMAL(5,2) DEFAULT 30.00,
  walkin_factor_pct DECIMAL(5,2) DEFAULT 20.00,
  noshow_factor_pct DECIMAL(5,2) DEFAULT 10.00,

  compliance_profile_id CHAR(36),

  plan_status ENUM('trial', 'active', 'expired', 'cancelled') NOT NULL DEFAULT 'trial',
  trial_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  trial_ends_at TIMESTAMP NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_restaurants_tableo_id (tableo_restaurant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 2. COMPLIANCE PROFILES
-- =====================================================
CREATE TABLE IF NOT EXISTS compliance_profiles (
  id CHAR(36) PRIMARY KEY,
  country_code VARCHAR(3) NOT NULL,
  state_code VARCHAR(10),
  city_code VARCHAR(50),
  name VARCHAR(255) NOT NULL,

  max_weekly_hours DECIMAL(5,2) NOT NULL DEFAULT 48,
  standard_weekly_hours DECIMAL(5,2) NOT NULL DEFAULT 40,
  weekly_hours_averaging_period_weeks INT DEFAULT 1,

  max_daily_hours DECIMAL(5,2) DEFAULT NULL,

  overtime_daily_threshold DECIMAL(5,2) DEFAULT NULL,
  overtime_weekly_threshold DECIMAL(5,2) DEFAULT 40,
  overtime_rate_1 DECIMAL(4,2) DEFAULT 1.50,
  overtime_rate_2 DECIMAL(4,2) DEFAULT 2.00,
  overtime_daily_threshold_2 DECIMAL(5,2) DEFAULT NULL,

  min_rest_between_shifts_hours DECIMAL(4,2) DEFAULT 11,
  min_weekly_rest_hours DECIMAL(5,2) DEFAULT 24,
  max_consecutive_days INT DEFAULT 6,

  break_required_after_hours DECIMAL(4,2) DEFAULT 6,
  break_duration_minutes INT DEFAULT 30,
  break_is_paid TINYINT(1) DEFAULT 0,

  night_start_time VARCHAR(5) DEFAULT '23:00',
  night_end_time VARCHAR(5) DEFAULT '06:00',
  max_night_hours_per_day DECIMAL(4,2) DEFAULT 8,

  casual_min_shift_hours DECIMAL(4,2) DEFAULT NULL,
  part_time_min_weekly_hours DECIMAL(5,2) DEFAULT NULL,

  schedule_advance_notice_days INT DEFAULT NULL,
  schedule_change_premium_hours DECIMAL(4,2) DEFAULT NULL,

  penalty_rates JSON,
  annual_overtime_cap_hours DECIMAL(6,2) DEFAULT NULL,

  minor_max_daily_hours DECIMAL(4,2) DEFAULT 8,
  minor_max_weekly_hours DECIMAL(5,2) DEFAULT 40,
  minor_prohibited_hours_start VARCHAR(5) DEFAULT '22:00',
  minor_prohibited_hours_end VARCHAR(5) DEFAULT '06:00',

  is_default TINYINT(1) DEFAULT 0,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_compliance_country (country_code),
  INDEX idx_compliance_country_state (country_code, state_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 3. EMPLOYEES
-- =====================================================
CREATE TABLE IF NOT EXISTS employees (
  id CHAR(36) PRIMARY KEY,
  restaurant_id CHAR(36) NOT NULL,

  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),

  role ENUM('server','bartender','host','runner','busser','line_cook','prep_cook','sous_chef','head_chef','dishwasher','manager','assistant_manager','barista','sommelier','other') NOT NULL,
  department ENUM('foh','boh') NOT NULL,

  employment_type ENUM('full_time','part_time','casual') NOT NULL,
  contracted_hours_per_week DECIMAL(5,2),
  hourly_rate DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',

  skills JSON,
  dining_area_ids JSON,

  start_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  end_date DATE,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_minor TINYINT(1) NOT NULL DEFAULT 0,

  color VARCHAR(7) DEFAULT '#3B82F6',

  invite_token VARCHAR(255),
  invite_sent_at TIMESTAMP NULL,
  portal_password_hash VARCHAR(255),
  last_login_at TIMESTAMP NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_employees_restaurant (restaurant_id),
  INDEX idx_employees_role (restaurant_id, role),
  INDEX idx_employees_active (restaurant_id, is_active),
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 4. EMPLOYEE AVAILABILITY
-- =====================================================
CREATE TABLE IF NOT EXISTS employee_availability (
  id CHAR(36) PRIMARY KEY,
  employee_id CHAR(36) NOT NULL,

  day_of_week TINYINT NOT NULL,
  start_time VARCHAR(5) NOT NULL,
  end_time VARCHAR(5) NOT NULL,
  is_available TINYINT(1) NOT NULL DEFAULT 1,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_availability_employee (employee_id),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 5. TIME-OFF REQUESTS
-- =====================================================
CREATE TABLE IF NOT EXISTS time_off_requests (
  id CHAR(36) PRIMARY KEY,
  employee_id CHAR(36) NOT NULL,
  restaurant_id CHAR(36) NOT NULL,

  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,

  status ENUM('pending','approved','denied') NOT NULL DEFAULT 'pending',
  reviewed_by CHAR(36),
  reviewed_at TIMESTAMP NULL,
  review_note TEXT,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_timeoff_employee (employee_id),
  INDEX idx_timeoff_restaurant_dates (restaurant_id, start_date, end_date),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 6. SCHEDULE WEEKS
-- =====================================================
CREATE TABLE IF NOT EXISTS schedule_weeks (
  id CHAR(36) PRIMARY KEY,
  restaurant_id CHAR(36) NOT NULL,

  week_start DATE NOT NULL,
  status ENUM('draft','published') NOT NULL DEFAULT 'draft',
  published_at TIMESTAMP NULL,
  published_by CHAR(36),

  total_scheduled_hours DECIMAL(8,2) DEFAULT 0,
  total_labor_cost DECIMAL(10,2) DEFAULT 0,

  notes TEXT,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_restaurant_week (restaurant_id, week_start),
  INDEX idx_schedule_weeks_restaurant (restaurant_id, week_start),
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 7. SHIFTS
-- =====================================================
CREATE TABLE IF NOT EXISTS shifts (
  id CHAR(36) PRIMARY KEY,
  schedule_week_id CHAR(36) NOT NULL,
  restaurant_id CHAR(36) NOT NULL,
  employee_id CHAR(36),

  date DATE NOT NULL,
  start_time VARCHAR(5) NOT NULL,
  end_time VARCHAR(5) NOT NULL,

  role ENUM('server','bartender','host','runner','busser','line_cook','prep_cook','sous_chef','head_chef','dishwasher','manager','assistant_manager','barista','sommelier','other') NOT NULL,
  department ENUM('foh','boh') NOT NULL,

  break_minutes INT NOT NULL DEFAULT 0,

  dining_area_id INT,
  section_label VARCHAR(100),

  is_training TINYINT(1) NOT NULL DEFAULT 0,
  is_open TINYINT(1) NOT NULL DEFAULT 0,

  notes TEXT,

  scheduled_hours DECIMAL(5,2) NOT NULL DEFAULT 0,
  estimated_cost DECIMAL(10,2) NOT NULL DEFAULT 0,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_shifts_schedule (schedule_week_id),
  INDEX idx_shifts_employee (employee_id),
  INDEX idx_shifts_restaurant_date (restaurant_id, date),
  FOREIGN KEY (schedule_week_id) REFERENCES schedule_weeks(id) ON DELETE CASCADE,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 8. SHIFT SWAP REQUESTS
-- =====================================================
CREATE TABLE IF NOT EXISTS shift_swap_requests (
  id CHAR(36) PRIMARY KEY,
  shift_id CHAR(36) NOT NULL,
  requesting_employee_id CHAR(36) NOT NULL,
  target_employee_id CHAR(36),

  status ENUM('pending','approved','denied','cancelled') NOT NULL DEFAULT 'pending',
  reviewed_by CHAR(36),
  reviewed_at TIMESTAMP NULL,

  message TEXT,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_swaps_shift (shift_id),
  FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
  FOREIGN KEY (requesting_employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 9. SHIFT TEMPLATES
-- =====================================================
CREATE TABLE IF NOT EXISTS shift_templates (
  id CHAR(36) PRIMARY KEY,
  restaurant_id CHAR(36) NOT NULL,

  name VARCHAR(255) NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,

  template_shifts JSON NOT NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_templates_restaurant (restaurant_id),
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 10. DAILY STAFFING SNAPSHOTS
-- =====================================================
CREATE TABLE IF NOT EXISTS daily_staffing_data (
  id CHAR(36) PRIMARY KEY,
  restaurant_id CHAR(36) NOT NULL,

  date DATE NOT NULL,

  booked_covers INT NOT NULL DEFAULT 0,
  booking_count INT NOT NULL DEFAULT 0,

  covers_by_period JSON,
  recommended_staff JSON,
  scheduled_staff JSON,

  staffing_status ENUM('understaffed','optimal','overstaffed','unknown') DEFAULT 'unknown',

  last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_restaurant_date (restaurant_id, date),
  INDEX idx_staffing_data_restaurant_date (restaurant_id, date),
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- 11. NOTIFICATIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
  id CHAR(36) PRIMARY KEY,
  restaurant_id CHAR(36) NOT NULL,
  employee_id CHAR(36),

  type ENUM(
    'schedule_published','shift_assigned','shift_changed','shift_cancelled',
    'swap_requested','swap_approved','swap_denied',
    'timeoff_approved','timeoff_denied',
    'open_shift_available','staffing_alert','compliance_warning',
    'large_booking_alert'
  ) NOT NULL,

  title VARCHAR(255) NOT NULL,
  body TEXT,
  data JSON,

  is_read TINYINT(1) NOT NULL DEFAULT 0,
  read_at TIMESTAMP NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_notifications_employee (employee_id, is_read),
  INDEX idx_notifications_restaurant (restaurant_id, created_at),
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- FK: restaurants -> compliance_profiles
-- =====================================================
ALTER TABLE restaurants
  ADD CONSTRAINT fk_restaurant_compliance
  FOREIGN KEY (compliance_profile_id)
  REFERENCES compliance_profiles(id)
  ON DELETE SET NULL;
