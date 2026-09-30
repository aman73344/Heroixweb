import { createClient } from '@supabase/supabase-js';

// SERVER-ONLY Supabase client that authenticates with the SERVICE ROLE key.
//
// WHY THIS EXISTS
// `lib/supabase.ts` builds its client from the ANON key. That is correct for
// PUBLIC READS (the storefront reads the catalogue from the browser), but every
// server-side WRITE also used it:
//
//   - lib/db.ts              -> insert into orders, update products.stock
//   - lib/server-products.ts -> upsert/delete products
//   - app/api/products/route.ts -> upsert products
//
// Those writes only worked because the `products`/`orders` tables had wide-open
// RLS policies. The hardening migration removes those anon write policies, so
// all server-side writes must move to the service key FIRST, or checkout breaks.
//
// The service role bypasses RLS, so it must never reach a client component.
// Rather than add the `server-only` package, this module throws immediately if it
// is ever evaluated in a browser bundle. `scripts/security-check.mjs` also asserts
// the service key value never appears in any built client chunk.
//
// GUARD: if this module is imported into client code, `process.env.NEXT_PUBLIC_`
// inlining means the service key is not actually present - but this check still
// fires first, so the failure is loud rather than silent.

if (typeof window !== 'undefined') {
  throw new Error(
    'lib/supabase-admin.ts is server-only and must never be imported by a client component.',
  );
}


let adminInstance: ReturnType<typeof createClient> | null = null;

function getAdminClient() {
  if (!adminInstance) {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = (process.env.SUPABASE_SERVICE_KEY || '').trim();

    if (!url) {
      throw new Error('Missing SUPABASE_URL for the admin Supabase client');
    }
    if (!serviceKey) {
      throw new Error(
        'Missing SUPABASE_SERVICE_KEY. Server-side writes cannot use the anon key any more.',
      );
    }

    adminInstance = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return adminInstance;
}

export const adminSupabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    return (getAdminClient() as any)[prop];
  },
});
