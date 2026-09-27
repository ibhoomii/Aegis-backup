import { Check, Minus } from "lucide-react";
import { Eyebrow } from "@/components/eyebrow";
import { Reveal } from "@/components/reveal";

const rows: { dimension: string; traditional: string; aegis: string }[] = [
  {
    dimension: "Alert volume",
    traditional: "Thousands of disconnected alerts land in a queue.",
    aegis: "Related alerts collapse into one correlated incident.",
  },
  {
    dimension: "Triage",
    traditional: "Manual, tab-by-tab investigation across tools.",
    aegis: "A reconstructed timeline with a confidence score.",
  },
  {
    dimension: "Prioritisation",
    traditional: "Severity is a guess; everything looks urgent.",
    aegis: "A 0–100 risk score weighted by real impact.",
  },
  {
    dimension: "Context",
    traditional: "Analyst hunts for threat intel and technique mapping.",
    aegis: "Threat intel and MITRE ATT&CK attached automatically.",
  },
  {
    dimension: "Explainability",
    traditional: "Black-box scoring you have to trust blindly.",
    aegis: "Every score ships the reasons behind it.",
  },
  {
    dimension: "Response",
    traditional: "Copy-paste runbooks, executed by hand.",
    aegis: "Recommended actions, executed only after approval.",
  },
];

export function Comparison() {
  return (
    <section id="comparison" className="border-b border-line dark:border-line-dark">
      <div className="mx-auto max-w-[1400px] px-6 py-20 lg:px-10 lg:py-28">
        <Reveal className="max-w-2xl">
          <Eyebrow tone="signal">The difference</Eyebrow>
          <h2 className="mt-5 font-display text-4xl font-700 leading-[1.05] tracking-tighter text-balance">
            Same events.
            <br />A completely different <span className="text-signal">morning</span>.
          </h2>
          <p className="mt-6 font-body text-[15px] leading-relaxed text-ink-soft dark:text-paper/70">
            Traditional tooling stops at detection and hands an analyst a pile of alerts. AegisSOC
            carries the work through correlation, scoring, explanation, and a controlled response.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mt-12">
          <div className="border border-line dark:border-line-dark">
            {/* header */}
            <div className="hidden grid-cols-[0.7fr_1fr_1fr] border-b border-line dark:border-line-dark md:grid">
              <div className="px-5 py-3" />
              <div className="border-l border-line px-5 py-3 font-mono text-[10px] uppercase tracking-widest2 text-ink-faint dark:border-line-dark dark:text-paper/45">
                Traditional SOC
              </div>
              <div className="border-l border-line bg-signal-soft/50 px-5 py-3 font-mono text-[10px] uppercase tracking-widest2 text-signal dark:border-line-dark dark:bg-signal/10">
                AegisSOC
              </div>
            </div>

            {/* rows */}
            <div className="divide-y divide-line dark:divide-line-dark">
              {rows.map((r) => (
                <div key={r.dimension} className="grid grid-cols-1 md:grid-cols-[0.7fr_1fr_1fr]">
                  <div className="px-5 py-4 font-mono text-[11px] uppercase tracking-wideish text-ink dark:text-paper/80">
                    {r.dimension}
                  </div>
                  <div className="flex items-start gap-2.5 border-line px-5 py-4 dark:border-line-dark md:border-l">
                    <Minus size={14} className="mt-0.5 flex-none text-ink-faint dark:text-paper/30" />
                    <span className="font-body text-[13.5px] leading-relaxed text-ink-soft dark:text-paper/55">
                      {r.traditional}
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5 border-line bg-signal-soft/30 px-5 py-4 dark:border-line-dark dark:bg-signal/5 md:border-l">
                    <Check size={14} className="mt-0.5 flex-none text-signal" />
                    <span className="font-body text-[13.5px] leading-relaxed text-ink dark:text-paper/80">
                      {r.aegis}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
