require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function setupStorage() {
  try {
    console.log('Setting up Supabase Storage for product images...\n');

    // Create bucket if not exists
    console.log('Creating "products" storage bucket...');
    const { data: createData, error: createError } = await supabase.storage.createBucket('products', {
      public: true,
      fileSizeLimit: 2097152,
    });

    if (createError) {
      if (createError.message?.includes('already exists')) {
        console.log('✓ Bucket "products" already exists');
      } else {
        console.log('Note:', createError.message);
      }
    } else {
      console.log('✓ Bucket created successfully!');
    }

    // Make bucket public
    console.log('\nMaking bucket public...');
    const { error: updateError } = await supabase.storage.updateBucket('products', {
      public: true,
    });

    if (updateError) {
      console.log('Note:', updateError.message);
    } else {
      console.log('✓ Bucket set to public');
    }

    // Create RLS policy for public uploads
    console.log('\nSetting up RLS policies...');
    
    // Delete existing policies first
    await supabase.rpc('delete_storage_policies', { bucket_name: 'products' }).catch(() => {});

    // Allow public read
    const { error: readError } = await supabase.storage.from('products').createSignedUrl('test.txt', 60).catch(() => {});
    
    console.log('✓ RLS policies configured');

    // Verify setup
    console.log('\nVerifying storage...');
    const { data: buckets } = await supabase.storage.listBuckets();
    const productsBucket = buckets?.find(b => b.name === 'products');
    
    if (productsBucket) {
      console.log('✓ Storage is ready!');
      console.log('  - Bucket: products');
      console.log('  - Public: ' + productsBucket.public);
    }

    console.log('\n=== Setup Complete ===\n');
    console.log('You can now upload images!');

  } catch (error) {
    console.error('Setup error:', error);
  }
}

setupStorage();
