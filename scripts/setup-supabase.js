require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const products = [
  { id: 'neon-genesis', name: 'Neon Genesis Evangelion', description: 'Classic mecha anime keychain with iconic EVA Unit design', price: 599, category: 'Anime', image: '/placeholder-product.png', rating: 4.8, reviews: 342, stock: 50 },
  { id: 'attack-titan', name: 'Attack on Titan', description: 'Dynamic action keychain featuring the Scout Regiment emblem', price: 549, category: 'Anime', image: '/placeholder-product.png', rating: 4.9, reviews: 567, stock: 75 },
  { id: 'demon-slayer', name: 'Demon Slayer', description: 'Beautiful Demon Slayer Corps insignia keychain with sword charm', price: 649, category: 'Anime', image: '/placeholder-product.png', rating: 4.7, reviews: 421, stock: 60 },
  { id: 'jujutsu-kaisen', name: 'Jujutsu Kaisen', description: 'Sorcery-themed keychain with Jujutsu High emblem', price: 599, category: 'Anime', image: '/placeholder-product.png', rating: 4.8, reviews: 389, stock: 45 },
  { id: 'my-hero', name: 'My Hero Academia', description: 'Heroes and villains collection keychain from the hit series', price: 499, category: 'Anime', image: '/placeholder-product.png', rating: 4.6, reviews: 298, stock: 40 },
  { id: 'steins-gate', name: 'Steins;Gate', description: 'Time travel sci-fi keychain with iconic lab emblem', price: 549, category: 'Anime', image: '/placeholder-product.png', rating: 4.9, reviews: 245, stock: 35 },
  { id: 'batman', name: 'Batman Icon', description: 'Dark Knight Batman emblem keychain with premium finish', price: 599, category: 'Superhero', image: '/placeholder-product.png', rating: 4.8, reviews: 312, stock: 55 },
  { id: 'superman', name: 'Superman Shield', description: 'Iconic Superman S shield keychain with vibrant colors', price: 599, category: 'Superhero', image: '/placeholder-product.png', rating: 4.7, reviews: 287, stock: 50 },
  { id: 'wonder-woman', name: 'Wonder Woman Lasso', description: 'Wonder Woman inspired keychain with golden accents', price: 649, category: 'Superhero', image: '/placeholder-product.png', rating: 4.9, reviews: 198, stock: 30 },
  { id: 'iron-man', name: 'Iron Man Arc Reactor', description: 'Glowing Iron Man arc reactor keychain replica', price: 699, category: 'Marvel', image: '/placeholder-product.png', rating: 4.9, reviews: 456, stock: 70 },
  { id: 'spider-man', name: 'Spider-Man Web', description: 'Spider-Man web design keychain with red and blue finish', price: 549, category: 'Marvel', image: '/placeholder-product.png', rating: 4.8, reviews: 387, stock: 65 },
  { id: 'thor-hammer', name: 'Thor Mjolnir', description: 'Mighty Mjolnir hammer keychain with detailed sculpting', price: 749, category: 'Marvel', image: '/placeholder-product.png', rating: 4.9, reviews: 523, stock: 40 },
  { id: 'flash', name: 'The Flash Lightning', description: 'The Flash lightning bolt keychain with metallic finish', price: 549, category: 'DC', image: '/placeholder-product.png', rating: 4.7, reviews: 264, stock: 45 },
  { id: 'aquaman', name: 'Aquaman Trident', description: 'Aquaman trident keychain with ocean blue accents', price: 599, category: 'DC', image: '/placeholder-product.png', rating: 4.6, reviews: 156, stock: 35 },
  { id: 'ronaldo-7', name: 'Cristiano Ronaldo CR7', description: 'Cristiano Ronaldo CR7 football legend keychain', price: 499, category: 'Sports', image: '/placeholder-product.png', rating: 4.8, reviews: 612, stock: 80 },
  { id: 'messi-10', name: 'Lionel Messi 10', description: 'Lionel Messi football icon keychain with premium quality', price: 499, category: 'Sports', image: '/placeholder-product.png', rating: 4.9, reviews: 598, stock: 75 },
  { id: 'football-trophy', name: 'Football Trophy', description: 'Golden football trophy keychain for sports enthusiasts', price: 449, category: 'Sports', image: '/placeholder-product.png', rating: 4.5, reviews: 178, stock: 50 },
];

async function setupSupabase() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Error: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env.local');
    process.exit(1);
  }

  try {
    console.log('Initializing Supabase with products data...');

    // Save products to Supabase
    const { error } = await supabase.from('products').insert(products);
    
    if (error) {
      console.error('Error inserting products:', error);
      throw error;
    }
    
    console.log('Successfully initialized Supabase with products data!');

    // Verify by fetching products
    const { data: fetchedProducts } = await supabase.from('products').select('*');
    console.log(`Total products in database: ${fetchedProducts.length}`);
  } catch (error) {
    console.error('Error setting up Supabase:', error);
  }
}

setupSupabase();
