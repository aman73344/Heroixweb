"use client";

import Image from "next/image";
import Link from "next/link";
import { Instagram, Mail, MessageCircle, ShoppingBag, Truck } from "lucide-react";

// The store's contact details, in one place.
//
// WHY THIS IS ITS OWN COMPONENT
// The home page and every product page carried their own copy of this footer,
// so a contact change had to be made twice and had already drifted: the Instagram
// link pointed at the bare "instagram.com" instead of the actual store, and every
// other link was a dead href="#" that jumped to the top of the page.
//
// These are the real channels the store answers on.
const WHATSAPP_NUMBER = "923143131716"; // 0314-3131716 in international format
const WHATSAPP_LABEL = "0314-3131716";
const INSTAGRAM_URL = "https://www.instagram.com/heroix.pk/";
const INSTAGRAM_LABEL = "@heroix.pk";
const EMAIL = "aman723344@gmail.com";

// Links nudge sideways and colour up on hover, with the icon sliding a little
// further - a small movement that reads as "this is a link" on a laptop and
// still shows on a phone as a colour change, where there is no hover at all.
const linkClass =
  "group inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-accent touch:text-accent transition-colors duration-200";

export function StoreFooter() {
  return (
    <footer className="border-t border-border bg-card/30 py-12 mt-20">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div>
            <Link
              href="/"
              className="inline-block transition-transform duration-300 hover:scale-105 touch:opacity-80"
            >
              <Image
                src="/heroix-logo.png"
                alt="HEROIX"
                width={100}
                height={50}
                className="h-6 w-auto mb-4"
              />
            </Link>
            <p className="text-sm text-muted-foreground">
              Premium anime, Marvel, DC & gaming keychains for true collectors.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-foreground mb-4">Shop</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/#products" className={linkClass}>
                  <ShoppingBag className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
                  All Products
                </Link>
              </li>
              <li>
                <Link href="/checkout" className={linkClass}>
                  <ShoppingBag className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
                  Your Cart
                </Link>
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Truck className="w-4 h-4 shrink-0" />
                Shipping Rs 280 nationwide
              </li>
            </ul>
          </div>

          {/* The "Help Centre": the three ways a customer can actually reach the
              store. All three are live links - no dead href="#" left here. */}
          <div>
            <h4 className="font-bold text-foreground mb-4">Help Centre</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  <MessageCircle className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
                  WhatsApp {WHATSAPP_LABEL}
                </a>
              </li>
              <li>
                <a href={`mailto:${EMAIL}`} className={linkClass}>
                  <Mail className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
                  {EMAIL}
                </a>
              </li>
              <li>
                <a
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  <Instagram className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
                  Instagram {INSTAGRAM_LABEL}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-foreground mb-4">Follow Us</h4>
            <p className="text-sm text-muted-foreground mb-3">
              New designs drop first on Instagram.
            </p>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:gap-3 transition-all duration-300"
            >
              <Instagram className="w-4 h-4" />
              {INSTAGRAM_LABEL}
            </a>
          </div>
        </div>

        <div className="border-t border-border pt-8 text-center text-sm text-muted-foreground">
          <p>&copy; 2026 HEROIX. All rights reserved.</p>
          <p className="mt-2">
            Questions? WhatsApp{" "}
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline touch:text-accent"
            >
              {WHATSAPP_LABEL}
            </a>{" "}
            or{" "}
            <a
              href={`mailto:${EMAIL}`}
              className="text-accent hover:underline touch:text-accent"
            >
              {EMAIL}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}