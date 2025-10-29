-- Create storage bucket for demanda attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'demanda-attachments',
  'demanda-attachments',
  true,
  20971520, -- 20MB
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'text/plain',
    'text/csv',
    'text/markdown'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for demanda-attachments bucket
CREATE POLICY "Users can upload files to their org projects"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'demanda-attachments' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM projects
    WHERE organization_id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    )
  )
);

CREATE POLICY "Users can read files from their org projects"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'demanda-attachments' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM projects
    WHERE organization_id IN (
      SELECT organization_id FROM user_profiles WHERE id = auth.uid()
    )
  )
);

CREATE POLICY "Public can read files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'demanda-attachments');