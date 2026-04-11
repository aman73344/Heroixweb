import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

export async function GET() {
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
      rating: 4.5,
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
