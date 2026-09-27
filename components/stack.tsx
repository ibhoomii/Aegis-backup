import { Eyebrow } from "@/components/eyebrow";
import { Reveal } from "@/components/reveal";
import { stack } from "@/lib/content";

export function Stack() {
  return (
    <section id="stack" className="border-b border-line dark:border-line-dark">
      <div className="mx-auto max-w-[1400px] px-6 py-20 lg:px-10 lg:py-28">
        <Reveal>
          <Eyebrow>Under the hood</Eyebrow>
          <h2 className="mt-5 max-w-2xl font-display text-4xl font-700 leading-[1.05] tracking-tighter text-balance">
            Built on a stack that scales with log volume, not around it.
          </h2>
        </Reveal>

        <Reveal delay={0.1} className="mt-14">
          <div className="border border-line dark:border-line-dark">
            {stack.map((group, i) => (
              <div
                key={group.label}
                className={`group grid gap-4 border-l-2 border-l-transparent px-6 py-5 transition-colors duration-200 hover:border-l-signal hover:bg-paper-dim/50 dark:hover:bg-void-surface/40 sm:grid-cols-[160px_1fr] sm:items-baseline sm:gap-8 ${
                  i !== stack.length - 1 ? "border-b border-line dark:border-line-dark" : ""
                }`}
              >
                <div>
                  <span className="font-mono text-[12px] font-500 text-ink transition-colors duration-200 group-hover:text-signal dark:text-paper">
                    {group.label}
                  </span>
                  <span className="mt-0.5 block font-mono text-[10.5px] text-ink-faint dark:text-paper/40">
                    // {group.comment}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-2 gap-y-2">
                  {group.items.map((item) => (
                    <span
                      key={item}
                      className="border border-line dark:border-line-dark px-2.5 py-1 font-mono text-[11.5px] text-ink-soft dark:text-paper/70"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
