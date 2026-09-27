// Heuristic log analysis: normalized events → a full `Dataset`.
//
// This is the honest, browser-side stand-in for the spec's ML/RAG backend. It
// applies transparent pattern rules (thresholds on failed logins, distinct
// ports, DNS volume, …) to group events into incidents, score them, and
// populate every view the console renders. Nothing here is machine-learned —
// the risk factors are the actual signals that fired, which is what makes the
// scores explainable.

import {
  mitreCatalog,
  type Incident,
  type Severity,
  type IncidentStatus,
  type SecurityEvent,
  type EventStatus,
  type ThreatIndicator,
  type Asset,
  type UserProfile,
  type Notification,
  type EvidenceItem,
  type ResponseAction,
  type AnalystTurn,
  type TimelineStep,
} from "@/lib/soc-data";
import {
  emptyDataset,
  type Dataset,
  type Kpi,
  type MitreStep,
  type RiskFactor,
  type IncidentEntity,
  type SecurityHealth,
  type ReportSummary,
} from "@/lib/dataset";
import type { NormalizedEvent } from "@/lib/ingest/parse";

export type IngestFile = { name: string; hash: string; events: number };

export type AnalyzeOptions = {
  files?: IngestFile[];
  label: string;
  url?: string;
  generatedAt?: string;
};

// ---- small utilities -------------------------------------------------------

const clamp = (lo: number, hi: number, v: number) => Math.max(lo, Math.min(hi, v));

function countBy<T>(items: T[], key: (t: T) => string | undefined): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

function topEntries(m: Map<string, number>, n: number): [string, number][] {
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

function severityFromRisk(r: number): Severity {
  if (r >= 76) return "Critical";
  if (r >= 51) return "High";
  if (r >= 26) return "Medium";
  return "Low";
}

function statusFromSeverity(s: Severity): IncidentStatus {
  if (s === "Critical" || s === "High") return "Investigating";
  if (s === "Medium") return "Open";
  return "Monitoring";
}

const ALERT_STATUSES = new Set(["failed", "flagged", "blocked"]);
const isAlert = (e: NormalizedEvent) => ALERT_STATUSES.has(e.status);

// EventStatus (the feed's type) has no "info"; treat benign info as success.
function toEventStatus(s: NormalizedEvent["status"]): EventStatus {
  return s === "info" ? "success" : s;
}

function nowLabel(generatedAt?: string): string {
  if (generatedAt) return generatedAt;
  try {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(
      d.getUTCHours(),
    )}:${pad(d.getUTCMinutes())} UTC`;
  } catch {
    return "";
  }
}

// ---- internal detection shape ----------------------------------------------

type Detection = {
  kind: "compromise" | "bruteforce" | "portscan" | "dns_exfil" | "outbound" | "malware" | "privesc";
  title: string;
  asset: string;
  sourceIp?: string;
  user?: string;
  ports?: number[];
  mitre: string[];
  signals: RiskFactor[]; // raw weights; normalized later
  events: NormalizedEvent[];
  entities: IncidentEntity[];
  summary: string;
  risk: number;
};

// ---- main entry ------------------------------------------------------------

export function analyze(events: NormalizedEvent[], opts: AnalyzeOptions): Dataset {
  const generatedAt = nowLabel(opts.generatedAt);
  const baseMeta = {
    source: "user" as const,
    label: opts.label,
    generatedAt,
    eventCount: events.length,
    fileCount: opts.files?.length,
    url: opts.url,
  };

  if (events.length === 0) {
    const empty = emptyDataset(baseMeta);
    empty.meta.note = "No events could be parsed from this source.";
    return empty;
  }

  const detections = detect(events);
  detections.sort((a, b) => b.risk - a.risk);
  const capped = detections.slice(0, 12);

  // Assign display IDs (top incident = 2001) and build incidents + maps.
  const incidents: Incident[] = [];
  const timelineByIncident: Record<string, TimelineStep[]> = {};
  const riskFactorsByIncident: Record<string, RiskFactor[]> = {};
  const evidenceByIncident: Record<string, EvidenceItem[]> = {};
  const responseActionsByIncident: Record<string, ResponseAction[]> = {};
  const mitreChainByIncident: Record<string, MitreStep[]> = {};
  const entitiesByIncident: Record<string, IncidentEntity[]> = {};
  const explainByIncident: Record<string, AnalystTurn> = {};

  capped.forEach((d, i) => {
    const id = String(2001 + i);
    const severity = severityFromRisk(d.risk);
    const opened = earliestLabel(d.events) ?? "—";
    const confidence = clamp(52, 95, 58 + Math.round(d.risk / 5));

    incidents.push({
      id,
      title: d.title,
      asset: d.asset,
      risk: d.risk,
      severity,
      status: statusFromSeverity(severity),
      mitre: d.mitre,
      opened,
      confidence,
      assignee: i === 0 ? "A. Suthar" : "Unassigned",
      summary: d.summary,
    });

    timelineByIncident[id] = buildTimeline(d, id, opened);
    riskFactorsByIncident[id] = normalizeFactors(d.signals);
    evidenceByIncident[id] = evidenceFor(d, opts.files, generatedAt);
    responseActionsByIncident[id] = responseFor(d, id);
    mitreChainByIncident[id] = d.mitre.map((code) => ({
      code,
      tactic: mitreCatalog[code]?.tactic ?? "Technique",
      technique: mitreCatalog[code]?.name ?? code,
      observed: true,
    }));
    entitiesByIncident[id] = d.entities;
    explainByIncident[id] = explainTurn(id, d, severity, confidence);
  });

  // ---- aggregates ----------------------------------------------------------

  const activitySeries = buildActivitySeries(events);
  const alerts = events.filter(isAlert).length;
  const criticalCount = incidents.filter((i) => i.severity === "Critical").length;

  const topThreats = buildTopThreats(events);
  const hostileIps = buildHostileIps(events, incidents);
  const threatIntel = buildThreatIntel(hostileIps, generatedAt);
  const assets = buildAssets(events, incidents);
  const userProfiles = buildUserProfiles(events);
  const securityHealth = buildHealth(incidents, userProfiles);
  const mitreProgression = buildProgression(incidents);
  const reportSummary = buildReport(events, incidents, topThreats, hostileIps, opts.label, securityHealth.score);
  const notifications = buildNotifications(incidents, hostileIps);
  const kpis = buildKpis(events, alerts, incidents, activitySeries);
  const analyst = buildAnalyst(incidents, hostileIps, explainByIncident);

  return {
    meta: { ...baseMeta, note: `${incidents.length} incident(s) detected across ${events.length} events` },
    kpis,
    incidents,
    eventPool: buildEventPool(events),
    activitySeries,
    topThreats,
    threatIntel,
    assets,
    userProfiles,
    securityHealth,
    mitreProgression,
    notifications,
    reportSummary,
    analyst,
    timelineByIncident,
    riskFactorsByIncident,
    evidenceByIncident,
    responseActionsByIncident,
    mitreChainByIncident,
    entitiesByIncident,
    explainByIncident,
  };
}

// ---- detection -------------------------------------------------------------

function detect(events: NormalizedEvent[]): Detection[] {
  const detections: Detection[] = [];
  const byIp = groupBy(events, (e) => e.sourceIp);

  for (const [ip, evs] of byIp) {
    const failed = evs.filter((e) => e.action === "failed_login" || (e.status === "failed" && /login|auth/.test(e.action)));
    const success = evs.filter((e) => e.action === "successful_login");
    const priv = evs.filter((e) => e.action === "priv_escalation");
    const ports = distinct(evs.map((e) => e.port).filter((p): p is number => typeof p === "number"));
    const dns = evs.filter((e) => e.action === "dns_query");
    const outbound = evs.filter((e) => e.action === "outbound_conn" || e.action === "exfiltration");
    const host = topLabel(evs, (e) => e.host) ?? topLabel(evs, (e) => e.destIp);
    const targetUser = topLabel(failed.length ? failed : evs, (e) => e.user);

    // Credential attack → possible compromise chain.
    if (failed.length >= 5) {
      const signals: RiskFactor[] = [
        { factor: `${failed.length} failed logins from ${ip}`, weight: 0.28 },
        { factor: "Repeated attempts in a short window", weight: 0.12 },
      ];
      const mitre = ["T1110"];
      let risk = clamp(45, 72, 40 + failed.length * 1.5);
      let title = "Brute-Force Attack";
      let kind: Detection["kind"] = "bruteforce";

      if (success.length) {
        mitre.push("T1078");
        signals.push({ factor: "Successful login after failed attempts", weight: 0.24 });
        risk = clamp(70, 92, risk + 22);
        title = "Possible Account Compromise";
        kind = "compromise";
      }
      if (priv.length) {
        mitre.push("T1068");
        signals.push({ factor: "Privileged command shortly after login", weight: 0.2 });
        risk = clamp(78, 97, risk + 14);
        title = "Possible Server Compromise";
        kind = "compromise";
      }
      if (host) signals.push({ factor: `Target is a monitored asset — ${host}`, weight: 0.1 });

      detections.push({
        kind,
        title,
        asset: host ?? targetUser ?? ip ?? "Unknown asset",
        sourceIp: ip,
        user: targetUser,
        mitre,
        signals,
        events: [...failed, ...success, ...priv].slice(0, 8),
        entities: entitiesFor(ip, host, targetUser, ports),
        summary:
          kind === "compromise"
            ? `Brute-force attempts from ${ip} were followed by a successful login${host ? ` on ${host}` : ""}${priv.length ? ", then privileged activity" : ""}.`
            : `${failed.length} failed login attempts from ${ip} targeting ${host ?? targetUser ?? "multiple accounts"}.`,
        risk: Math.round(risk),
      });
    } else if (priv.length && !success.length) {
      // Standalone privilege escalation (no brute-force baseline).
      detections.push({
        kind: "privesc",
        title: "Unusual Privilege Escalation",
        asset: host ?? ip ?? "Unknown asset",
        sourceIp: ip,
        user: targetUser,
        mitre: ["T1548"],
        signals: [
          { factor: `Privilege escalation from ${ip}`, weight: 0.4 },
          { factor: "No prior authentication baseline", weight: 0.2 },
        ],
        events: priv.slice(0, 8),
        entities: entitiesFor(ip, host, targetUser, ports),
        summary: `Privilege escalation observed from ${ip}${host ? ` on ${host}` : ""} without a matching login baseline.`,
        risk: clamp(30, 58, 30 + priv.length * 6),
      });
    }

    // Port scan / recon.
    if (ports.length >= 15) {
      detections.push({
        kind: "portscan",
        title: "Port Scan / Recon",
        asset: host ?? topLabel(evs, (e) => e.destIp) ?? "DMZ range",
        sourceIp: ip,
        ports,
        mitre: ["T1046"],
        signals: [
          { factor: `${ports.length} distinct ports probed`, weight: 0.32 },
          { factor: "Single source touching many services", weight: 0.16 },
        ],
        events: evs.slice(0, 8),
        entities: entitiesFor(ip, host, undefined, ports),
        summary: `${ports.length} distinct ports probed from ${ip} — reconnaissance against ${host ?? "the environment"}.`,
        risk: clamp(45, 90, 42 + ports.length),
      });
    }

    // DNS exfiltration.
    if (dns.length >= 8) {
      detections.push({
        kind: "dns_exfil",
        title: "Possible DNS Exfiltration",
        asset: host ?? ip ?? "Unknown host",
        sourceIp: ip,
        mitre: ["T1048", "T1071"],
        signals: [
          { factor: `${dns.length} DNS queries in the window`, weight: 0.3 },
          { factor: "Consistent with covert-channel exfiltration", weight: 0.2 },
        ],
        events: dns.slice(0, 8),
        entities: entitiesFor(ip, host, undefined, undefined),
        summary: `Unusually high DNS query volume from ${host ?? ip} — consistent with covert-channel exfiltration.`,
        risk: clamp(55, 88, 50 + dns.length),
      });
    }

    // Suspicious outbound / exfil.
    if (outbound.length >= 5) {
      detections.push({
        kind: "outbound",
        title: "Suspicious Outbound Activity",
        asset: host ?? ip ?? "Unknown host",
        sourceIp: ip,
        mitre: ["T1048"],
        signals: [
          { factor: `${outbound.length} outbound connections from ${ip}`, weight: 0.3 },
          { factor: "Destinations outside the known baseline", weight: 0.16 },
        ],
        events: outbound.slice(0, 8),
        entities: entitiesFor(ip, host, undefined, undefined),
        summary: `Repeated outbound connections from ${host ?? ip} to external hosts.`,
        risk: clamp(45, 78, 40 + outbound.length * 2),
      });
    }
  }

  // Malware / malicious file activity, grouped by host.
  const malwareEvents = events.filter((e) => e.action === "malware_detected" || e.action === "file_download");
  const byHost = groupBy(malwareEvents, (e) => e.host ?? e.sourceIp);
  for (const [host, evs] of byHost) {
    const confirmed = evs.filter((e) => e.action === "malware_detected");
    if (!confirmed.length && evs.length < 3) continue;
    detections.push({
      kind: "malware",
      title: confirmed.length ? "Malware Detected" : "Suspicious File Download",
      asset: host ?? "Unknown host",
      sourceIp: topLabel(evs, (e) => e.sourceIp),
      mitre: ["T1204"],
      signals: [
        { factor: confirmed.length ? `${confirmed.length} malware signature match(es)` : `${evs.length} suspicious downloads`, weight: 0.3 },
        { factor: `Activity on endpoint ${host}`, weight: 0.14 },
      ],
      events: evs.slice(0, 8),
      entities: entitiesFor(topLabel(evs, (e) => e.sourceIp), host, undefined, undefined),
      summary: confirmed.length
        ? `Malicious file activity detected on ${host}.`
        : `Repeated suspicious file downloads on ${host}.`,
      risk: confirmed.length ? clamp(45, 75, 44 + confirmed.length * 6) : clamp(30, 55, 30 + evs.length * 3),
    });
  }

  return detections;
}

// ---- per-incident builders -------------------------------------------------

function entitiesFor(
  ip?: string,
  host?: string,
  user?: string,
  ports?: number[],
): IncidentEntity[] {
  const out: IncidentEntity[] = [];
  if (ip) out.push({ kind: "Source IP", label: ip, detail: "Origin of the activity", tone: "signal" });
  if (host) out.push({ kind: "Target asset", label: host, detail: "Affected host", tone: "caution" });
  if (user) out.push({ kind: "Account", label: user, detail: "Targeted / used account", tone: "ink" });
  if (ports && ports.length) {
    const shown = ports.slice(0, 6).join(", ");
    out.push({
      kind: "Ports",
      label: ports.length > 6 ? `${shown} +${ports.length - 6}` : shown,
      detail: `${ports.length} distinct port(s)`,
      tone: "ink",
    });
  }
  return out;
}

function normalizeFactors(signals: RiskFactor[]): RiskFactor[] {
  const total = signals.reduce((s, f) => s + f.weight, 0);
  if (total <= 0) return signals;
  return signals
    .map((f) => ({ factor: f.factor, weight: Math.round((f.weight / total) * 100) / 100 }))
    .sort((a, b) => b.weight - a.weight);
}

function buildTimeline(d: Detection, id: string, opened: string): TimelineStep[] {
  const sorted = [...d.events].sort((a, b) => (a.hour ?? 99) - (b.hour ?? 99));
  const steps: TimelineStep[] = sorted.slice(0, 5).map((e) => ({
    time: e.timeLabel ?? opened,
    title: humanizeAction(e.action),
    detail: truncate(e.raw, 96),
    tag: tagFor(e),
  }));
  steps.push({
    time: opened,
    title: `Incident #${id} opened`,
    detail: `${d.title} — risk ${d.risk}/100.`,
    tag: "INCIDENT",
  });
  return steps;
}

function tagFor(e: NormalizedEvent): string {
  if (e.action === "malware_detected") return "INTEL";
  if (e.action === "priv_escalation") return "RULE";
  if (e.status === "failed" || e.status === "flagged") return "RULE";
  return "DETECT";
}

function evidenceFor(d: Detection, files: IngestFile[] | undefined, generatedAt: string): EvidenceItem[] {
  if (!files || !files.length) return [];
  // Attach the uploaded files that contributed events to this incident.
  const contributing = distinct(d.events.map((e) => e.file));
  const matched = files.filter((f) => contributing.includes(f.name));
  const chosen = matched.length ? matched : files.slice(0, 1);
  const captured = generatedAt.split(" ")[1] ?? generatedAt;
  return chosen.map((f) => ({
    name: f.name,
    kind: "Uploaded log",
    hash: f.hash,
    captured,
    verified: true,
  }));
}

function responseFor(d: Detection, id: string): ResponseAction[] {
  const actions: ResponseAction[] = [];
  const ip = d.sourceIp;
  switch (d.kind) {
    case "compromise":
    case "bruteforce":
      if (ip) actions.push({ action: `Block source IP ${ip} at the edge`, impact: "High", requiresApproval: true });
      if (d.user) actions.push({ action: `Disable / lock affected account '${d.user}'`, impact: "High", requiresApproval: true });
      actions.push({ action: "Force password reset for affected users", impact: "Medium", requiresApproval: true });
      if (d.kind === "compromise") actions.push({ action: `Isolate ${d.asset} from the production network`, impact: "Critical", requiresApproval: true });
      break;
    case "portscan":
      if (ip) actions.push({ action: `Block scanning IP ${ip} at the firewall`, impact: "High", requiresApproval: true });
      actions.push({ action: `Review exposed services on ${d.asset}`, impact: "Medium", requiresApproval: true });
      actions.push({ action: "Enable rate limiting on the perimeter", impact: "Low", requiresApproval: true });
      break;
    case "dns_exfil":
    case "outbound":
      if (ip) actions.push({ action: `Block egress from ${ip}`, impact: "High", requiresApproval: true });
      actions.push({ action: `Isolate ${d.asset} pending review`, impact: "Critical", requiresApproval: true });
      actions.push({ action: "Capture full packet trace of the channel", impact: "Low", requiresApproval: true });
      break;
    case "malware":
      actions.push({ action: `Quarantine ${d.asset}`, impact: "Critical", requiresApproval: true });
      actions.push({ action: "Run a full endpoint scan", impact: "Medium", requiresApproval: true });
      if (ip) actions.push({ action: `Block download source ${ip}`, impact: "Medium", requiresApproval: true });
      break;
    case "privesc":
      actions.push({ action: `Review privileged activity on ${d.asset}`, impact: "Medium", requiresApproval: true });
      if (d.user) actions.push({ action: `Audit permissions for '${d.user}'`, impact: "Medium", requiresApproval: true });
      break;
  }
  actions.push({ action: `Create incident ticket #${id}`, impact: "Low", requiresApproval: false });
  return actions;
}

function explainTurn(id: string, d: Detection, severity: Severity, confidence: number): AnalystTurn {
  return {
    q: `Why is incident #${id} ${severity.toLowerCase()}?`,
    a: `Incident #${id} (${d.title}${d.asset ? ` on ${d.asset}` : ""}) scores ${d.risk}/100 because multiple signals reinforce each other.`,
    bullets: normalizeFactors(d.signals).map((f) => `${f.factor} (${Math.round(f.weight * 100)}%)`),
    confidence,
    sources: [`Incident #${id} timeline`, ...(d.sourceIp ? [`Source ${d.sourceIp}`] : []), `MITRE ${d.mitre.join(" / ")}`],
    incidentRef: id,
  };
}

// ---- aggregate builders ----------------------------------------------------

function buildActivitySeries(events: NormalizedEvent[]): { hour: string; events: number; alerts: number }[] {
  const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: String(h).padStart(2, "0"), events: 0, alerts: 0 }));
  events.forEach((e, i) => {
    const h = typeof e.hour === "number" && e.hour >= 0 && e.hour < 24 ? e.hour : i % 24;
    buckets[h].events += 1;
    if (isAlert(e)) buckets[h].alerts += 1;
  });
  return buckets;
}

function buildTopThreats(events: NormalizedEvent[]): { name: string; count: number }[] {
  const label: Record<string, string> = {
    failed_login: "Brute Force",
    successful_login: "Credential Attack",
    priv_escalation: "Privilege Escalation",
    port_scan: "Port Scanning",
    malware_detected: "Malware Delivery",
    file_download: "Malware Delivery",
    dns_query: "Data Exfiltration",
    exfiltration: "Data Exfiltration",
    outbound_conn: "Suspicious Outbound",
    oauth_grant: "Suspicious OAuth",
  };
  const counts = countBy(events, (e) => label[e.action]);
  return topEntries(counts, 5).map(([name, count]) => ({ name, count }));
}

function buildHostileIps(events: NormalizedEvent[], incidents: Incident[]): { ip: string; count: number; alerts: number }[] {
  const totals = countBy(events, (e) => e.sourceIp);
  const alertCounts = countBy(events.filter(isAlert), (e) => e.sourceIp);
  return topEntries(alertCounts, 6)
    .map(([ip]) => ({ ip, count: totals.get(ip) ?? 0, alerts: alertCounts.get(ip) ?? 0 }))
    .filter((x) => x.alerts > 0);
}

function buildThreatIntel(
  hostile: { ip: string; count: number; alerts: number }[],
  generatedAt: string,
): ThreatIndicator[] {
  const day = generatedAt.split(" ")[0] || "—";
  return hostile.slice(0, 4).map((h) => {
    const confidence = clamp(60, 96, 55 + h.alerts * 2);
    return {
      value: h.ip,
      kind: "IP",
      reputation: h.alerts >= 10 ? "Malicious" : "Suspicious",
      confidence,
      related: h.count,
      firstSeen: day,
      lastSeen: day,
    };
  });
}

function buildAssets(events: NormalizedEvent[], incidents: Incident[]): Asset[] {
  const hosts = new Set<string>();
  events.forEach((e) => {
    if (e.host) hosts.add(e.host);
  });
  incidents.forEach((i) => hosts.add(i.asset));
  const list: Asset[] = [];
  for (const name of hosts) {
    if (!name || name === "—") continue;
    const onHost = incidents.filter((i) => i.asset === name);
    const evs = events.filter((e) => e.host === name);
    const risk = onHost.length
      ? Math.max(...onHost.map((i) => i.risk))
      : clamp(8, 60, 15 + evs.filter(isAlert).length * 4);
    list.push({
      name,
      type: inferAssetType(name),
      criticality: severityFromRisk(risk),
      risk,
      owner: "—",
      openIncidents: onHost.filter((i) => i.status !== "Resolved").length,
    });
  }
  return list.sort((a, b) => b.risk - a.risk).slice(0, 8);
}

function inferAssetType(name: string): string {
  const n = name.toLowerCase();
  if (/db|database|sql/.test(n)) return "Database";
  if (/web|www|http|api/.test(n)) return "Web / API";
  if (/auth|idp|sso|gw|gateway/.test(n)) return "Auth / Identity";
  if (/fw|firewall|edge/.test(n)) return "Firewall";
  if (/pc|laptop|emp|desktop|endpoint/.test(n)) return "Endpoint";
  if (/srv|server|app|host/.test(n)) return "Server";
  return "Host";
}

function buildUserProfiles(events: NormalizedEvent[]): UserProfile[] {
  const users = new Set<string>();
  events.forEach((e) => e.user && users.add(e.user));
  const list: UserProfile[] = [];
  for (const user of users) {
    const evs = events.filter((e) => e.user === user);
    const failed = evs.filter((e) => e.status === "failed").length;
    const success = evs.filter((e) => e.action === "successful_login").length;
    const priv = evs.filter((e) => e.action === "priv_escalation").length;
    const risk = clamp(8, 96, failed * 5 + priv * 16 + (success && failed >= 5 ? 22 : 0));
    const flags: string[] = [];
    if (failed >= 5) flags.push("Repeated login failures");
    if (priv) flags.push("Privilege use");
    if (success && failed >= 5) flags.push("Login after brute force");
    list.push({
      user,
      role: "—",
      risk,
      baseline: "Derived from normal activity in the uploaded window",
      current: `${evs.length} events · ${failed} failed · ${priv} privileged`,
      flags,
    });
  }
  return list.sort((a, b) => b.risk - a.risk).slice(0, 4);
}

function buildHealth(incidents: Incident[], users: UserProfile[]): SecurityHealth {
  const crit = incidents.filter((i) => i.severity === "Critical").length;
  const high = incidents.filter((i) => i.severity === "High").length;
  const open = incidents.filter((i) => i.status !== "Resolved").length;
  const riskyUsers = users.filter((u) => u.risk >= 60).length;
  const dimensions = [
    { name: "Threat Detection", value: clamp(55, 95, 92 - crit * 3) },
    { name: "Incident Response", value: clamp(45, 95, 90 - open * 3) },
    { name: "User Risk", value: clamp(40, 95, 92 - riskyUsers * 10) },
    { name: "Network Security", value: clamp(45, 95, 88 - high * 4) },
    { name: "Endpoint Security", value: clamp(45, 95, 88 - incidents.filter((i) => i.mitre.includes("T1204")).length * 6) },
    { name: "Vulnerabilities", value: clamp(50, 92, 85 - crit * 4) },
  ];
  const score = Math.round(dimensions.reduce((s, d) => s + d.value, 0) / dimensions.length);
  return { score, dimensions };
}

function buildProgression(incidents: Incident[]): MitreStep[] {
  const codes = distinct(incidents.flatMap((i) => i.mitre));
  const order = ["T1190", "T1110", "T1078", "T1046", "T1059", "T1548", "T1068", "T1204", "T1071", "T1048", "T1098", "T1550"];
  const observed = codes
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .map((code) => ({
      code,
      tactic: mitreCatalog[code]?.tactic ?? "Technique",
      technique: mitreCatalog[code]?.name ?? code,
      observed: true,
    }));
  // Show a couple of likely next steps as not-yet-observed, mirroring the demo.
  const next = ["T1098", "T1048"].filter((c) => !codes.includes(c)).slice(0, 2);
  const notObserved = next.map((code) => ({
    code,
    tactic: mitreCatalog[code]?.tactic ?? "Technique",
    technique: mitreCatalog[code]?.name ?? code,
    observed: false,
  }));
  return [...observed, ...notObserved];
}

function buildReport(
  events: NormalizedEvent[],
  incidents: Incident[],
  topThreats: { name: string; count: number }[],
  hostile: { ip: string; count: number; alerts: number }[],
  label: string,
  score: number,
): ReportSummary {
  const alerts = events.filter(isAlert).length;
  const flaggedOnly = events.filter((e) => e.status === "flagged").length;
  const threatTotal = topThreats.reduce((s, t) => s + t.count, 0) || 1;
  const techCounts = countBy(
    incidents.flatMap((i) => i.mitre),
    (c) => c,
  );
  return {
    window: label || "Uploaded logs",
    totalEvents: events.length,
    totalAlerts: alerts,
    criticalIncidents: incidents.filter((i) => i.severity === "Critical").length,
    // Heuristic: share of alerts that are merely "flagged" (not hard fail/block)
    // is a rough proxy for likely false positives.
    falsePositiveRate: clamp(0, 30, Math.round(alerts ? (flaggedOnly / alerts) * 22 : 0)),
    // Heuristic placeholder — no real response telemetry in uploaded logs.
    avgResponseMins: clamp(4, 30, 6 + incidents.filter((i) => i.severity === "Critical").length * 2),
    securityScore: score,
    topAttackTypes: topThreats.map((t) => ({ name: t.name, value: Math.round((t.count / threatTotal) * 100) })),
    topIps: hostile.slice(0, 3).map((h) => ({ value: h.ip, count: h.count })),
    topTechniques: topEntries(techCounts, 3).map(([code, count]) => ({
      code,
      name: mitreCatalog[code]?.name ?? code,
      count,
    })),
  };
}

function buildNotifications(
  incidents: Incident[],
  hostile: { ip: string; count: number; alerts: number }[],
): Notification[] {
  const notes: Notification[] = incidents
    .filter((i) => i.severity === "Critical" || i.severity === "High")
    .slice(0, 3)
    .map((i) => ({
      title: `${i.severity} incident #${i.id}`,
      detail: `${i.title} · ${i.asset} · Risk ${i.risk}`,
      severity: i.severity,
      time: i.opened,
    }));
  if (hostile[0]) {
    notes.push({
      title: "Threat-intel match",
      detail: `${hostile[0].ip} flagged across ${hostile[0].alerts} alerts`,
      severity: "High",
      time: incidents[0]?.opened ?? "—",
    });
  }
  return notes.slice(0, 4);
}

function buildKpis(
  events: NormalizedEvent[],
  alerts: number,
  incidents: Incident[],
  activitySeries: { hour: string; events: number; alerts: number }[],
): Kpi[] {
  const crit = incidents.filter((i) => i.severity === "Critical").length;
  const ramp = (to: number) => {
    if (to <= 0) return [0, 0, 0, 0, 0];
    return Array.from({ length: 6 }, (_, i) => Math.round((to * (i + 1)) / 6));
  };
  return [
    { label: "Events parsed", value: events.length, spark: activitySeries.map((d) => d.events), tone: "ink" },
    { label: "Alerts", value: alerts, spark: activitySeries.map((d) => d.alerts), tone: "caution" },
    { label: "Incidents", value: incidents.length, spark: ramp(incidents.length), tone: "signal" },
    { label: "Critical", value: crit, spark: ramp(crit), tone: "signal" },
  ];
}

function buildEventPool(events: NormalizedEvent[]): SecurityEvent[] {
  // Prefer the most interesting events (alerts first), keep it feed-sized.
  const ordered = [...events].sort((a, b) => Number(isAlert(b)) - Number(isAlert(a)));
  return ordered.slice(0, 16).map((e) => ({
    sourceIp: e.sourceIp ?? "—",
    asset: e.host ?? e.destIp ?? "—",
    type: e.action,
    status: toEventStatus(e.status),
  }));
}

function buildAnalyst(
  incidents: Incident[],
  hostile: { ip: string; count: number; alerts: number }[],
  explainByIncident: Record<string, AnalystTurn>,
): Dataset["analyst"] {
  const top = incidents[0];
  const topIp = hostile[0]?.ip;
  const suggestions: string[] = [];
  if (top) suggestions.push(`Why is incident #${top.id} ${top.severity.toLowerCase()}?`);
  suggestions.push("What should I investigate first?");
  if (topIp) suggestions.push(`Show all activity from ${topIp}`);
  const topTech = incidents.flatMap((i) => i.mitre)[0];
  if (topTech) suggestions.push(`Show all attacks related to ${topTech}`);

  const script: AnalystTurn[] = [];
  if (top && explainByIncident[top.id]) script.push(explainByIncident[top.id]);

  if (incidents.length) {
    script.push({
      q: "What should I investigate first?",
      a: `Prioritise by risk. ${incidents.length} incident(s) were detected in this data; start with the highest-risk items.`,
      bullets: incidents.slice(0, 3).map((i) => `#${i.id} · ${i.asset} · Risk ${i.risk} — ${i.title}`),
      confidence: 82,
      sources: ["Incident queue", "Risk ranking"],
      incidentRef: top?.id,
    });
  }
  if (topTech) {
    const withTech = incidents.filter((i) => i.mitre.includes(topTech));
    script.push({
      q: `Show all attacks related to ${topTech}`,
      a: `${topTech} (${mitreCatalog[topTech]?.name ?? topTech}) appears in ${withTech.length} incident(s) in this dataset.`,
      bullets: withTech.slice(0, 4).map((i) => `#${i.id} · ${i.asset} — ${i.title}`),
      confidence: 85,
      sources: ["MITRE mapping"],
    });
  }
  if (topIp) {
    const h = hostile[0];
    script.push({
      q: `Show all activity from ${topIp}`,
      a: `${topIp} is the most active hostile source in this data, tied to ${h.alerts} alert(s) across ${h.count} event(s).`,
      bullets: [
        `${h.count} total events, ${h.alerts} flagged or failed`,
        ...incidents.filter((i) => i.summary.includes(topIp)).slice(0, 2).map((i) => `Linked to incident #${i.id} — ${i.title}`),
      ],
      confidence: 88,
      sources: [`Events from ${topIp}`],
    });
  }

  const fallback: AnalystTurn = {
    a: incidents.length
      ? `I can explain any of the ${incidents.length} detected incident(s), rank them by risk, or trace a MITRE technique through this dataset. Try a suggested question, or ask about a specific incident, IP, or asset.`
      : "No incidents were detected in this data. I can still summarise the events — ask about a specific IP, user, or asset.",
    confidence: undefined,
  };

  return { suggestions, script, fallback };
}

// ---- generic helpers -------------------------------------------------------

function groupBy<T>(items: T[], key: (t: T) => string | undefined): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    if (!k) continue;
    const arr = m.get(k);
    if (arr) arr.push(it);
    else m.set(k, [it]);
  }
  return m;
}

function distinct<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function topLabel<T>(items: T[], key: (t: T) => string | undefined): string | undefined {
  const counts = countBy(items, key);
  return topEntries(counts, 1)[0]?.[0];
}

function earliestLabel(events: NormalizedEvent[]): string | undefined {
  const withTime = events.filter((e) => e.timeLabel);
  if (!withTime.length) return undefined;
  return withTime.sort((a, b) => (a.hour ?? 99) - (b.hour ?? 99))[0].timeLabel;
}

function humanizeAction(action: string): string {
  return action
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
