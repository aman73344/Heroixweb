"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signOut, getCurrentUser } from "@/lib/auth";
import { ArrowLeft, LayoutDashboard, Package, ShoppingCart, LogOut, User } from "lucide-react";

export default function AdminLayoutPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const user = await getCurrentUser();
      setIsAuthenticated(!!user);
    } catch (err) {
      console.error("Auth check failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
      setIsAuthenticated(true);
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      setIsAuthenticated(false);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 border-border bg-card">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2 text-accent hover:text-accent/80 mb-4">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back to Shop</span>
            </Link>
            <div className="w-16 h-16 bg-accent rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-2xl">H</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">HEROIX Admin</h1>
            <p className="text-muted-foreground mt-2">Sign in to manage your store</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@heroix.com"
                className="mt-1 bg-background/50 border-border"
                required
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-foreground">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="mt-1 bg-background/50 border-border"
                required
              />
            </div>
            {error && (
              <p className="text-red-500 text-sm">{error}</p>
            )}
            <Button type="submit" className="w-full bg-accent hover:bg-accent/90" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/admin" className="group">
            <Card className="p-6 border-border hover:border-accent transition-all h-full">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                  <LayoutDashboard className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Dashboard</h3>
                  <p className="text-sm text-muted-foreground">Overview & Stats</p>
                </div>
              </div>
            </Card>
          </Link>

          <Link href="/admin/products" className="group">
            <Card className="p-6 border-border hover:border-accent transition-all h-full">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                  <Package className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Products</h3>
                  <p className="text-sm text-muted-foreground">Manage Products</p>
                </div>
              </div>
            </Card>
          </Link>

          <Link href="/admin/orders" className="group">
            <Card className="p-6 border-border hover:border-accent transition-all h-full">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                  <ShoppingCart className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Orders</h3>
                  <p className="text-sm text-muted-foreground">View Orders</p>
                </div>
              </div>
            </Card>
          </Link>
        </div>
      </main>
    </div>
  );
}
