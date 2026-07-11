-- Run this in the Supabase SQL Editor to create the patients table.
-- Patients are stored here; letters remain in localStorage until the next migration.

CREATE TABLE IF NOT EXISTS patients (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at          timestamptz DEFAULT now() NOT NULL,
  updated_at          timestamptz DEFAULT now() NOT NULL,

  -- Patient identity
  full_name           text NOT NULL,
  patient_id_number   text,          -- National ID / passport — NOT the DB uuid

  -- Birthdate stored as separate text fields to match the form inputs
  birthdate_day       text,
  birthdate_month     text,
  birthdate_year      text,
  calculated_age      text,          -- Stored at creation time; recalculate on display

  -- Demographics
  gender              text,
  emails              jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{ value, label }], index 0 = primary
  phones              jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{ value, label }], index 0 = primary
  smoking_vaping      text,
  pets                text,
  occupation          text,
  referred_by         text,
  location            text,

  -- Ownership — links to the Supabase Auth user who created the record
  created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ── Row Level Security ─────────────────────────────────────────────────────────

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- Each user can only see and edit their own patients.

CREATE POLICY "insert_own_patients"
  ON patients FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "select_own_patients"
  ON patients FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "update_own_patients"
  ON patients FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "delete_own_patients"
  ON patients FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- ── Auto-update updated_at ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
