/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    // Deliberate, and part of the egress fix: every picture is pre-resized
    // into 400/800px WebP derivatives inside the bucket (lib/image-url.ts +
    // scripts/generate-image-derivatives.mjs, plus derivatives generated
    // automatically at upload time in app/admin/products), so <SmartImage>
    // already hands the browser the right file. Enabling the optimizer would
    // make the server re-download the FULL-SIZE original from Supabase to
    // resize it again - one extra origin hit per visitor per image, which is
    // precisely the traffic that exhausted the cached-egress quota once.
    unoptimized: true,
  },
  env: {
    // NEXT_PUBLIC_* vars are the only ones guaranteed to exist on Vercel, so
    // fall back to them. Without this fallback a project that only sets the
    // NEXT_PUBLIC_ pair would inline `undefined` into the client bundle
    // (app/admin/products/page.tsx is a client component that reads these).
    SUPABASE_URL:
      process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY:
      process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    // Admin credentials and secrets are intentionally NOT exposed to the client
    // bundle - they are read from the server environment only.
  },
}

export default nextConfig
