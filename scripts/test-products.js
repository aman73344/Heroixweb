// Simple test script to check if products are loading
console.log('Testing product loading...');

// Simulate product data
const products = [
  { id: 1, name: 'Product 1', price: 10.99 },
  { id: 2, name: 'Product 2', price: 15.99 },
  { id: 3, name: 'Product 3', price: 7.99 }
];

console.log(`Found ${products.length} products`);
if (products.length > 0) {
  console.log('First product:', products[0]);
} else {
  console.log('No products found');
}