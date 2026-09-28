import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getAdminSession();

  return NextResponse.json(
    { authenticated: !!session, email: session?.email ?? null },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
