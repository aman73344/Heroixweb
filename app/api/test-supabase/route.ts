import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { addOrderToSupabase } from '@/lib/db';

export async function GET() {
  try {
    // Test 1: Check Supabase connection
    const { data: testData, error: testError } = await supabase
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

    const { error: insertError } = await supabase
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
