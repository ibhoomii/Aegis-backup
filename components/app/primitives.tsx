import type { ReactNode } from "react";
import type { Severity, IncidentStatus } from "@/lib/soc-data";

// Severity: Critical is the only solid-filled badge so it always draws the eye;
// High / Medium / Low are soft-outlined in the existing semantic tones.
const severityClass: Record<Severity, string> = {
  Critical: "border-signal bg-signal text-paper",
  High: "border-signal/50 bg-signal-soft text-signal dark:bg-signal/10",
  Medium: "border-caution/50 bg-caution-soft text-caution dark:bg-caution/10",
  Low: "border-clearance/50 bg-clearance-soft text-clearance dark:bg-clearance/10",
};

export function SeverityBadge({
  level,
  className = "",
}: {
  level: Severity;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center border px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wideish ${severityClass[level]} ${className}`}
    >
      {level}
    </span>
  );
}

const statusDot: Record<IncidentStatus, string> = {
  Investigating: "bg-signal",
  Open: "bg-caution",
  Contained: "bg-clearance",
  Monitoring: "bg-caution/60",
  Resolved: "bg-ink-faint dark:bg-paper/40",
};

export function StatusBadge({ status }: { status: IncidentStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wideish text-ink-soft dark:text-paper/60">
      <span className={`h-1.5 w-1.5 flex-none rounded-full ${statusDot[status]}`} />
      {status}
    </span>
  );
}

// Bordered surface with an optional mono eyebrow label + right-side slot.
// Matches the site's hairline / sharp-corner cards.
export function Panel({
  label,
  right,
  children,
  className = "",
  bodyClassName = "",
}: {
  label?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`border border-line dark:border-line-dark bg-paper dark:bg-void ${className}`}
    >
      {label && (
        <header className="flex items-center justify-between gap-3 border-b border-line dark:border-line-dark px-4 py-2.5">
          <span className="font-mono text-[10px] uppercase tracking-widest2 text-ink-faint dark:text-paper/50">
            {label}
          </span>
          {right}
        </header>
      )}
      <div className={bodyClassName || "p-4"}>{children}</div>
    </section>
  );
}

export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-line dark:border-line-dark pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <span className="font-mono text-[11px] uppercase tracking-widest2 text-signal">
          {eyebrow}
        </span>
        <h1 className="mt-2 font-display text-3xl font-700 tracking-tighter sm:text-[2.1rem]">
          {title}
        </h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </div>
  );
}

// Risk number rendered in its severity tone (used in tables / headers).
export function riskTone(risk: number) {
  if (risk >= 76) return "text-signal";
  if (risk >= 51) return "text-caution";
  if (risk >= 26) return "text-caution";
  return "text-clearance";
}
