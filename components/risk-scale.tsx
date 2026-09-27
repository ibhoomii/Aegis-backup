import { severityScale } from "@/lib/content";

const barTone: Record<string, string> = {
  clearance: "bg-clearance",
  caution: "bg-caution",
  signal: "bg-signal",
};

export function RiskScale() {
  return (
    <section className="border-b border-line dark:border-line-dark">
      <div className="mx-auto max-w-[1400px] px-6 py-10 lg:px-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex-none font-mono text-[10px] uppercase tracking-widest2 text-ink-faint dark:text-paper/40">
            Every incident gets one number, 0–100
          </span>
          <div className="flex h-2.5 flex-1 overflow-hidden">
            <div className="h-full w-[25%] bg-clearance" />
            <div className="h-full w-[25%] bg-caution/70" />
            <div className="h-full w-[25%] bg-caution" />
            <div className="h-full w-[25%] bg-signal" />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 sm:justify-end">
          {severityScale.map((s) => (
            <span
              key={s.label}
              className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wideish text-ink-faint dark:text-paper/40"
            >
              <span className={`h-1.5 w-1.5 ${barTone[s.tone]}`} />
              {s.range} {s.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
