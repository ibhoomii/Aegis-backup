"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useDataset } from "@/components/app/data-source";
import type { SecurityEvent, EventStatus } from "@/lib/soc-data";

const statusClass: Record<EventStatus, string> = {
  failed: "text-signal",
  blocked: "text-clearance",
  flagged: "text-caution",
  success: "text-ink-faint dark:text-paper/45",
};

type Row = SecurityEvent & { id: number; time: string };

function stamp() {
  return new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
  });
}

export function LiveFeed() {
  const { eventPool } = useDataset();
  const [rows, setRows] = useState<Row[]>([]);
  const idRef = useRef(0);
  const poolRef = useRef(0);

  useEffect(() => {
    // Reset the stream whenever the active dataset changes (e.g. demo → your data).
    setRows([]);
    idRef.current = 0;
    poolRef.current = 0;

    if (eventPool.length === 0) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const make = (): Row => {
      const ev = eventPool[poolRef.current % eventPool.length];
      poolRef.current += 1;
      return { ...ev, id: idRef.current++, time: stamp() };
    };

    // seed the feed
    setRows(Array.from({ length: Math.min(7, eventPool.length) }, make).reverse());

    if (reduce) return; // no live streaming under reduced-motion

    const id = setInterval(() => {
      setRows((prev) => [make(), ...prev].slice(0, 9));
    }, 2400);
    return () => clearInterval(id);
  }, [eventPool]);

  return (
    <div className="min-h-[280px]">
      {eventPool.length === 0 ? (
        <div className="flex items-center gap-2 px-4 py-6 font-mono text-[11px] text-ink-faint dark:text-paper/40">
          No events in this source — upload logs from Data Sources.
        </div>
      ) : rows.length === 0 ? (
        <div className="flex items-center gap-2 px-4 py-6 font-mono text-[11px] text-ink-faint dark:text-paper/40">
          <span className="h-1.5 w-1.5 animate-blink rounded-full bg-clearance" />
          connecting to event stream…
        </div>
      ) : (
        <ul className="divide-y divide-line font-mono dark:divide-line-dark">
          <AnimatePresence initial={false}>
            {rows.map((r) => (
              <motion.li
                key={r.id}
                layout
                initial={{ opacity: 0, backgroundColor: "rgba(232,71,28,0.06)" }}
                animate={{ opacity: 1, backgroundColor: "rgba(232,71,28,0)" }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="grid grid-cols-[64px_1fr_auto] items-center gap-3 px-4 py-2 text-[11px] sm:grid-cols-[72px_120px_1fr_auto]"
              >
                <span className="tabular-nums text-ink-faint dark:text-paper/40">{r.time}</span>
                <span className="hidden truncate text-ink-soft dark:text-paper/60 sm:block">
                  {r.sourceIp}
                </span>
                <span className="truncate text-ink dark:text-paper/85">
                  <span className="text-ink-faint dark:text-paper/40">{r.asset}</span>{" "}
                  {r.type}
                </span>
                <span className={`uppercase tracking-wideish ${statusClass[r.status]}`}>
                  {r.status}
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
