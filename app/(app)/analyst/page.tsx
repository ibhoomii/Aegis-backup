"use client";

import { Panel, PageHeader } from "@/components/app/primitives";
import { AnalystChat } from "@/components/app/analyst-chat";
import { useDataSource } from "@/components/app/data-source";
import { riskFactorsFor } from "@/lib/dataset";
import { usePageTitle } from "@/lib/use-page-title";

const capabilities = [
  "Reconstruct an incident timeline from raw events",
  "Explain why a risk score is what it is",
  "Trace a MITRE technique across the environment",
  "Correlate alerts into a single narrative",
];

export default function AnalystPage() {
  usePageTitle("AI Analyst — AegisSOC");
  const { dataset, source } = useDataSource();

  // Example panel: the highest-risk incident in the active dataset, with its
  // explainable risk factors (the demo's #1042, or the user's top detection).
  const topIncident = [...dataset.incidents].sort((a, b) => b.risk - a.risk)[0];
  const factors = topIncident ? riskFactorsFor(dataset, topIncident.id) : [];
  const maxWeight = Math.max(1e-6, ...factors.map((f) => f.weight));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Investigate" title="AI Security Analyst">
        <span className="inline-flex items-center gap-2 border border-line px-3 py-1.5 font-mono text-[11px] text-ink-soft dark:border-line-dark dark:text-paper/60">
          <span className="h-1.5 w-1.5 animate-blink rounded-full bg-clearance" />
          {source === "user" ? "Grounded in your uploaded logs" : "RAG · grounded in your environment"}
        </span>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AnalystChat />
        </div>

        <div className="space-y-6">
          <Panel label="Explainable by design">
            <p className="font-body text-[13px] leading-relaxed text-ink-soft dark:text-paper/70">
              {source === "user"
                ? "Every answer is grounded in the incidents, IPs, and techniques detected from the logs you uploaded — and ships with the exact signals behind it. Matching is keyword-based and runs in your browser; nothing is sent to a model."
                : "The analyst retrieves your runbooks, past incidents, and MITRE references before answering — then ships every verdict with a confidence score and the exact sources it drew from. No bare answers, no black box."}
            </p>
          </Panel>

          <Panel label="What you can ask">
            <ul className="space-y-2.5">
              {capabilities.map((c) => (
                <li key={c} className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1 w-1 flex-none bg-signal" />
                  <span className="font-mono text-[11px] leading-relaxed text-ink-soft dark:text-paper/65">{c}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel label={topIncident ? `Example — risk factors, #${topIncident.id}` : "Example — risk factors"}>
            {factors.length === 0 ? (
              <p className="font-mono text-[10.5px] leading-relaxed text-ink-faint dark:text-paper/40">
                No scored incidents in this source yet. Load logs from Data Sources and the
                highest-risk detection will be broken down here.
              </p>
            ) : (
              <div className="space-y-2.5">
                {factors.map((f) => (
                  <div key={f.factor}>
                    <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
                      <span className="text-ink-soft dark:text-paper/65">{f.factor}</span>
                      <span className="tabular-nums text-ink-faint dark:text-paper/40">{f.weight.toFixed(2)}</span>
                    </div>
                    <div className="mt-1 h-1 w-full bg-line dark:bg-line-dark">
                      <div className="h-full bg-signal" style={{ width: `${(f.weight / maxWeight) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
