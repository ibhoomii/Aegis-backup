"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Panel, PageHeader, SeverityBadge, riskTone } from "@/components/app/primitives";
import { ScoreRing } from "@/components/app/score-ring";
import { useDataset } from "@/components/app/data-source";
import { usePageTitle } from "@/lib/use-page-title";

const reputationClass: Record<string, string> = {
  Malicious: "border-signal/50 bg-signal-soft text-signal dark:bg-signal/10",
  Suspicious: "border-caution/50 bg-caution-soft text-caution dark:bg-caution/10",
  Clean: "border-clearance/50 bg-clearance-soft text-clearance dark:bg-clearance/10",
};

function userTone(risk: number): "signal" | "caution" | "clearance" {
  return risk >= 76 ? "signal" : risk >= 51 ? "caution" : "clearance";
}

export default function AssetsPage() {
  usePageTitle("Assets & Risk — AegisSOC");
  const { assets, userProfiles, threatIntel } = useDataset();
  const sortedAssets = [...assets].sort((a, b) => b.risk - a.risk);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Context" title="Assets & Risk">
        <span className="inline-flex items-center gap-2 border border-line px-3 py-1.5 font-mono text-[11px] text-ink-soft dark:border-line-dark dark:text-paper/60">
          {assets.length} assets · {assets.filter((a) => a.openIncidents > 0).length} with open incidents
        </span>
      </PageHeader>

      {/* asset register */}
      <Panel label="Asset risk register" bodyClassName="">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="border-b border-line text-left dark:border-line-dark">
                {["Asset", "Type", "Criticality", "Risk", "Owner", "Open"].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-mono text-[9.5px] uppercase tracking-wideish text-ink-faint dark:text-paper/40">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line dark:divide-line-dark">
              {sortedAssets.map((a) => (
                <tr key={a.name} className="transition-colors hover:bg-paper-dim/60 dark:hover:bg-void-surface/50">
                  <td className="px-4 py-3 font-mono text-[12px] text-ink dark:text-paper/85">{a.name}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-ink-soft dark:text-paper/55">{a.type}</td>
                  <td className="px-4 py-3"><SeverityBadge level={a.criticality} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-6 font-mono text-[12px] font-600 tabular-nums ${riskTone(a.risk)}`}>{a.risk}</span>
                      <div className="h-1 w-24 bg-line dark:bg-line-dark">
                        <div className={`h-full ${a.risk >= 76 ? "bg-signal" : a.risk >= 51 ? "bg-caution" : "bg-clearance"}`} style={{ width: `${a.risk}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-ink-soft dark:text-paper/55">{a.owner}</td>
                  <td className="px-4 py-3">
                    {a.openIncidents > 0 ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-signal">
                        <AlertTriangle size={11} /> {a.openIncidents}
                      </span>
                    ) : (
                      <span className="font-mono text-[11px] text-ink-faint dark:text-paper/30">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {sortedAssets.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center font-mono text-[11px] text-ink-faint dark:text-paper/40">
                    No assets identified in this source.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* user risk profiling */}
      {userProfiles.length > 0 && (
        <div>
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-widest2 text-ink-faint dark:text-paper/45">
            User risk profiling
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {userProfiles.map((u) => (
              <div key={u.user} className="border border-line bg-paper p-4 dark:border-line-dark dark:bg-void">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-mono text-[13px] text-ink dark:text-paper">{u.user}</div>
                    <div className="font-mono text-[10px] uppercase tracking-wideish text-ink-faint dark:text-paper/40">{u.role}</div>
                  </div>
                  <ScoreRing value={u.risk} tone={userTone(u.risk)} size={64} stroke={5} />
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className="border border-line px-2.5 py-2 dark:border-line-dark">
                    <div className="font-mono text-[8.5px] uppercase tracking-widest2 text-clearance">Baseline</div>
                    <p className="mt-1 font-mono text-[10px] leading-relaxed text-ink-soft dark:text-paper/55">{u.baseline}</p>
                  </div>
                  <div className={`border px-2.5 py-2 ${u.flags.length ? "border-signal/40 bg-signal-soft/40 dark:bg-signal/5" : "border-line dark:border-line-dark"}`}>
                    <div className="font-mono text-[8.5px] uppercase tracking-widest2 text-signal">Current</div>
                    <p className="mt-1 font-mono text-[10px] leading-relaxed text-ink-soft dark:text-paper/55">{u.current}</p>
                  </div>
                </div>

                {u.flags.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {u.flags.map((f) => (
                      <span key={f} className="border border-signal/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wideish text-signal">
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* threat intelligence */}
      <Panel label="Threat intelligence" bodyClassName="">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-line text-left dark:border-line-dark">
                {["Indicator", "Type", "Reputation", "Confidence", "Related", "First seen", "Last seen"].map((h) => (
                  <th key={h} className="px-4 py-2.5 font-mono text-[9.5px] uppercase tracking-wideish text-ink-faint dark:text-paper/40">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line dark:divide-line-dark">
              {threatIntel.map((t) => (
                <tr key={t.value} className="transition-colors hover:bg-paper-dim/60 dark:hover:bg-void-surface/50">
                  <td className="px-4 py-3 font-mono text-[11.5px] text-ink dark:text-paper/85">{t.value}</td>
                  <td className="px-4 py-3 font-mono text-[10px] uppercase tracking-wideish text-ink-faint dark:text-paper/40">{t.kind}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wideish ${reputationClass[t.reputation]}`}>
                      {t.reputation}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-7 font-mono text-[11px] tabular-nums text-ink-soft dark:text-paper/60">{t.confidence}%</span>
                      <div className="h-1 w-16 bg-line dark:bg-line-dark">
                        <div className="h-full bg-signal" style={{ width: `${t.confidence}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-ink-soft dark:text-paper/55">{t.related}</td>
                  <td className="px-4 py-3 font-mono text-[10px] text-ink-faint dark:text-paper/40">{t.firstSeen}</td>
                  <td className="px-4 py-3 font-mono text-[10px] text-ink-faint dark:text-paper/40">{t.lastSeen}</td>
                </tr>
              ))}
              {threatIntel.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center font-mono text-[11px] text-ink-faint dark:text-paper/40">
                    No threat indicators enriched from this source.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Link
        href="/analyst"
        className="inline-flex items-center gap-1.5 font-mono text-[11px] text-signal hover:underline"
      >
        Ask the analyst which asset to prioritise →
      </Link>
    </div>
  );
}
