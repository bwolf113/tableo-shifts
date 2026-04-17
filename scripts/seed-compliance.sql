-- =====================================================
-- Compliance Profiles Seed Data
-- =====================================================
-- Default profiles for major jurisdictions.
-- These represent statutory minimums; restaurants can customize.
-- =====================================================

-- EU DEFAULT (Working Time Directive baseline)
INSERT INTO compliance_profiles (id, country_code, state_code, name, max_weekly_hours, standard_weekly_hours, weekly_hours_averaging_period_weeks, max_daily_hours, overtime_daily_threshold, overtime_weekly_threshold, overtime_rate_1, overtime_rate_2, min_rest_between_shifts_hours, min_weekly_rest_hours, max_consecutive_days, break_required_after_hours, break_duration_minutes, break_is_paid, night_start_time, night_end_time, max_night_hours_per_day, penalty_rates, is_default)
VALUES (gen_random_uuid(), 'EU', NULL, 'European Union (Default)', 48, 40, 17, NULL, NULL, 40, 1.50, 2.00, 11, 24, 6, 6, 30, false, '23:00', '06:00', 8, '{}', true);

-- UNITED KINGDOM
INSERT INTO compliance_profiles (id, country_code, state_code, name, max_weekly_hours, standard_weekly_hours, weekly_hours_averaging_period_weeks, max_daily_hours, overtime_daily_threshold, overtime_weekly_threshold, overtime_rate_1, min_rest_between_shifts_hours, min_weekly_rest_hours, max_consecutive_days, break_required_after_hours, break_duration_minutes, break_is_paid, night_start_time, night_end_time, max_night_hours_per_day, minor_max_daily_hours, minor_max_weekly_hours, minor_prohibited_hours_start, minor_prohibited_hours_end, penalty_rates, is_default)
VALUES (gen_random_uuid(), 'GB', NULL, 'United Kingdom', 48, 40, 17, NULL, NULL, 40, 1.50, 11, 24, 6, 6, 20, false, '23:00', '06:00', 8, 8, 40, '22:00', '06:00', '{}', true);

-- FRANCE (Hospitality - HCR convention)
INSERT INTO compliance_profiles (id, country_code, state_code, name, max_weekly_hours, standard_weekly_hours, weekly_hours_averaging_period_weeks, max_daily_hours, overtime_daily_threshold, overtime_weekly_threshold, overtime_rate_1, overtime_rate_2, overtime_daily_threshold_2, min_rest_between_shifts_hours, min_weekly_rest_hours, max_consecutive_days, break_required_after_hours, break_duration_minutes, break_is_paid, night_start_time, night_end_time, max_night_hours_per_day, part_time_min_weekly_hours, annual_overtime_cap_hours, penalty_rates, is_default)
VALUES (gen_random_uuid(), 'FR', NULL, 'France (Hospitality HCR)', 48, 35, 12, 10, NULL, 35, 1.25, 1.50, NULL, 9, 24, 6, 6, 20, false, '22:00', '07:00', 8, 24, 220, '{}', true);

-- GERMANY
INSERT INTO compliance_profiles (id, country_code, state_code, name, max_weekly_hours, standard_weekly_hours, weekly_hours_averaging_period_weeks, max_daily_hours, overtime_daily_threshold, overtime_weekly_threshold, overtime_rate_1, min_rest_between_shifts_hours, min_weekly_rest_hours, max_consecutive_days, break_required_after_hours, break_duration_minutes, break_is_paid, night_start_time, night_end_time, max_night_hours_per_day, penalty_rates, is_default)
VALUES (gen_random_uuid(), 'DE', NULL, 'Germany (Hospitality)', 48, 40, 24, 10, NULL, 40, 1.25, 10, 24, 6, 6, 30, false, '23:00', '06:00', 8, '{"sunday": 1.25, "night": 1.25}', true);

-- SPAIN
INSERT INTO compliance_profiles (id, country_code, state_code, name, max_weekly_hours, standard_weekly_hours, max_daily_hours, overtime_weekly_threshold, overtime_rate_1, min_rest_between_shifts_hours, min_weekly_rest_hours, max_consecutive_days, break_required_after_hours, break_duration_minutes, night_start_time, night_end_time, max_night_hours_per_day, annual_overtime_cap_hours, penalty_rates, is_default)
VALUES (gen_random_uuid(), 'ES', NULL, 'Spain', 40, 40, 9, 40, 1.75, 12, 36, 6, 6, 15, '22:00', '06:00', 8, 80, '{"night": 1.25}', true);

-- ITALY (Hospitality CCNL Turismo)
INSERT INTO compliance_profiles (id, country_code, state_code, name, max_weekly_hours, standard_weekly_hours, weekly_hours_averaging_period_weeks, max_daily_hours, overtime_weekly_threshold, overtime_rate_1, overtime_rate_2, min_rest_between_shifts_hours, min_weekly_rest_hours, max_consecutive_days, break_required_after_hours, break_duration_minutes, night_start_time, night_end_time, annual_overtime_cap_hours, penalty_rates, is_default)
VALUES (gen_random_uuid(), 'IT', NULL, 'Italy (Hospitality CCNL)', 48, 40, 16, NULL, 40, 1.30, 1.40, 11, 24, 6, 6, 10, '00:00', '05:00', 260, '{"night": 1.60, "public_holiday": 1.55}', true);

-- NETHERLANDS (Hospitality Horeca CAO)
INSERT INTO compliance_profiles (id, country_code, state_code, name, max_weekly_hours, standard_weekly_hours, weekly_hours_averaging_period_weeks, max_daily_hours, overtime_weekly_threshold, overtime_rate_1, min_rest_between_shifts_hours, min_weekly_rest_hours, max_consecutive_days, break_required_after_hours, break_duration_minutes, night_start_time, night_end_time, casual_min_shift_hours, schedule_advance_notice_days, penalty_rates, is_default)
VALUES (gen_random_uuid(), 'NL', NULL, 'Netherlands (Horeca)', 60, 40, 16, 12, 40, 1.25, 11, 36, 6, 5.5, 30, '00:00', '06:00', 3, 4, '{"sunday": 1.35}', true);

-- PORTUGAL
INSERT INTO compliance_profiles (id, country_code, state_code, name, max_weekly_hours, standard_weekly_hours, max_daily_hours, overtime_weekly_threshold, overtime_rate_1, overtime_rate_2, min_rest_between_shifts_hours, min_weekly_rest_hours, break_required_after_hours, break_duration_minutes, night_start_time, night_end_time, annual_overtime_cap_hours, penalty_rates, is_default)
VALUES (gen_random_uuid(), 'PT', NULL, 'Portugal', 40, 40, 8, 40, 1.25, 1.375, 11, 24, 5, 30, '22:00', '07:00', 150, '{"night": 1.25, "public_holiday": 1.50}', true);

-- MALTA
INSERT INTO compliance_profiles (id, country_code, state_code, name, max_weekly_hours, standard_weekly_hours, weekly_hours_averaging_period_weeks, overtime_weekly_threshold, overtime_rate_1, min_rest_between_shifts_hours, min_weekly_rest_hours, max_consecutive_days, break_required_after_hours, break_duration_minutes, night_start_time, night_end_time, penalty_rates, is_default)
VALUES (gen_random_uuid(), 'MT', NULL, 'Malta', 48, 40, 17, 40, 1.50, 11, 24, 6, 6, 30, '23:00', '06:00', '{"sunday": 2.00, "public_holiday": 2.00}', true);

-- IRELAND
INSERT INTO compliance_profiles (id, country_code, state_code, name, max_weekly_hours, standard_weekly_hours, weekly_hours_averaging_period_weeks, overtime_weekly_threshold, overtime_rate_1, min_rest_between_shifts_hours, min_weekly_rest_hours, max_consecutive_days, break_required_after_hours, break_duration_minutes, night_start_time, night_end_time, penalty_rates, is_default)
VALUES (gen_random_uuid(), 'IE', NULL, 'Ireland', 48, 40, 24, 40, 1.50, 11, 24, 6, 4.5, 15, '00:00', '07:00', '{"sunday": 1.25}', true);

-- SWEDEN (Hospitality HRF)
INSERT INTO compliance_profiles (id, country_code, state_code, name, max_weekly_hours, standard_weekly_hours, overtime_weekly_threshold, overtime_rate_1, min_rest_between_shifts_hours, min_weekly_rest_hours, max_consecutive_days, break_required_after_hours, break_duration_minutes, night_start_time, night_end_time, annual_overtime_cap_hours, penalty_rates, is_default)
VALUES (gen_random_uuid(), 'SE', NULL, 'Sweden (Hospitality)', 48, 40, 40, 1.50, 11, 36, 6, 5, 30, '22:00', '06:00', 200, '{"saturday": 1.50, "sunday": 2.00}', true);

-- USA FEDERAL
INSERT INTO compliance_profiles (id, country_code, state_code, name, max_weekly_hours, standard_weekly_hours, max_daily_hours, overtime_daily_threshold, overtime_weekly_threshold, overtime_rate_1, min_rest_between_shifts_hours, min_weekly_rest_hours, max_consecutive_days, break_required_after_hours, break_duration_minutes, minor_max_daily_hours, minor_max_weekly_hours, minor_prohibited_hours_start, minor_prohibited_hours_end, penalty_rates, is_default)
VALUES (gen_random_uuid(), 'US', NULL, 'United States (Federal)', 168, 40, NULL, NULL, 40, 1.50, 0, 0, 7, 0, 0, 8, 40, '19:00', '07:00', '{}', true);

-- USA - CALIFORNIA
INSERT INTO compliance_profiles (id, country_code, state_code, name, max_weekly_hours, standard_weekly_hours, max_daily_hours, overtime_daily_threshold, overtime_weekly_threshold, overtime_rate_1, overtime_rate_2, overtime_daily_threshold_2, min_rest_between_shifts_hours, break_required_after_hours, break_duration_minutes, penalty_rates, schedule_advance_notice_days, is_default)
VALUES (gen_random_uuid(), 'US', 'CA', 'United States - California', 168, 40, NULL, 8, 40, 1.50, 2.00, 12, 0, 5, 30, '{}', NULL, true);

-- USA - NEW YORK
INSERT INTO compliance_profiles (id, country_code, state_code, name, max_weekly_hours, standard_weekly_hours, overtime_weekly_threshold, overtime_rate_1, min_rest_between_shifts_hours, break_required_after_hours, break_duration_minutes, penalty_rates, is_default)
VALUES (gen_random_uuid(), 'US', 'NY', 'United States - New York', 168, 40, 40, 1.50, 0, 6, 30, '{}', true);

-- USA - NEW YORK CITY (Fast Food / Hospitality - Fair Workweek)
INSERT INTO compliance_profiles (id, country_code, state_code, city_code, name, max_weekly_hours, standard_weekly_hours, overtime_weekly_threshold, overtime_rate_1, min_rest_between_shifts_hours, break_required_after_hours, break_duration_minutes, schedule_advance_notice_days, schedule_change_premium_hours, penalty_rates, is_default)
VALUES (gen_random_uuid(), 'US', 'NY', 'NYC', 'United States - NYC (Fair Workweek)', 168, 40, 40, 1.50, 11, 6, 30, 14, 1, '{}', false);

-- USA - OREGON
INSERT INTO compliance_profiles (id, country_code, state_code, name, max_weekly_hours, standard_weekly_hours, overtime_weekly_threshold, overtime_rate_1, min_rest_between_shifts_hours, break_required_after_hours, break_duration_minutes, schedule_advance_notice_days, penalty_rates, is_default)
VALUES (gen_random_uuid(), 'US', 'OR', 'United States - Oregon', 168, 40, 40, 1.50, 10, 6, 30, 14, '{}', true);

-- CANADA - ONTARIO
INSERT INTO compliance_profiles (id, country_code, state_code, name, max_weekly_hours, standard_weekly_hours, overtime_weekly_threshold, overtime_rate_1, min_rest_between_shifts_hours, min_weekly_rest_hours, break_required_after_hours, break_duration_minutes, casual_min_shift_hours, penalty_rates, is_default)
VALUES (gen_random_uuid(), 'CA', 'ON', 'Canada - Ontario', 48, 44, 44, 1.50, 11, 24, 5, 30, 3, '{}', true);

-- CANADA - BRITISH COLUMBIA
INSERT INTO compliance_profiles (id, country_code, state_code, name, max_weekly_hours, standard_weekly_hours, overtime_daily_threshold, overtime_weekly_threshold, overtime_rate_1, overtime_rate_2, overtime_daily_threshold_2, min_rest_between_shifts_hours, min_weekly_rest_hours, break_required_after_hours, break_duration_minutes, casual_min_shift_hours, penalty_rates, is_default)
VALUES (gen_random_uuid(), 'CA', 'BC', 'Canada - British Columbia', 168, 40, 8, 40, 1.50, 2.00, 12, 8, 32, 5, 30, 2, '{}', true);

-- CANADA - QUEBEC
INSERT INTO compliance_profiles (id, country_code, state_code, name, max_weekly_hours, standard_weekly_hours, overtime_weekly_threshold, overtime_rate_1, min_weekly_rest_hours, break_required_after_hours, break_duration_minutes, casual_min_shift_hours, penalty_rates, is_default)
VALUES (gen_random_uuid(), 'CA', 'QC', 'Canada - Quebec', 168, 40, 40, 1.50, 32, 5, 30, 3, '{}', true);

-- AUSTRALIA (Hospitality Award)
INSERT INTO compliance_profiles (id, country_code, state_code, name, max_weekly_hours, standard_weekly_hours, max_daily_hours, overtime_weekly_threshold, overtime_rate_1, overtime_rate_2, min_rest_between_shifts_hours, min_weekly_rest_hours, max_consecutive_days, break_required_after_hours, break_duration_minutes, casual_min_shift_hours, schedule_advance_notice_days, penalty_rates, is_default)
VALUES (gen_random_uuid(), 'AU', NULL, 'Australia (Hospitality Award)', 38, 38, 11.5, 38, 1.50, 2.00, 10, 24, 5, 6, 30, 3, 7, '{"saturday": 1.25, "sunday": 1.50, "public_holiday": 2.25, "evening": 1.15}', true);

-- MEXICO
INSERT INTO compliance_profiles (id, country_code, state_code, name, max_weekly_hours, standard_weekly_hours, max_daily_hours, overtime_weekly_threshold, overtime_rate_1, overtime_rate_2, min_weekly_rest_hours, break_required_after_hours, break_duration_minutes, night_start_time, night_end_time, minor_max_daily_hours, minor_max_weekly_hours, penalty_rates, is_default)
VALUES (gen_random_uuid(), 'MX', NULL, 'Mexico', 48, 48, 8, 48, 2.00, 3.00, 24, 0, 30, '20:00', '06:00', 6, 36, '{"sunday": 1.25, "public_holiday": 2.00, "night": 1.20}', true);

-- BRAZIL
INSERT INTO compliance_profiles (id, country_code, state_code, name, max_weekly_hours, standard_weekly_hours, max_daily_hours, overtime_weekly_threshold, overtime_rate_1, min_rest_between_shifts_hours, min_weekly_rest_hours, break_required_after_hours, break_duration_minutes, night_start_time, night_end_time, penalty_rates, is_default)
VALUES (gen_random_uuid(), 'BR', NULL, 'Brazil', 44, 44, 8, 44, 1.50, 11, 24, 6, 60, '22:00', '05:00', '{"sunday": 2.00, "public_holiday": 2.00, "night": 1.20}', true);

-- ARGENTINA
INSERT INTO compliance_profiles (id, country_code, state_code, name, max_weekly_hours, standard_weekly_hours, max_daily_hours, overtime_weekly_threshold, overtime_rate_1, overtime_rate_2, min_rest_between_shifts_hours, min_weekly_rest_hours, max_consecutive_days, night_start_time, night_end_time, penalty_rates, annual_overtime_cap_hours, is_default)
VALUES (gen_random_uuid(), 'AR', NULL, 'Argentina', 48, 48, 8, 48, 1.50, 2.00, 12, 35, 6, '21:00', '06:00', '{"saturday_afternoon": 2.00, "sunday": 2.00, "public_holiday": 2.00}', 200, true);

-- COLOMBIA
INSERT INTO compliance_profiles (id, country_code, state_code, name, max_weekly_hours, standard_weekly_hours, max_daily_hours, overtime_weekly_threshold, overtime_rate_1, min_weekly_rest_hours, break_required_after_hours, break_duration_minutes, night_start_time, night_end_time, penalty_rates, is_default)
VALUES (gen_random_uuid(), 'CO', NULL, 'Colombia', 42, 42, 8, 42, 1.25, 24, 0, 60, '21:00', '06:00', '{"night": 1.35, "sunday": 1.75, "public_holiday": 1.75}', true);
