"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

export function RadialGauge({
  value,
  size = 64,
  stroke = 4,
  label,
  tone = "signal",
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  tone?: "signal" | "clearance" | "caution";
}) {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const toneColor =
    tone === "signal" ? "#E8471C" : tone === "clearance" ? "#0E8F6B" : "#DB9A1E";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg ref={ref} width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-paper/15 dark:stroke-paper/10"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={toneColor}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{
            strokeDashoffset: inView
              ? circumference - (value / 100) * circumference
              : circumference,
          }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="font-mono text-[13px] font-600 leading-none text-paper">
          {value}
        </span>
        {label && (
          <span className="mt-0.5 font-mono text-[7px] uppercase tracking-wideish text-paper/50">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
