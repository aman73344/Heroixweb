// The site's own absolute address, for the places that need one: sitemap.xml,
// robots.txt and metadataBase.
//
// WHY THIS EXISTS
// These all require a full URL (https://...), but the app had no concept of its
// own address at all. Rather than hard-code a domain that would be wrong the
// moment the store moves, this reads the environment in order of reliability:
//
//   1. NEXT_PUBLIC_SITE_URL - set this in production to your real domain.
//   2. VERCEL_URL          - set automatically by Vercel on every deployment.
//   3. localhost:3000      - development fallback.
//
// Until NEXT_PUBLIC_SITE_URL is set, sitemap entries will point at whichever
// host Vercel last deployed to, which works but is not ideal.

const FALLBACK = 'http://localhost:3000';

export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, '')}`;

  return FALLBACK;
}