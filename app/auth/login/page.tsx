'use client';

import { Suspense, useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        setIsLoading(false);
        return;
      }

      router.push(redirect);
    } catch (err) {
      setError('An error occurred. Please try again.');
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md relative z-10 border-border/50 shadow-2xl">
      <div className="p-8 space-y-6">
        <div className="space-y-2 text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-accent rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">H</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Admin Login</h1>
          <p className="text-sm text-muted-foreground">Sign in to manage your store</p>
        </div>

        <div className="bg-accent/10 border border-accent/20 rounded-lg p-3">
          <p className="text-xs text-muted-foreground text-center">
            Use email <strong>aman723344@gmail.com</strong> and password <strong>admin123</strong>
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-foreground">
              Email
            </label>
            <Input
              id="email"
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={isLoading}
              required
              className="bg-background/50 border-border"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              Password
            </label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={isLoading}
                required
                className="bg-background/50 border-border pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <div className="text-center pt-4 border-t border-border">
          <Link href="/" className="text-sm text-accent hover:underline">
            ← Back to Shop
          </Link>
        </div>
      </div>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-card flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-accent/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent/5 rounded-full blur-3xl"></div>
      </div>

      <Suspense fallback={
        <Card className="w-full max-w-md relative z-10 border-border/50 shadow-2xl">
          <div className="p-8 flex items-center justify-center">
            <Spinner className="w-8 h-8" />
          </div>
        </Card>
      }>
        <LoginForm />
      </Suspense>
    </div>
  );
}
