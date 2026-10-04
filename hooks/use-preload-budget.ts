"use client";

// How far ahead the gallery and the product-card carousel are allowed to warm up
// pictures.
//
// The Network Information API is not supported everywhere, so this never
// *prevents* an image from loading - it only decides how many extra ones are
// fetched in the background. On a connection that reports nothing (Safari,
// Firefox, desktop Chrome in most cases) the budget stays at 1, which is the
// behaviour the site has always had.
//
// Kept deliberately trivial: one number, no scoring, no device sniffing. A
// mis-detected connection costs one small extra request, never a broken page.

import { useEffect, useState } from "react";

interface NetworkInformationLike extends EventTarget {
  effectiveType?: string;
  saveData?: boolean;
}

function readConnection(): NetworkInformationLike | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & { connection?: NetworkInformationLike };
  // `webkitConnection` is the old Android/Chrome name.
  return nav.connection ?? (nav as unknown as { webkitConnection?: NetworkInformationLike }).webkitConnection ?? null;
}

/** 1 = warm the next picture too, 0 = show this picture and nothing else. */
export function usePreloadBudget(): number {
  // Server render and the first client render must agree, so start optimistic
  // and correct after mount.
  const [budget, setBudget] = useState(1);

  useEffect(() => {
    const connection = readConnection();
    if (!connection) return;

    const compute = () => {
      const slowType = /^(slow-2g|2g|3g)$/i.test(connection.effectiveType || "");
      setBudget(connection.saveData || slowType ? 0 : 1);
    };

    compute();
    connection.addEventListener?.("change", compute);
    return () => connection.removeEventListener?.("change", compute);
  }, []);

  return budget;
}
