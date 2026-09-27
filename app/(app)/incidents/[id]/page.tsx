"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Bot, Fingerprint, ShieldCheck, ArrowRight, Search } from "lucide-react";
import { Panel, SeverityBadge, StatusBadge, riskTone } from "@/components/app/primitives";
import { ScoreRing } from "@/components/app/score-ring";
import { ResponsePanel } from "@/components/app/response-panel";
import { AttackGraph } from "@/components/app/attack-graph";
import { AiTriage } from "@/components/app/ai/ai-triage";
import { useDataSource } from "@/components/app/data-source";
import { usePageTitle } from "@/lib/use-page-title";
import {
  incidentFromDataset,
  timelineFor,
  riskFactorsFor,
  evidenceFor,
  responseActionsFor,
  mitreChainFor,
  entitiesFor,
  explainFor,
  type IncidentEntity,
} from "@/lib/dataset";

const tagTone: Record<string, string> = {
  RULE: "border-line text-ink-soft dark:border-line-dark dark:text-paper/60",
  ML: "border-caution/50 text-caution",
  INTEL: "border-signal/50 text-signal",
  INCIDENT: "border-signal bg-signal text-paper",
  DETECT: "border-line text-ink-soft dark:border-line-dark dark:text-paper/60",
  CORRELATE: "border-caution/50 text-caution",
  AI: "border-clearance/50 text-clearance",
};

const entityDot: Record<string, string> = {
  signal: "bg-signal",
  caution: "bg-caution",
  clearance: "bg-clearance",
  ink: "bg-ink/60 dark:bg-paper/50",
};

function EntityList({ entities }: { entities: IncidentEntity[] }) {
  return (
    <ul className="space-y-2">
      {entities.map((e, i) => (
        <li key={`${e.kind}-${e.label}-${i}`} className="flex items-start gap-3 border border-line px-3 py-2 dark:border-line-dark">
          <span className={`mt-1.5 h-1.5 w-1.5 flex-none rounded-full ${entityDot[e.tone ?? "ink"]}`} />
          <div className="min-w-0">
            <div className="font-mono text-[9px] uppercase tracking-wideish text-ink-faint dark:text-paper/40">
              {e.kind}
            </div>
            <div className="truncate font-mono text-[12px] text-ink dark:text-paper/85">{e.label}</div>
            {e.detail && (
              <div className="mt-0.5 font-mono text-[10px] leading-relaxed text-ink-soft dark:text-paper/55">
                {e.detail}
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function IncidentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id ?? "");
  const { dataset, source, hydrated } = useDataSource();
  const inc = incidentFromDataset(dataset, id);

  usePageTitle(inc ? `#${inc.id} ${inc.title} — AegisSOC` : "Incident — AegisSOC");

  if (!inc) {
    // During a demo → your-data swap the store is briefly the demo dataset; hold
    // off on the "not found" verdict until localStorage has been read.
    if (!hydrated) {
      return (
        <div className="flex items-center gap-2 py-24 font-mono text-[11px] text-ink-faint dark:text-paper/40">
          <span className="h-1.5 w-1.5 animate-blink rounded-full bg-clearance" />
          loading incident…
        </div>
      );
    }
    return (
      <div className="space-y-6">
        <Link
          href="/incidents"
          className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-wideish text-ink-faint transition-colors hover:text-signal dark:text-paper/40"
        >
          <ArrowLeft size={12} /> Incident queue
        </Link>
        <Panel label="Incident not found">
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center border border-line text-ink-faint dark:border-line-dark dark:text-paper/40">
              <Search size={20} />
            </span>
            <div>
              <p className="font-display text-lg font-600">No incident #{id}</p>
              <p className="mt-1 font-mono text-[11px] text-ink-soft dark:text-paper/55">
                {source === "user"
                  ? "This incident isn't part of your uploaded data."
                  : "This incident isn't part of the demo environment."}
              </p>
            </div>
            <Link
              href="/incidents"
              className="inline-flex items-center gap-1.5 border border-ink bg-ink px-4 py-2 font-mono text-[11px] uppercase tracking-wideish text-paper transition-colors hover:border-signal hover:bg-signal dark:border-paper dark:bg-paper dark:text-ink dark:hover:border-signal dark:hover:bg-signal dark:hover:text-paper"
            >
              Back to queue <ArrowRight size={13} />
            </Link>
          </div>
        </Panel>
      </div>
    );
  }

  const timeline = timelineFor(dataset, inc.id);
  const factors = riskFactorsFor(dataset, inc.id);
  const maxWeight = Math.max(1e-6, ...factors.map((f) => f.weight));
  const evidence = evidenceFor(dataset, inc.id);
  const actions = responseActionsFor(dataset, inc.id);
  const chain = mitreChainFor(dataset, inc.id);
  const entities = entitiesFor(dataset, inc.id);
  const explain = explainFor(dataset, inc.id);

  const showGraph = source === "demo" && inc.id === "1042";
  const riskToneName = inc.risk >= 76 ? "signal" : inc.risk >= 51 ? "caution" : "clearance";

  return (
    <div className="space-y-6">
      {/* breadcrumb */}
      <Link
        href="/incidents"
        className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-wideish text-ink-faint transition-colors hover:text-signal dark:text-paper/40"
      >
        <ArrowLeft size={12} /> Incident queue
      </Link>

      {/* header */}
      <div className="flex flex-col gap-6 border-b border-line pb-6 dark:border-line-dark lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[12px] text-ink-faint dark:text-paper/40">#{inc.id}</span>
            <SeverityBadge level={inc.severity} />
            <StatusBadge status={inc.status} />
          </div>
          <h1 className="mt-2 font-display text-3xl font-700 tracking-tighter sm:text-[2.1rem]">
            {inc.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-[11px] text-ink-soft dark:text-paper/55">
            <span><span className="text-ink-faint dark:text-paper/35">asset</span> {inc.asset}</span>
            <span><span className="text-ink-faint dark:text-paper/35">opened</span> {inc.opened} UTC</span>
            <span><span className="text-ink-faint dark:text-paper/35">assignee</span> {inc.assignee}</span>
            <span><span className="text-ink-faint dark:text-paper/35">confidence</span> {inc.confidence}%</span>
          </div>
        </div>
        <div className="flex flex-none items-center gap-4">
          <ScoreRing value={inc.risk} tone={riskToneName as "signal" | "caution" | "clearance"} size={104} suffix="risk" />
        </div>
      </div>

      {/* AI triage */}
      <AiTriage incident={inc} />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* main column */}
        <div className="space-y-6 lg:col-span-2">
          {/* AI summary */}
          <Panel
            label="AI assessment"
            right={
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-clearance">
                <Bot size={12} /> {inc.confidence}% confidence
              </span>
            }
          >
            <p className="font-body text-[14px] leading-relaxed text-ink dark:text-paper/85">
              {inc.summary}
            </p>
            {explain && (
              <>
                {explain.bullets && explain.bullets.length > 0 && (
                  <div className="mt-4 space-y-2 border-t border-line pt-4 dark:border-line-dark">
                    {explain.bullets.map((b) => (
                      <div key={b} className="flex items-start gap-2.5">
                        <span className="mt-1.5 h-1 w-1 flex-none bg-signal" />
                        <span className="font-mono text-[11.5px] leading-relaxed text-ink-soft dark:text-paper/70">{b}</span>
                      </div>
                    ))}
                  </div>
                )}
                {explain.sources && explain.sources.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[9px] uppercase tracking-widest2 text-ink-faint dark:text-paper/35">
                      Sources
                    </span>
                    {explain.sources.map((s) => (
                      <span key={s} className="border border-line px-1.5 py-0.5 font-mono text-[9.5px] text-ink-soft dark:border-line-dark dark:text-paper/55">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
            <Link
              href="/analyst"
              className="mt-4 inline-flex items-center gap-1.5 font-mono text-[11px] text-signal hover:underline"
            >
              Ask the analyst about this incident <ArrowRight size={12} />
            </Link>
          </Panel>

          {/* timeline */}
          <Panel label="Reconstructed timeline">
            {timeline.length === 0 ? (
              <p className="font-mono text-[11px] text-ink-faint dark:text-paper/40">
                No timeline could be reconstructed for this incident.
              </p>
            ) : (
              <ol className="relative space-y-4 border-l border-line pl-6 dark:border-line-dark">
                {timeline.map((t, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[27px] top-1 h-2 w-2 rounded-full border-2 border-paper bg-signal dark:border-void" />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] tabular-nums text-ink dark:text-paper">{t.time}</span>
                      <span className={`border px-1 py-0.5 font-mono text-[8.5px] uppercase tracking-wideish ${tagTone[t.tag] ?? tagTone.RULE}`}>
                        {t.tag}
                      </span>
                      <span className="font-display text-[13px] font-500">{t.title}</span>
                    </div>
                    <p className="mt-1 font-mono text-[10.5px] leading-relaxed text-ink-soft dark:text-paper/55">
                      {t.detail}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          {/* entity relationships — SVG for the demo hero, list for everything else */}
          {showGraph ? (
            <Panel label="Entity relationship graph" right={<span className="font-mono text-[10px] text-ink-faint dark:text-paper/40">6 entities · 5 links</span>}>
              <AttackGraph />
            </Panel>
          ) : entities.length > 0 ? (
            <Panel label="Entities involved" right={<span className="font-mono text-[10px] text-ink-faint dark:text-paper/40">{entities.length} entities</span>}>
              <EntityList entities={entities} />
            </Panel>
          ) : null}

          {/* recommended response */}
          <Panel label="Recommended response" right={<span className="font-mono text-[10px] text-caution">human-approved</span>}>
            <ResponsePanel actions={actions} />
          </Panel>
        </div>

        {/* side column */}
        <div className="space-y-6">
          {/* risk breakdown */}
          <Panel label="Why this score">
            <div className="mb-4 flex items-baseline gap-2">
              <span className={`font-mono text-3xl font-700 tabular-nums ${riskTone(inc.risk)}`}>{inc.risk}</span>
              <span className="font-mono text-[11px] text-ink-faint dark:text-paper/40">/ 100 risk</span>
            </div>
            {factors.length === 0 ? (
              <p className="font-mono text-[10.5px] text-ink-faint dark:text-paper/40">No contributing factors recorded.</p>
            ) : (
              <div className="space-y-2.5">
                {factors.map((f) => (
                  <div key={f.factor}>
                    <div className="flex items-center justify-between gap-2 font-mono text-[10.5px]">
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
            <p className="mt-3 border-t border-line pt-3 font-mono text-[9px] leading-relaxed text-ink-faint dark:border-line-dark dark:text-paper/35">
              SHAP-style contributions — every score ships with the reasons behind it.
            </p>
          </Panel>

          {/* mitre */}
          <Panel label="MITRE ATT&CK">
            {chain.length === 0 ? (
              <p className="font-mono text-[10.5px] text-ink-faint dark:text-paper/40">No techniques mapped.</p>
            ) : (
              <ol className="space-y-2">
                {chain.map((m, i) => (
                  <li key={m.code + i} className="flex items-center gap-3">
                    <span className="font-mono text-[9px] text-ink-faint dark:text-paper/30">{String(i + 1).padStart(2, "0")}</span>
                    <div className={`flex flex-1 items-center justify-between border px-2.5 py-1.5 ${m.observed ? "border-signal/40 bg-signal-soft/60 dark:bg-signal/10" : "border-dashed border-line dark:border-line-dark"}`}>
                      <div>
                        <div className={`font-mono text-[11px] ${m.observed ? "text-signal" : "text-ink-faint dark:text-paper/40"}`}>{m.code}</div>
                        <div className="font-mono text-[9px] uppercase tracking-wideish text-ink-faint dark:text-paper/40">{m.tactic}</div>
                      </div>
                      <span className="font-mono text-[9px] text-ink-soft dark:text-paper/50">{m.observed ? "observed" : "—"}</span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          {/* evidence */}
          <Panel
            label="Evidence integrity"
            right={<Fingerprint size={13} className="text-ink-faint dark:text-paper/40" />}
          >
            {evidence.length > 0 ? (
              <ul className="space-y-2.5">
                {evidence.map((e) => (
                  <li key={e.name} className="border border-line px-3 py-2 dark:border-line-dark">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-[11px] text-ink dark:text-paper/85">{e.name}</span>
                      {e.verified && <ShieldCheck size={13} className="flex-none text-clearance" />}
                    </div>
                    <div className="mt-1 flex items-center justify-between font-mono text-[9px] text-ink-faint dark:text-paper/40">
                      <span>{e.kind} · {e.captured}</span>
                      <span className="text-clearance">SHA-256 {e.hash}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="font-mono text-[10.5px] leading-relaxed text-ink-faint dark:text-paper/40">
                Artifacts are SHA-256 hashed the moment they are captured. Collection for this
                incident is pending analyst action.
              </p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
