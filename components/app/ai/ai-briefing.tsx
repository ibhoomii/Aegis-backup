"use client";

// AI shift-handover briefing for the dashboard. Renders a structured Gemini
// response; every failure path shows an inline message instead of breaking
// the page, and a "Regenerate" control re-asks with the live dataset.

import { useState } from "react";
import { Sparkles, Loader2, AlertTriangle, RefreshCw, ChevronDown } from "lucide-react";
import { Panel } from "@/components/app/primitives";
import { useDataset } from "@/components/app/data-source";
import { buildDatasetDigest, askAi } from "@/lib/ai/digest";

type Briefing = {
  headline: string;
  summary: string;
  topRisks: string[];
  recommendedActions: string[];
  confidenceNote: string;
};

export function AiBriefing() {
  const dataset = useDataset();
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const result = await askAi<Briefing>("brief", {
        datasetDigest: buildDatasetDigest(dataset),
      });
      setBriefing(result);
      setCollapsed(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "The AI briefing failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      label="AI briefing — Gemini"
      right={
        <div className="flex items-center gap-2">
          {briefing && (
            <button
              onClick={() => setCollapsed((v) => !v)}
              aria-label="Collapse briefing"
              className="text-ink-faint transition-colors hover:text-signal dark:text-paper/40"
            >
              <ChevronDown size={14} className={collapsed ? "" : "rotate-180"} />
            </button>
          )}
          <button
            onClick={generate}
            disabled={busy}
            className="inline-flex items-center gap-1.5 bg-signal px-3 py-1.5 font-mono text-[10px] uppercase tracking-wideish text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 size={11} className="animate-spin" />
            ) : briefing ? (
              <RefreshCw size={11} />
            ) : (
              <Sparkles size={11} />
            )}
            {briefing ? "Regenerate" : busy ? "Thinking…" : "Generate briefing"}
          </button>
        </div>
      }
      className={briefing && !collapsed ? "border-signal/40" : ""}
    >
      {error && (
        <div className="flex items-start gap-2.5">
          <AlertTriangle size={14} className="mt-0.5 flex-none text-signal" />
          <div className="space-y-1">
            <p className="font-mono text-[11px] text-signal">{error}</p>
            <p className="font-mono text-[10px] text-ink-faint dark:text-paper/40">
              The scripted analyst answers on the AI Analyst page still work without AI.
            </p>
          </div>
        </div>
      )}

      {!error && !briefing && !busy && (
        <p className="font-mono text-[11px] leading-relaxed text-ink-soft dark:text-paper/60">
          Ask Gemini for a shift-handover briefing: what changed, which risks
          deserve attention first, and what to action — grounded strictly in the
          current dataset.
        </p>
      )}

      {busy && !briefing && (
        <div className="flex items-center gap-2 py-1 font-mono text-[11px] text-ink-faint dark:text-paper/40">
          <Loader2 size={13} className="animate-spin text-signal" />
          Gemini is reading the current dataset…
        </div>
      )}

      {briefing && (
        <div className={`space-y-3.5 overflow-hidden transition-all ${collapsed ? "max-h-0" : ""}`}>
          <div>
            <div className="font-display text-[15px] font-600 tracking-tight text-ink dark:text-paper">
              {briefing.headline}
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft dark:text-paper/65">
              {briefing.summary}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {briefing.topRisks?.length > 0 && (
              <div>
                <div className="pb-1.5 font-mono text-[9px] uppercase tracking-widest2 text-ink-faint dark:text-paper/45">
                  Top risks
                </div>
                <ul className="space-y-1.5">
                  {briefing.topRisks.map((r) => (
                    <li key={r} className="flex items-start gap-2 font-mono text-[10.5px] leading-relaxed text-ink-soft dark:text-paper/60">
                      <span className="mt-1.5 h-1 w-1 flex-none bg-signal" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {briefing.recommendedActions?.length > 0 && (
              <div>
                <div className="pb-1.5 font-mono text-[9px] uppercase tracking-widest2 text-ink-faint dark:text-paper/45">
                  Recommended actions
                </div>
                <ul className="space-y-1.5">
                  {briefing.recommendedActions.map((a) => (
                    <li key={a} className="flex items-start gap-2 font-mono text-[10.5px] leading-relaxed text-ink-soft dark:text-paper/60">
                      <span className="mt-1.5 h-1 w-1 flex-none bg-clearance" />
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {briefing.confidenceNote && (
            <p className="border-t border-line pt-2.5 font-mono text-[9.5px] text-ink-faint dark:border-line-dark dark:text-paper/35">
              {briefing.confidenceNote}
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}
