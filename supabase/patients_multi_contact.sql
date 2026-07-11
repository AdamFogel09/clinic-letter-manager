-- Run this in the Supabase SQL Editor.
-- Replaces the single `email`/`phone` text columns with ordered jsonb lists of
-- { value, label } entries. Index 0 is always the primary contact.

ALTER TABLE patients ADD COLUMN emails jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE patients ADD COLUMN phones jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE patients SET emails = jsonb_build_array(jsonb_build_object('value', email, 'label', ''))
  WHERE email IS NOT NULL AND email <> '';
UPDATE patients SET phones = jsonb_build_array(jsonb_build_object('value', phone, 'label', ''))
  WHERE phone IS NOT NULL AND phone <> '';

ALTER TABLE patients DROP COLUMN email;
ALTER TABLE patients DROP COLUMN phone;
