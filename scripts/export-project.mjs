// One-time full export of everything the Supabase project owns:
//   1) every row of the `products` and `orders` tables  -> exports/data/*.json
//   2) every image object in the `products` bucket      -> exports/images/**
//
// WHY THIS EXISTS
// The project was restricted once (exceed_cached_egress_quota) and every API
// path went 402. This script is the "never again" insurance: run it as soon as
// service is restored and the site's assets exist on local disk, independent
// of any Supabase quota.
//
// USAGE
//   node scripts/export-project.mjs            # full export
//   node scripts/export-project.mjs --dry-run  # list what would be exported
//
// It is read-only: it never uploads, updates, or deletes anything.

import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "exports");
const DRY = process.argv.includes("--dry-run");

function env(name) {
  const path = join(ROOT, ".env.local");
  if (existsSync(path)) {
    const m = readFileSync(path, "utf8").match(new RegExp(`^${name}=(.*)$`, "m"));
    if (m) return m[1].trim();
  }
  return process.env[name];
}

const URL_ = env("NEXT_PUBLIC_SUPABASE_URL") || env("SUPABASE_URL");
const KEY =
  env("SUPABASE_SERVICE_KEY") ||
  env("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
  env("SUPABASE_ANON_KEY");

if (!URL_ || !KEY) {
  console.error("Missing Supabase URL/key in .env.local or environment.");
  process.exit(1);
}

const supabase = createClient(URL_, KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const fmt = (n) =>
  n > 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + " MB" : (n / 1024).toFixed(0) + " KB";

// --- 1) Tables ---------------------------------------------------------------
async function exportTable(table) {
  const rows = [];
  const pageSize = 500;
  for (let from = 0; from < 100000; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  if (!DRY) {
    await mkdir(join(OUT, "data"), { recursive: true });
    await writeFile(join(OUT, "data", `${table}.json`), JSON.stringify(rows, null, 2));
  }
  console.log(`  ${table}: ${rows.length} rows`);
  return rows;
}

// --- 2) Storage objects ------------------------------------------------------
// Recursively walks the bucket. `list()` returns folders (id === null) and
// files; folders are queued and re-listed with the prefix extended.
async function listAll(bucket) {
  const files = [];
  const queue = [""];
  while (queue.length) {
    const prefix = queue.shift();
    let offset = 0;
    for (;;) {
      const { data, error } = await supabase.storage.from(bucket).list(prefix, {
        limit: 1000,
        offset,
      });
      if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
      if (!data || data.length === 0) break;
      for (const entry of data) {
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.id === null) queue.push(path); // folder
        else files.push({ path, size: entry.metadata?.size || 0 });
      }
      if (data.length < 1000) break;
      offset += data.length;
    }
  }
  return files;
}

async function downloadObject(bucket, path) {
  const res = await fetch(
    `${URL_}/storage/v1/object/public/${bucket}/${encodeURI(path)}`
  );
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const dest = join(OUT, "images", bucket, path);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  return buf.length;
}

// --- run ---------------------------------------------------------------------
(async () => {
  console.log(DRY ? "DRY RUN (no files written)" : "Exporting project...");

  try {
    console.log("Tables:");
    await exportTable("products");
    await exportTable("orders");
  } catch (e) {
    console.error(`TABLE EXPORT FAILED: ${e.message}`);
    console.error(
      "(402 here means the project is still restricted - retry after the " +
        "billing cycle resets or the plan is upgraded.)"
    );
    process.exitCode = 1;
  }

  try {
    console.log("Storage:");
    const files = await listAll("products");
    const total = files.reduce((s, f) => s + f.size, 0);
    console.log(`  products bucket: ${files.length} objects, ${fmt(total)}`);
    if (DRY) {
      for (const f of files.slice(0, 10)) console.log(`    ${f.path} (${fmt(f.size)})`);
      if (files.length > 10) console.log(`    ... and ${files.length - 10} more`);
    } else {
      let done = 0;
      let bytes = 0;
      for (const f of files) {
        bytes += await downloadObject("products", f.path);
        done += 1;
        if (done % 50 === 0) console.log(`  ${done}/${files.length} (${fmt(bytes)})`);
      }
      console.log(`  downloaded ${done} objects, ${fmt(bytes)}`);
    }
  } catch (e) {
    console.error(`STORAGE EXPORT FAILED: ${e.message}`);
    process.exitCode = 1;
  }

  if (!DRY && !process.exitCode) {
    console.log(`\nDone. Everything written under ${OUT}`);
    console.log("Keep this folder safe - it is your full offline backup.");
  }
})();
