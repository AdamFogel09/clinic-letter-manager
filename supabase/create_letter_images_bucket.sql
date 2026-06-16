-- Create the letter-images storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('letter-images', 'letter-images', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: authenticated users can upload images into their own folder
-- Path structure: {userId}/{letterId}/{imageId}.jpg
CREATE POLICY "Users can upload own letter images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'letter-images'
  AND name LIKE (auth.uid()::text || '/%')
);

-- RLS: authenticated users can read their own images
CREATE POLICY "Users can read own letter images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'letter-images'
  AND name LIKE (auth.uid()::text || '/%')
);

-- RLS: authenticated users can delete their own images
CREATE POLICY "Users can delete own letter images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'letter-images'
  AND name LIKE (auth.uid()::text || '/%')
);
