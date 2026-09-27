"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Eyebrow } from "@/components/eyebrow";
import { Reveal } from "@/components/reveal";
import {
  incidentGraphNodes,
  incidentGraphEdges,
  graphReveals,
  type GraphNodeId,
} from "@/lib/content";

function elbow(x1: number, y1: number, x2: number, y2: number) {
  if (x1 === x2) return `M ${x1} ${y1} L ${x2} ${y2}`;
  const midY = (y1 + y2) / 2;
  return `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
}

function nodeById(id: GraphNodeId) {
  return incidentGraphNodes.find((n) => n.id === id)!;
}

export function IncidentGraph() {
  const [active, setActive] = useState<GraphNodeId | null>(null);
  const [motionOk, setMotionOk] = useState(true);

  useEffect(() => {
    setMotionOk(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const activeNode = active ? nodeById(active) : null;

  return (
    <section id="graph" className="border-b border-line dark:border-line-dark">
      <div className="mx-auto max-w-[1400px] px-6 py-20 lg:px-10 lg:py-28">
        <div className="grid gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <Reveal>
            <Eyebrow>Incident graph</Eyebrow>
            <h2 className="mt-5 max-w-md font-display text-4xl font-700 leading-[1.05] tracking-tighter text-balance">
              See how the entities connect.
            </h2>
            <p className="mt-6 max-w-sm font-body text-[15px] leading-relaxed text-ink-soft dark:text-paper/70">
              Every incident is a small graph, not a flat list: an IP led to
              a user, the user reached a server, the server ran a process
              and touched a file. Hover a node to trace it.
            </p>

            <ul className="mt-8 grid grid-cols-2 gap-x-6 gap-y-2.5">
              {graphReveals.map((r) => (
                <li
                  key={r}
                  className="flex items-center gap-2 font-mono text-[11px] text-ink-faint dark:text-paper/40"
                >
                  <span className="h-1 w-1 flex-none bg-signal" />
                  {r}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="border border-line dark:border-line-dark bg-paper/50 dark:bg-void-surface/40 p-4 sm:p-6">
              <svg
                viewBox="0 -18 640 498"
                className="w-full touch-manipulation"
                role="img"
                aria-label="Incident entity graph: IP address to user to server to process, file, and network connection"
              >
                {incidentGraphEdges.map((edge, i) => {
                  const from = nodeById(edge.from);
                  const to = nodeById(edge.to);
                  const d = elbow(from.x, from.y, to.x, to.y);
                  const isActive =
                    active !== null && (edge.from === active || edge.to === active);
                  const isDimmed = active !== null && !isActive;

                  return (
                    <g key={`${edge.from}-${edge.to}`}>
                      <motion.path
                        d={d}
                        fill="none"
                        strokeWidth={isActive ? 2 : 1.3}
                        className={
                          isActive
                            ? "stroke-signal"
                            : "stroke-ink/25 dark:stroke-paper/20"
                        }
                        style={{ opacity: isDimmed ? 0.18 : 1 }}
                        initial={{ pathLength: 0 }}
                        whileInView={{ pathLength: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7, delay: 0.15 + i * 0.1 }}
                      />
                      {motionOk && !isDimmed && (
                        <circle r={active !== null ? 3.2 : 2.4} className="fill-signal">
                          <animateMotion
                            path={d}
                            dur="2.6s"
                            begin={`${i * 0.35}s`}
                            repeatCount="indefinite"
                          />
                        </circle>
                      )}
                    </g>
                  );
                })}

                {incidentGraphNodes.map((node) => {
                  const isActive = active === node.id;
                  const isDimmed = active !== null && !isActive;
                  const isServer = node.id === "server";

                  return (
                    <g
                      key={node.id}
                      onMouseEnter={() => setActive(node.id)}
                      onMouseLeave={() => setActive(null)}
                      onClick={() => setActive((cur) => (cur === node.id ? null : node.id))}
                      className="cursor-pointer"
                      style={{ opacity: isDimmed ? 0.35 : 1 }}
                    >
                      {isServer ? (
                        <rect
                          x={node.x - 30}
                          y={node.y - 22}
                          width={60}
                          height={44}
                          rx={2}
                          className={
                            isActive
                              ? "fill-signal stroke-signal"
                              : "fill-paper dark:fill-void stroke-ink dark:stroke-paper"
                          }
                          strokeWidth={1.4}
                        />
                      ) : (
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={22}
                          className={
                            isActive
                              ? "fill-signal stroke-signal"
                              : "fill-paper dark:fill-void stroke-ink dark:stroke-paper"
                          }
                          strokeWidth={1.4}
                        />
                      )}
                      <text
                        x={node.x}
                        y={node.y - 32}
                        textAnchor="middle"
                        className={`font-mono text-[10px] uppercase tracking-wide ${
                          isActive
                            ? "fill-signal"
                            : "fill-ink-soft dark:fill-paper/60"
                        }`}
                      >
                        {node.label}
                      </text>
                    </g>
                  );
                })}
              </svg>

              <div className="mt-5 min-h-[52px] border-t border-line dark:border-line-dark pt-4">
                {activeNode ? (
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-widest2 text-signal">
                      {activeNode.label}
                    </span>
                    <p className="mt-1.5 font-body text-[13px] leading-relaxed text-ink-soft dark:text-paper/70">
                      {activeNode.detail}
                    </p>
                  </div>
                ) : (
                  <p className="font-mono text-[11px] text-ink-faint dark:text-paper/35">
                    Hover or tap a node to inspect it.
                  </p>
                )}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
