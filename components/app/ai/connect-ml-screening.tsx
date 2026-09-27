"use client";

// Post-analysis ML screening + AI review for the /connect page.
// `screening` is the summary produced while analyzing the logs (may be null
// when the ML service was offline); the AI review is user-triggered.

import { useState } from "react";
import { BrainCircuit, Sparkles, Loader2, AlertTriangle, ShieldCheck } from "lucide-react";
import { Panel, SeverityBadge, riskTone } from "@/components/app/primitives";
import { askAi } from "@/lib/ai/digest";
import type { MlScreening } from "@/lib/dataset";
import type { NormalizedEvent } from "@/lib/ingest/parse";

type LogInsights = {
  overview: string;
  notableFindings: string[];
  dataQuality: string[];
  suggestedNext: string[];
};

const levelToSeverity = {
  Critical: "Critical",
  High: "High",
  Medium: "Medium",
  Low: "Low",
} as const;

export function ConnectMlScreening({
  screening,
  events,
  files,
}: {
  screening: MlScreening | null;
  events: NormalizedEvent[];
  files: { name: string; format: string; events: number }[];
}) {
  const [insights, setInsights] = useState<LogInsights | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function review() {
    setBusy(true);
    setError(null);
    try {
      const result = await askAi<LogInsights>("logInsights", {
        files,
        heuristics: {
          totalParsed: events.length,
          actions: Object.entries(
            events.reduce<Record<string, number>>((acc, e) => {
              acc[e.action] = (acc[e.action] ?? 0) + 1;
              return acc;
            }, {}),
          )
            .map(([action, n]) => ({ action, count: n }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8),
        },
        mlScreening: screening,
        sampleLines: events.slice(0, 12).map((e) => e.raw.slice(0, 200)),
      });
      setInsights(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "AI review failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      label="ML screening + AI review"
      right={
        <button
          onClick={review}
          disabled={busy}
          className="inline-flex items-center gap-1.5 border border-clearance/50 bg-clearance-soft px-3 py-1.5 font-mono text-[10px] uppercase tracking-wideish text-clearance transition-colors hover:bg-clearance hover:text-paper dark:bg-clearance/10 disabled:opacity-50"
        >
          {busy ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
          {busy ? "Gemini is reviewing..." : insights ? "Re-run" : "AI review"}
        </button>
      }
    >
      {screening ? (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-px border border-line bg-line dark:border-line-dark dark:bg-line-dark">
            {[
              ["Scored", String(screening.scored)],
              ["ML flagged", String(screening.flagged)],
              ["Max risk", screening.maxRisk.toFixed(1)],
              ["Avg risk", screening.avgRisk.toFixed(1)],
            ].map(([label, v]) => (
              <div key={label} className="bg-paper p-3 dark:bg-void">
                <div className="font-mono text-[8.5px] uppercase tracking-wideish text-ink-faint dark:text-paper/45">{label}</div>
                <div className="mt-0.5 font-mono text-[15px] font-600 tabular-nums text-ink dark:text-paper">{v}</div>
              </div>
            ))}
          </div>

          {screening.topEvents.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left">
                <thead>
                  <tr className="border-b border-line dark:border-line-dark">
                    {["Risk", "Level", "Action", "Source", "Top reason"].map((h) => (
                      <th key={h} className="pb-2 font-mono text-[9px] uppercase tracking-widest2 text-ink-faint dark:text-paper/45">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line dark:divide-line-dark">
                  {screening.topEvents.slice(0, 6).map((e, i) => (
                    <tr key={i} className="transition-colors hover:bg-paper-dim/60 dark:hover:bg-void-surface/50">
                      <td className={`px-1 py-2.5 font-mono text-[12px] font-600 tabular-nums ${riskTone(e.risk)}`}>{e.risk.toFixed(1)}</td>
                      <td className="px-1 py-2.5"><SeverityBadge level={levelToSeverity[e.level as keyof typeof levelToSeverity]} /></td>
                      <td className="px-1 py-2.5 font-mono text-[10.5px] text-ink dark:text-paper/85">{e.action}</td>
                      <td className="px-1 py-2.5 font-mono text-[10.5px] text-ink-soft dark:text-paper/60">{e.sourceIp ?? "—"}</td>
                      <td className="px-1 py-2.5 font-mono text-[10px] text-ink-soft dark:text-paper/60">{e.reasons[0] ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="flex items-center gap-2 font-mono text-[11px] text-clearance">
              <ShieldCheck size={14} /> The ML engine flagged no anomalies in this data.
            </p>
          )}
          <p className="font-mono text-[9.5px] text-ink-faint dark:text-paper/35">
            Scored by the NSL-KDD Isolation Forest (engine 1) via feature mapping — see the ML
            Detection page for the full breakdown.
          </p>
        </div>
      ) : (
        <p className="flex items-center gap-2 font-mono text-[11px] text-ink-faint dark:text-paper/45">
          <BrainCircuit size={13} />
          ML screening was skipped (ML service offline) — start uvicorn and re-analyze to score
          these events.
        </p>
      )}

      {error && (
        <p className="mt-3 flex items-center gap-1.5 font-mono text-[10.5px] text-signal">
          <AlertTriangle size={12} /> {error}
        </p>
      )}
      {insights && (
        <div className="mt-4 space-y-2.5 border-t border-line pt-3.5 dark:border-line-dark">
          <p className="text-[12.5px] leading-relaxed text-ink dark:text-paper/85">{insights.overview}</p>
          {insights.notableFindings?.length > 0 && (
            <ul className="space-y-1">
              {insights.notableFindings.map((f) => (
                <li key={f} className="flex items-start gap-2 font-mono text-[10.5px] leading-relaxed text-ink-soft dark:text-paper/60">
                  <span className="mt-1.5 h-1 w-1 flex-none bg-signal" />{f}
                </li>
              ))}
            </ul>
          )}
          {insights.suggestedNext?.length > 0 && (
            <ol className="space-y-1">
              {insights.suggestedNext.map((s, i) => (
                <li key={s} className="flex items-start gap-2 font-mono text-[10.5px] leading-relaxed text-ink-soft dark:text-paper/60">
                  <span className="font-600 text-clearance">{i + 1}.</span>{s}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </Panel>
  );
}
