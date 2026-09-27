"use client";

import { Panel, PageHeader } from "@/components/app/primitives";
import { ScoreRing } from "@/components/app/score-ring";
import { PrintButton } from "@/components/app/print-button";
import { useDataSource } from "@/components/app/data-source";
import { usePageTitle } from "@/lib/use-page-title";

const attackColors = ["bg-signal", "bg-caution", "bg-clearance", "bg-ink/40 dark:bg-paper/30"];
const legendColors = ["text-signal", "text-caution", "text-clearance", "text-ink-faint dark:text-paper/40"];

export default function ReportsPage() {
  usePageTitle("Reports — AegisSOC");
  const { dataset, source } = useDataSource();
  const { reportSummary, meta } = dataset;

  const kpis = [
    { label: "Events processed", value: reportSummary.totalEvents.toLocaleString("en-US") },
    { label: "Alerts raised", value: reportSummary.totalAlerts.toLocaleString("en-US") },
    { label: "Critical incidents", value: String(reportSummary.criticalIncidents), tone: "signal" },
    { label: "False-positive rate", value: `${reportSummary.falsePositiveRate}%`, tone: "clearance" },
    { label: "Avg response time", value: `${reportSummary.avgResponseMins}m` },
    { label: "Security score", value: `${reportSummary.securityScore}/100`, tone: "caution" },
  ];

  const attackTotal = Math.max(1, reportSummary.topAttackTypes.reduce((s, a) => s + a.value, 0));
  const maxIp = Math.max(1, ...reportSummary.topIps.map((i) => i.count));
  const maxTech = Math.max(1, ...reportSummary.topTechniques.map((t) => t.count));
  const topAttack = reportSummary.topAttackTypes[0];
  const topIp = reportSummary.topIps[0];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Reports" title="Security Summary">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-ink-faint dark:text-paper/40">
            {reportSummary.window} · generated {meta.generatedAt || "just now"}
          </span>
          <PrintButton />
        </div>
      </PageHeader>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-px border border-line bg-line dark:border-line-dark dark:bg-line-dark md:grid-cols-3 lg:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className="bg-paper p-4 dark:bg-void">
            <div className="font-mono text-[9.5px] uppercase tracking-wideish text-ink-faint dark:text-paper/45">
              {k.label}
            </div>
            <div
              className={`mt-2 font-mono text-xl font-600 tabular-nums ${
                k.tone === "signal"
                  ? "text-signal"
                  : k.tone === "clearance"
                  ? "text-clearance"
                  : k.tone === "caution"
                  ? "text-caution"
                  : "text-ink dark:text-paper"
              }`}
            >
              {k.value}
            </div>
          </div>
        ))}
      </div>

      {/* executive summary + score */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel label="Executive summary" className="lg:col-span-2">
          {source === "user" ? (
            <>
              <p className="font-body text-[14px] leading-relaxed text-ink dark:text-paper/85">
                Across {reportSummary.window.toLowerCase()}, AegisSOC parsed{" "}
                <span className="font-600 text-signal">{reportSummary.totalEvents.toLocaleString("en-US")}</span>{" "}
                events from your logs and raised {reportSummary.totalAlerts} alerts, of which{" "}
                {reportSummary.criticalIncidents} escalated to critical incidents. These figures come
                from browser-side heuristics — the flagged-only share puts the estimated
                false-positive rate near {reportSummary.falsePositiveRate}%.
              </p>
              <p className="mt-3 font-body text-[14px] leading-relaxed text-ink-soft dark:text-paper/70">
                {topAttack
                  ? `${topAttack.name} led the detections at ${topAttack.value}% of scored activity`
                  : "No dominant attack pattern emerged"}
                {topIp ? `, concentrated around ${topIp.value}` : ""}. Overall posture scores{" "}
                {reportSummary.securityScore}/100 across detection, response, user, network,
                endpoint, and vulnerability health.
              </p>
            </>
          ) : (
            <>
              <p className="font-body text-[14px] leading-relaxed text-ink dark:text-paper/85">
                Over the {reportSummary.window.toLowerCase()}, AegisSOC processed{" "}
                <span className="font-600 text-signal">{reportSummary.totalEvents.toLocaleString("en-US")}</span>{" "}
                security events and raised {reportSummary.totalAlerts} alerts, of which{" "}
                {reportSummary.criticalIncidents} escalated to critical incidents. Correlation and ML
                scoring held the false-positive rate to {reportSummary.falsePositiveRate}% while keeping
                mean response time at {reportSummary.avgResponseMins} minutes.
              </p>
              <p className="mt-3 font-body text-[14px] leading-relaxed text-ink-soft dark:text-paper/70">
                Brute-force and credential attacks dominated the threat landscape, driven largely by a
                small set of hostile source IPs. Overall posture holds at a security score of{" "}
                {reportSummary.securityScore}/100 — steady, with endpoint and vulnerability coverage the
                weakest dimensions.
              </p>
            </>
          )}

          {/* attack type distribution */}
          <div className="mt-6 border-t border-line pt-5 dark:border-line-dark">
            <div className="font-mono text-[10px] uppercase tracking-widest2 text-ink-faint dark:text-paper/45">
              Attack type distribution
            </div>
            {reportSummary.topAttackTypes.length === 0 ? (
              <p className="mt-3 font-mono text-[11px] text-ink-faint dark:text-paper/40">
                No attack categories were scored in this source.
              </p>
            ) : (
              <>
                <div className="mt-3 flex h-3 w-full overflow-hidden border border-line dark:border-line-dark">
                  {reportSummary.topAttackTypes.map((a, i) => (
                    <div
                      key={a.name}
                      className={attackColors[i % attackColors.length]}
                      style={{ width: `${(a.value / attackTotal) * 100}%` }}
                      title={`${a.name} ${a.value}%`}
                    />
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
                  {reportSummary.topAttackTypes.map((a, i) => (
                    <span key={a.name} className="font-mono text-[10.5px] text-ink-soft dark:text-paper/60">
                      <span className={legendColors[i % legendColors.length]}>■</span> {a.name} {a.value}%
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </Panel>

        <Panel label="Posture score">
          <div className="flex flex-col items-center gap-3">
            <ScoreRing value={reportSummary.securityScore} tone="caution" size={140} suffix="/ 100" />
            <p className="text-center font-mono text-[10.5px] leading-relaxed text-ink-faint dark:text-paper/45">
              Weighted across detection, response, user, network, endpoint, and vulnerability health.
            </p>
          </div>
        </Panel>
      </div>

      {/* top ips + techniques */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel label="Top hostile source IPs">
          {reportSummary.topIps.length === 0 ? (
            <p className="font-mono text-[11px] text-ink-faint dark:text-paper/40">
              No hostile source IPs were identified in this source.
            </p>
          ) : (
            <ul className="space-y-3.5">
              {reportSummary.topIps.map((ip) => (
                <li key={ip.value}>
                  <div className="flex items-center justify-between font-mono text-[11.5px]">
                    <span className="text-ink dark:text-paper/85">{ip.value}</span>
                    <span className="tabular-nums text-ink-faint dark:text-paper/45">{ip.count} events</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full bg-line dark:bg-line-dark">
                    <div className="h-full bg-signal" style={{ width: `${(ip.count / maxIp) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel label="Top MITRE techniques">
          {reportSummary.topTechniques.length === 0 ? (
            <p className="font-mono text-[11px] text-ink-faint dark:text-paper/40">
              No MITRE techniques were mapped in this source.
            </p>
          ) : (
            <ul className="space-y-3.5">
              {reportSummary.topTechniques.map((t) => (
                <li key={t.code}>
                  <div className="flex items-center justify-between font-mono text-[11.5px]">
                    <span className="text-ink dark:text-paper/85">
                      <span className="text-signal">{t.code}</span> · {t.name}
                    </span>
                    <span className="tabular-nums text-ink-faint dark:text-paper/45">{t.count}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full bg-line dark:bg-line-dark">
                    <div className="h-full bg-ink dark:bg-paper/70" style={{ width: `${(t.count / maxTech) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <p className="border-t border-line pt-5 font-mono text-[10px] text-ink-faint dark:border-line-dark dark:text-paper/30">
        {source === "user"
          ? "Auto-generated by AegisSOC · figures computed from your uploaded logs by browser-side heuristics."
          : "Auto-generated by AegisSOC · figures are spec-derived for this concept build."}
      </p>
    </div>
  );
}
