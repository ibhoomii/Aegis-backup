// Log events → ML feature rows.
//
// The trained NSL-KDD anomaly model scores NSL-KDD-style connection records
// (41 fields). User-uploaded logs are far messier, so this module builds the
// closest honest mapping: per-event categorical/flag derivation from the
// normalized event (protocol/service from ports, connection flag from status),
// plus behavioural aggregates computed over each source IP's activity window
// (connection counts, error rates, distinct services/hosts) — mirroring how
// NSL-KDD's time-based traffic features were originally constructed.
//
// Everything here is heuristic *feature construction*; the actual verdict
// (risk score, anomaly flag, reasons) always comes from the trained model.

import type { NormalizedEvent } from "@/lib/ingest/parse";

// NSL-KDD categorical vocabulary (subset that covers real log traffic).
const PORT_SERVICE: Record<number, [string, string]> = {
  20: ["tcp", "ftp_data"], 21: ["tcp", "ftp"], 22: ["tcp", "ssh"], 23: ["tcp", "telnet"],
  25: ["tcp", "smtp"], 37: ["tcp", "time"], 53: ["udp", "domain_u"], 67: ["udp", "bootp_u"],
  69: ["udp", "tftp_u"], 79: ["tcp", "finger"], 80: ["tcp", "http"], 110: ["tcp", "pop_3"],
  113: ["tcp", "auth"], 123: ["udp", "ntp_u"], 143: ["tcp", "imap4"], 161: ["udp", "other"],
  389: ["tcp", "ldap"], 443: ["tcp", "http"], 445: ["tcp", "other"], 465: ["tcp", "smtp"],
  514: ["udp", "syslog"], 587: ["tcp", "smtp"], 636: ["tcp", "ldap"], 993: ["tcp", "pop_3"],
  995: ["tcp", "pop_3"], 1433: ["tcp", "other"], 1812: ["udp", "other"], 3306: ["tcp", "other"],
  3389: ["tcp", "other"], 5432: ["tcp", "other"], 5900: ["tcp", "X11"], 6379: ["tcp", "other"],
  6667: ["tcp", "IRC"], 8080: ["tcp", "http"], 8443: ["tcp", "http"], 9200: ["tcp", "other"],
  11211: ["tcp", "other"], 27017: ["tcp", "other"],
};

export type MlFeatureRow = {
  // NSL-KDD-style model features
  duration: number;
  protocol_type: string;
  service: string;
  flag: string;
  src_bytes: number;
  dst_bytes: number;
  count: number;
  srv_count: number;
  serror_rate: number;
  srv_serror_rate: number;
  rerror_rate: number;
  srv_rerror_rate: number;
  same_srv_rate: number;
  diff_srv_rate: number;
  dst_host_count: number;
  dst_host_srv_count: number;
  dst_host_same_srv_rate: number;
  dst_host_diff_srv_rate: number;
  dst_host_serror_rate: number;
  dst_host_srv_serror_rate: number;
  dst_host_rerror_rate: number;
  dst_host_srv_rerror_rate: number;
  dst_host_same_src_port_rate: number;
  num_failed_logins: number;
  logged_in: number;
  hot: number;
  num_compromised: number;
  num_file_creations: number;
  num_shells: number;
  num_root: number;
  // passthrough context (echoed back with each verdict, not fed to the model)
  _ctx: {
    action: string;
    status: string;
    sourceIp?: string;
    destIp?: string;
    user?: string;
    host?: string;
    port?: number;
    timeLabel?: string;
    file: string;
    raw: string;
  };
};

const FAIL_STATUSES = new Set(["failed", "blocked"]);

function protoService(e: NormalizedEvent): [string, string] {
  const raw = e.raw.toLowerCase();
  if (/\bicmp\b|ping|echo request|echo reply/.test(raw)) return ["icmp", "eco_i"];
  if (/\budp\b/.test(raw) && !PORT_SERVICE[e.port ?? 0]) return ["udp", "other"];
  const hit = e.port ? PORT_SERVICE[e.port] : undefined;
  if (hit) return hit;
  if (/\bssh\b/.test(raw)) return ["tcp", "ssh"];
  if (/http|web|nginx|apache/.test(raw)) return ["tcp", "http"];
  if (/\bdns\b|resolver|named/.test(raw)) return ["udp", "domain_u"];
  if (/\bsmtp\b|mail/.test(raw)) return ["tcp", "smtp"];
  return ["tcp", "private"];
}

function connFlag(e: NormalizedEvent): string {
  if (e.status === "failed") return "REJ";
  if (e.status === "blocked") return "REJ";
  if (e.action === "port_scan" || e.action === "outbound_conn") return "S0";
  if (e.status === "flagged") return "S1";
  return "SF";
}

export type MlScreeningResult = {
  rows: MlFeatureRow[];
  summary: {
    scored: number;
    flagged: number;
    maxRisk: number;
    avgRisk: number;
  };
};

// Aggregates used to build the count/rate features per source IP.
type SourceAgg = { n: number; failed: number; blocked: number; srv: Map<string, number> };
type DestAgg = { n: number; failed: number; blocked: number; srv: Map<string, number>; srcPorts: Map<string, number> };

export function buildFeatureRows(events: NormalizedEvent[], limit = 300): MlFeatureRow[] {
  const scoped = events.slice(0, limit);

  // Per-source and per-destination behaviour windows.
  const bySource = new Map<string, SourceAgg>();
  const byDest = new Map<string, DestAgg>();
  for (const e of scoped) {
    const sKey = e.sourceIp ?? "unknown";
    const dKey = e.destIp ?? e.host ?? "unknown";
    const failed = e.status === "failed" ? 1 : 0;
    const blocked = e.status === "blocked" ? 1 : 0;

    const s = bySource.get(sKey) ?? { n: 0, failed: 0, blocked: 0, srv: new Map() };
    const svc = protoService(e)[1];
    s.n += 1; s.failed += failed; s.blocked += blocked;
    s.srv.set(svc, (s.srv.get(svc) ?? 0) + 1);
    bySource.set(sKey, s);

    const d = byDest.get(dKey) ?? { n: 0, failed: 0, blocked: 0, srv: new Map(), srcPorts: new Map() };
    d.n += 1; d.failed += failed; d.blocked += blocked;
    d.srv.set(svc, (d.srv.get(svc) ?? 0) + 1);
    const spKey = `${sKey}:${e.port ?? 0}`;
    d.srcPorts.set(spKey, (d.srcPorts.get(spKey) ?? 0) + 1);
    byDest.set(dKey, d);
  }

  const rate = (num: number, den: number) => (den > 0 ? Math.min(1, num / den) : 0);

  return scoped.map((e) => {
    const [protocol_type, service] = protoService(e);
    const flag = connFlag(e);
    const sAgg = bySource.get(e.sourceIp ?? "unknown");
    const dAgg = byDest.get(e.destIp ?? e.host ?? "unknown");

    const count = sAgg?.n ?? 1;
    const srvCount = sAgg?.srv.get(service) ?? 1;
    const failedLogins = e.action === "failed_login" ? 1 : 0;

    // Hot/compromised-style indicators derived from the action taxonomy.
    const hot =
      (e.action === "priv_escalation" ? 3 : 0) +
      (e.action === "malware_detected" ? 2 : 0) +
      (e.action === "exfiltration" ? 2 : 0);
    const numCompromised = e.action === "priv_escalation" ? 1 : 0;
    const numFileCreations = e.action === "file_download" ? 1 : 0;

    const dstHostCount = dAgg?.n ?? 1;
    const dstHostSrvCount = dAgg?.srv.get(service) ?? 1;
    const dstSerrRate = rate(dAgg?.failed ?? 0, dstHostCount);
    const dstRerrRate = rate(dAgg?.blocked ?? 0, dstHostCount);
    const samePortHits = dAgg?.srcPorts.get(`${e.sourceIp ?? "unknown"}:${e.port ?? 0}`) ?? 1;

    return {
      duration: 0,
      protocol_type,
      service,
      flag,
      src_bytes: 0,
      dst_bytes: 0,
      count,
      srv_count: srvCount,
      serror_rate: rate(sAgg?.failed ?? 0, count),
      srv_serror_rate: rate(sAgg?.failed ?? 0, count),
      rerror_rate: rate(sAgg?.blocked ?? 0, count),
      srv_rerror_rate: rate(sAgg?.blocked ?? 0, count),
      same_srv_rate: rate(srvCount, count),
      diff_srv_rate: 1 - rate(srvCount, count),
      dst_host_count: dstHostCount,
      dst_host_srv_count: dstHostSrvCount,
      dst_host_same_srv_rate: rate(dstHostSrvCount, dstHostCount),
      dst_host_diff_srv_rate: 1 - rate(dstHostSrvCount, dstHostCount),
      dst_host_serror_rate: dstSerrRate,
      dst_host_srv_serror_rate: dstSerrRate,
      dst_host_rerror_rate: dstRerrRate,
      dst_host_srv_rerror_rate: dstRerrRate,
      dst_host_same_src_port_rate: rate(samePortHits, dstHostCount),
      num_failed_logins: failedLogins,
      logged_in: e.status === "success" ? 1 : 0,
      hot,
      num_compromised: numCompromised,
      num_file_creations: numFileCreations,
      num_shells: 0,
      num_root: numCompromised,
      _ctx: {
        action: e.action,
        status: e.status,
        sourceIp: e.sourceIp,
        destIp: e.destIp,
        user: e.user,
        host: e.host,
        port: e.port,
        timeLabel: e.timeLabel,
        file: e.file,
        raw: e.raw.length > 220 ? `${e.raw.slice(0, 219)}…` : e.raw,
      },
    };
  });
}
