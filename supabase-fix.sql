-- Fix RLS policies for orders table
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard -> SQL Editor)

-- Option 1: Disable RLS entirely (easiest)
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;

-- Option 2: If you want to keep RLS but allow public access, use these policies instead:
-- Allow INSERT
-- CREATE POLICY "Allow anonymous inserts" ON orders FOR INSERT TO anon WITH CHECK (true);

-- Allow SELECT
-- CREATE POLICY "Allow anonymous select" ON orders FOR SELECT TO anon USING (true);

-- Allow UPDATE
-- CREATE POLICY "Allow anonymous update" ON orders FOR UPDATE TO anon USING (true);

-- Allow DELETE
-- CREATE POLICY "Allow anonymous delete" ON orders FOR DELETE TO anon USING (true);
