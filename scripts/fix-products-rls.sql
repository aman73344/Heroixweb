-- Run this in Supabase Dashboard > SQL Editor
-- This fixes RLS policies for the products table

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow public inserts" ON products;
DROP POLICY IF EXISTS "Allow public selects" ON products;
DROP POLICY IF EXISTS "Allow public updates" ON products;
DROP POLICY IF EXISTS "Allow public deletes" ON products;

-- Create policies to allow all operations
CREATE POLICY "Allow public inserts" ON products FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow public selects" ON products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow public updates" ON products FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "Allow public deletes" ON products FOR DELETE TO anon, authenticated USING (true);

-- Make sure the table is accessible
GRANT ALL ON products TO anon;
GRANT ALL ON products TO authenticated;
