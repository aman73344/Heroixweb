import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { LayoutDashboard, Package, ShoppingCart, Settings } from 'lucide-react';

const cards = [
  {
    href: '/admin',
    title: 'Dashboard',
    description: 'Overview & Stats',
    icon: LayoutDashboard,
  },
  {
    href: '/admin/products',
    title: 'Products',
    description: 'Manage Products',
    icon: Package,
  },
  {
    href: '/admin/orders',
    title: 'Orders',
    description: 'View Orders',
    icon: ShoppingCart,
  },
  {
    href: '/admin/settings',
    title: 'Settings',
    description: 'Store & Chatbot',
    icon: Settings,
  },
];

// Reaching this page already means the signed admin session was verified in
// app/admin/layout.tsx - there is no public login form here.
export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Manage your products, orders and store settings.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="group">
            <Card className="p-6 border-border hover:border-accent transition-all h-full">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                  <card.icon className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">{card.title}</h3>
                  <p className="text-sm text-muted-foreground">{card.description}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
