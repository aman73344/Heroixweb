import { NextRequest, NextResponse } from 'next/server';
import { getServerProducts, saveServerProducts, addServerProduct, deleteServerProduct } from '@/lib/server-products';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');

    const products = getServerProducts();
    let filteredProducts = products;

    if (category && category !== 'All') {
      filteredProducts = products.filter(p => p.category === category);
    }

    return NextResponse.json({
      success: true,
      data: filteredProducts,
      count: filteredProducts.length,
    });
  } catch (error) {
    console.error('Products API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, products, product } = body;

    if (action === 'save-all' && Array.isArray(products)) {
      // Bulk save products from admin
      const success = saveServerProducts(products);
      return NextResponse.json(
        { success, message: 'Products saved' },
        { status: success ? 200 : 500 },
      );
    }

    if (action === 'add' && product) {
      // Add single product
      const success = addServerProduct(product);
      return NextResponse.json(
        { success, message: 'Product added' },
        { status: success ? 200 : 500 },
      );
    }

    if (action === 'delete' && product?.id) {
      // Delete single product
      const success = deleteServerProduct(product.id);
      return NextResponse.json(
        { success, message: 'Product deleted' },
        { status: success ? 200 : 500 },
      );
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error processing products:', error);
    return NextResponse.json({ error: 'Failed to process products' }, { status: 500 });
  }
}
