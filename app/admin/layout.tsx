import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/admin-guard';
import { AdminNav } from './admin-nav';

// The admin area is never cached: every request is checked against the signed
// session cookie before anything is rendered.
export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();

  // Not signed in => the admin area does not exist as far as the visitor knows.
  if (!session) {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminNav email={session.email} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
