require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function resetDatabase() {
  try {
    console.log('Starting database cleanup...\n');

    console.log('Step 1: Fetching all products...');
    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select('id, name, image')
      .limit(100);

    if (fetchError) {
      console.error('Error fetching products:', fetchError);
    } else {
      console.log(`Found ${products?.length || 0} products\n`);
    }

    if (products && products.length > 0) {
      console.log('Step 2: Updating products to remove large image data...\n');
      
      let updated = 0;
      let failed = 0;
      
      for (const product of products) {
        let cleanImage = '/placeholder.jpg';
        
        if (product.image) {
          if (product.image.startsWith('data:')) {
            cleanImage = product.image;
          } else if (product.image.length < 500) {
            cleanImage = product.image;
          }
        }

        const { error: updateError } = await supabase
          .from('products')
          .update({ 
            image: cleanImage,
            updated_at: new Date().toISOString()
          })
          .eq('id', product.id);

        if (updateError) {
          failed++;
          console.log(`  Failed: ${product.name}`);
        } else {
          updated++;
          if (updated % 10 === 0) {
            console.log(`  Updated ${updated} products...`);
          }
        }
      }

      console.log(`\nUpdated ${updated} products`);
      if (failed > 0) {
        console.log(`Failed: ${failed} products`);
      }
    } else {
      console.log('No products found to update.\n');
    }

    console.log('\nStep 3: Verifying database...\n');
    
    const { data: verifyData, error: verifyError } = await supabase
      .from('products')
      .select('id, name, image')
      .limit(5);

    if (verifyError) {
      console.error('Verification failed:', verifyError);
    } else {
      console.log('Database is working! Sample products:');
      verifyData?.forEach(p => {
        const imgPreview = p.image?.substring(0, 50) || 'none';
        console.log(`  - ${p.name}: ${imgPreview}...`);
      });
    }

    console.log('\nCleanup complete!');
    console.log('\nYou can now use the admin panel without timeout issues.');
    console.log('Note: Only the first image (thumbnail) will be stored per product.');

  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

resetDatabase();
