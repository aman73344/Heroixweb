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

    const reveal = () => {
      setState("shown");
      observer.disconnect();
    };

    // threshold MUST be 0 here.
    //
    // The threshold is a fraction OF THE TARGET ELEMENT, not of the screen. The
    // product grid is tens of thousands of pixels tall, so the most of it that
    // can ever be on screen is a tiny fraction - far below any threshold like
    // 0.05. The browser therefore never reported a crossing and the section
    // stayed at opacity-0 forever: "products are not available until I click a
    // category" (clicking one shrinks the grid until the fraction is finally
    // reached, which is why it then appeared).
    //
    // threshold: 0 fires as soon as ANY part enters, which is correct for both
    // a 60px category bar and a 40,000px product grid.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) reveal();
        }
      },
      // Reveal as the element starts to come into view rather than waiting
      // until it is fully on screen.
      { rootMargin: "0px 0px -10% 0px", threshold: 0 }
    );

    observer.observe(element);

    // Backstop: content must never be able to stay invisible. If the observer
    // somehow never reports (an edge case in a browser, a parent with
    // display:none, a container that changes size later), force it visible
    // rather than leaving a section of the shop blank.
    const failsafe = setTimeout(reveal, 2000);

    return () => {
      clearTimeout(failsafe);
      observer.disconnect();
    };
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