-- Run this in the Supabase SQL Editor to enable Row Level Security on the letters table.
-- Letters are now the primary source of truth for saved drafts.
-- Each user can only see and edit their own letters.

-- ── Row Level Security ─────────────────────────────────────────────────────────

ALTER TABLE letters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insert_own_letters"
  ON letters FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "select_own_letters"
  ON letters FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "update_own_letters"
  ON letters FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "delete_own_letters"
  ON letters FOR DELETE
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

CREATE TRIGGER letters_updated_at
  BEFORE UPDATE ON letters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
