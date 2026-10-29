import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Checkout - HEROIX Keychains",
  description:
    "Complete your order for premium anime, Marvel, DC & gaming keychains. 50% upfront via NayaPay, 50% after delivery. Ship across Pakistan.",
};

export default function CheckoutLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
