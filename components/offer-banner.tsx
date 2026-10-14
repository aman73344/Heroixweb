'use client';

import { useEffect, useState } from 'react';
import { Gift, X } from 'lucide-react';
import { FREE_DELIVERY_MIN_ITEMS } from '@/lib/store-config';

// Remembers that a visitor closed the banner, so it never nags them again (and
// stops taking up space on repeat visits). v1 lets us re-show it if we ever
// change the offer meaningfully, just by bumping the key.
const DISMISS_KEY = 'heroix:offer-banner-dismissed:v1';

/**
 * A slim announcement strip for the "order 3+ keychains, delivery is FREE" promo.
 *
 * Why a thin top bar and not a big hero card: it is visible to EVERY visitor the
 * instant the page loads (right above the navbar, before any scrolling), it costs
 * one line of vertical space, and it can be dismissed - after which it removes
 * itself from the DOM entirely so it stops taking up any space at all.
 */
export function OfferBanner() {
  // Starts VISIBLE so it is present in the very first paint for crawlers and
  // first-time visitors; the effect below then hides it only for someone who
  // already dismissed it. No hydration mismatch because the initial client
  // render matches the server render.
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') setDismissed(true);
    } catch {
      // Private mode / storage disabled - just keep showing it.
    }
  }, []);

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative bg-accent text-accent-foreground">
      <div className="max-w-7xl mx-auto px-8 sm:px-4 py-2 text-center">
        <p className="flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold">
          <Gift className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>
            🎁 Order {FREE_DELIVERY_MIN_ITEMS}+ keychains and get{' '}
            <span className="underline decoration-2 underline-offset-2">
              FREE delivery
            </span>
            !
          </span>
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss offer"
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-black/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-foreground/60"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
