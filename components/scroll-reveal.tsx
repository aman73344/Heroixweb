"use client";

import { useEffect, useRef, useState } from "react";

// Fades and lifts a section into place when the customer scrolls to it.
//
// WHY IT DEFAULTS TO VISIBLE
// The first version of this idea hid content behind `opacity-0` in the markup.
// That would have broken the SEO work on the home page: if JavaScript is slow,
// blocked or broken, the products, prices and links would be in the HTML but
// invisible, and nothing would ever animate in.
//
// So the element is rendered VISIBLE and only re-armed after mount, and only when
// it is actually below the fold. Content already on screen at load shows at once
// (no flash), content further down waits for the scroll, and anything that never
// runs JavaScript simply stays visible.
export function ScrollReveal({
  children,
  className = "",
  /** Milliseconds to wait before revealing, for staggering a group. */
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  // "visible" -> "hidden" (only if below the fold) -> "shown" (when it arrives)
  const [state, setState] = useState<"visible" | "hidden" | "shown">("visible");

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const prefersReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion || typeof IntersectionObserver === "undefined") {
      return;
    }

    // Already on screen: leave it alone rather than hiding it and fading it back
    // in, which would be a visible flicker on every page load.
    const rect = element.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.9) return;

    setState("hidden");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setState("shown");
          observer.disconnect();
        }
      },
      // Reveal slightly before the element is fully on screen, so it is already
      // in place by the time the customer looks at it.
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const stateClass =
    state === "shown"
      ? "opacity-100 translate-y-0"
      : state === "hidden"
        ? "opacity-0 translate-y-6"
        : "";

  return (
    <div
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={`transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none motion-reduce:translate-y-0 ${stateClass} ${className}`}
    >
      {children}
    </div>
  );
}