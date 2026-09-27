"use client";

import { useMemo, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  Link2,
  FileText,
  Trash2,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  FlaskConical,
  Hash,
  CheckCircle2,
  Database,
} from "lucide-react";
import { PageHeader, Panel, SeverityBadge } from "@/components/app/primitives";
import { ConnectMlScreening } from "@/components/app/ai/connect-ml-screening";
import { useDataSource } from "@/components/app/data-source";
import { usePageTitle } from "@/lib/use-page-title";
import { parseFilesDetailed } from "@/lib/ingest/parse";
import { analyze, type IngestFile } from "@/lib/ingest/analyze";
import { sha256Short } from "@/lib/ingest/hash";
import type { Dataset, MlScreening } from "@/lib/dataset";

type Loaded = { name: string; text: string; size: number };

const ACCEPT = ".log,.txt,.json,.jsonl,.csv";
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB per file — keeps localStorage sane

const SAMPLE_FILES = ["auth-sample.log", "network-events.csv"];

const formatLabel: Record<string, string> = {
  json: "JSON",
  jsonl: "JSON Lines",
  csv: "CSV",
  log: "Log / text",
};

export default function ConnectPage() {
  usePageTitle("Data Sources — AegisSOC");
  const router = useRouter();
  const { loadUserDataset } = useDataSource();

  const [files, setFiles] = useState<Loaded[]>([]);
  const [url, setUrl] = useState("");
  const [urlBusy, setUrlBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Dataset | null>(null);
  const [mlScreening, setMlScreening] = useState<MlScreening | null>(null);
  const [fileHashes, setFileHashes] = useState<{ name: string; hash: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Per-file format + event count, recomputed as the source list changes.
  const parsed = useMemo(
    () => parseFilesDetailed(files.map((f) => ({ name: f.name, text: f.text }))),
    [files],
  );
  const totalEvents = parsed.reduce((s, p) => s + p.events.length, 0);

  async function addFiles(list: FileList | File[]) {
    setError(null);
    const incoming = Array.from(list);
    const loaded: Loaded[] = [];
    for (const f of incoming) {
      if (f.size > MAX_BYTES) {
        setError(`"${f.name}" is larger than 8 MB and was skipped.`);
        continue;
      }
      try {
        const text = await f.text();
        loaded.push({ name: f.name, text, size: f.size });
      } catch {
        setError(`Could not read "${f.name}".`);
      }
    }
    if (loaded.length) {
      setResult(null);
      setFiles((prev) => {
        const byName = new Map(prev.map((p) => [p.name, p]));
        loaded.forEach((l) => byName.set(l.name, l));
        return [...byName.values()];
      });
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
    setResult(null);
  }

  async function loadSamples() {
    setError(null);
    try {
      const loaded = await Promise.all(
        SAMPLE_FILES.map(async (name) => {
          const res = await fetch(`/samples/${name}`);
          if (!res.ok) throw new Error(name);
          return { name, text: await res.text(), size: 0 };
        }),
      );
      setResult(null);
      setFiles((prev) => {
        const byName = new Map(prev.map((p) => [p.name, p]));
        loaded.forEach((l) => byName.set(l.name, l));
        return [...byName.values()];
      });
    } catch {
      setError("Could not load the bundled sample logs.");
    }
  }

  async function connectUrl() {
    const target = url.trim();
    if (!target || urlBusy) return;
    setUrlBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target }),
      });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || typeof data.text !== "string") {
        setError(data.error ?? "Could not fetch that URL.");
        return;
      }
      if (!data.text.trim()) {
        setError("That URL returned no content.");
        return;
      }
      const name = safeName(target);
      setResult(null);
      setFiles((prev) => {
        const byName = new Map(prev.map((p) => [p.name, p]));
        byName.set(name, { name, text: data.text as string, size: data.text!.length });
        return [...byName.values()];
      });
      setUrl("");
    } catch {
      setError("Could not reach the proxy. Is the dev server running?");
    } finally {
      setUrlBusy(false);
    }
  }

  async function runAnalyze() {
    if (!files.length || analyzing) return;
    setAnalyzing(true);
    setError(null);
    try {
      const textByName = new Map(files.map((f) => [f.name, f.text]));
      const events = parsed.flatMap((p) => p.events);
      const ingestFiles: IngestFile[] = await Promise.all(
        parsed.map(async (p) => ({
          name: p.file,
          hash: await sha256Short(textByName.get(p.file) ?? ""),
          events: p.events.length,
        })),
      );
      const connected = files.find((f) => f.name.startsWith("http"));
      const ds = analyze(events, {
        files: ingestFiles,
        label: deriveLabel(files),
        url: connected?.name,
      });

      // ML screening: score the parsed events through the NSL-KDD anomaly
      // model and attach the summary to the dataset (best-effort — if the
      // ML service is offline the console still works, just unscored).
      let screening = null;
      try {
        const mlRes = await fetch("/api/ml/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ events }),
        });
        if (mlRes.ok) {
          const ml = (await mlRes.json()) as {
            summary?: { scored: number; flagged: number; maxRisk: number; avgRisk: number };
            verdicts?: {
              is_anomaly: boolean;
              risk_score: number;
              risk_level: string;
              reasons: { description: string }[];
              context: { action: string; sourceIp?: string };
            }[];
          };
          if (ml.summary && ml.verdicts) {
            screening = {
              model: "nslkdd",
              ...ml.summary,
              topEvents: ml.verdicts
                .filter((v) => v.is_anomaly)
                .sort((a, b) => b.risk_score - a.risk_score)
                .slice(0, 6)
                .map((v) => ({
                  action: v.context.action,
                  sourceIp: v.context.sourceIp,
                  risk: v.risk_score,
                  level: v.risk_level,
                  reasons: v.reasons.map((r) => r.description),
                })),
            };
            ds.ml = screening;
          }
        }
      } catch {
        /* ML service offline — proceed without screening */
      }
      setMlScreening(screening);

      loadUserDataset(ds);
      setFileHashes(ingestFiles.map((f) => ({ name: f.name, hash: f.hash })));
      setResult(ds);
    } catch {
      setError("Something went wrong analyzing these logs. Check the file format and try again.");
    } finally {
      setAnalyzing(false);
    }
  }

  function reset() {
    setFiles([]);
    setResult(null);
    setFileHashes([]);
    setError(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Data Sources" title="Analyze your own logs">
        <span className="inline-flex items-center gap-1.5 border border-clearance/50 bg-clearance-soft px-2 py-1 font-mono text-[10px] uppercase tracking-wideish text-clearance dark:bg-clearance/10">
          <ShieldCheck size={12} /> Parsed in your browser
        </span>
      </PageHeader>

      <p className="max-w-3xl font-body text-[14px] leading-relaxed text-ink-soft dark:text-paper/70">
        Upload log files or connect a URL. AegisSOC parses the events, detects
        incidents with transparent pattern rules, scores each by risk, and
        rebuilds the whole console around your data. Analysis runs locally;
        evidence hashes are real SHA-256 digests of the bytes you provide.
      </p>

      {error && (
        <div className="flex items-start gap-2.5 border border-signal/50 bg-signal-soft px-4 py-3 dark:bg-signal/10">
          <AlertTriangle size={15} className="mt-0.5 flex-none text-signal" />
          <span className="font-mono text-[12px] text-signal">{error}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* upload + url */}
        <div className="space-y-6">
          <Panel label="Upload log files" bodyClassName="p-4 space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center border border-dashed px-6 py-10 text-center transition-colors ${
                dragging
                  ? "border-signal bg-signal-soft dark:bg-signal/10"
                  : "border-line hover:border-signal dark:border-line-dark"
              }`}
            >
              <Upload size={22} className="text-ink-faint dark:text-paper/40" />
              <p className="mt-3 font-body text-[13.5px] text-ink dark:text-paper/85">
                Drag &amp; drop log files, or{" "}
                <span className="text-signal underline underline-offset-2">browse</span>
              </p>
              <p className="mt-1 font-mono text-[10.5px] uppercase tracking-wideish text-ink-faint dark:text-paper/40">
                .log · .txt · .json · .jsonl · .csv
              </p>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                loadSamples();
              }}
              className="inline-flex items-center gap-1.5 border border-line px-3 py-1.5 font-mono text-[11px] uppercase tracking-wideish text-ink-soft transition-colors hover:border-signal hover:text-signal dark:border-line-dark dark:text-paper/70"
            >
              <FlaskConical size={13} /> Load sample logs
            </button>
          </Panel>

          <Panel label="Connect a URL" bodyClassName="p-4 space-y-3">
            <p className="font-body text-[12.5px] leading-relaxed text-ink-soft dark:text-paper/65">
              Point AegisSOC at a raw log endpoint (http/https). It's fetched
              through a small server-side proxy to get past browser CORS.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex flex-1 items-center gap-2 border border-line px-3 py-2.5 focus-within:border-signal dark:border-line-dark">
                <Link2 size={14} className="flex-none text-ink-faint dark:text-paper/40" />
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && connectUrl()}
                  placeholder="https://example.com/logs/auth.log"
                  className="w-full bg-transparent font-mono text-[12px] text-ink outline-none placeholder:text-ink-faint dark:text-paper dark:placeholder:text-paper/40"
                />
              </div>
              <button
                onClick={connectUrl}
                disabled={!url.trim() || urlBusy}
                className="inline-flex items-center justify-center gap-1.5 border border-ink bg-ink px-4 py-2.5 font-mono text-[11px] uppercase tracking-wideish text-paper transition-opacity hover:bg-signal hover:border-signal disabled:opacity-40 dark:border-paper dark:bg-paper dark:text-ink dark:hover:bg-signal dark:hover:text-paper"
              >
                {urlBusy ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
                Fetch
              </button>
            </div>
          </Panel>
        </div>

        {/* loaded sources + analyze */}
        <Panel
          label={`Sources${files.length ? ` · ${files.length}` : ""}`}
          right={
            files.length ? (
              <button
                onClick={reset}
                className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wideish text-ink-faint transition-colors hover:text-signal dark:text-paper/40"
              >
                <Trash2 size={11} /> Clear
              </button>
            ) : undefined
          }
          bodyClassName="p-0"
        >
          {files.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <Database size={20} className="text-ink-faint dark:text-paper/30" />
              <p className="mt-3 font-mono text-[11px] uppercase tracking-wideish text-ink-faint dark:text-paper/40">
                No sources yet
              </p>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-line dark:divide-line-dark">
                {files.map((f) => {
                  const info = parsed.find((p) => p.file === f.name);
                  return (
                    <li key={f.name} className="flex items-center gap-3 px-4 py-3">
                      <FileText size={14} className="flex-none text-ink-faint dark:text-paper/40" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-[12px] text-ink dark:text-paper/85">{f.name}</p>
                        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wideish text-ink-faint dark:text-paper/40">
                          {info ? `${formatLabel[info.format]} · ${info.events.length} events` : "…"}
                        </p>
                      </div>
                      <button
                        onClick={() => removeFile(f.name)}
                        aria-label={`Remove ${f.name}`}
                        className="flex-none text-ink-faint transition-colors hover:text-signal dark:text-paper/40"
                      >
                        <Trash2 size={13} />
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="border-t border-line px-4 py-3 dark:border-line-dark">
                <div className="mb-3 flex items-center justify-between font-mono text-[11px] text-ink-soft dark:text-paper/60">
                  <span className="uppercase tracking-wideish text-ink-faint dark:text-paper/40">Total events</span>
                  <span className="tabular-nums text-ink dark:text-paper">{totalEvents.toLocaleString()}</span>
                </div>
                <button
                  onClick={runAnalyze}
                  disabled={analyzing || totalEvents === 0}
                  className="inline-flex w-full items-center justify-center gap-2 border border-signal bg-signal px-4 py-3 font-mono text-[11px] uppercase tracking-wideish text-paper transition-opacity disabled:opacity-40"
                >
                  {analyzing ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                  {analyzing ? "Analyzing…" : "Analyze logs"}
                </button>
                {totalEvents === 0 && (
                  <p className="mt-2 font-mono text-[10px] text-ink-faint dark:text-paper/40">
                    No events parsed yet — check the file format.
                  </p>
                )}
              </div>
            </>
          )}
        </Panel>
      </div>

      {result && <AnalysisSummary result={result} fileHashes={fileHashes} onOpen={() => router.push("/dashboard")} />}

      {result && (
        <ConnectMlScreening
          screening={mlScreening}
          events={parsed.flatMap((p) => p.events)}
          files={parsed.map((p) => ({ name: p.file, format: p.format, events: p.events.length }))}
        />
      )}
    </div>
  );
}

function AnalysisSummary({
  result,
  fileHashes,
  onOpen,
}: {
  result: Dataset;
  fileHashes: { name: string; hash: string }[];
  onOpen: () => void;
}) {
  const techniques = result.mitreProgression.filter((m) => m.observed);
  return (
    <Panel
      label="Analysis complete"
      right={
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wideish text-clearance">
          <CheckCircle2 size={12} /> Loaded into console
        </span>
      }
      bodyClassName="p-0"
    >
      {/* headline counts */}
      <div className="grid grid-cols-2 divide-x divide-y divide-line dark:divide-line-dark sm:grid-cols-4 sm:divide-y-0">
        {[
          { label: "Events", value: result.meta.eventCount.toLocaleString() },
          { label: "Incidents", value: String(result.incidents.length) },
          { label: "Critical", value: String(result.incidents.filter((i) => i.severity === "Critical").length) },
          { label: "Techniques", value: String(techniques.length) },
        ].map((s) => (
          <div key={s.label} className="px-5 py-4">
            <span className="block font-mono text-2xl font-600 tabular-nums">{s.value}</span>
            <span className="mt-1 block font-mono text-[9.5px] uppercase tracking-wideish text-ink-faint dark:text-paper/40">
              {s.label}
            </span>
          </div>
        ))}
      </div>

      <div className="grid gap-0 border-t border-line dark:border-line-dark lg:grid-cols-2 lg:divide-x lg:divide-line dark:lg:divide-line-dark">
        {/* detected incidents */}
        <div className="p-5">
          <span className="font-mono text-[10px] uppercase tracking-widest2 text-ink-faint dark:text-paper/50">
            Detected incidents
          </span>
          {result.incidents.length ? (
            <ul className="mt-3 space-y-2">
              {result.incidents.slice(0, 6).map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-body text-[13px] text-ink dark:text-paper/85">
                    <span className="font-mono text-ink-faint dark:text-paper/40">#{i.id}</span> {i.title}
                    <span className="text-ink-faint dark:text-paper/40"> · {i.asset}</span>
                  </span>
                  <SeverityBadge level={i.severity} className="flex-none" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 font-body text-[13px] text-ink-soft dark:text-paper/60">
              No incidents matched the detection rules — the console will show your events without flagged incidents.
            </p>
          )}
        </div>

        {/* techniques + top IPs */}
        <div className="divide-y divide-line dark:divide-line-dark">
          <div className="p-5">
            <span className="font-mono text-[10px] uppercase tracking-widest2 text-ink-faint dark:text-paper/50">
              MITRE techniques
            </span>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {techniques.length ? (
                techniques.map((t) => (
                  <span key={t.code} className="border border-line px-2 py-1 font-mono text-[10px] text-ink-soft dark:border-line-dark dark:text-paper/70">
                    {t.code} · {t.technique}
                  </span>
                ))
              ) : (
                <span className="font-mono text-[11px] text-ink-faint dark:text-paper/40">None mapped</span>
              )}
            </div>
          </div>
          <div className="p-5">
            <span className="font-mono text-[10px] uppercase tracking-widest2 text-ink-faint dark:text-paper/50">
              Top sources
            </span>
            <div className="mt-3 space-y-1.5">
              {result.threatIntel.length ? (
                result.threatIntel.map((t) => (
                  <div key={t.value} className="flex items-center justify-between font-mono text-[11px]">
                    <span className="text-ink dark:text-paper/85">{t.value}</span>
                    <span className="text-ink-faint dark:text-paper/40">{t.reputation} · {t.related} events</span>
                  </div>
                ))
              ) : (
                <span className="font-mono text-[11px] text-ink-faint dark:text-paper/40">No hostile sources</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* evidence hashes */}
      {fileHashes.length > 0 && (
        <div className="border-t border-line p-5 dark:border-line-dark">
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest2 text-ink-faint dark:text-paper/50">
            <Hash size={11} /> Evidence integrity · SHA-256
          </span>
          <ul className="mt-3 space-y-1.5">
            {fileHashes.map((f) => (
              <li key={f.name} className="flex items-center justify-between gap-3 font-mono text-[11px]">
                <span className="min-w-0 truncate text-ink-soft dark:text-paper/65">{f.name}</span>
                <span className="flex-none text-clearance">{f.hash}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-line px-5 py-4 dark:border-line-dark sm:flex-row sm:items-center sm:justify-between">
        <span className="font-mono text-[11px] text-ink-faint dark:text-paper/40">
          Your data is now the active source across the console.
        </span>
        <button
          onClick={onOpen}
          className="group inline-flex items-center justify-center gap-2 border border-ink bg-ink px-5 py-2.5 font-mono text-[11px] uppercase tracking-wideish text-paper transition-colors hover:border-signal hover:bg-signal dark:border-paper dark:bg-paper dark:text-ink dark:hover:border-signal dark:hover:bg-signal dark:hover:text-paper"
        >
          Open dashboard
          <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </Panel>
  );
}

function safeName(url: string): string {
  try {
    const u = new URL(url);
    const tail = u.pathname.split("/").filter(Boolean).pop();
    return tail ? `${u.hostname}/${tail}` : u.hostname;
  } catch {
    return url.slice(0, 60);
  }
}

function deriveLabel(files: Loaded[]): string {
  const connected = files.find((f) => f.name.startsWith("http"));
  if (connected) return `Connected: ${connected.name}`;
  if (files.length === 1) return files[0].name;
  return `${files.length} uploaded files`;
}
