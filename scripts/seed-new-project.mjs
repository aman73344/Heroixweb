// =============================================================================
// seed-new-project.mjs - load the CSV exports of the OLD project into the NEW
// Supabase project over the REST API (the publishable key + RLS-off window
// created by supabase/new-project/01-schema.sql).
//
// WHY THIS AND NOT SQL: the product descriptions contain quotes, emoji and
// multi-line text. Hand-pasting INSERTs is how that data gets corrupted; a
// JSON payload over REST has no escaping to get wrong, and every write is
// acknowledged and counted.
//
// PREREQUISITE: run supabase/new-project/01-schema.sql in the NEW project's
// SQL Editor first. Afterwards run supabase/new-project/02-security.sql.
//
// USAGE
//   node scripts/seed-new-project.mjs                 # dry run (no writes)
//   node scripts/seed-new-project.mjs --apply         # write to the new project
//   node scripts/seed-new-project.mjs --verify        # read-only counts
//
// The CSV files default to the exports in the Downloads folder; pass explicit
// paths to use others:
//   node scripts/seed-new-project.mjs prod.csv orders.csv --apply
// =============================================================================

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('dotenv').config({ path: '.env.local' });

const URL_BASE = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

const DEFAULT_PRODUCTS_CSV = 'C:/Users/User/Downloads/products_rows.csv';
const DEFAULT_ORDERS_CSV = 'C:/Users/User/Downloads/orders_rows.csv';

// ---------------------------------------------------------------------------
// Minimal RFC-4180 CSV parser: quoted fields, "" escapes, newlines inside
// quotes. The product descriptions are full of all three.
// ---------------------------------------------------------------------------
function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  const header = rows.shift();
  return rows
    .filter((r) => r.some((v) => v !== ''))
    .map((r) => Object.fromEntries(header.map((h, idx) => [h, r[idx] ?? ''])));
}
// text[] exported as a JSON array by the dashboard; keep a Postgres
// {"a","b"} literal fallback in case a different export path was used.
function toTextArray(value, field) {
  const v = (value || '').trim();
  if (v === '' || v === '[]') return [];
  try {
    const parsed = JSON.parse(v);
    if (Array.isArray(parsed)) return parsed.map((x) => String(x));
    throw new Error(`not an array: ${JSON.stringify(parsed)}`);
  } catch (jsonErr) {
    if (v.startsWith('{') && v.endsWith('}')) {
      const out = [];
      let cur = '';
      let quoted = false;
      for (const ch of v.slice(1, -1)) {
        if (ch === '"') { quoted = !quoted; continue; }
        if (ch === ',' && !quoted) { out.push(cur); cur = ''; continue; }
        cur += ch;
      }
      out.push(cur);
      return out.filter((s) => s !== '').map((s) => s.replace(/\\"/g, '"'));
    }
    throw new Error(`Field "${field}" is not a valid text[] value: ${jsonErr.message}`);
  }
}

function toJson(value, field) {
  const v = (value || '').trim();
  if (v === '') return null;
  try { return JSON.parse(v); }
  catch (e) { throw new Error(`Field "${field}" is not valid JSON: ${e.message}`); }
}

function toNumber(value, field, { required = false, fallback = null } = {}) {
  const v = (value || '').trim();
  if (v === '') {
    if (required) throw new Error(`Field "${field}" is required`);
    return fallback;
  }
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error(`Field "${field}" is not a number: ${v}`);
  return n;
}

function toText(value) {
  const v = (value == null ? '' : String(value)).trim();
  return v === '' ? null : v;
}

function toTimestamp(value) {
  const v = (value || '').trim();
  return v === '' ? undefined : v; // undefined -> omitted, DB default now()
}

// ---------------------------------------------------------------------------
// Row transforms. Keys left undefined are omitted so column defaults apply.
// ---------------------------------------------------------------------------
function productRow(r) {
  const instockRaw = (r.instock || '').trim().toLowerCase();
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    price: toNumber(r.price, 'price', { required: true }),
    stock: toNumber(r.stock, 'stock', { fallback: 0 }),
    description: toText(r.description),
    images: toJson(r.images, `images(${r.id})`),
    image: toText(r.image),
    instock: instockRaw === '' ? undefined : instockRaw === 'true',
    rating: toNumber(r.rating, 'rating', { fallback: 4.5 }),
    reviews: toNumber(r.reviews, 'reviews', { fallback: 0 }),
    created_at: toTimestamp(r.created_at),
    updated_at: toTimestamp(r.updated_at),
    image_urls: toTextArray(r.image_urls, `image_urls(${r.id})`),
    features: toTextArray(r.features, `features(${r.id})`),
    variants: toTextArray(r.variants, `variants(${r.id})`),
  };
}

function orderRow(r) {
  return {
    id: r.id,
    date: toText(r.date),
    customer: toText(r.customer),
    email: toText(r.email),
    phone: toText(r.phone),
    address: toText(r.address),
    city: toText(r.city),
    items: toNumber(r.items, 'items'),
    total: toNumber(r.total, 'total'),
    status: toText(r.status),
    items_data: toJson(r.items_data, `items_data(${r.id})`),
    created_at: toTimestamp(r.created_at),
    order_number: toNumber(r.order_number, 'order_number'),
  };
}

// ---------------------------------------------------------------------------
// REST helpers (publishable key; only works while RLS is off, i.e. BEFORE
// 02-security.sql runs). Resolution=merge-duplicates on the PK makes reruns
// idempotent.
// ---------------------------------------------------------------------------
async function rest(path, init = {}) {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${path} -> ${res.status}: ${await res.text()}`);
  return res;
}

async function countOf(table) {
  const res = await rest(`${table}?select=id&limit=1`, {
    headers: { Prefer: 'count=exact' },
  });
  const range = res.headers.get('content-range') || '';
  return Number(range.split('/')[1] || 0);
}

async function upsert(table, rows) {
  const res = await rest(table, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(rows),
  });
  return (await res.json()).length;
}

function stripUndefined(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const verifyOnly = args.includes('--verify');
  const paths = args.filter((a) => !a.startsWith('--'));
  const productsCsv = paths[0] || DEFAULT_PRODUCTS_CSV;
  const ordersCsv = paths[1] || DEFAULT_ORDERS_CSV;

  if (!URL_BASE || !KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
    process.exit(1);
  }
  console.log(`Target: ${URL_BASE} (${verifyOnly ? 'verify only' : apply ? 'APPLY' : 'dry run'})`);

  const products = parseCSV(readFileSync(productsCsv, 'utf8')).map(productRow).map(stripUndefined);
  const orders = parseCSV(readFileSync(ordersCsv, 'utf8')).map(orderRow).map(stripUndefined);
  const bad = products.filter((p) => !p.id || !p.name || p.price == null);
  if (bad.length) throw new Error(`Invalid product rows: ${bad.map((b) => b.id).join(', ')}`);
  const dupIds = products.map((p) => p.id).filter((id, i, a) => a.indexOf(id) !== i);
  if (dupIds.length) throw new Error(`Duplicate product ids in CSV: ${[...new Set(dupIds)].join(', ')}`);
  console.log(`Parsed: ${products.length} products, ${orders.length} orders`);

  if (verifyOnly) {
    const pc = await countOf('products');
    let oc;
    try { oc = await countOf('orders'); }
    catch (e) { oc = `INACCESSIBLE (expected after 02-security.sql): ${e.message.slice(0, 100)}`; }
    console.log(`DB products: ${pc} (CSV: ${products.length})  orders: ${oc} (CSV: ${orders.length})`);
    if (pc !== products.length) process.exit(1);
    return;
  }

  if (!apply) {
    const sample = products[0];
    console.log('DRY RUN - nothing written. Sample product that would be sent:');
    console.log(JSON.stringify({ ...sample, description: (sample.description || '').slice(0, 80) + '…' }, null, 2));
    console.log('\nRe-run with --apply after supabase/new-project/01-schema.sql has been executed.');
    return;
  }

  let written = 0;
  for (let i = 0; i < products.length; i += 20) {
    written += await upsert('products', products.slice(i, i + 20));
    console.log(`  products ${written}/${products.length}`);
  }
  let ordersWritten = 0;
  for (let i = 0; i < orders.length; i += 20) {
    ordersWritten += await upsert('orders', orders.slice(i, i + 20));
    console.log(`  orders ${ordersWritten}/${orders.length}`);
  }

  const pc = await countOf('products');
  const oc = await countOf('orders');
  console.log(`\nDone. DB has ${pc} products (expected ${products.length}) and ${oc} orders (expected ${orders.length})`);
  if (pc !== products.length || oc !== orders.length) {
    console.error('COUNT MISMATCH - re-run this script; upserts are idempotent.');
    process.exit(1);
  }
  console.log('Next step: run supabase/new-project/02-security.sql in the SQL Editor.');
}

main().catch((e) => { console.error('\nFAILED:', e.message); process.exit(1); });


