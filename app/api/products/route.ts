import { NextRequest, NextResponse } from 'next/server';
import { getServerProducts, saveServerProducts, deleteServerProduct } from '@/lib/server-products';
import { adminSupabase } from '@/lib/supabase-admin';
import { normalizeRating, normalizeReviewCount } from '@/lib/reviews';
import { requireAdminApi } from '@/lib/admin-guard';
import { rateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';

// GET is public: the storefront reads the catalogue through here.
// POST mutates the catalogue, so it must never run for an anonymous caller.
export const dynamic = 'force-dynamic';

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
  // Catalogue writes are admin-only. This endpoint previously accepted an
  // unauthenticated {"action":"delete"} and could delete any product.
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;

  const limited = rateLimit(request, RATE_LIMITS.productWrites);
  if (!limited.ok) return rateLimitResponse(limited);

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
        rating: normalizeRating(product.rating),
        reviews: normalizeReviewCount(product.reviews),
        created_at: product.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await (adminSupabase as any)
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
