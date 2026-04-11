-- Run this in Supabase Dashboard > SQL Editor

-- Add a column to store multiple image URLs as text
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Update existing products to put their single image in the array
UPDATE products SET image_urls = ARRAY[image] WHERE image_urls IS NULL OR array_length(image_urls, 1) IS NULL;
