// BROWSER-SAFE catalogue reads.
//
// WHY THIS FILE EXISTS
// `lib/db.ts` contains both public catalogue READS and server-side WRITES. The
// writes need the service-role key, so that module imports `adminSupabase` from
// `lib/supabase-admin.ts`, which deliberately THROWS when it is evaluated in a
// browser:
//
//     if (typeof window !== 'undefined') { throw new Error('server-only...') }
//
// Three components are marked "use client" and need the product list in the
// browser. When they imported `getProducts` from `lib/db.ts`, the browser pulled
// in the whole module graph, evaluated `lib/supabase-admin.ts`, and the throw
// fired at MODULE EVALUATION - before React could hydrate. The storefront went
// down with a blank "This page couldn't load" screen.
//
// The server render kept working (there `typeof window === 'undefined'`), and
// `next build` kept passing, so the failure was invisible to tsc, to the build,
// and to HTTP status checks. Only the browser could see it.
//
// THE RULE
// This module may import `./supabase` (the anon-key client) and pure helpers.
// It must NEVER import `./supabase-admin` or `./db`. Every browser-needed read
// belongs here; every write stays in `lib/db.ts`.
//
// `scripts/security-check.mjs` walks the import graph of every "use client" file
// and fails if `lib/supabase-admin.ts` is reachable even transitively, so this
// mistake cannot be reintroduced silently.

import { supabase } from './supabase';

export async function getProducts(): Promise<any[]> {
  try {
    // features/variants are optional columns added by
    // scripts/add-features-column.sql - skip any that don't exist yet so the
    // store keeps working before the script has been run.
    const OPTIONAL_COLUMNS = ['features', 'variants'];
    const BASE_COLUMNS = [
      'id', 'name', 'category', 'price', 'stock', 'description',
      'image', 'image_urls', 'rating', 'reviews',
    ];
    let selectedOptional = [...OPTIONAL_COLUMNS];
    let data: any = null;
    let error: any = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      const columns = [...BASE_COLUMNS, ...selectedOptional].join(', ');
      // Supabase/PostgREST caps a single response at its own row limit, so the
      // rows are paged in. Without this a product beyond the first page (there
      // are more than 50 in the table) simply never loads, which looks like
      // "my product/design vanished after a reload".
      const pageSize = 200;
      const page: any[] = [];
      for (let from = 0; from < 2000; from += pageSize) {
        const chunk: any = await (supabase as any)
          .from('products')
          .select(columns)
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);

        if (chunk.error) {
          error = chunk.error;
          break;
        }

        const rows = Array.isArray(chunk.data) ? chunk.data : [];
        page.push(...rows);
        if (rows.length < pageSize) break;
      }

      data = page;
      if (!error || (error as any).code !== '42703') break;

      const match =
        (error as any).message.match(/column\s+([\w.]+)\s+does not exist/) ||
        (error as any).message.match(/column "([^"]+)"/);
      const missing = match?.[1]?.split('.').pop();

      if (missing && selectedOptional.includes(missing)) {
        selectedOptional = selectedOptional.filter((c) => c !== missing);
        continue;
      }

      if (attempt === 0) {
        // Couldn't identify the column - drop all optional columns and retry
        selectedOptional = [];
        continue;
      }

      break;
    }

    if (error) {
      console.error('Supabase error:', error);
      return [];
    }

    if (data && data.length > 0) {
      return data.map((p: any) => {
        let images: string[] = ['/placeholder.jpg'];

        // Use image_urls array if available
        if (p.image_urls && Array.isArray(p.image_urls) && p.image_urls.length > 0) {
          images = p.image_urls;
        } else if (p.image) {
          images = [p.image];
        }

        return {
          ...p,
          image: images[0],
          images: images,
          inStock: p.stock > 0
        };
      });
    }

    return [];
  } catch (error) {
    console.error('Error fetching from Supabase:', error);
    return [];
  }
}
