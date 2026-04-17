-- Migration 004: Add covers snapshot and booking alert to schedule_weeks
-- Run in Supabase SQL Editor (or your PostgreSQL instance)

ALTER TABLE schedule_weeks
  ADD COLUMN IF NOT EXISTS covers_snapshot JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS booking_alert JSONB DEFAULT NULL;

-- covers_snapshot: set at publish time
-- Format: { "2026-04-20": 45, "2026-04-21": 32, "2026-04-22": 0, ... }

-- booking_alert: set by sync when covers deviate from snapshot
-- Format: { "2026-04-20": { "at_publish": 45, "current": 58, "diff": 13 }, ... }
-- Cleared (set to NULL) when manager dismisses the alert
