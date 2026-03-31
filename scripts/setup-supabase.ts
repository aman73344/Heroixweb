import { saveProductsToSupabase, getProductsFromSupabase } from '../lib/db';
import products from '../products.json';

async function setupSupabase() {
  try {
    console.log('Initializing Supabase with products data...');

    // Save products to Supabase
    await saveProductsToSupabase(products);
    console.log('Successfully initialized Supabase with products data!');

    // Verify by fetching products
    const fetchedProducts = await getProductsFromSupabase();
    console.log(`Total products in database: ${fetchedProducts.length}`);
  } catch (error) {
    console.error('Error setting up Supabase:', error);
  }
}

setupSupabase();