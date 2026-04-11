require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: Missing env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function resetProducts() {
  console.log('Resetting products table...\n');

  // Delete all products
  console.log('Deleting all products...');
  const { error: deleteError } = await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  if (deleteError) {
    console.error('Delete error:', deleteError);
  } else {
    console.log('✓ All products deleted');
  }

  // Insert default products with placeholder images
  console.log('\nInserting default products...');
  
  const defaultProducts = [
    { id: 'neon-genesis', name: 'Neon Genesis Evangelion', description: 'Classic mecha anime keychain with iconic EVA Unit design', price: 599, category: 'Anime', image: '/placeholder.jpg', stock: 50, rating: 4.8, reviews: 342 },
    { id: 'attack-titan', name: 'Attack on Titan', description: 'Dynamic action keychain featuring the Scout Regiment emblem', price: 549, category: 'Anime', image: '/placeholder.jpg', stock: 75, rating: 4.9, reviews: 567 },
    { id: 'demon-slayer', name: 'Demon Slayer', description: 'Beautiful Demon Slayer Corps insignia keychain with sword charm', price: 649, category: 'Anime', image: '/placeholder.jpg', stock: 60, rating: 4.7, reviews: 421 },
    { id: 'batman', name: 'Batman Icon', description: 'Dark Knight Batman emblem keychain with premium finish', price: 599, category: 'Superhero', image: '/placeholder.jpg', stock: 55, rating: 4.8, reviews: 312 },
    { id: 'iron-man', name: 'Iron Man Arc Reactor', description: 'Glowing Iron Man arc reactor keychain replica', price: 699, category: 'Marvel', image: '/placeholder.jpg', stock: 65, rating: 4.9, reviews: 456 },
    { id: 'spider-man', name: 'Spider-Man Web', description: 'Spider-Man web design keychain with red and blue finish', price: 549, category: 'Marvel', image: '/placeholder.jpg', stock: 60, rating: 4.8, reviews: 387 },
  ];

  const { error: insertError } = await supabase.from('products').insert(defaultProducts);

  if (insertError) {
    console.error('Insert error:', insertError);
  } else {
    console.log('✓ Default products inserted');
  }

  console.log('\n=== Database Reset Complete ===');
  console.log('\nRefresh the admin page - it should load fast now!');
}

resetProducts();
