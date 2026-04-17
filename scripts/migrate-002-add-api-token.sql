-- Migration 002: Add api_token and api_url to restaurants
-- Run this in your Supabase SQL Editor

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS api_token TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS api_url VARCHAR(255) DEFAULT 'https://app.tableo.com';
