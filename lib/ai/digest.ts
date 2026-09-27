// Compact, AI-friendly summary of the active Dataset.
//
// Gemini context windows are large but prompts should still be cheap and
// focused, so the digest keeps only what a SOC analyst briefing needs:
// counts, the highest-risk incidents, top hostile sources, and open actions.

import type { Dataset } from "@/lib/dataset";

export function buildDatasetDigest(ds: Dataset): string {
  const lines: string[] = [];
  const m = ds.meta;
  lines.push(
    `Source: ${m.source} (${m.label}); generated ${m.generatedAt}; ${m.eventCount.toLocaleString("en-US")} events.`,
  );

  const inc = ds.incidents;
  const bySev = inc.reduce<Record<string, number>>((acc, i) => {
    acc[i.severity] = (acc[i.severity] ?? 0) + 1;
    return acc;
  }, {});
  lines.push(
    `Incidents: ${inc.length} total (${Object.entries(bySev)
      .map(([k, v]) => `${v} ${k}`)
      .join(", ")}). Open/unresolved: ${inc.filter((i) => i.status !== "Resolved").length}.`,
  );

  const top = [...inc].sort((a, b) => b.risk - a.risk).slice(0, 6);
  for (const i of top) {
    lines.push(
      `  #${i.id} [${i.severity}, risk ${i.risk}, ${i.status}] ${i.title} — asset ${i.asset}; MITRE ${i.mitre.join(", ") || "n/a"}; ${i.summary}`,
    );
  }

  if (ds.topThreats?.length) {
    lines.push(
      `Top threat types: ${ds.topThreats.slice(0, 5).map((t) => `${t.name} (${t.count})`).join(", ")}.`,
    );
  }
  if (ds.reportSummary?.topIps?.length) {
    lines.push(
      `Top source IPs: ${ds.reportSummary.topIps.slice(0, 5).map((t) => `${t.value} (${t.count})`).join(", ")}.`,
    );
  }
  if (ds.assets?.length) {
    const risky = [...ds.assets].sort((a, b) => b.risk - a.risk).slice(0, 4);
    lines.push(
      `Highest-risk assets: ${risky.map((a) => `${a.name} (risk ${a.risk}${a.criticality ? `, ${a.criticality}` : ""})`).join("; ")}.`,
    );
  }
  lines.push(
    `Security health score: ${ds.securityHealth.score}/100. Alerts in window: ${ds.reportSummary?.totalAlerts ?? "n/a"}.`,
  );

  const ml = ds.ml;
  if (ml) {
    lines.push(
      `ML screening of uploaded events: ${ml.flagged}/${ml.scored} flagged anomalous (avg risk ${ml.avgRisk.toFixed(1)}, max ${ml.maxRisk.toFixed(1)}) using ${ml.model}.`,
    );
  }

  return lines.join("\n");
}

// Small fetch wrapper shared by every AI panel.
export async function askAi<T>(task: string, payload: unknown): Promise<T> {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task, payload }),
  });
  const body = (await res.json()) as T & { error?: string };
  if (body.error) throw new Error(body.error);
  return body;
}
