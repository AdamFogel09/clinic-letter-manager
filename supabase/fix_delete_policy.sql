-- Run this in Supabase SQL Editor if the Delete button on All Letters page
-- shows a permissions error. This adds the DELETE policy if it doesn't exist.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'letters' AND policyname = 'delete_own_letters'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "delete_own_letters"
        ON letters FOR DELETE
        TO authenticated
        USING (created_by = auth.uid());
    $policy$;
    RAISE NOTICE 'DELETE policy created.';
  ELSE
    RAISE NOTICE 'DELETE policy already exists — no action needed.';
  END IF;
END $$;
