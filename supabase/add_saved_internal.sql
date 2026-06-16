-- Run this in the Supabase SQL Editor to add saved_internal support.
-- Safe to run multiple times (uses IF NOT EXISTS / column existence checks).

DO $$
BEGIN
  -- Track when a letter was saved internally (not sent to patient)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'letters' AND column_name = 'saved_internal_at'
  ) THEN
    ALTER TABLE letters ADD COLUMN saved_internal_at TIMESTAMPTZ;
    RAISE NOTICE 'Added saved_internal_at column.';
  ELSE
    RAISE NOTICE 'saved_internal_at already exists.';
  END IF;

  -- Track which letter this was duplicated from (set by duplicateLetter()).
  -- ON DELETE SET NULL: if the source is deleted first, this silently clears.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'letters' AND column_name = 'source_letter_id'
  ) THEN
    ALTER TABLE letters ADD COLUMN source_letter_id UUID REFERENCES letters(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added source_letter_id column.';
  ELSE
    RAISE NOTICE 'source_letter_id already exists.';
  END IF;
END $$;
