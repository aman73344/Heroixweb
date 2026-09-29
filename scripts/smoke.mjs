// Live smoke test against the running local server.
// Run: node scripts/smoke.mjs
const base = process.env.SMOKE_BASE || 'http://localhost:3111';

const paths = ['/', '/products/prod-1790668035221', '/admin/products', '/api/products'];
const out = [];
for (const p of paths) {
  try {
    const res = await fetch(base + p);
    const body = await res.text();
    out.push(`${p} -> HTTP ${res.status} (${body.length} bytes)`);
    if (p === '/api/products') {
      const json = JSON.parse(body);
      out.push(`  products returned: ${json.count} (was capped at 50 before the fix)`);
      const withVariants = (json.data || []).filter((x) => Array.isArray(x.variants) && x.variants.length);
      out.push(`  products carrying designs: ${withVariants.length}`);
      for (const p2 of withVariants) {
        out.push(`    ${p2.id}: ${p2.variants.length} design(s)`);
      }
    }
    if (p === '/') {
      out.push(`  has Gaming filter: ${body.includes('Gaming')}`);
      out.push(`  has Others filter: ${body.includes('Others')}`);
    }
  } catch (e) {
    out.push(`${p} -> ERROR ${e.message}`);
  }
}
console.log(out.join('\n'));
