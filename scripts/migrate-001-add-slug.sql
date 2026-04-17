-- Migration 001: Add slug column to restaurants
-- Run this in your Supabase SQL Editor

-- 1. Add slug column
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS slug VARCHAR(255);

-- 2. Make tableo_restaurant_id nullable (slug is now the primary identifier)
ALTER TABLE restaurants ALTER COLUMN tableo_restaurant_id DROP NOT NULL;

-- 3. Backfill any existing restaurants with a slug from their name
UPDATE restaurants
SET slug = LOWER(REPLACE(REPLACE(name, ' ', '-'), '''', ''))
WHERE slug IS NULL;

-- 4. Make slug NOT NULL and UNIQUE
ALTER TABLE restaurants ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurants_slug ON restaurants(slug);
