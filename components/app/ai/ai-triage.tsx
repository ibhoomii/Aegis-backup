"use client";

// AI incident triage: structured Gemini analysis (handover summary, likely
// assessment, IOCs found in the record, severity opinion, prioritized
// response actions and open questions) rendered on the incident detail page.

import { useState } from "react";
import { Bot, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { Panel, SeverityBadge } from "@/components/app/primitives";
import { useDataSource } from "@/components/app/data-source";
import { buildDatasetDigest, askAi } from "@/lib/ai/digest";
import type { Incident } from "@/lib/soc-data";

type Triage = {
  summary: string;
  assessment: string;
  iocs: { type: string; value: string; note: string }[];
  severityOpinion: "Critical" | "High" | "Medium" | "Low";
  recommendedActions: string[];
  questions: string[];
};

export function AiTriage({ incident }: { incident: Incident }) {
  const { dataset } = useDataSource();
  const [triage, setTriage] = useState<Triage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const result = await askAi<Triage>("incident", {
        incident: {
          id: incident.id,
          title: incident.title,
          severity: incident.severity,
          risk: incident.risk,
          status: incident.status,
          asset: incident.asset,
          mitre: incident.mitre,
          summary: incident.summary,
          confidence: incident.confidence,
          assignee: incident.assignee,
          opened: incident.opened,
        },
        datasetDigest: buildDatasetDigest(dataset),
      });
      setTriage(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "AI triage failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      label="AI triage - Gemini"
      right={
        <button
          onClick={run}
          disabled={busy}
          className="inline-flex items-center gap-1.5 border border-clearance/50 bg-clearance-soft px-3 py-1.5 font-mono text-[10px] uppercase tracking-wideish text-clearance transition-colors hover:bg-clearance hover:text-paper dark:bg-clearance/10 disabled:opacity-50"
        >
          {busy ? <Loader2 size={11} className="animate-spin" /> : triage ? <RefreshCw size={11} /> : <Bot size={11} />}
          {busy ? "Analyzing..." : triage ? "Re-run" : "Run AI triage"}
        </button>
      }
    >
      {error && (
        <div className="flex items-start gap-2.5">
          <AlertTriangle size={14} className="mt-0.5 flex-none text-signal" />
          <p className="font-mono text-[11px] text-signal">{error}</p>
        </div>
      )}

      {!error && !triage && !busy && (
        <p className="font-mono text-[11px] leading-relaxed text-ink-soft dark:text-paper/60">
          Have Gemini triage this incident: a handover summary, the most likely
          assessment, indicators of compromise from the record, a severity
          opinion and prioritized next actions.
        </p>
      )}

      {busy && !triage && (
        <div className="flex items-center gap-2 py-1 font-mono text-[11px] text-ink-faint dark:text-paper/40">
          <Loader2 size={13} className="animate-spin text-clearance" />
          Gemini is triaging incident #{incident.id}...
        </div>
      )}

      {triage && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[12.5px] leading-relaxed text-ink dark:text-paper/85">{triage.summary}</p>
            <span className="flex flex-none items-center gap-1.5">
              <span className="font-mono text-[8.5px] uppercase tracking-wideish text-ink-faint dark:text-paper/40">AI</span>
              <SeverityBadge level={triage.severityOpinion} />
            </span>
          </div>

          <div>
            <div className="pb-1 font-mono text-[9px] uppercase tracking-widest2 text-ink-faint dark:text-paper/45">
              Assessment
            </div>
            <p className="border-l-2 border-caution/60 pl-3 text-[12px] leading-relaxed text-ink-soft dark:text-paper/65">
              {triage.assessment}
            </p>
          </div>

          {triage.iocs?.length > 0 && (
            <div>
              <div className="pb-1.5 font-mono text-[9px] uppercase tracking-widest2 text-ink-faint dark:text-paper/45">
                Indicators of compromise
              </div>
              <div className="flex flex-wrap gap-1.5">
                {triage.iocs.map((ioc, i) => (
                  <span
                    key={`${ioc.value}-${i}`}
                    title={ioc.note}
                    className="border border-signal/40 bg-signal-soft/60 px-2 py-1 font-mono text-[10px] text-signal dark:bg-signal/10"
                  >
                    {ioc.type}: {ioc.value}
                  </span>
                ))}
              </div>
            </div>
          )}

          {triage.recommendedActions?.length > 0 && (
            <div>
              <div className="pb-1.5 font-mono text-[9px] uppercase tracking-widest2 text-ink-faint dark:text-paper/45">
                Recommended actions
              </div>
              <ol className="space-y-1.5">
                {triage.recommendedActions.map((a, i) => (
                  <li key={a} className="flex items-start gap-2.5 font-mono text-[10.5px] leading-relaxed text-ink-soft dark:text-paper/60">
                    <span className="font-600 text-clearance">{String(i + 1).padStart(2, "0")}</span>
                    {a}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {triage.questions?.length > 0 && (
            <div>
              <div className="pb-1.5 font-mono text-[9px] uppercase tracking-widest2 text-ink-faint dark:text-paper/45">
                Verify
              </div>
              <ul className="space-y-1">
                {triage.questions.map((q) => (
                  <li key={q} className="font-mono text-[10.5px] text-ink-faint dark:text-paper/45">? {q}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
