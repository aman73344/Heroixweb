require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function addColumn() {
  console.log('Adding image_urls column to products table...\n');

  // Try to insert with image_urls to see if column exists
  const { error } = await supabase.from('products').insert({
    id: 'test-' + Date.now(),
    name: 'Test Column',
    image_urls: ['http://test.com/image.jpg'],
    image: 'http://test.com/image.jpg',
    price: 100,
    category: 'Test'
  }).select().single();

  if (error) {
    console.log('Error:', error.message);
    console.log('Error code:', error.code);
    
    if (error.code === '42703') {
      console.log('\nColumn does not exist. Need to add it manually.');
      console.log('Go to Supabase Dashboard > Table Editor > products');
      console.log('Click the + icon to add column:');
      console.log('  Name: image_urls');
      console.log('  Type: text[] (array)');
    }
  } else {
    console.log('Column exists! Testing...');
    // Clean up test record
    await supabase.from('products').delete().eq('name', 'Test Column');
    console.log('Done!');
  }
}

addColumn();
