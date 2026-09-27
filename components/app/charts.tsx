"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";

type Point = { hour: string; events: number; alerts: number };

// Attack-activity area chart with a hover guide + tooltip. Hand-built SVG to
// stay dependency-free and match the site's other SVG visuals.
export function ActivityChart({ data }: { data: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const W = 720;
  const H = 210;
  const padX = 8;
  const padTop = 16;
  const padBottom = 26;
  const innerW = W - padX * 2;
  const innerH = H - padTop - padBottom;

  const maxEvents = Math.max(...data.map((d) => d.events));
  const maxAlerts = Math.max(...data.map((d) => d.alerts));

  const x = (i: number) => padX + (i / (data.length - 1)) * innerW;
  const yEvents = (v: number) => padTop + innerH - (v / maxEvents) * innerH;

  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${yEvents(d.events).toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L ${x(data.length - 1).toFixed(1)} ${padTop + innerH} L ${x(0).toFixed(1)} ${padTop + innerH} Z`;

  const peakIndex = data.reduce((best, d, i) => (d.events > data[best].events ? i : best), 0);

  function onMove(e: React.PointerEvent) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHover(Math.round(frac * (data.length - 1)));
  }

  const active = hover ?? peakIndex;

  return (
    <div ref={wrapRef} className="relative" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Attack activity over 24 hours">
        <defs>
          <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E8471C" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#E8471C" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* horizontal gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <line
            key={g}
            x1={padX}
            x2={W - padX}
            y1={padTop + innerH * g}
            y2={padTop + innerH * g}
            className="stroke-line dark:stroke-line-dark"
            strokeWidth={1}
            strokeDasharray={g === 1 ? "0" : "2 4"}
          />
        ))}

        {/* alert ticks along the baseline */}
        {data.map((d, i) => (
          <line
            key={i}
            x1={x(i)}
            x2={x(i)}
            y1={padTop + innerH}
            y2={padTop + innerH - (d.alerts / maxAlerts) * (innerH * 0.42)}
            className="stroke-signal/40"
            strokeWidth={2.5}
          />
        ))}

        <motion.path
          d={areaPath}
          fill="url(#activityFill)"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        />
        <motion.path
          d={linePath}
          fill="none"
          className="stroke-ink dark:stroke-paper"
          strokeWidth={1.6}
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        />

        {/* hover guide */}
        <line
          x1={x(active)}
          x2={x(active)}
          y1={padTop}
          y2={padTop + innerH}
          className="stroke-signal/50"
          strokeWidth={1}
        />
        <circle cx={x(active)} cy={yEvents(data[active].events)} r={3.5} className="fill-signal" />

        {/* x-axis labels every 4h */}
        {data.map((d, i) =>
          i % 4 === 0 ? (
            <text
              key={i}
              x={x(i)}
              y={H - 8}
              textAnchor="middle"
              className="fill-ink-faint font-mono dark:fill-paper/40"
              style={{ fontSize: 9 }}
            >
              {d.hour}:00
            </text>
          ) : null
        )}
      </svg>

      {/* tooltip */}
      <div
        className="pointer-events-none absolute top-1 -translate-x-1/2 border border-line bg-paper px-2.5 py-1.5 dark:border-line-dark dark:bg-void-surface"
        style={{ left: `${(active / (data.length - 1)) * 100}%`, opacity: hover === null ? 0 : 1, transition: "opacity 0.15s" }}
      >
        <div className="font-mono text-[10px] text-ink dark:text-paper">
          {data[active].hour}:00 UTC
        </div>
        <div className="mt-0.5 font-mono text-[9.5px] text-ink-faint dark:text-paper/50">
          {data[active].events.toLocaleString("en-US")} events
        </div>
        <div className="font-mono text-[9.5px] text-signal">{data[active].alerts} alerts</div>
      </div>
    </div>
  );
}

// Compact sparkline for stat cards.
export function Sparkline({
  data,
  className = "",
  tone = "ink",
}: {
  data: number[];
  className?: string;
  tone?: "ink" | "signal" | "clearance" | "caution";
}) {
  const W = 120;
  const H = 32;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const x = (i: number) => (i / (data.length - 1)) * W;
  const y = (v: number) => H - ((v - min) / range) * (H - 4) - 2;
  const d = data.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const stroke =
    tone === "signal"
      ? "stroke-signal"
      : tone === "clearance"
      ? "stroke-clearance"
      : tone === "caution"
      ? "stroke-caution"
      : "stroke-ink/50 dark:stroke-paper/40";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`h-8 w-full ${className}`} preserveAspectRatio="none" aria-hidden>
      <path d={d} fill="none" className={stroke} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
