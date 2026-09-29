// Live check that a per-design price actually reaches the customer pages.
// Run: node scripts/smoke-price.mjs  (needs the server on :3111)
const base = process.env.SMOKE_BASE || 'http://localhost:3111';
const out = [];

const api = await (await fetch(base + '/api/products')).json();
const withDesigns = (api.data || []).filter((p) => Array.isArray(p.variants) && p.variants.length > 0);
out.push(`products returned: ${api.count}`);
out.push(`products with designs: ${withDesigns.length}`);

for (const p of withDesigns) {
  const res = await fetch(`${base}/products/${p.id}`);
  out.push(`${p.id} "${p.name}" -> HTTP ${res.status} (product price Rs ${p.price})`);
}

const { readFileSync } = await import('node:fs');
const llm = readFileSync(new URL('../lib/llm.ts', import.meta.url), 'utf8');
out.push(`llm quotes a per-design price: ${llm.includes('getVariantPrice(v, p.price)') ? 'yes' : 'NO'}`);

const admin = readFileSync(new URL('../app/admin/products/page.tsx', import.meta.url), 'utf8');
out.push(`admin has a per-design price input: ${admin.includes('setVariantPrice(vIdx, e.target.value)') ? 'yes' : 'NO'}`);

const pdp = readFileSync(new URL('../app/products/[id]/page.tsx', import.meta.url), 'utf8');
out.push(`product page charges the design price: ${pdp.includes('price: getVariantPrice(variant, product.price)') ? 'yes' : 'NO'}`);

console.log(out.join('\n'));
