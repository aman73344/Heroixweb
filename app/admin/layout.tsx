'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';

  async function handleLogout() {
    setIsLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/auth/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  const isLoginPage = pathname === '/admin';

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Navbar - Only show if NOT on login page */}
      {!isLoginPage && (
        <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              {/* Logo */}
              <div className="flex items-center gap-4">
                <Link href="/" className="flex items-center gap-2 text-accent hover:text-accent/80">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  <span className="text-sm hidden sm:inline">Back to Shop</span>
                </Link>
                <div className="h-6 w-px bg-border hidden sm:block" />
                <Link href="/admin" className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold">H</span>
                  </div>
                  <div>
                    <div className="font-bold text-foreground">HEROIX</div>
                    <div className="text-xs text-muted-foreground">Admin</div>
                  </div>
                </Link>
              </div>

              {/* Navigation Menu - Removed, now shown in admin page */}

              {/* User Menu */}
              <div className="flex items-center gap-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2"
                    >
                      <div className="w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold">A</span>
                      </div>
                      <span className="hidden sm:inline text-sm">Admin</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                      admin@heroix.com
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleLogout} disabled={isLoading}>
                      {isLoading ? 'Logging out...' : 'Logout'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
