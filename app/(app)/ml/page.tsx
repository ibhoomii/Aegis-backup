"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  BrainCircuit,
  Loader2,
  AlertTriangle,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  ArrowRight,
  UploadCloud,
  FileWarning,
} from "lucide-react";
import { PageHeader, Panel, SeverityBadge, riskTone } from "@/components/app/primitives";
import { ScoreRing } from "@/components/app/score-ring";
import { usePageTitle } from "@/lib/use-page-title";
import { parseFilesDetailed, type NormalizedEvent } from "@/lib/ingest/parse";
import { buildFeatureRows } from "@/lib/ingest/ml-features";
import { askAi } from "@/lib/ai/digest";
import type { MlAnalyzeResult, MlModelInfo } from "@/lib/ml-service";

const levelToSeverity = {
  Critical: "Critical",
  High: "High",
  Medium: "Medium",
  Low: "Low",
} as const;

const SUSPICIOUS_EVENT = {
  duration: 0, protocol_type: "tcp", service: "private", flag: "S0",
  src_bytes: 0, dst_bytes: 0, count: 123, srv_count: 6,
  serror_rate: 1.0, srv_serror_rate: 1.0, same_srv_rate: 0.05,
  dst_host_count: 255, dst_host_srv_count: 26, num_failed_logins: 5,
  logged_in: 0, source_ip: "203.0.113.66", destination: "WEB-SERVER-01",
  event_id: "evt-suspicious",
};
const NORMAL_EVENT = {
  duration: 0, protocol_type: "tcp", service: "http", flag: "SF",
  src_bytes: 232, dst_bytes: 8153, count: 1, srv_count: 1,
  serror_rate: 0, srv_serror_rate: 0, same_srv_rate: 1.0,
  dst_host_count: 1, dst_host_srv_count: 1, num_failed_logins: 0,
  logged_in: 1, source_ip: "198.51.100.24", destination: "WEB-SERVER-01",
  event_id: "evt-normal",
};
const PORTSCAN_EVENT = {
  duration: 0, protocol_type: "tcp", service: "eco_i", flag: "S0",
  src_bytes: 0, dst_bytes: 0, count: 240, srv_count: 240,
  serror_rate: 0.98, srv_serror_rate: 0.98, same_srv_rate: 1.0,
  dst_host_count: 250, dst_host_srv_count: 250, dst_host_serror_rate: 0.97,
  num_failed_logins: 0, logged_in: 0,
  source_ip: "203.0.113.9", destination: "EDGE-FW-02", event_id: "evt-portscan",
};
const FLOW_EVENT = {
  Flow_Duration: 1867944,
  Total_Fwd_Packets: 4,
  Total_Length_of_Fwd_Packets: 28,
  Fwd_Packet_Length_Max: 28,
  Fwd_Packet_Length_Min: 0,
  Fwd_Packet_Length_Mean: 7.0,

  Bwd_Packet_Length_Max: 0,
  Bwd_Packet_Length_Min: 0,
  Bwd_Packet_Length_Mean: 0,
  Bwd_Packet_Length_Std: 0,

  "Flow_Bytes/s": 163.8,
  "Flow_Packets/s": 2.85,

  Flow_IAT_Mean: 373588.8,
  Flow_IAT_Std: 525000,
  Flow_IAT_Max: 900000,
  Flow_IAT_Min: 50000,

  Fwd_IAT_Mean: 466986,
  Fwd_IAT_Std: 600000,
  Fwd_IAT_Min: 50000,

  Bwd_IAT_Mean: 0,
  Bwd_IAT_Std: 0,

  Fwd_PSH_Flags: 0,
  Bwd_PSH_Flags: 0,
  Fwd_URG_Flags: 0,
  Bwd_URG_Flags: 0,

  "Bwd_Packets/s": 1.07,

  Min_Packet_Length: 0,
  Max_Packet_Length: 1054,
  Packet_Length_Mean: 4.6,
  Packet_Length_Variance: 51.9,

  FIN_Flag_Count: 0,
  RST_Flag_Count: 0,
  PSH_Flag_Count: 0,
  ACK_Flag_Count: 3,
  URG_Flag_Count: 0,
  CWE_Flag_Count: 0,

  "Down/Up_Ratio": 1.0,

  "Fwd_Avg_Bytes/Bulk": 0,
  "Fwd_Avg_Packets/Bulk": 0,
  Fwd_Avg_Bulk_Rate: 0,

  "Bwd_Avg_Bytes/Bulk": 0,
  "Bwd_Avg_Packets/Bulk": 0,
  Bwd_Avg_Bulk_Rate: 0,

  min_seg_size_forward: 20,

  event_id: "evt-ddos-flow",
};
const BATCH_EVENTS = [SUSPICIOUS_EVENT, PORTSCAN_EVENT, NORMAL_EVENT];

type VerdictWithCtx = MlAnalyzeResult & {
  context: {
    action: string; status: string; sourceIp?: string; destIp?: string;
    user?: string; host?: string; port?: number; timeLabel?: string;
    file: string; raw: string;
  };
};

type MlVerdictExplanation = {
  plainEnglish: string;
  likelyScenarios: string[];
  mitre: { code: string; name: string; why: string }[];
  nextSteps: string[];
  caveat: string;
};

type LogInsights = {
  overview: string;
  notableFindings: string[];
  dataQuality: string[];
  suggestedNext: string[];
};

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}
function scoreTone(score: number): "signal" | "caution" | "clearance" {
  if (score >= 70) return "signal";
  if (score >= 40) return "caution";
  return "clearance";
}

export default function MlPage() {
  usePageTitle("ML Detection — AegisSOC");

  const [info, setInfo] = useState<Record<string, MlModelInfo | { error: string }>>({});
  const [serviceDown, setServiceDown] = useState<string | null>(null);
  const [activeModel, setActiveModel] = useState<"nslkdd" | "cicids">("nslkdd");

  const [result, setResult] = useState<MlAnalyzeResult | null>(null);
  const [batch, setBatch] = useState<MlAnalyzeResult[] | null>(null);
  const [busy, setBusy] = useState<"single" | "batch" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // AI explanation of the current verdict
  const [aiExplain, setAiExplain] = useState<MlVerdictExplanation | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Log-file screening
  const [logEvents, setLogEvents] = useState<NormalizedEvent[]>([]);
  const [logFiles, setLogFiles] = useState<{ name: string; format: string; events: number }[]>([]);
  const [verdicts, setVerdicts] = useState<VerdictWithCtx[] | null>(null);
  const [screenSummary, setScreenSummary] = useState<{ scored: number; flagged: number; maxRisk: number; avgRisk: number } | null>(null);
  const [screenBusy, setScreenBusy] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [insights, setInsights] = useState<LogInsights | null>(null);
  const [insightsBusy, setInsightsBusy] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    for (const model of ["nslkdd", "cicids"]) {
      fetch(`/api/ml/info?model=${model}`)
        .then(async (res) => {
          const body = (await res.json()) as MlModelInfo | { error: string };
          setInfo((prev) => ({ ...prev, [model]: body }));
          if ("error" in body) setServiceDown(body.error);
          else setServiceDown(null);
        })
        .catch((err: Error) => setServiceDown(err.message));
    }
  }, []);

  const metrics = useMemo(() => {
    const m = info[activeModel];
    if (!m || "error" in m) return null;
    return m;
  }, [info, activeModel]);

  async function analyze(
    event: Record<string, unknown> | null,
    mode: "single" | "batch",
  ) {
    setError(null);
    setAiExplain(null);
    setAiError(null);
    setBusy(mode);
    try {
      const res = await fetch(mode === "single" ? "/api/ml/analyze" : "/api/ml/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "single" ? { event: { ...event, model: activeModel } } : { events: BATCH_EVENTS },
        ),
      });
      const body = (await res.json()) as (MlAnalyzeResult | MlAnalyzeResult[]) | { error: string };
      if ("error" in body) throw new Error(body.error);
      if (mode === "single") {
        setResult(body as MlAnalyzeResult);
        setBatch(null);
      } else {
        setBatch(body as MlAnalyzeResult[]);
        setResult(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "The analysis failed.");
    } finally {
      setBusy(null);
    }
  }

  async function explainWithAi() {
    if (!result) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const shown = activeModel === "cicids" ? FLOW_EVENT : SUSPICIOUS_EVENT;
      const explanation = await askAi<MlVerdictExplanation>("mlExplain", {
        event: shown,
        verdict: result,
        modelName: activeModel,
      });
      setAiExplain(explanation);
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : "The AI explanation failed.");
    } finally {
      setAiBusy(false);
    }
  }

  async function addLogFiles(list: FileList | File[]) {
    setScreenError(null);
    const loaded: { name: string; text: string }[] = [];
    for (const f of Array.from(list)) {
      try {
        loaded.push({ name: f.name, text: await f.text() });
      } catch {
        setScreenError(`Could not read "${f.name}".`);
      }
    }
    if (!loaded.length) return;
    const parsed = parseFilesDetailed(loaded);
    const events = parsed.flatMap((p) => p.events);
    setLogEvents(events);
    setLogFiles(parsed.map((p) => ({ name: p.file, format: p.format, events: p.events.length })));
    setVerdicts(null);
    setInsights(null);
    setScreenSummary(null);
  }

  async function screenLogs() {
    if (!logEvents.length) return;
    setScreenBusy(true);
    setScreenError(null);
    setInsights(null);
    try {
      const res = await fetch("/api/ml/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: logEvents }),
      });
      const body = (await res.json()) as {
        verdicts?: VerdictWithCtx[];
        summary?: { scored: number; flagged: number; maxRisk: number; avgRisk: number };
        error?: string;
      };
      if (body.error) throw new Error(body.error);
      setVerdicts(body.verdicts ?? []);
      setScreenSummary(body.summary ?? null);
    } catch (err: unknown) {
      setScreenError(err instanceof Error ? err.message : "ML screening failed.");
    } finally {
      setScreenBusy(false);
    }
  }

  async function aiLogInsights() {
    setInsightsBusy(true);
    setInsightsError(null);
    try {
      const result = await askAi<LogInsights>("logInsights", {
        files: logFiles,
        heuristics: {
          totalParsed: logEvents.length,
          actions: Object.entries(
            logEvents.reduce<Record<string, number>>((acc, e) => {
              acc[e.action] = (acc[e.action] ?? 0) + 1;
              return acc;
            }, {}),
          ).map(([action, n]) => ({ action, count: n })).sort((a, b) => b.count - a.count).slice(0, 8),
        },
        mlScreening: screenSummary
          ? {
              ...screenSummary,
              topFlagged: (verdicts ?? [])
                .filter((v) => v.is_anomaly)
                .slice(0, 8)
                .map((v) => ({
                  action: v.context.action,
                  source: v.context.sourceIp,
                  risk: v.risk_score,
                  level: v.risk_level,
                  topReason: v.reasons[0]?.description,
                })),
            }
          : null,
        sampleLines: logEvents.slice(0, 12).map((e) => e.raw.slice(0, 200)),
      });
      setInsights(result);
    } catch (err: unknown) {
      setInsightsError(err instanceof Error ? err.message : "AI insights failed.");
    } finally {
      setInsightsBusy(false);
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) addLogFiles(e.dataTransfer.files);
  }

  const resultSeverity = result ? levelToSeverity[result.risk_level] : null;
  const modelCards = (["nslkdd", "cicids"] as const).map((name) => {
    const m = info[name];
    return { name, m };
  });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Machine Learning" title="ML Anomaly Detection">
        <span className="inline-flex items-center gap-2 border border-line px-3 py-1.5 font-mono text-[11px] text-ink-soft dark:border-line-dark dark:text-paper/60">
          <BrainCircuit size={13} className={!serviceDown ? "text-clearance" : ""} />
          {!serviceDown ? "2 engines online" : "Service offline"}
        </span>
      </PageHeader>

      {serviceDown && (
        <div className="flex items-start gap-3 border border-signal/50 bg-signal-soft p-4 dark:bg-signal/10">
          <AlertTriangle size={16} className="mt-0.5 flex-none text-signal" />
          <div className="space-y-1">
            <p className="font-mono text-[12px] text-signal">ML service unreachable</p>
            <p className="font-mono text-[11px] text-ink-soft dark:text-paper/60">{serviceDown}</p>
          </div>
        </div>
      )}

      {/* model cards (both engines) */}
      <div className="grid gap-5 lg:grid-cols-2">
        {modelCards.map(({ name, m }) => {
          const ok = m && !("error" in m);
          const mm = ok ? (m as MlModelInfo) : null;
          const tm = mm?.test_metrics;
          return (
            <Panel
              key={name}
              label={name === "nslkdd" ? "Engine 1 · event model" : "Engine 2 · flow model"}
              right={
                <span className={`font-mono text-[9.5px] uppercase tracking-wideish ${ok ? "text-clearance" : "text-ink-faint dark:text-paper/40"}`}>
                  {ok ? "online" : "offline"}
                </span>
              }
              className={activeModel === name ? "border-signal/50" : ""}
            >
              {mm ? (
                <div className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ["Algorithm", `${mm.model_type} · 400 trees`],
                      ["Training", mm.training_mode],
                      ["Threshold", `${mm.operating_threshold.toFixed(4)} @ ${pct(mm.target_false_positive_rate)} FPR`],
                      ["Trained on", name === "nslkdd" ? "NSL-KDD normal traffic" : "CICIDS2017 benign flows"],
                    ].map(([label, value]) => (
                      <div key={label} className="border border-line p-2.5 dark:border-line-dark">
                        <div className="font-mono text-[8.5px] uppercase tracking-wideish text-ink-faint dark:text-paper/45">{label}</div>
                        <div className="mt-1 font-mono text-[10.5px] leading-snug text-ink dark:text-paper/85">{value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-4 gap-px border border-line bg-line dark:border-line-dark dark:bg-line-dark">
                    {[
                      ["ROC", tm?.roc_auc],
                      ["PR-AUC", tm?.pr_auc],
                      ["Precision", tm?.precision],
                      ["Recall", tm?.recall],
                    ].map(([label, v]) => (
                      <div key={label as string} className="bg-paper p-2.5 dark:bg-void">
                        <div className="font-mono text-[8px] uppercase tracking-wideish text-ink-faint dark:text-paper/45">{label}</div>
                        <div className="mt-0.5 font-mono text-[12.5px] font-600 tabular-nums text-ink dark:text-paper">{pct((v as number) ?? 0)}</div>
                      </div>
                    ))}
                  </div>
                  {name === "nslkdd" ? (
                    <p className="font-mono text-[9.5px] leading-relaxed text-ink-faint dark:text-paper/40">
                      NSL-KDD test set: recall {pct(tm?.recall_on_novel_unseen_attack_types ?? 0)} on 17 attack types never seen in
                      training. Weak spot: R2L/U2R — pair with rules for credential attacks.
                    </p>
                  ) : (
                    <p className="font-mono text-[9.5px] leading-relaxed text-ink-faint dark:text-paper/40">
                      CICIDS2017 flows: DDoS recall {pct(tm?.recall_by_attack_class?.DDoS ?? 0)} at 5% FPR. Honest limit:
                      PortScan flows share statistical traits with co-temporal benign traffic (known dataset issue).
                    </p>
                  )}
                </div>
              ) : (
                <p className="font-mono text-[11px] text-ink-faint dark:text-paper/40">Model unavailable.</p>
              )}
            </Panel>
          );
        })}
      </div>

      {/* analyzer */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel label="Event analyzer">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[9.5px] uppercase tracking-widest2 text-ink-faint dark:text-paper/45">engine</span>
              {(["nslkdd", "cicids"] as const).map((name) => (
                <button
                  key={name}
                  onClick={() => setActiveModel(name)}
                  className={`border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wideish transition-colors ${
                    activeModel === name
                      ? "border-signal bg-signal-soft text-signal dark:bg-signal/10"
                      : "border-line text-ink-soft hover:border-signal dark:border-line-dark dark:text-paper/55"
                  }`}
                >
                  {name === "nslkdd" ? "NSL-KDD events" : "CICIDS2017 flows"}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {(activeModel === "nslkdd"
                ? [
                    { label: "Suspicious", ev: SUSPICIOUS_EVENT as Record<string, unknown>, primary: true },
                    { label: "Normal", ev: NORMAL_EVENT as Record<string, unknown>, primary: false },
                    { label: "Port scan", ev: PORTSCAN_EVENT as Record<string, unknown>, primary: false },
                  ]
                : [{ label: "DDoS-like flow", ev: FLOW_EVENT as Record<string, unknown>, primary: true }]
              ).map(({ label, ev, primary }) => (
                <button
                  key={label}
                  onClick={() => analyze(ev, "single")}
                  disabled={busy !== null}
                  className={`inline-flex items-center gap-2 px-3 py-2 font-mono text-[11px] uppercase tracking-wideish transition-opacity disabled:opacity-50 ${
                    primary ? "bg-signal text-paper hover:opacity-90" : "border border-line text-ink-soft hover:border-signal hover:text-signal dark:border-line-dark dark:text-paper/60"
                  }`}
                >
                  {busy === "single" ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                  {label}
                </button>
              ))}
            </div>
            <pre className="max-h-40 overflow-auto border border-line bg-paper-dim p-3 font-mono text-[9.5px] leading-relaxed text-ink-soft dark:border-line-dark dark:bg-void-surface dark:text-paper/60">
              {JSON.stringify(activeModel === "nslkdd" ? SUSPICIOUS_EVENT : FLOW_EVENT, null, 2)}
            </pre>
            {error && (
              <div className="flex items-start gap-2 border border-signal/50 bg-signal-soft p-3 dark:bg-signal/10">
                <AlertTriangle size={14} className="mt-0.5 flex-none text-signal" />
                <span className="font-mono text-[10.5px] text-signal">{error}</span>
              </div>
            )}
          </div>
        </Panel>

        <Panel
          label="Model verdict"
          right={result && <SeverityBadge level={resultSeverity ?? "Low"} />}
        >
          {result ? (
            <div className="space-y-4">
              <div className="flex items-center gap-5">
                <ScoreRing
                  value={Math.round(result.risk_score)}
                  tone={scoreTone(result.risk_score)}
                  size={110}
                  suffix="risk /100"
                />
                <div className="space-y-1">
                  <div className={`flex items-center gap-2 font-mono text-[13px] font-600 ${result.is_anomaly ? "text-signal" : "text-clearance"}`}>
                    {result.is_anomaly ? <ShieldAlert size={15} /> : <ShieldCheck size={15} />}
                    {result.is_anomaly ? "Anomaly flagged" : "Within baseline"}
                  </div>
                  <div className="font-mono text-[10px] text-ink-faint dark:text-paper/40">
                    raw {result.raw_isolation_forest_score.toFixed(5)} · thr {result.operating_threshold?.toFixed(5)} · {result.model}
                  </div>
                </div>
              </div>

              {result.reasons.length > 0 && (
                <div>
                  <div className="pb-2 font-mono text-[9.5px] uppercase tracking-widest2 text-ink-faint dark:text-paper/45">Main reasons</div>
                  <ul className="space-y-1.5">
                    {result.reasons.map((r) => (
                      <li key={r.feature} className="flex items-start gap-2.5 border border-line p-2.5 dark:border-line-dark">
                        <span className={`mt-px flex-none font-mono text-[10px] font-600 tabular-nums ${riskTone(r.magnitude * 10)}`}>
                          ×{r.magnitude.toFixed(1)}
                        </span>
                        <span className="font-mono text-[10px] leading-relaxed text-ink-soft dark:text-paper/60">{r.description}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="border-t border-line pt-3 dark:border-line-dark">
                <button
                  onClick={explainWithAi}
                  disabled={aiBusy}
                  className="inline-flex items-center gap-1.5 border border-clearance/50 bg-clearance-soft px-3 py-1.5 font-mono text-[10px] uppercase tracking-wideish text-clearance transition-colors hover:bg-clearance hover:text-paper dark:bg-clearance/10 disabled:opacity-50"
                >
                  {aiBusy ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                  {aiBusy ? "Gemini is thinking…" : aiExplain ? "Re-explain" : "Explain with AI"}
                </button>
                {aiError && (
                  <p className="mt-2 flex items-center gap-1.5 font-mono text-[10.5px] text-signal">
                    <AlertTriangle size={12} /> {aiError}
                  </p>
                )}
                {aiExplain && (
                  <div className="mt-3 space-y-2.5">
                    <p className="text-[12.5px] leading-relaxed text-ink dark:text-paper/85">{aiExplain.plainEnglish}</p>
                    {aiExplain.likelyScenarios?.length > 0 && (
                      <div>
                        <div className="pb-1 font-mono text-[8.5px] uppercase tracking-widest2 text-ink-faint dark:text-paper/45">Likely scenarios</div>
                        <ul className="space-y-1">
                          {aiExplain.likelyScenarios.map((s) => (
                            <li key={s} className="flex items-start gap-2 font-mono text-[10.5px] leading-relaxed text-ink-soft dark:text-paper/60">
                              <span className="mt-1.5 h-1 w-1 flex-none bg-caution" />{s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {aiExplain.mitre?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {aiExplain.mitre.map((t) => (
                          <span key={t.code} title={t.why} className="border border-signal/40 px-2 py-0.5 font-mono text-[9.5px] text-signal">
                            {t.code} · {t.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {aiExplain.nextSteps?.length > 0 && (
                      <div>
                        <div className="pb-1 font-mono text-[8.5px] uppercase tracking-widest2 text-ink-faint dark:text-paper/45">Next steps</div>
                        <ol className="space-y-1">
                          {aiExplain.nextSteps.map((s, i) => (
                            <li key={s} className="flex items-start gap-2 font-mono text-[10.5px] leading-relaxed text-ink-soft dark:text-paper/60">
                              <span className="font-600 text-clearance">{i + 1}.</span>{s}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                    {aiExplain.caveat && (
                      <p className="font-mono text-[9px] text-ink-faint dark:text-paper/35">{aiExplain.caveat}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-48 flex-col items-center justify-center gap-2 font-mono text-[11px] text-ink-faint dark:text-paper/40">
              <BrainCircuit size={22} className="opacity-40" />
              Run an analysis to see the model&apos;s verdict.
            </div>
          )}
        </Panel>
      </div>

      {/* log-file screening */}
      <Panel
        label="Screen your log files through the ML engine"
        right={
          logEvents.length > 0 && !verdicts ? (
            <button
              onClick={screenLogs}
              disabled={screenBusy}
              className="inline-flex items-center gap-1.5 bg-signal px-3 py-1.5 font-mono text-[10px] uppercase tracking-wideish text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {screenBusy ? <Loader2 size={11} className="animate-spin" /> : <ShieldAlert size={11} />}
              {screenBusy ? "Scoring..." : `Score ${Math.min(logEvents.length, 300)} events`}
            </button>
          ) : null
        }
      >
        <div className="space-y-4">
          <p className="font-mono text-[11px] leading-relaxed text-ink-soft dark:text-paper/60">
            Upload auth.log, syslog, CSV/JSON exports — any text log. Events are parsed, mapped
            onto connection-record features (protocol/service from ports, per-source behaviour
            windows, error rates), then scored by the NSL-KDD anomaly model (first 300 events).
          </p>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed p-6 transition-colors ${
              dragging ? "border-signal bg-signal-soft/40 dark:bg-signal/5" : "border-line hover:border-signal/50 dark:border-line-dark"
            }`}
          >
            <UploadCloud size={20} className="text-ink-faint dark:text-paper/40" />
            <span className="font-mono text-[11px] text-ink-soft dark:text-paper/60">
              Drop log files here or click to browse
            </span>
            <input ref={fileInputRef} type="file" multiple accept=".log,.txt,.json,.jsonl,.csv" className="hidden" onChange={(e) => e.target.files && addLogFiles(e.target.files)} />
          </div>
          {logFiles.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {logFiles.map((f) => (
                <span key={f.name} className="border border-line px-2 py-1 font-mono text-[10px] text-ink-soft dark:border-line-dark dark:text-paper/60">
                  {f.name} · {f.format} · {f.events} events
                </span>
              ))}
            </div>
          )}
          {screenError && (
            <div className="flex items-start gap-2 border border-signal/50 bg-signal-soft p-3 dark:bg-signal/10">
              <AlertTriangle size={14} className="mt-0.5 flex-none text-signal" />
              <span className="font-mono text-[10.5px] text-signal">{screenError}</span>
            </div>
          )}
          {screenSummary && (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-px border border-line bg-line dark:border-line-dark dark:bg-line-dark">
                {[
                  ["Scored", String(screenSummary.scored)],
                  ["Flagged", String(screenSummary.flagged)],
                  ["Max risk", screenSummary.maxRisk.toFixed(1)],
                  ["Avg risk", screenSummary.avgRisk.toFixed(1)],
                ].map(([label, v]) => (
                  <div key={label} className="bg-paper p-3 dark:bg-void">
                    <div className="font-mono text-[8.5px] uppercase tracking-wideish text-ink-faint dark:text-paper/45">{label}</div>
                    <div className="mt-0.5 font-mono text-[15px] font-600 tabular-nums text-ink dark:text-paper">{v}</div>
                  </div>
                ))}
              </div>

              {verdicts && verdicts.some((v) => v.is_anomaly) && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left">
                    <thead>
                      <tr className="border-b border-line dark:border-line-dark">
                        {["Risk", "Level", "Action", "Source", "Where", "Top reason"].map((h) => (
                          <th key={h} className="pb-2 font-mono text-[9px] uppercase tracking-widest2 text-ink-faint dark:text-paper/45">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line dark:divide-line-dark">
                      {verdicts.filter((v) => v.is_anomaly).slice(0, 10).map((v, i) => (
                        <tr key={i} className="transition-colors hover:bg-paper-dim/60 dark:hover:bg-void-surface/50">
                          <td className={`px-1 py-2.5 font-mono text-[12px] font-600 tabular-nums ${riskTone(v.risk_score)}`}>{v.risk_score.toFixed(1)}</td>
                          <td className="px-1 py-2.5"><SeverityBadge level={levelToSeverity[v.risk_level]} /></td>
                          <td className="px-1 py-2.5 font-mono text-[10.5px] text-ink dark:text-paper/85">{v.context.action}</td>
                          <td className="px-1 py-2.5 font-mono text-[10.5px] text-ink-soft dark:text-paper/60">{v.context.sourceIp ?? "—"}</td>
                          <td className="px-1 py-2.5 font-mono text-[10px] text-ink-faint dark:text-paper/45">{v.context.timeLabel ?? ""} {v.context.file}</td>
                          <td className="px-1 py-2.5 font-mono text-[10px] text-ink-soft dark:text-paper/60">{v.reasons[0]?.description ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {verdicts && !verdicts.some((v) => v.is_anomaly) && (
                <p className="flex items-center gap-2 font-mono text-[11px] text-clearance">
                  <ShieldCheck size={14} /> Every screened event sits within the learned baseline.
                </p>
              )}

              <div className="border-t border-line pt-3 dark:border-line-dark">
                <button
                  onClick={aiLogInsights}
                  disabled={insightsBusy}
                  className="inline-flex items-center gap-1.5 border border-clearance/50 bg-clearance-soft px-3 py-1.5 font-mono text-[10px] uppercase tracking-wideish text-clearance transition-colors hover:bg-clearance hover:text-paper dark:bg-clearance/10 disabled:opacity-50"
                >
                  {insightsBusy ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                  {insightsBusy ? "Gemini is reviewing..." : insights ? "Re-run AI review" : "AI review of these logs"}
                </button>
                {insightsError && (
                  <p className="mt-2 flex items-center gap-1.5 font-mono text-[10.5px] text-signal">
                    <AlertTriangle size={12} /> {insightsError}
                  </p>
                )}
                {insights && (
                  <div className="mt-3 space-y-2.5">
                    <p className="text-[12.5px] leading-relaxed text-ink dark:text-paper/85">{insights.overview}</p>
                    {insights.notableFindings?.length > 0 && (
                      <div>
                        <div className="pb-1 font-mono text-[8.5px] uppercase tracking-widest2 text-ink-faint dark:text-paper/45">Notable findings</div>
                        <ul className="space-y-1">
                          {insights.notableFindings.map((f) => (
                            <li key={f} className="flex items-start gap-2 font-mono text-[10.5px] leading-relaxed text-ink-soft dark:text-paper/60">
                              <span className="mt-1.5 h-1 w-1 flex-none bg-signal" />{f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {insights.dataQuality?.length > 0 && (
                      <div>
                        <div className="pb-1 font-mono text-[8.5px] uppercase tracking-widest2 text-ink-faint dark:text-paper/45">Data quality</div>
                        <ul className="space-y-1">
                          {insights.dataQuality.map((f) => (
                            <li key={f} className="flex items-start gap-2 font-mono text-[10px] leading-relaxed text-ink-faint dark:text-paper/45">
                              <FileWarning size={11} className="mt-0.5 flex-none" />{f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {insights.suggestedNext?.length > 0 && (
                      <div>
                        <div className="pb-1 font-mono text-[8.5px] uppercase tracking-widest2 text-ink-faint dark:text-paper/45">Suggested next steps</div>
                        <ol className="space-y-1">
                          {insights.suggestedNext.map((s, i) => (
                            <li key={s} className="flex items-start gap-2 font-mono text-[10.5px] leading-relaxed text-ink-soft dark:text-paper/60">
                              <span className="font-600 text-clearance">{i + 1}.</span>{s}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Panel>

      {/* batch demo */}
      <Panel
        label="Batch simulation — 3 event types (event model)"
        right={
          <button
            onClick={() => analyze(null, "batch")}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 border border-line px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wideish text-ink-soft transition-colors hover:border-signal hover:text-signal dark:border-line-dark dark:text-paper/60 disabled:opacity-50"
          >
            {busy === "batch" ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
            Run batch
          </button>
        }
      >
        {batch ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-line dark:border-line-dark">
                  {["Event", "Verdict", "Risk", "Level", "Top reason"].map((h) => (
                    <th key={h} className="pb-2 font-mono text-[9.5px] uppercase tracking-widest2 text-ink-faint dark:text-paper/45">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line dark:divide-line-dark">
                {batch.map((r, i) => (
                  <tr key={r.event_id ?? i} className="transition-colors hover:bg-paper-dim/60 dark:hover:bg-void-surface/50">
                    <td className="px-1 py-3 font-mono text-[11px] text-ink dark:text-paper">{r.event_id}</td>
                    <td className="px-1 py-3">
                      <span className={`font-mono text-[10.5px] font-600 ${r.is_anomaly ? "text-signal" : "text-clearance"}`}>
                        {r.is_anomaly ? "ANOMALY" : "normal"}
                      </span>
                    </td>
                    <td className={`px-1 py-3 font-mono text-[12px] font-600 tabular-nums ${riskTone(r.risk_score)}`}>{r.risk_score.toFixed(1)}</td>
                    <td className="px-1 py-3"><SeverityBadge level={levelToSeverity[r.risk_level]} /></td>
                    <td className="px-1 py-3 font-mono text-[10.5px] text-ink-soft dark:text-paper/60">{r.reasons[0]?.feature ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="font-mono text-[11px] text-ink-faint dark:text-paper/40">
            Score {BATCH_EVENTS.length} NSL-KDD-style events at once (brute-force pattern, port scan, normal HTTP).
          </p>
        )}
      </Panel>
    </div>
  );
}
