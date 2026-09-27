"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDown } from "lucide-react";
import { Eyebrow } from "@/components/eyebrow";
import { CountUp } from "@/components/count-up";
import { RadialGauge } from "@/components/radial-gauge";
import { stats, rawAlerts, correlatedChain } from "@/lib/content";

const chipRotations = [-3, 2, -1.5, 3, -2, 1.5, -3.5, 2.5];

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden border-b border-line dark:border-line-dark">
      <div className="bg-grid absolute inset-0 opacity-[0.55] dark:opacity-[0.35]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-paper dark:from-void to-transparent" />

      <div className="relative mx-auto max-w-[1400px] px-6 pb-20 pt-16 lg:px-10 lg:pb-28 lg:pt-20">
        <div className="grid gap-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
          {/* Left: headline */}
          <div>
            <Eyebrow tone="signal">AI-Powered Security Operations Center</Eyebrow>

            <h1 className="mt-6 max-w-xl font-display text-[13vw] font-700 leading-[0.98] tracking-tightest text-balance sm:text-6xl lg:text-[4rem]">
              128,421 events.
              <br />
              <span className="text-signal">7</span> things that
              <br />
              actually matter.
            </h1>

            <p className="mt-7 max-w-md font-body text-[15.5px] leading-relaxed text-ink-soft dark:text-paper/70">
              Most of what hits a SOC every day is noise. AegisSOC runs every
              event through rules and machine learning, correlates what&rsquo;s
              related, scores the risk, and hands your analysts a short list
              of incidents worth their attention &mdash; each one already
              explained.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <a
                href="#request"
                className="group inline-flex items-center gap-2 bg-ink dark:bg-paper px-5 py-3 font-mono text-xs uppercase tracking-wideish text-paper dark:text-ink transition-colors hover:bg-signal dark:hover:bg-signal dark:hover:text-paper"
              >
                Request a demo
                <ArrowUpRight
                  size={14}
                  className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </a>
              <a
                href="#pipeline"
                className="inline-flex items-center gap-2 border border-line dark:border-line-dark px-5 py-3 font-mono text-xs uppercase tracking-wideish text-ink dark:text-paper transition-colors hover:border-signal hover:text-signal"
              >
                See the pipeline
              </a>
            </div>

            {/* Stat strip */}
            <div className="mt-14 grid grid-cols-2 gap-px border border-line dark:border-line-dark bg-line dark:bg-line-dark sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label} className="bg-paper dark:bg-void px-4 py-4">
                  <CountUp
                    value={s.value}
                    className="block font-mono text-2xl font-600 tabular-nums text-ink dark:text-paper"
                  />
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-wideish text-ink-faint dark:text-paper/50">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: signature visual — scattered alerts converging into one incident */}
          <div className="relative">
            <div className="relative border border-line dark:border-line-dark bg-paper/60 dark:bg-void-surface/60 p-6">
              <div className="mb-5 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest2 text-ink-faint dark:text-paper/50">
                  Before correlation
                </span>
                <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wideish text-ink-faint dark:text-paper/50">
                  <span className="h-1.5 w-1.5 animate-blink rounded-full bg-signal" />
                  live
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {rawAlerts.map((alert, i) => (
                  <motion.span
                    key={alert + i}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + i * 0.08, duration: 0.4 }}
                    style={{ rotate: `${chipRotations[i % chipRotations.length]}deg` }}
                    className="border border-line dark:border-line-dark bg-paper dark:bg-void px-2.5 py-1.5 font-mono text-[10.5px] text-ink-soft dark:text-paper/70"
                  >
                    {alert}
                  </motion.span>
                ))}
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 1.0, duration: 0.5 }}
                className="my-6 flex flex-col items-center gap-1.5"
              >
                <div className="h-8 w-px bg-gradient-to-b from-line dark:from-line-dark to-signal" />
                <span className="flex items-center gap-1.5 border border-signal/40 bg-signal-soft dark:bg-signal/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wideish text-signal">
                  <ArrowDown size={11} /> correlation engine
                </span>
                <div className="h-8 w-px bg-gradient-to-b from-signal to-line dark:to-line-dark" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 1.3, duration: 0.5 }}
                className="border border-ink dark:border-paper bg-ink dark:bg-void-raised p-4"
              >
                <div className="flex items-center justify-between border-b border-paper/15 dark:border-paper/10 pb-3">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest2 text-paper/50">
                      Incident #1042
                    </div>
                    <div className="mt-1 font-display text-sm font-500 text-paper">
                      Possible Server Compromise
                    </div>
                  </div>
                  <RadialGauge value={97} size={46} stroke={3.5} />
                </div>
                <ol className="mt-3 space-y-1.5">
                  {correlatedChain.map((step, i) => (
                    <li
                      key={step}
                      className="flex items-center gap-2 font-mono text-[11px] text-paper/70"
                    >
                      <span className="text-paper/30">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
