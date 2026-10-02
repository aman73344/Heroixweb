"use client";

import { useEffect, useState } from "react";

/**
 * A word that changes every few seconds, e.g. the navbar line that cycles
 * Anime -> Marvel -> DC -> Gaming -> Sports.
 *
 * WHY IT STARTS STILL
 * The first word is rendered on the server and is the same one the browser
 * starts with; the rotation only begins after mount. If it rotated during
 * render, the server HTML and the first client render would disagree and React
 * would report a hydration mismatch.
 *
 * The visible word is hidden from screen readers and the whole list is exposed
 * once as a label instead, so assistive tech announces a sentence rather than
 * a word that keeps changing under the user.
 */
export function RotatingTagline({
  words,
  interval = 2400,
  className = "",
}: {
  words: string[];
  interval?: number;
  className?: string;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (words.length < 2) return;
    const id = setInterval(
      () => setIndex((current) => (current + 1) % words.length),
      interval
    );
    return () => clearInterval(id);
  }, [words.length, interval]);

  return (
    <span
      className={`relative inline-grid overflow-hidden align-bottom ${className}`}
      style={{ gridArea: "1 / 1" }}
      aria-label={words.join(", ")}
      role="text"
    >
      {words.map((word, i) => (
        <span
          key={word}
          aria-hidden={i !== index}
          className={`col-start-1 row-start-1 whitespace-nowrap transition-all duration-500 ease-out motion-reduce:transition-none ${
            i === index ? "translate-y-0 opacity-100" : "-translate-y-6 opacity-0"
          }`}
        >
          {word}
        </span>
      ))}
    </span>
  );
}