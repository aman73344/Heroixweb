import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminApi } from '@/lib/admin-guard';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function POST(request: NextRequest) {
  try {
    // Admin only - product create/update/delete.
    const unauthorized = await requireAdminApi();
    if (unauthorized) return unauthorized;

    const { action, product } = await request.json();

    if (action === 'save' && product) {
      // Variants can arrive as an array of lines (what the admin sends) or as a
      // single textarea string like "Red: 5\nBlue: 4". Normalise both to an
      // array so the jsonb/text[] column always gets the shape it expects.
      const variantsValue = Array.isArray(product.variants)
        ? product.variants
        : typeof product.variants === 'string'
          ? product.variants
              .split('\n')
              .map((line: string) => line.trim())
              .filter(Boolean)
          : [];

      const productRow: Record<string, any> = {
        id: product.id,
        name: product.name,
        description: product.description || '',
        price: product.price,
        category: product.category || 'Anime',
        stock: product.stock || 0,
        image: product.image,
        image_urls: product.image_urls || [product.image],
        features: product.features || [],
        variants: variantsValue,
        rating: product.rating || 4.5,
        reviews: product.reviews || 0,
        created_at: product.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // features/variants are optional columns added by
      // scripts/add-features-column.sql. If one doesn't exist yet, strip it and
      // retry so saving the product never fails because of it.
      const OPTIONAL_COLUMNS = ['features', 'variants'];
      const row: Record<string, any> = { ...productRow };
      const missingColumns: string[] = [];
      let data: any = null;
      let error: any = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        ({ data, error } = await supabase
          .from('products')
          .upsert(row, { onConflict: 'id' })
          .select()
          .single());

        if (!error || (error as any).code !== '42703') break;

        const match =
          error.message.match(/column "([^"]+)"/) ||
          error.message.match(/column\s+([\w.]+)\s+does not exist/);
        const missing = match?.[1]?.split('.').pop();

        if (missing && OPTIONAL_COLUMNS.includes(missing) && missing in row) {
          missingColumns.push(missing);
          delete row[missing];
          continue;
        }

        if (attempt === 0) {
          // Couldn't identify the column - retry without any optional columns
          OPTIONAL_COLUMNS.forEach((column) => {
            if (column in row) {
              missingColumns.push(column);
              delete row[column];
            }
          });
          continue;
        }

        break;
      }

      if (error) {
        console.error('Save error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        data,
        ...(missingColumns.length > 0
          ? {
              warning: `Product saved, but ${
                missingColumns.map((c) => `"${c}"`).join(' and ')
              } could not be stored because the column is missing in Supabase. Run scripts/add-features-column.sql once in the Supabase SQL Editor to enable Product Features / Variants.`,
            }
          : {}),
      });
    }

    if (action === 'delete' && product?.id) {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
