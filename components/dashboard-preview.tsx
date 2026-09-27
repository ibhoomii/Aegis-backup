import Link from "next/link";
import { Eyebrow } from "@/components/eyebrow";
import { Reveal } from "@/components/reveal";
import { CountUp } from "@/components/count-up";
import { Search, ArrowRight } from "lucide-react";
import { stats, dashboard } from "@/lib/content";

const riskTone: Record<string, string> = {
  Critical: "border-signal text-signal bg-signal-soft dark:bg-signal/10",
  High: "border-caution text-caution bg-caution-soft dark:bg-caution/10",
};

export function DashboardPreview() {
  return (
    <section id="dashboard" className="border-b border-line dark:border-line-dark bg-paper-dim/50 dark:bg-void-surface/30">
      <div className="mx-auto max-w-[1400px] px-6 py-20 lg:px-10 lg:py-28">
        <Reveal className="mx-auto max-w-2xl text-center">
          <div className="flex justify-center">
            <Eyebrow>The workspace</Eyebrow>
          </div>
          <h2 className="mt-5 font-display text-4xl font-700 leading-[1.05] tracking-tighter text-balance">
            Everything an analyst needs, one screen.
          </h2>
        </Reveal>

        <Reveal delay={0.1} className="mt-14">
          <div className="mx-auto max-w-5xl border border-line dark:border-line-dark bg-paper dark:bg-void shadow-[0_1px_0_0_rgba(0,0,0,0.02)]">
            {/* window chrome */}
            <div className="flex items-center justify-between border-b border-line dark:border-line-dark px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 border border-line dark:border-line-dark" />
                <span className="h-2.5 w-2.5 border border-line dark:border-line-dark" />
                <span className="h-2.5 w-2.5 border border-line dark:border-line-dark" />
              </div>
              <span className="font-mono text-[10px] uppercase tracking-wideish text-ink-faint dark:text-paper/40">
                AegisSOC / overview
              </span>
              <div className="flex items-center gap-1.5 border border-line dark:border-line-dark px-2 py-1">
                <Search size={10} className="text-ink-faint dark:text-paper/40" />
                <span className="font-mono text-[9.5px] text-ink-faint dark:text-paper/40">
                  search
                </span>
              </div>
            </div>

            {/* stat row */}
            <div className="grid grid-cols-2 divide-x divide-y divide-line dark:divide-line-dark sm:grid-cols-4 sm:divide-y-0">
              {stats.map((s) => (
                <div key={s.label} className="px-5 py-4">
                  <CountUp value={s.value} className="block font-mono text-xl font-600 tabular-nums" />
                  <div className="mt-1 font-mono text-[9.5px] uppercase tracking-wideish text-ink-faint dark:text-paper/40">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid divide-y divide-line dark:divide-line-dark lg:grid-cols-[1.5fr_1fr] lg:divide-x lg:divide-y-0">
              {/* activity + mitre */}
              <div className="divide-y divide-line dark:divide-line-dark">
                <div className="p-5">
                  <span className="font-mono text-[9.5px] uppercase tracking-wideish text-ink-faint dark:text-paper/40">
                    Attack activity
                  </span>
                  <svg viewBox="0 0 400 90" className="mt-4 h-20 w-full overflow-visible">
                    <polyline
                      points="0,70 30,66 60,68 90,40 120,55 150,20 180,45 210,35 240,60 270,15 300,42 330,50 360,10 400,38"
                      fill="none"
                      className="stroke-ink/25 dark:stroke-paper/20"
                      strokeWidth="1.5"
                    />
                    <circle cx="360" cy="10" r="3" className="fill-signal" />
                  </svg>
                </div>
                <div className="p-5">
                  <span className="font-mono text-[9.5px] uppercase tracking-wideish text-ink-faint dark:text-paper/40">
                    MITRE ATT&amp;CK observed
                  </span>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {dashboard.mitreRow.map((m) => (
                      <span
                        key={m}
                        className="border border-line dark:border-line-dark px-2 py-1 font-mono text-[10px] text-ink-soft dark:text-paper/70"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* threats + intel + asset risk */}
              <div className="divide-y divide-line dark:divide-line-dark">
                <div className="p-5">
                  <span className="font-mono text-[9.5px] uppercase tracking-wideish text-ink-faint dark:text-paper/40">
                    Top threats
                  </span>
                  <ul className="mt-3 space-y-1.5">
                    {dashboard.topThreats.map((t) => (
                      <li key={t} className="font-body text-[12.5px] text-ink-soft dark:text-paper/70">
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-5">
                  <span className="font-mono text-[9.5px] uppercase tracking-wideish text-ink-faint dark:text-paper/40">
                    Asset risk
                  </span>
                  <ul className="mt-3 space-y-2">
                    {dashboard.assetRisk.map((a) => (
                      <li key={a.name} className="flex items-center justify-between">
                        <span className="font-body text-[12.5px] text-ink-soft dark:text-paper/70">
                          {a.name}
                        </span>
                        <span
                          className={`border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wideish ${riskTone[a.level]}`}
                        >
                          {a.level}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* AI analyst input */}
            <div className="border-t border-line dark:border-line-dark p-4">
              <Link
                href="/analyst"
                className="group flex items-center gap-2 border border-line px-3 py-2.5 transition-colors hover:border-signal dark:border-line-dark"
              >
                <span className="h-1.5 w-1.5 flex-none rounded-full bg-clearance" />
                <span className="font-mono text-[12px] text-ink-faint dark:text-paper/40">
                  Ask AegisSOC anything &mdash; &ldquo;why is incident #1042 critical?&rdquo;
                </span>
                <ArrowRight
                  size={13}
                  className="ml-auto flex-none text-ink-faint transition-all group-hover:translate-x-0.5 group-hover:text-signal dark:text-paper/40"
                />
              </Link>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center gap-3">
            <Link
              href="/start"
              className="group inline-flex items-center gap-2 border border-ink bg-ink px-5 py-3 font-mono text-[11px] uppercase tracking-wideish text-paper transition-colors hover:border-signal hover:bg-signal dark:border-paper dark:bg-paper dark:text-ink dark:hover:border-signal dark:hover:bg-signal dark:hover:text-paper"
            >
              Open the live console
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <p className="font-mono text-[11px] text-ink-faint dark:text-paper/40">
              Two ways in — explore the demo, or upload your own logs.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
