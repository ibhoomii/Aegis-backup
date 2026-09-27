"use client";

import { Eyebrow } from "@/components/eyebrow";
import { Reveal } from "@/components/reveal";
import { pipelineStages } from "@/lib/content";

export function Pipeline() {
  return (
    <section id="pipeline" className="border-b border-line dark:border-line-dark">
      <div className="mx-auto max-w-[1400px] px-6 py-20 lg:px-10 lg:py-28">
        <Reveal>
          <Eyebrow>How an event becomes an answer</Eyebrow>
          <h2 className="mt-5 max-w-2xl font-display text-4xl font-700 leading-[1.05] tracking-tighter text-balance">
            One pipeline, eleven checkpoints, one incident.
          </h2>
          <p className="mt-6 max-w-xl font-body text-[15px] leading-relaxed text-ink-soft dark:text-paper/70">
            Every event passes through the same route, from the moment it
            leaves a server to the moment a human approves a response.
            Nothing skips a step.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mt-14">
          <div className="-mx-6 overflow-x-auto px-6 pb-4 lg:mx-0 lg:overflow-visible lg:px-0">
            <div className="relative flex w-max min-w-full items-stretch gap-0 lg:w-full">
              {pipelineStages.map((stage, i) => (
                <div key={stage} className="group relative flex items-stretch">
                  <div className="flex w-[170px] flex-col justify-between border border-line dark:border-line-dark px-4 py-5 transition-colors duration-200 hover:border-signal lg:w-auto lg:flex-1">
                    <span className="font-mono text-[10px] text-ink-faint transition-colors duration-200 group-hover:text-signal dark:text-paper/40">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="mt-6 font-display text-[13.5px] font-500 leading-snug">
                      {stage}
                    </span>
                  </div>
                  {i < pipelineStages.length - 1 && (
                    <div className="flex w-4 flex-none items-center justify-center lg:w-3">
                      <span className="text-ink-faint transition-colors duration-200 group-hover:text-signal dark:text-paper/30">
                        →
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.15} className="mt-6 flex flex-wrap gap-x-8 gap-y-2">
          <span className="font-mono text-[10px] uppercase tracking-wideish text-ink-faint dark:text-paper/40">
            Step 04 runs two engines side by side — rules for the known, ML for the new
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wideish text-ink-faint dark:text-paper/40">
            Step 10 is never automatic on production systems
          </span>
        </Reveal>
      </div>
    </section>
  );
}
