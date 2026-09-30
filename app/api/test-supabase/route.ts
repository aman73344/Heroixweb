import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdminApi } from '@/lib/admin-guard';

// DISABLED IN PRODUCTION.
//
// This endpoint inserted and then deleted a real row in the orders table. It
// existed only as a connection smoke test and returns 410 in production so it
// cannot be used to write or probe order data.
//
// Enable locally only by setting ALLOW_TEST_ENDPOINTS=true.

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
    // Test 1: Check Supabase connection
    const { error: testError } = await supabase
      .from('products')
      .select('count')
      .single();
    
    if (testError) {
      return NextResponse.json({
        success: false,
        test: 'Supabase Connection',
        error: testError.message,
        code: testError.code
      });
    }

    // Test 2: Try to insert a test order
    const testOrder = {
      id: `TEST-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      customer: 'Test User',
      email: 'test@test.com',
      phone: '03000000000',
      address: 'Test Address',
      city: 'Lahore',
      items: 1,
      total: 500,
      status: 'pending' as const,
      items_data: [{ productId: 'test', name: 'Test Product', price: 500, quantity: 1 }]
    };

    const { error: insertError } = await (supabase as any)
      .from('orders')
      .insert([testOrder])
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({
        success: false,
        test: 'Order Insert',
        error: insertError.message,
        details: insertError.details,
        code: insertError.code,
        hint: insertError.hint
      });
    }

    // Clean up test order
    await supabase.from('orders').delete().eq('id', testOrder.id);

    return NextResponse.json({
      success: true,
      message: 'All tests passed! Supabase is working correctly.'
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    });
  }
}
