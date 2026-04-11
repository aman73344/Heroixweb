import { NextRequest, NextResponse } from 'next/server';
import { getServerProducts, saveServerProducts, addServerProduct, deleteServerProduct } from '@/lib/server-products';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');

    const products = await getServerProducts();
    let filteredProducts = products;

    if (category && category !== 'All') {
      filteredProducts = products.filter((p: any) => p.category === category);
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
      const success = await saveServerProducts(products);
      return NextResponse.json(
        { success, message: 'Products saved' },
        { status: success ? 200 : 500 },
      );
    }

    if ((action === 'add' || action === 'update-single') && product) {
      const firstImage = product.images?.[0] || product.image || '/placeholder.jpg';
      const productData = {
        id: product.id,
        name: product.name,
        description: product.description || '',
        price: product.price,
        category: product.category || 'Anime',
        stock: product.stock || 0,
        image: firstImage,
        rating: product.rating || 4.5,
        reviews: product.reviews || 0,
        created_at: product.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await (supabase as any)
        .from('products')
        .upsert([productData], { onConflict: 'id' });

      if (error) {
        console.error('Error saving product:', error);
        return NextResponse.json(
          { success: false, message: 'Product saved to list but database error', error: error.message },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { success: true, message: 'Product saved' },
        { status: 200 },
      );
    }

    if (action === 'delete' && product?.id) {
      const success = await deleteServerProduct(product.id);
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
