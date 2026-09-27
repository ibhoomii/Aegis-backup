"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 border border-line px-3 py-1.5 font-mono text-[11px] uppercase tracking-wideish text-ink-soft transition-colors hover:border-signal hover:text-signal dark:border-line-dark dark:text-paper/60"
    >
      <Printer size={13} /> Export
    </button>
  );
}
