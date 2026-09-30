import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminApi } from '@/lib/admin-guard';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

// DISABLED IN PRODUCTION.
//
// This endpoint performed a real INSERT + DELETE against the products table. It
// existed only as a connection smoke test. It is kept in the repo for local
// debugging but returns 410 in production so it cannot be used to write data.
//
// The admin session check is intentionally NOT the protection here: even a
// hijacked admin cookie should not be able to write arbitrary rows through a
// debug endpoint. Enable locally only by setting ALLOW_TEST_ENDPOINTS=true.

export const dynamic = 'force-dynamic';

const ENABLED = process.env.ALLOW_TEST_ENDPOINTS === 'true';

export async function GET() {
  if (!ENABLED) {
    return NextResponse.json(
      {
        success: false,
        error: 'This debug endpoint is disabled. Set ALLOW_TEST_ENDPOINTS=true to enable it (local development only).',
      },
      { status: 410 },
    );
  }

  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { success: false, error: 'Disabled in production.' },
      { status: 410 },
    );
  }

  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;

  try {
    console.log("Testing Supabase connection...");
    console.log("URL:", supabaseUrl);
    console.log("Has Service Key:", !!supabaseServiceKey);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Test insert
    const testProduct = {
      id: 'test-' + Date.now(),
      name: 'Test Product',
      description: 'Testing connection',
      price: 999,
      category: 'Test',
      stock: 10,
      image: '/placeholder.jpg',
      rating: 4.8,
      reviews: 0
    };

    console.log("Inserting test product:", testProduct);

    const { data, error } = await supabase
      .from('products')
      .insert([testProduct])
      .select()
      .single();

    if (error) {
      console.error("Insert error:", error);
      return NextResponse.json({ 
        success: false, 
        error: error.message,
        code: error.code,
        details: error.details
      });
    }

    console.log("Test product inserted:", data);

    // Delete test product
    await supabase.from('products').delete().eq('id', testProduct.id);

    return NextResponse.json({ 
      success: true, 
      message: 'Connection works!',
      insertedProduct: data 
    });
  } catch (error: any) {
    console.error("Error:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
