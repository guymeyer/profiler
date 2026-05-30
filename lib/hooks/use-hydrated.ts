"use client";
import { useEffect, useState } from "react";

// Hydration gate for client components reading from a persisted Zustand
// store. Returns false on initial render (SSR + client first paint),
// flips to true after mount so the next render sees the rehydrated
// state. Replaces the `useState(false) + useEffect(() => setHydrated(true))`
// boilerplate copy-pasted across ~10 pages.
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
