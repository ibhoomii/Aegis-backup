import { Eyebrow } from "@/components/eyebrow";
import { Reveal } from "@/components/reveal";
import { TiltCard } from "@/components/tilt-card";
import { phases } from "@/lib/content";

export function Capabilities() {
  return (
    <section id="capabilities" className="border-b border-line dark:border-line-dark">
      <div className="mx-auto max-w-[1400px] px-6 py-20 lg:px-10 lg:py-28">
        <Reveal>
          <Eyebrow>Capabilities, by phase</Eyebrow>
          <h2 className="mt-5 max-w-2xl font-display text-4xl font-700 leading-[1.05] tracking-tighter text-balance">
            Four jobs. Twelve capabilities.
          </h2>
        </Reveal>

        <div className="mt-16 divide-y divide-line dark:divide-line-dark border-t border-line dark:border-line-dark">
          {phases.map((phase, pi) => (
            <Reveal key={phase.id} delay={pi * 0.05}>
              <div className="grid gap-8 py-12 lg:grid-cols-[0.85fr_2.15fr] lg:gap-12">
                <div>
                  <span className="font-mono text-xs text-signal">{phase.index}</span>
                  <h3 className="mt-2 font-display text-2xl font-700 tracking-tighter">
                    {phase.title}
                  </h3>
                  <p className="mt-3 max-w-xs font-body text-[13.5px] leading-relaxed text-ink-soft dark:text-paper/60">
                    {phase.description}
                  </p>
                </div>

                <div className="grid gap-px bg-line dark:bg-line-dark sm:grid-cols-2 lg:grid-cols-3">
                  {phase.capabilities.map((cap) => (
                    <TiltCard
                      key={cap.name}
                      className="overflow-hidden bg-paper dark:bg-void p-5 transition-colors hover:bg-paper-dim dark:hover:bg-void-surface"
                    >
                      <h4 className="relative font-display text-[14.5px] font-500 leading-snug">
                        {cap.name}
                      </h4>
                      <p className="relative mt-2.5 font-body text-[12.5px] leading-relaxed text-ink-soft dark:text-paper/55">
                        {cap.detail}
                      </p>
                    </TiltCard>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
