-- Migration 003: Add leave type to time_off_requests
-- Run this in your Supabase SQL Editor

ALTER TABLE time_off_requests ADD COLUMN IF NOT EXISTS leave_type VARCHAR(20) DEFAULT 'time_off';

-- leave_type values: 'time_off', 'sick_leave', 'personal', 'holiday', 'other'

COMMENT ON COLUMN time_off_requests.leave_type IS 'Type of leave: time_off, sick_leave, personal, holiday, other';
