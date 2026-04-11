require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: Missing env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function recreateTable() {
  console.log('Recreating products table...\n');

  // Delete all products
  console.log('1. Deleting all products...');
  await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('   ✓ Done');

  // Try to vacuum/analyze to clean up
  console.log('2. Clearing cache...');
  try {
    await supabase.rpc('vacuum', {});
  } catch (e) {
    // Vacuum not available, skip
  }
  console.log('   ✓ Done');

  // Insert fresh products
  console.log('3. Inserting fresh products...');
  
  const defaultProducts = [
    { id: 'neon-genesis', name: 'Neon Genesis Evangelion', description: 'Classic mecha anime keychain', price: 599, category: 'Anime', image: '/placeholder.jpg', stock: 50, rating: 4.8, reviews: 342 },
    { id: 'attack-titan', name: 'Attack on Titan', description: 'Dynamic action keychain', price: 549, category: 'Anime', image: '/placeholder.jpg', stock: 75, rating: 4.9, reviews: 567 },
    { id: 'batman', name: 'Batman Icon', description: 'Dark Knight Batman emblem keychain', price: 599, category: 'Superhero', image: '/placeholder.jpg', stock: 55, rating: 4.8, reviews: 312 },
    { id: 'iron-man', name: 'Iron Man Arc Reactor', description: 'Glowing arc reactor keychain', price: 699, category: 'Marvel', image: '/placeholder.jpg', stock: 65, rating: 4.9, reviews: 456 },
    { id: 'spider-man', name: 'Spider-Man Web', description: 'Spider-Man web design keychain', price: 549, category: 'Marvel', image: '/placeholder.jpg', stock: 60, rating: 4.8, reviews: 387 },
    { id: 'ronaldo-7', name: 'Cristiano Ronaldo CR7', description: 'CR7 football legend keychain', price: 499, category: 'Sports', image: '/placeholder.jpg', stock: 70, rating: 4.8, reviews: 612 },
  ];

  const { error } = await supabase.from('products').insert(defaultProducts);
  
  if (error) {
    console.log('   Error:', error.message);
  } else {
    console.log('   ✓ Done');
  }

  // Verify
  console.log('4. Verifying...');
  const { data } = await supabase.from('products').select('id, name');
  console.log(`   Found ${data?.length || 0} products`);
  
  if (data && data.length > 0) {
    console.log('   Products:', data.map(p => p.name).join(', '));
  }

  console.log('\n=== Done! Refresh the admin page ===');
}

recreateTable();
