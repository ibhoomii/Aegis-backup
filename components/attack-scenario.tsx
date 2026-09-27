import { Eyebrow } from "@/components/eyebrow";
import { Reveal } from "@/components/reveal";
import { RadialGauge } from "@/components/radial-gauge";
import { CheckCircle2 } from "lucide-react";
import { scenario } from "@/lib/content";

const tagTone: Record<string, string> = {
  RULE: "text-ink-soft dark:text-paper/60 border-line dark:border-line-dark",
  ML: "text-caution border-caution/50 bg-caution-soft dark:bg-caution/10",
  INTEL: "text-clearance border-clearance/50 bg-clearance-soft dark:bg-clearance/10",
  INCIDENT: "text-signal border-signal/50 bg-signal-soft dark:bg-signal/10",
};

export function AttackScenario() {
  return (
    <section className="border-b border-line dark:border-line-dark">
      <div className="mx-auto max-w-[1400px] px-6 py-20 lg:px-10 lg:py-28">
        <Reveal>
          <Eyebrow>Walkthrough</Eyebrow>
          <h2 className="mt-5 max-w-2xl font-display text-4xl font-700 leading-[1.05] tracking-tighter text-balance">
            One night on <span className="font-mono text-signal">{scenario.asset}</span>
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-14 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <Reveal delay={0.1}>
            <ol className="space-y-0">
              {scenario.timeline.map((event, i) => (
                <li key={i} className="relative flex gap-5 pb-8 last:pb-0">
                  {i < scenario.timeline.length - 1 && (
                    <span className="absolute left-[27px] top-6 h-full w-px bg-line dark:bg-line-dark" />
                  )}
                  <span className="w-14 flex-none pt-0.5 font-mono text-[11px] tabular-nums text-ink-faint dark:text-paper/40">
                    {event.time}
                  </span>
                  <span className="relative z-10 mt-1 h-2.5 w-2.5 flex-none rounded-full border-2 border-paper dark:border-void bg-ink dark:bg-paper" />
                  <div className="flex-1 pb-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-display text-[14.5px] font-500">{event.title}</h4>
                      <span
                        className={`border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wideish ${tagTone[event.tag]}`}
                      >
                        {event.tag}
                      </span>
                    </div>
                    <p className="mt-1.5 max-w-sm font-body text-[13px] leading-relaxed text-ink-soft dark:text-paper/60">
                      {event.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>

          <Reveal delay={0.2}>
            <div className="border border-ink dark:border-paper bg-ink dark:bg-void-raised p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-widest2 text-paper/50">
                    AI investigation summary
                  </span>
                  <h4 className="mt-1.5 font-display text-lg font-500 text-paper">
                    Incident #1042
                  </h4>
                </div>
                <RadialGauge value={97} size={64} stroke={4.5} label="Critical" />
              </div>
              <p className="mt-4 font-body text-[14px] leading-relaxed text-paper/85">
                {scenario.summary}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {scenario.mitre.map((m) => (
                  <span
                    key={m}
                    className="border border-paper/20 px-2 py-1 font-mono text-[10px] text-paper/70"
                  >
                    {m}
                  </span>
                ))}
              </div>

              <div className="mt-6 border-t border-paper/15 pt-5">
                <span className="font-mono text-[10px] uppercase tracking-widest2 text-paper/50">
                  Recommended actions
                </span>
                <ul className="mt-3 space-y-2">
                  {scenario.recommended.map((r) => (
                    <li key={r} className="flex items-start gap-2 font-body text-[13px] text-paper/80">
                      <CheckCircle2 size={14} className="mt-0.5 flex-none text-clearance" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                className="mt-6 w-full border border-signal bg-signal py-2.5 font-mono text-[11px] uppercase tracking-wideish text-paper transition-colors hover:bg-signal-dim"
              >
                Approve response
              </button>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
