import { Eyebrow } from "@/components/eyebrow";
import { Reveal } from "@/components/reveal";

const rawSources = [
  "Login attempts",
  "Failed authentication",
  "Network connections",
  "Firewall events",
  "Process execution",
  "File modifications",
  "API requests",
  "Cloud activity",
];

export function Problem() {
  return (
    <section className="border-b border-line dark:border-line-dark">
      <div className="mx-auto max-w-[1400px] px-6 py-20 lg:px-10 lg:py-28">
        <div className="grid gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <Reveal>
            <Eyebrow>The problem</Eyebrow>
            <h2 className="mt-5 max-w-md font-display text-4xl font-700 leading-[1.05] tracking-tighter text-balance">
              Analysts don&rsquo;t have a detection problem.
              <br />
              They have a{" "}
              <span className="text-signal">drowning</span> problem.
            </h2>
            <p className="mt-6 max-w-md font-body text-[15px] leading-relaxed text-ink-soft dark:text-paper/70">
              A single organization can generate millions of events a day
              across servers, endpoints, applications, and the network.
              Almost all of it is normal. A traditional system still turns
              it into a wall of disconnected alerts, and it&rsquo;s left to a
              human to work out which ones are actually the same attack.
            </p>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="border border-line dark:border-line-dark">
              <div className="grid grid-cols-1 divide-y divide-line dark:divide-line-dark sm:grid-cols-2 sm:divide-y-0 sm:divide-x">
                <div className="p-6">
                  <span className="font-mono text-[10px] uppercase tracking-widest2 text-ink-faint dark:text-paper/50">
                    What gets generated
                  </span>
                  <ul className="mt-4 space-y-2.5">
                    {rawSources.map((s) => (
                      <li
                        key={s}
                        className="font-mono text-[12.5px] text-ink-soft dark:text-paper/70"
                      >
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-col justify-between bg-paper-dim/60 dark:bg-void-surface/60 p-6">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-widest2 text-ink-faint dark:text-paper/50">
                      What an analyst needs
                    </span>
                    <p className="mt-4 font-body text-[14px] leading-relaxed text-ink-soft dark:text-paper/70">
                      Not more alerts. One incident, already connected, with
                      a reason attached &mdash; so the next question is
                      &ldquo;what do I do about it,&rdquo; not &ldquo;is
                      this even related.&rdquo;
                    </p>
                  </div>
                  <div className="mt-6 border border-signal/40 bg-signal-soft dark:bg-signal/10 px-4 py-3">
                    <span className="font-mono text-[11px] text-signal">
                      → Possible Server Compromise
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
