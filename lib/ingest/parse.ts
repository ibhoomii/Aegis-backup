// Log parsing: raw file text → normalized events.
//
// A user's logs could be anything — JSON exports, CSV from a SIEM, or raw
// syslog/auth.log lines. This module sniffs each file's format and extracts a
// common `NormalizedEvent` shape. It is deliberately forgiving: unparseable
// files or lines are skipped, never thrown, so one bad file can't sink an
// upload.

export type NormalizedStatus = "failed" | "success" | "flagged" | "blocked" | "info";

export type NormalizedEvent = {
  ts?: number; // epoch ms, when a full date was parseable
  timeLabel?: string; // "02:11" for display
  hour?: number; // 0-23, for hourly bucketing
  sourceIp?: string;
  destIp?: string;
  user?: string;
  host?: string;
  action: string; // e.g. "failed_login"
  status: NormalizedStatus;
  port?: number;
  raw: string; // original line / stringified record
  file: string; // source filename
};

export type ParseResult = {
  file: string;
  format: "json" | "jsonl" | "csv" | "log";
  events: NormalizedEvent[];
};

// ---- Public API ------------------------------------------------------------

export function parseFiles(files: { name: string; text: string }[]): NormalizedEvent[] {
  return parseFilesDetailed(files).flatMap((r) => r.events);
}

// Same as parseFiles but keeps the per-file format + count, for the /connect
// upload summary.
export function parseFilesDetailed(files: { name: string; text: string }[]): ParseResult[] {
  return files.map((f) => {
    try {
      return parseOne(f.name, f.text);
    } catch {
      return { file: f.name, format: "log", events: [] };
    }
  });
}

// ---- Format sniff ----------------------------------------------------------

function parseOne(name: string, text: string): ParseResult {
  const lower = name.toLowerCase();
  const trimmed = text.trimStart();

  if (lower.endsWith(".json") || trimmed.startsWith("[")) {
    const events = parseJson(text, name);
    if (events) return { file: name, format: "json", events };
  }
  if (lower.endsWith(".jsonl") || trimmed.startsWith("{")) {
    const events = parseJsonl(text, name);
    if (events.length) return { file: name, format: "jsonl", events };
  }
  if (lower.endsWith(".csv") || looksLikeCsv(text)) {
    const events = parseCsv(text, name);
    if (events.length) return { file: name, format: "csv", events };
  }
  return { file: name, format: "log", events: parseLines(text, name) };
}

// ---- JSON / JSONL ----------------------------------------------------------

function parseJson(text: string, file: string): NormalizedEvent[] | null {
  try {
    const data: unknown = JSON.parse(text);
    const records = extractRecords(data);
    return records.map((r) => recordToEvent(r, file));
  } catch {
    return null;
  }
}

// A JSON object might wrap the array under a common key (events, logs, data…).
function extractRecords(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.filter(isRecord);
  if (isRecord(data)) {
    for (const key of ["events", "logs", "records", "data", "results", "hits"]) {
      const v = data[key];
      if (Array.isArray(v)) return v.filter(isRecord);
    }
    return [data];
  }
  return [];
}

function parseJsonl(text: string, file: string): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("//")) continue;
    try {
      const obj: unknown = JSON.parse(t);
      if (isRecord(obj)) events.push(recordToEvent(obj, file));
    } catch {
      // not a JSON line — fall back to text extraction so nothing is lost
      events.push(buildFromText(t, file));
    }
  }
  return events;
}

// ---- CSV -------------------------------------------------------------------

function looksLikeCsv(text: string): boolean {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  if (!first.includes(",")) return false;
  return /(^|,)\s*(source_?ip|src_?ip|ip|user(name)?|host(name)?|asset|event_?type|type|action|status|timestamp|time)\s*(,|$)/i.test(
    first,
  );
}

function parseCsv(text: string, file: string): NormalizedEvent[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const header = splitCsvRow(lines[0]).map((h) => h.trim().toLowerCase());
  const events: NormalizedEvent[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvRow(lines[i]);
    if (cells.length === 1 && cells[0] === "") continue;
    const rec: Record<string, unknown> = {};
    header.forEach((h, idx) => {
      rec[h] = cells[idx];
    });
    events.push(recordToEvent(rec, file, lines[i]));
  }
  return events;
}

// Minimal CSV row splitter with double-quote support (enough for log exports;
// not a full RFC-4180 parser).
function splitCsvRow(row: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

// ---- Line-based (syslog / auth.log / generic) ------------------------------

function parseLines(text: string, file: string): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    events.push(buildFromText(t, file));
  }
  return events;
}

// ---- Record → event (structured sources) -----------------------------------

const FIELD_ALIASES: Record<string, string[]> = {
  sourceIp: ["source_ip", "src_ip", "sourceip", "srcip", "client_ip", "remote_addr", "source", "ip", "src"],
  destIp: ["dest_ip", "dst_ip", "destination_ip", "destip", "dstip", "target_ip", "dest", "dst"],
  user: ["user", "username", "user_name", "account", "principal", "userid", "user_id"],
  host: ["host", "hostname", "asset", "device", "machine", "target", "dest_host", "server", "computer"],
  action: ["action", "event_type", "eventtype", "type", "event", "activity", "category", "operation"],
  status: ["status", "result", "outcome", "disposition", "action_result", "response", "level"],
  port: ["port", "dest_port", "dst_port", "dport", "destination_port", "dstport"],
  timestamp: ["timestamp", "time", "ts", "@timestamp", "date", "datetime", "eventtime", "event_time"],
};

function pick(rec: Record<string, unknown>, aliases: string[]): string | undefined {
  for (const key of aliases) {
    const v = rec[key];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return undefined;
}

function recordToEvent(
  rec: Record<string, unknown>,
  file: string,
  raw?: string,
): NormalizedEvent {
  const rawText = raw ?? JSON.stringify(rec);
  const sourceIp = pick(rec, FIELD_ALIASES.sourceIp) ?? firstIp(rawText);
  const destIp = pick(rec, FIELD_ALIASES.destIp);
  const user = pick(rec, FIELD_ALIASES.user) ?? extractUser(rawText);
  const host = pick(rec, FIELD_ALIASES.host);
  const rawAction = pick(rec, FIELD_ALIASES.action);
  const rawStatus = pick(rec, FIELD_ALIASES.status);
  const portStr = pick(rec, FIELD_ALIASES.port);
  const time = parseTime(pick(rec, FIELD_ALIASES.timestamp) ?? rawText);

  // Prefer explicit action/status fields; otherwise classify from the text.
  const classified = classify(`${rawAction ?? ""} ${rawStatus ?? ""} ${rawText}`);
  const action = rawAction ? normalizeAction(rawAction) : classified.action;
  const status = rawStatus ? normalizeStatus(rawStatus, classified.status) : classified.status;

  return {
    ...time,
    sourceIp,
    destIp,
    user,
    host,
    action,
    status,
    port: portStr ? clampPort(portStr) : extractPort(rawText),
    raw: rawText,
    file,
  };
}

// ---- Text → event (unstructured lines) --------------------------------------

function buildFromText(raw: string, file: string): NormalizedEvent {
  const { action, status } = classify(raw);
  return {
    ...parseTime(raw),
    sourceIp: firstIp(raw),
    destIp: secondIp(raw),
    user: extractUser(raw),
    host: extractHost(raw),
    action,
    status,
    port: extractPort(raw),
    raw,
    file,
  };
}

// ---- Extractors ------------------------------------------------------------

const IPV4 = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;

function allIps(text: string): string[] {
  return text.match(IPV4) ?? [];
}
function firstIp(text: string): string | undefined {
  // Honor labeled source fields first (src=, from …).
  const labeled = /(?:src|source|from|client|remote)[=:\s]+((?:\d{1,3}\.){3}\d{1,3})/i.exec(text);
  return labeled?.[1] ?? allIps(text)[0];
}
function secondIp(text: string): string | undefined {
  const labeled = /(?:dst|dest|destination|to|target)[=:\s]+((?:\d{1,3}\.){3}\d{1,3})/i.exec(text);
  if (labeled) return labeled[1];
  const ips = allIps(text);
  return ips.length > 1 ? ips[1] : undefined;
}

function extractPort(text: string): number | undefined {
  const m =
    /(?:d?port|dpt|dst_?port)[=:\s]+(\d{1,5})/i.exec(text) ??
    /\bport\s+(\d{1,5})\b/i.exec(text);
  return m ? clampPort(m[1]) : undefined;
}
function clampPort(v: string): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n <= 65535 ? n : undefined;
}

function extractUser(text: string): string | undefined {
  const m =
    /for (?:invalid user )?([A-Za-z0-9_.\-\\]+) from/i.exec(text) ??
    /user[=:\s]+"?([A-Za-z0-9_.\-\\]+)"?/i.exec(text) ??
    /\buser\s+([A-Za-z0-9_.\-\\]+)/i.exec(text);
  return m?.[1];
}

// syslog hostname sits right after the timestamp:
// "Aug 26 02:10:15 web-server-01 sshd[123]: ..."
function extractHost(text: string): string | undefined {
  const m =
    /host(?:name)?[=:\s]+([A-Za-z0-9_.\-]+)/i.exec(text) ??
    /^[A-Za-z]{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+([A-Za-z0-9_.\-]+)/.exec(text);
  return m?.[1];
}

function parseTime(text: string): { ts?: number; timeLabel?: string; hour?: number } {
  // ISO 8601
  const iso = /(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(text);
  if (iso) {
    const ts = Date.parse(text.slice(iso.index));
    return {
      ts: Number.isNaN(ts) ? undefined : ts,
      timeLabel: `${iso[2]}:${iso[3]}`,
      hour: Number(iso[2]),
    };
  }
  // syslog "Aug 26 02:10:15"
  const sys = /\b[A-Za-z]{3}\s+\d{1,2}\s+(\d{2}):(\d{2}):(\d{2})\b/.exec(text);
  if (sys) return { timeLabel: `${sys[1]}:${sys[2]}`, hour: Number(sys[1]) };
  // bare HH:MM (not preceded by a dot/digit, so IPs and ports don't match)
  const bare = /(?:^|\s|\[|T)(\d{2}):(\d{2})(?::\d{2})?/.exec(text);
  if (bare) return { timeLabel: `${bare[1]}:${bare[2]}`, hour: Number(bare[1]) };
  return {};
}

// ---- Classification --------------------------------------------------------

// Ordered rules: the first match wins, so more specific patterns come first.
const RULES: { re: RegExp; action: string; status: NormalizedStatus }[] = [
  { re: /fail(ed)?\s+(password|login|auth)|authentication fail|invalid user|login\s*fail|auth.*deny/i, action: "failed_login", status: "failed" },
  { re: /accepted password|session opened|login\s*succe|auth.*success|successful\s*login/i, action: "successful_login", status: "success" },
  { re: /sudo|privilege|priv[-_ ]?esc|escalat|elevat|COMMAND=|root access|runas/i, action: "priv_escalation", status: "flagged" },
  { re: /port\s*scan|nmap|scan detected|masscan|recon/i, action: "port_scan", status: "flagged" },
  { re: /malware|virus|trojan|ransom|malicious|quarantine|threat detected/i, action: "malware_detected", status: "flagged" },
  { re: /dns query|named\[|resolver|\bIN\s+(A|AAAA|TXT|CNAME)\b|dns_query/i, action: "dns_query", status: "flagged" },
  { re: /download|wget|curl\s+http|file[-_ ]?download|\.(exe|zip|bin|sh|ps1|dll)\b/i, action: "file_download", status: "flagged" },
  { re: /outbound|egress|connection to|connect(ed)? to|established.*->/i, action: "outbound_conn", status: "flagged" },
  { re: /exfil|data transfer|large upload|beacon/i, action: "exfiltration", status: "flagged" },
  { re: /oauth|token grant|consent granted|scope granted/i, action: "oauth_grant", status: "success" },
];

function classify(text: string): { action: string; status: NormalizedStatus } {
  for (const rule of RULES) {
    if (rule.re.test(text)) {
      // A blocked/denied verb overrides the rule's default status.
      if (/block(ed)?|denied|drop(ped)?|reject/i.test(text)) {
        return { action: rule.action, status: "blocked" };
      }
      return { action: rule.action, status: rule.status };
    }
  }
  if (/block(ed)?|denied|drop(ped)?|reject/i.test(text)) return { action: "blocked_traffic", status: "blocked" };
  if (/error|critical|alert|warn/i.test(text)) return { action: "system_alert", status: "flagged" };
  return { action: "event", status: "info" };
}

function normalizeAction(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s\-]+/g, "_").replace(/[^a-z0-9_]/g, "");
}

function normalizeStatus(raw: string, fallback: NormalizedStatus): NormalizedStatus {
  const s = raw.toLowerCase();
  if (/success|ok|accept|allow|pass|granted|\b2\d\d\b/.test(s)) return "success";
  if (/fail|invalid|error|denied.*auth|\b40[13]\b/.test(s)) return "failed";
  if (/block|deny|drop|reject/.test(s)) return "blocked";
  if (/flag|alert|suspicious|warn|anomal/.test(s)) return "flagged";
  return fallback;
}

// ---- Guards ----------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
