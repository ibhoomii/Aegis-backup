"use client";

// Client pages can't `export const metadata`, so they set the tab title with
// this small effect hook instead.

import { useEffect } from "react";

export function usePageTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
