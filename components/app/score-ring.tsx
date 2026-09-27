"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const toneColor: Record<string, string> = {
  signal: "#E8471C",
  clearance: "#0E8F6B",
  caution: "#DB9A1E",
};

// Radial score ring that adapts its centre text to the current surface
// (unlike RadialGauge, which is tuned for dark incident cards).
export function ScoreRing({
  value,
  max = 100,
  size = 128,
  stroke = 8,
  tone = "clearance",
  suffix,
}: {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  tone?: "signal" | "clearance" | "caution";
  suffix?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = value / max;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg ref={ref} width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-line dark:stroke-line-dark"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={toneColor[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: inView ? c - pct * c : c }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="font-mono text-2xl font-600 tabular-nums text-ink dark:text-paper">
          {value}
        </span>
        {suffix && (
          <span className="font-mono text-[9px] uppercase tracking-wideish text-ink-faint dark:text-paper/40">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
