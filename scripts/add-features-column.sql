-- Optional admin product fields (run ONCE in the Supabase SQL Editor):
--   features -> "Product Features" bullet list on the product page
--   variants -> "Variants / Designs" (colors/designs) - optional, not every
--               keychain has multiple designs
-- https://supabase.com/dashboard -> SQL Editor -> paste -> Run

ALTER TABLE products ADD COLUMN IF NOT EXISTS features TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE products ADD COLUMN IF NOT EXISTS variants TEXT[] DEFAULT ARRAY[]::TEXT[];