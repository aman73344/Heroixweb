-- Run this in Supabase Dashboard > SQL Editor

-- Allow anyone to upload files to the products bucket
CREATE POLICY "Allow public uploads" ON storage.objects
FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id = 'products');

-- Allow anyone to view files in the products bucket
CREATE POLICY "Allow public viewing" ON storage.objects
FOR SELECT TO anon, authenticated
USING (bucket_id = 'products');

-- Allow anyone to delete files in the products bucket
CREATE POLICY "Allow public delete" ON storage.objects
FOR DELETE TO anon, authenticated
USING (bucket_id = 'products');

-- Allow anyone to update files in the products bucket
CREATE POLICY "Allow public update" ON storage.objects
FOR UPDATE TO anon, authenticated
USING (bucket_id = 'products');
