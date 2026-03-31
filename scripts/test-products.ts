import { getProducts } from '../lib/db';

async function testProducts() {
  try {
    console.log('Testing product loading...');
    const products = await getProducts();
    console.log(`Found ${products.length} products`);
    if (products.length > 0) {
      console.log('First product:', products[0]);
    } else {
      console.log('No products found');
    }
  } catch (error) {
    console.error('Error testing products:', error);
  }
}

testProducts();