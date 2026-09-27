"use client";

import Link from "next/link";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import { CountUp } from "@/components/count-up";
import { Panel, PageHeader, SeverityBadge, StatusBadge, riskTone } from "@/components/app/primitives";
import { ActivityChart, Sparkline } from "@/components/app/charts";
import { ScoreRing } from "@/components/app/score-ring";
import { LiveFeed } from "@/components/app/live-feed";
import { AiBriefing } from "@/components/app/ai/ai-briefing";
import { DashboardMlSection } from "@/components/app/ai/dashboard-ml-section";
import { useDataSource } from "@/components/app/data-source";
import { usePageTitle } from "@/lib/use-page-title";

function healthTone(v: number): "clearance" | "caution" | "signal" {
  if (v >= 85) return "clearance";
  if (v >= 76) return "caution";
  return "signal";
}
const healthBar: Record<string, string> = {
  clearance: "bg-clearance",
  caution: "bg-caution",
  signal: "bg-signal",
};

export default function DashboardPage() {
  usePageTitle("SOC Overview — AegisSOC");
  const { dataset, source } = useDataSource();
  const {
    kpis,
    activitySeries,
    topThreats,
    threatIntel,
    assets,
    securityHealth,
    mitreProgression,
    incidents,
  } = dataset;
  const suggestions = dataset.analyst.suggestions;

  const maxThreat = Math.max(1, ...topThreats.map((t) => t.count));
  const queue = incidents.filter((i) => i.severity === "Critical" || i.severity === "High").slice(0, 5);
  const topIncident = [...incidents].sort((a, b) => b.risk - a.risk)[0];
  const topAssets = [...assets].sort((a, b) => b.risk - a.risk).slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Security Operations" title="SOC Overview">
        <span className="inline-flex items-center gap-2 border border-line px-3 py-1.5 font-mono text-[11px] text-ink-soft dark:border-line-dark dark:text-paper/60">
          <span className="h-1.5 w-1.5 animate-blink rounded-full bg-clearance" />
          {source === "user" ? "Your data · last 24h" : "Live · last 24h"}
        </span>
      </PageHeader>

      {/* AI briefing */}
      <AiBriefing />

      {/* stat cards */}
      <div className="grid grid-cols-2 gap-px border border-line bg-line dark:border-line-dark dark:bg-line-dark lg:grid-cols-4">
        {kpis.map((s) => (
          <div key={s.label} className="bg-paper p-5 dark:bg-void">
            <div className="flex items-start justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wideish text-ink-faint dark:text-paper/45">
                {s.label}
              </span>
              {s.trend && <span className="font-mono text-[10px] text-clearance">{s.trend}</span>}
            </div>
            <CountUp value={s.value} className="mt-3 block font-mono text-3xl font-600 tabular-nums text-ink dark:text-paper" />
            {s.spark.length > 0 && (
              <div className="mt-3">
                <Sparkline data={s.spark} tone={s.tone} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* activity + health */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel label="Attack activity — 24h" className="lg:col-span-2" right={<span className="font-mono text-[10px] text-ink-faint dark:text-paper/40">events · alerts</span>}>
          <ActivityChart data={activitySeries} />
        </Panel>

        <Panel label="Security health score">
          <div className="flex flex-col items-center gap-4">
            <ScoreRing value={securityHealth.score} tone="caution" size={132} suffix="/ 100" />
            <div className="w-full space-y-2.5">
              {securityHealth.dimensions.map((d) => {
                const tone = healthTone(d.value);
                return (
                  <div key={d.name}>
                    <div className="flex items-center justify-between font-mono text-[10.5px]">
                      <span className="text-ink-soft dark:text-paper/60">{d.name}</span>
                      <span className="tabular-nums text-ink dark:text-paper">{d.value}</span>
                    </div>
                    <div className="mt-1 h-1 w-full bg-line dark:bg-line-dark">
                      <div className={`h-full ${healthBar[tone]}`} style={{ width: `${d.value}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Panel>
      </div>

      {/* live feed + top threats */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          label="Live event stream"
          className="lg:col-span-2"
          bodyClassName=""
          right={
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-ink-faint dark:text-paper/40">
              <span className="h-1.5 w-1.5 animate-blink rounded-full bg-signal" /> ingesting
            </span>
          }
        >
          <LiveFeed />
        </Panel>

        <Panel label="Top threats">
          {topThreats.length === 0 ? (
            <p className="font-mono text-[11px] text-ink-faint dark:text-paper/40">No threat categories detected.</p>
          ) : (
            <ul className="space-y-3.5">
              {topThreats.map((t) => (
                <li key={t.name}>
                  <div className="flex items-center justify-between font-mono text-[11.5px]">
                    <span className="text-ink dark:text-paper/85">{t.name}</span>
                    <span className="tabular-nums text-ink-faint dark:text-paper/45">{t.count}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full bg-line dark:bg-line-dark">
                    <div className="h-full bg-signal" style={{ width: `${(t.count / maxThreat) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {source === "demo" && (
            <div className="mt-5 border-t border-line pt-4 dark:border-line-dark">
              <span className="font-mono text-[10px] uppercase tracking-widest2 text-ink-faint dark:text-paper/40">
                Detection mix
              </span>
              <div className="mt-2 flex gap-4 font-mono text-[10.5px] text-ink-soft dark:text-paper/60">
                <span><span className="text-signal">■</span> Rules 63%</span>
                <span><span className="text-caution">■</span> ML 29%</span>
                <span><span className="text-clearance">■</span> Intel 8%</span>
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* ML anomaly detection engines */}
      <DashboardMlSection />

      {/* threat intel + mitre + asset risk */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel label="Threat intelligence">
          {threatIntel.length === 0 ? (
            <p className="font-mono text-[11px] text-ink-faint dark:text-paper/40">No indicators enriched.</p>
          ) : (
            <ul className="divide-y divide-line dark:divide-line-dark">
              {threatIntel.map((t) => (
                <li key={t.value} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-[11.5px] text-ink dark:text-paper/85">{t.value}</div>
                    <div className="font-mono text-[9.5px] uppercase tracking-wideish text-ink-faint dark:text-paper/40">
                      {t.kind} · {t.related} related
                    </div>
                  </div>
                  <span
                    className={`flex-none border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wideish ${
                      t.reputation === "Malicious"
                        ? "border-signal/50 bg-signal-soft text-signal dark:bg-signal/10"
                        : "border-caution/50 bg-caution-soft text-caution dark:bg-caution/10"
                    }`}
                  >
                    {t.reputation} {t.confidence}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel label="MITRE ATT&CK progression">
          {mitreProgression.length === 0 ? (
            <p className="font-mono text-[11px] text-ink-faint dark:text-paper/40">No techniques observed.</p>
          ) : (
            <ol className="space-y-2">
              {mitreProgression.map((m, i) => (
                <li key={m.code} className="flex items-center gap-3">
                  <span className="font-mono text-[9px] text-ink-faint dark:text-paper/30">{String(i + 1).padStart(2, "0")}</span>
                  <div
                    className={`flex flex-1 items-center justify-between border px-2.5 py-1.5 ${
                      m.observed
                        ? "border-signal/40 bg-signal-soft/70 dark:bg-signal/10"
                        : "border-dashed border-line dark:border-line-dark"
                    }`}
                  >
                    <div>
                      <div className={`font-mono text-[11px] ${m.observed ? "text-signal" : "text-ink-faint dark:text-paper/40"}`}>
                        {m.code}
                      </div>
                      <div className="font-mono text-[9px] uppercase tracking-wideish text-ink-faint dark:text-paper/40">
                        {m.tactic}
                      </div>
                    </div>
                    <span className="font-mono text-[9.5px] text-ink-soft dark:text-paper/50">
                      {m.observed ? "observed" : "—"}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel label="Asset risk" right={<Link href="/assets" className="font-mono text-[10px] text-signal hover:underline">all →</Link>}>
          {topAssets.length === 0 ? (
            <p className="font-mono text-[11px] text-ink-faint dark:text-paper/40">No assets identified.</p>
          ) : (
            <ul className="space-y-3">
              {topAssets.map((a) => (
                <li key={a.name}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11.5px] text-ink dark:text-paper/85">{a.name}</span>
                    <span className={`font-mono text-[11.5px] font-600 tabular-nums ${riskTone(a.risk)}`}>{a.risk}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1 flex-1 bg-line dark:bg-line-dark">
                      <div className={`h-full ${a.risk >= 76 ? "bg-signal" : a.risk >= 51 ? "bg-caution" : "bg-clearance"}`} style={{ width: `${a.risk}%` }} />
                    </div>
                    <SeverityBadge level={a.criticality} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* incident queue */}
      <Panel
        label="Critical incident queue"
        right={<Link href="/incidents" className="inline-flex items-center gap-1 font-mono text-[10px] text-signal hover:underline">View all incidents <ArrowRight size={11} /></Link>}
        bodyClassName=""
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-line text-left dark:border-line-dark">
                {["ID", "Incident", "Asset", "Risk", "Severity", "Status", "MITRE", ""].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-mono text-[9.5px] uppercase tracking-wideish text-ink-faint dark:text-paper/40">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line dark:divide-line-dark">
              {queue.map((i) => (
                <tr key={i.id} className="group transition-colors hover:bg-paper-dim/60 dark:hover:bg-void-surface/50">
                  <td className="px-4 py-3 font-mono text-[11px] text-ink-faint dark:text-paper/40">#{i.id}</td>
                  <td className="px-4 py-3">
                    <Link href={`/incidents/${i.id}`} className="font-display text-[13px] font-500 transition-colors group-hover:text-signal">
                      {i.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-ink-soft dark:text-paper/60">{i.asset}</td>
                  <td className={`px-4 py-3 font-mono text-[12px] font-600 tabular-nums ${riskTone(i.risk)}`}>{i.risk}</td>
                  <td className="px-4 py-3"><SeverityBadge level={i.severity} /></td>
                  <td className="px-4 py-3"><StatusBadge status={i.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {i.mitre.map((m) => (
                        <span key={m} className="border border-line px-1 py-0.5 font-mono text-[9px] text-ink-soft dark:border-line-dark dark:text-paper/50">{m}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/incidents/${i.id}`} className="text-ink-faint transition-colors group-hover:text-signal dark:text-paper/40">
                      <ArrowUpRight size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
              {queue.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center font-mono text-[11px] text-ink-faint dark:text-paper/40">
                    No critical or high-severity incidents in this source.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* AI analyst ask */}
      <Link
        href="/analyst"
        className="group flex flex-col gap-4 border border-line bg-ink p-5 transition-colors hover:border-signal dark:border-line-dark dark:bg-void-surface sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-3">
          <span className="h-1.5 w-1.5 flex-none rounded-full bg-clearance" />
          <span className="font-mono text-[13px] text-paper/70">
            Ask AegisSOC anything
            {topIncident && (
              <>
                {" — "}
                <span className="text-paper">“why is incident #{topIncident.id} risk {topIncident.risk}?”</span>
              </>
            )}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {suggestions.slice(0, 2).map((s) => (
            <span key={s} className="hidden border border-paper/20 px-2 py-1 font-mono text-[10px] text-paper/50 md:inline-block">{s}</span>
          ))}
          <span className="inline-flex items-center gap-1.5 bg-signal px-4 py-2 font-mono text-[11px] uppercase tracking-wideish text-paper transition-transform group-hover:translate-x-0.5">
            Open analyst <ArrowRight size={13} />
          </span>
        </div>
      </Link>
    </div>
  );
}
