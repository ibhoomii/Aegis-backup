// Expanded SOC data for the AegisSOC console pages.
// Sourced from the AegisSOC project spec (§29 dashboard, §33 WEB-SERVER-01
// scenario, §11 threat intel, §17-24 incident workflow, §22 health score).
// Frontend-only: static, spec-derived data — no live connections.

export type Severity = "Critical" | "High" | "Medium" | "Low";
export type IncidentStatus =
  | "Investigating"
  | "Open"
  | "Contained"
  | "Monitoring"
  | "Resolved";

export type Incident = {
  id: string;
  title: string;
  asset: string;
  risk: number;
  severity: Severity;
  status: IncidentStatus;
  mitre: string[];
  opened: string;
  confidence: number;
  assignee: string;
  summary: string;
};

// #1042 is the hero incident from the spec's end-to-end scenario (§33).
export const incidents: Incident[] = [
  {
    id: "1042",
    title: "Possible Server Compromise",
    asset: "WEB-SERVER-01",
    risk: 97,
    severity: "Critical",
    status: "Investigating",
    mitre: ["T1110", "T1059", "T1068"],
    opened: "02:13",
    confidence: 89,
    assignee: "A. Suthar",
    summary:
      "Credential-based attack: brute force, then a successful login from an unusual source, followed by privileged activity on a production web server.",
  },
  {
    id: "1041",
    title: "Data Exfiltration over DNS",
    asset: "DATABASE-01",
    risk: 88,
    severity: "Critical",
    status: "Investigating",
    mitre: ["T1048", "T1071"],
    opened: "01:52",
    confidence: 81,
    assignee: "Unassigned",
    summary:
      "Sustained high-entropy DNS queries from the primary database host to an unlisted resolver — consistent with covert-channel exfiltration.",
  },
  {
    id: "1040",
    title: "Credential Stuffing Wave",
    asset: "AUTH-GW-01",
    risk: 71,
    severity: "High",
    status: "Contained",
    mitre: ["T1110"],
    opened: "00:41",
    confidence: 76,
    assignee: "R. Mehta",
    summary:
      "Distributed login attempts against the auth gateway using leaked credential pairs. Rate-limiting engaged; a handful of accounts flagged for reset.",
  },
  {
    id: "1039",
    title: "Suspicious OAuth Grant",
    asset: "IDP-CLOUD",
    risk: 63,
    severity: "High",
    status: "Open",
    mitre: ["T1550"],
    opened: "23:18",
    confidence: 68,
    assignee: "Unassigned",
    summary:
      "A new third-party application was granted broad mailbox scopes minutes after an unusual admin sign-in.",
  },
  {
    id: "1038",
    title: "Port Scan Sweep",
    asset: "EDGE-FW-02",
    risk: 58,
    severity: "High",
    status: "Monitoring",
    mitre: ["T1046"],
    opened: "22:05",
    confidence: 72,
    assignee: "R. Mehta",
    summary:
      "A single external IP touched 1,400+ ports across the DMZ range in under two minutes — reconnaissance ahead of a targeted attempt.",
  },
  {
    id: "1037",
    title: "Impossible-Travel Sign-in",
    asset: "user_102",
    risk: 52,
    severity: "Medium",
    status: "Resolved",
    mitre: ["T1078"],
    opened: "20:47",
    confidence: 64,
    assignee: "A. Suthar",
    summary:
      "Two successful logins 40 minutes apart from geographies 7,000km apart. Resolved as VPN egress change after user confirmation.",
  },
  {
    id: "1036",
    title: "Malware Hash Match",
    asset: "EMP-PC-114",
    risk: 44,
    severity: "Medium",
    status: "Monitoring",
    mitre: ["T1204"],
    opened: "19:12",
    confidence: 59,
    assignee: "Unassigned",
    summary:
      "A downloaded binary matched a known-malicious SHA-256 in threat intel. Host quarantined pending analyst review.",
  },
  {
    id: "1035",
    title: "Unusual Sudo Activity",
    asset: "APP-SRV-05",
    risk: 34,
    severity: "Low",
    status: "Resolved",
    mitre: ["T1548"],
    opened: "17:39",
    confidence: 55,
    assignee: "R. Mehta",
    summary:
      "Off-hours privilege escalation traced to a scheduled maintenance job. Marked benign; baseline updated.",
  },
];

export function incidentById(id: string) {
  return incidents.find((i) => i.id === id);
}

// Live event feed pool (§1 — normalized security events). The dashboard
// samples from these to simulate a stream.
export type EventStatus = "failed" | "success" | "flagged" | "blocked";
export type SecurityEvent = {
  sourceIp: string;
  asset: string;
  type: string;
  status: EventStatus;
};

export const eventPool: SecurityEvent[] = [
  { sourceIp: "185.203.116.42", asset: "WEB-SERVER-01", type: "failed_login", status: "failed" },
  { sourceIp: "10.0.0.25", asset: "AUTH-GW-01", type: "failed_login", status: "failed" },
  { sourceIp: "192.168.4.11", asset: "APP-SRV-05", type: "process_exec", status: "success" },
  { sourceIp: "185.203.116.42", asset: "WEB-SERVER-01", type: "priv_escalation", status: "flagged" },
  { sourceIp: "203.0.113.9", asset: "EDGE-FW-02", type: "port_scan", status: "flagged" },
  { sourceIp: "10.0.0.25", asset: "DATABASE-01", type: "dns_query", status: "flagged" },
  { sourceIp: "198.51.100.7", asset: "IDP-CLOUD", type: "oauth_grant", status: "success" },
  { sourceIp: "172.16.0.5", asset: "EMP-PC-114", type: "file_download", status: "blocked" },
  { sourceIp: "185.203.116.42", asset: "WEB-SERVER-01", type: "successful_login", status: "success" },
  { sourceIp: "45.83.220.14", asset: "AUTH-GW-01", type: "failed_login", status: "failed" },
  { sourceIp: "10.0.0.31", asset: "DATABASE-01", type: "file_modify", status: "flagged" },
  { sourceIp: "203.0.113.9", asset: "EDGE-FW-02", type: "syn_flood", status: "blocked" },
  { sourceIp: "192.168.4.22", asset: "APP-SRV-05", type: "api_request", status: "success" },
  { sourceIp: "91.240.118.3", asset: "WEB-SERVER-01", type: "outbound_conn", status: "flagged" },
];

// Attack-activity timeline (§29) — 24 hourly buckets of event volume with an
// alert overlay. Values are illustrative but shaped like a real day.
export const activitySeries: { hour: string; events: number; alerts: number }[] = [
  { hour: "00", events: 4200, alerts: 6 },
  { hour: "01", events: 3800, alerts: 5 },
  { hour: "02", events: 5100, alerts: 22 },
  { hour: "03", events: 6400, alerts: 31 },
  { hour: "04", events: 3600, alerts: 9 },
  { hour: "05", events: 3100, alerts: 4 },
  { hour: "06", events: 3900, alerts: 7 },
  { hour: "07", events: 5200, alerts: 11 },
  { hour: "08", events: 7300, alerts: 14 },
  { hour: "09", events: 8600, alerts: 18 },
  { hour: "10", events: 9100, alerts: 21 },
  { hour: "11", events: 8800, alerts: 17 },
  { hour: "12", events: 7900, alerts: 12 },
  { hour: "13", events: 8100, alerts: 15 },
  { hour: "14", events: 8700, alerts: 19 },
  { hour: "15", events: 9000, alerts: 16 },
  { hour: "16", events: 8300, alerts: 13 },
  { hour: "17", events: 7100, alerts: 10 },
  { hour: "18", events: 6200, alerts: 9 },
  { hour: "19", events: 5600, alerts: 12 },
  { hour: "20", events: 5000, alerts: 14 },
  { hour: "21", events: 4700, alerts: 11 },
  { hour: "22", events: 4400, alerts: 20 },
  { hour: "23", events: 4100, alerts: 24 },
];

export const topThreats: { name: string; count: number }[] = [
  { name: "Brute Force", count: 128 },
  { name: "Port Scanning", count: 74 },
  { name: "Credential Attack", count: 41 },
  { name: "Malware Delivery", count: 19 },
];

// Threat intelligence (§11).
export type ThreatIndicator = {
  value: string;
  kind: "IP" | "Domain" | "Hash" | "CVE";
  reputation: "Malicious" | "Suspicious" | "Clean";
  confidence: number;
  related: number;
  firstSeen: string;
  lastSeen: string;
};

export const threatIntel: ThreatIndicator[] = [
  {
    value: "185.203.116.42",
    kind: "IP",
    reputation: "Malicious",
    confidence: 92,
    related: 4,
    firstSeen: "2026-07-30",
    lastSeen: "2026-08-26",
  },
  {
    value: "cdn-sync[.]update-delivery[.]net",
    kind: "Domain",
    reputation: "Malicious",
    confidence: 87,
    related: 3,
    firstSeen: "2026-08-11",
    lastSeen: "2026-08-25",
  },
  {
    value: "9f2b…c41e (SHA-256)",
    kind: "Hash",
    reputation: "Malicious",
    confidence: 95,
    related: 6,
    firstSeen: "2026-06-02",
    lastSeen: "2026-08-24",
  },
  {
    value: "CVE-2026-3114",
    kind: "CVE",
    reputation: "Suspicious",
    confidence: 70,
    related: 2,
    firstSeen: "2026-08-01",
    lastSeen: "2026-08-20",
  },
];

// Asset risk (§20).
export type Asset = {
  name: string;
  type: string;
  criticality: Severity;
  risk: number;
  owner: string;
  openIncidents: number;
};

export const assets: Asset[] = [
  { name: "DATABASE-01", type: "Production DB", criticality: "Critical", risk: 91, owner: "Platform", openIncidents: 1 },
  { name: "WEB-SERVER-01", type: "Web / API", criticality: "High", risk: 97, owner: "AppEng", openIncidents: 1 },
  { name: "SERVER-03", type: "Application", criticality: "High", risk: 63, owner: "AppEng", openIncidents: 0 },
  { name: "AUTH-GW-01", type: "Auth Gateway", criticality: "High", risk: 71, owner: "IdentityEng", openIncidents: 1 },
  { name: "EDGE-FW-02", type: "Firewall", criticality: "Medium", risk: 58, owner: "NetOps", openIncidents: 1 },
  { name: "SERVER-02", type: "Application", criticality: "Medium", risk: 32, owner: "AppEng", openIncidents: 0 },
  { name: "EMP-PC-114", type: "Endpoint", criticality: "Medium", risk: 44, owner: "IT", openIncidents: 1 },
  { name: "SERVER-01", type: "Batch / Jobs", criticality: "Low", risk: 12, owner: "Platform", openIncidents: 0 },
];

// User risk profiling (§21).
export type UserProfile = {
  user: string;
  role: string;
  risk: number;
  baseline: string;
  current: string;
  flags: string[];
};

export const userProfiles: UserProfile[] = [
  {
    user: "user_102",
    role: "Finance Analyst",
    risk: 92,
    baseline: "Login 9 AM · known laptop · Mumbai · ~100 req/day",
    current: "3 AM login · unknown device · unknown location · 3,000 files accessed",
    flags: ["New device", "Unusual hour", "Bulk file access"],
  },
  {
    user: "admin",
    role: "System Administrator",
    risk: 84,
    baseline: "Console access from jump host · business hours",
    current: "Login from external IP flagged as malicious · privileged command",
    flags: ["Malicious source IP", "Off-hours privilege use"],
  },
  {
    user: "svc_backup",
    role: "Service Account",
    risk: 47,
    baseline: "Nightly backup window · fixed host",
    current: "Outbound connection to new external host",
    flags: ["New destination"],
  },
  {
    user: "r.mehta",
    role: "SOC Analyst",
    risk: 12,
    baseline: "Console + dashboard · business hours",
    current: "Normal",
    flags: [],
  },
];

// Security health score (§22).
export const securityHealth = {
  score: 82,
  dimensions: [
    { name: "Threat Detection", value: 90 },
    { name: "Incident Response", value: 88 },
    { name: "User Risk", value: 85 },
    { name: "Network Security", value: 81 },
    { name: "Endpoint Security", value: 78 },
    { name: "Vulnerabilities", value: 76 },
  ],
};

// MITRE ATT&CK progression (§12).
export const mitreProgression: {
  tactic: string;
  technique: string;
  code: string;
  observed: boolean;
}[] = [
  { tactic: "Initial Access", technique: "Exposed Service", code: "T1190", observed: true },
  { tactic: "Credential Access", technique: "Brute Force", code: "T1110", observed: true },
  { tactic: "Execution", technique: "Command Execution", code: "T1059", observed: true },
  { tactic: "Privilege Escalation", technique: "Exploitation for Priv-Esc", code: "T1068", observed: true },
  { tactic: "Persistence", technique: "Account Manipulation", code: "T1098", observed: false },
  { tactic: "Exfiltration", technique: "Exfil over Alt Protocol", code: "T1048", observed: false },
];

// Evidence integrity (§23) — captured artifacts for incident #1042.
export type EvidenceItem = {
  name: string;
  kind: string;
  hash: string;
  captured: string;
  verified: boolean;
};

export const evidence: EvidenceItem[] = [
  { name: "auth.log (02:09–02:14)", kind: "Log excerpt", hash: "3f8a…d29b", captured: "02:14:07", verified: true },
  { name: "process_exec.json", kind: "Process record", hash: "b71c…0e4f", captured: "02:12:41", verified: true },
  { name: "shadow.diff", kind: "File diff", hash: "9d02…a1c7", captured: "02:13:02", verified: true },
  { name: "netflow_outbound.pcap", kind: "Packet capture", hash: "5e6b…f338", captured: "02:13:55", verified: true },
];

// Controlled response actions (§24) — recommended, human-approved.
export type ResponseAction = {
  action: string;
  impact: Severity;
  requiresApproval: boolean;
  done?: boolean;
};

export const responseActions: ResponseAction[] = [
  { action: "Block source IP 185.203.116.42 at the edge", impact: "High", requiresApproval: true },
  { action: "Disable compromised account 'admin'", impact: "High", requiresApproval: true },
  { action: "Force password reset for affected users", impact: "Medium", requiresApproval: true },
  { action: "Isolate WEB-SERVER-01 from production network", impact: "Critical", requiresApproval: true },
  { action: "Create incident ticket #1042", impact: "Low", requiresApproval: false, done: true },
];

// Explainable-AI risk factors (§15) — SHAP-style contributions to the 97 score.
export const riskFactors: { factor: string; weight: number }[] = [
  { factor: "Threat-intel: source IP is malicious", weight: 0.23 },
  { factor: "Privileged command moments after login", weight: 0.2 },
  { factor: "Unusual login time (02:11)", weight: 0.18 },
  { factor: "Unknown / unrecognized device", weight: 0.16 },
  { factor: "New source IP for this asset", weight: 0.13 },
  { factor: "Pattern matches a prior attack", weight: 0.1 },
];

// Notifications & escalation (§26).
export type Notification = {
  title: string;
  detail: string;
  severity: Severity;
  time: string;
};

export const notifications: Notification[] = [
  { title: "Critical incident #1042", detail: "Possible Server Compromise · WEB-SERVER-01 · Risk 97", severity: "Critical", time: "02:13" },
  { title: "Critical incident #1041", detail: "Data exfiltration over DNS · DATABASE-01 · Risk 88", severity: "Critical", time: "01:52" },
  { title: "Threat-intel match", detail: "185.203.116.42 confirmed malicious (92% confidence)", severity: "High", time: "02:12" },
  { title: "Incident #1040 contained", detail: "Credential stuffing rate-limited on AUTH-GW-01", severity: "High", time: "00:58" },
];

// Reports (§28) — security summary figures.
export const reportSummary = {
  window: "Last 24 hours",
  totalEvents: 128421,
  totalAlerts: 342,
  criticalIncidents: 7,
  falsePositiveRate: 11,
  avgResponseMins: 8,
  securityScore: 82,
  topAttackTypes: [
    { name: "Brute Force", value: 37 },
    { name: "Port Scanning", value: 22 },
    { name: "Credential Attack", value: 12 },
    { name: "Malware Delivery", value: 6 },
  ],
  topIps: [
    { value: "185.203.116.42", count: 214 },
    { value: "203.0.113.9", count: 141 },
    { value: "45.83.220.14", count: 96 },
  ],
  topTechniques: [
    { code: "T1110", name: "Brute Force", count: 128 },
    { code: "T1059", name: "Command Execution", count: 61 },
    { code: "T1068", name: "Privilege Escalation", count: 44 },
  ],
};

// AI Security Analyst scripted exchanges (§13, §14 RAG, §25 chat).
export type AnalystTurn = {
  q?: string;
  a: string;
  bullets?: string[];
  confidence?: number;
  sources?: string[];
  incidentRef?: string;
};

export const analystSuggestions = [
  "Why is incident #1042 critical?",
  "What should I investigate first?",
  "Show all attacks related to T1110",
  "Which IP generated the most suspicious activity?",
];

export const analystScript: AnalystTurn[] = [
  {
    q: "Why is incident #1042 critical?",
    a: "Incident #1042 (Possible Server Compromise on WEB-SERVER-01) scores 97/100 because several high-weight signals reinforce each other rather than appearing in isolation.",
    bullets: [
      "Brute force (15 failed logins in 60s) immediately followed by a successful login",
      "Login from an unknown device at an unusual hour — 0.91 ML anomaly score",
      "Privileged command executed seconds after authentication",
      "Source IP 185.203.116.42 is confirmed malicious in threat intel (92%)",
      "Target is a production asset (high business impact)",
    ],
    confidence: 89,
    sources: ["Incident #1042 timeline", "Threat-intel: 185.203.116.42", "MITRE T1110 / T1059 / T1068"],
    incidentRef: "1042",
  },
  {
    q: "What should I investigate first?",
    a: "Prioritise by risk and business impact. Two criticals are open; start with #1042 — it shows active privileged access on a production web server, which is time-sensitive.",
    bullets: [
      "#1042 · WEB-SERVER-01 · Risk 97 — active compromise, contain first",
      "#1041 · DATABASE-01 · Risk 88 — possible exfiltration in progress",
      "#1039 · IDP-CLOUD · Risk 63 — suspicious OAuth grant, review scopes",
    ],
    confidence: 84,
    sources: ["Incident queue", "Asset risk register"],
  },
  {
    q: "Show all attacks related to T1110",
    a: "T1110 (Brute Force) appears in 2 open incidents and 128 correlated alerts over the last 24 hours.",
    bullets: [
      "#1042 · WEB-SERVER-01 — brute force → successful login → priv-esc",
      "#1040 · AUTH-GW-01 — distributed credential stuffing (contained)",
      "Peak activity between 02:00 and 03:00 from 185.203.116.42",
    ],
    confidence: 91,
    sources: ["MITRE mapping index", "Correlation engine output"],
  },
  {
    q: "Which IP generated the most suspicious activity?",
    a: "185.203.116.42 is the most active hostile source — it drove the WEB-SERVER-01 compromise and is linked to 4 related threats.",
    bullets: [
      "214 events in 24h, 96% flagged or failed",
      "Reputation: Malicious · Confidence 92% · First seen 2026-07-30",
      "Tied to incident #1042 and the outbound connection on WEB-SERVER-01",
    ],
    confidence: 90,
    sources: ["Threat-intel: 185.203.116.42", "Event stream (24h)"],
  },
];

export const analystFallback: AnalystTurn = {
  a: "I can investigate incidents, correlate alerts, explain risk scores, and trace MITRE techniques across your environment. Try one of the suggested questions, or ask about a specific incident, asset, or indicator.",
  confidence: undefined,
};

// MITRE technique catalog (§12) — names for every code referenced by an
// incident, so the workspace can label a technique without a network call.
export const mitreCatalog: Record<string, { tactic: string; name: string }> = {
  T1190: { tactic: "Initial Access", name: "Exploit Public-Facing App" },
  T1110: { tactic: "Credential Access", name: "Brute Force" },
  T1059: { tactic: "Execution", name: "Command & Scripting Interpreter" },
  T1068: { tactic: "Privilege Escalation", name: "Exploitation for Priv-Esc" },
  T1098: { tactic: "Persistence", name: "Account Manipulation" },
  T1048: { tactic: "Exfiltration", name: "Exfil over Alternative Protocol" },
  T1071: { tactic: "Command & Control", name: "Application Layer Protocol" },
  T1550: { tactic: "Defense Evasion", name: "Use Alternate Auth Material" },
  T1046: { tactic: "Discovery", name: "Network Service Scanning" },
  T1078: { tactic: "Initial Access", name: "Valid Accounts" },
  T1204: { tactic: "Execution", name: "User Execution" },
  T1548: { tactic: "Privilege Escalation", name: "Abuse Elevation Control" },
};

// Reconstructed attack timeline for an incident. #1042 uses the detailed
// end-to-end scenario (§33); every other incident gets a plausible three-beat
// reconstruction derived from its own fields.
export type TimelineStep = {
  time: string;
  title: string;
  detail: string;
  tag: string;
};

function shiftTime(hhmm: string, deltaMin: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (((h * 60 + m + deltaMin) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function incidentTimeline(id: string): TimelineStep[] {
  if (id === "1042") {
    return [
      { time: "02:10", title: "Brute force begins", detail: "15 failed logins from a single IP inside 60 seconds trip the rule engine.", tag: "RULE" },
      { time: "02:11", title: "Successful login", detail: "Authentication succeeds from an unrecognized device at an unusual hour.", tag: "RULE" },
      { time: "02:11", title: "Anomaly score 0.91", detail: "The ML engine flags the session against the server's learned baseline.", tag: "ML" },
      { time: "02:12", title: "Privilege escalation", detail: "A privileged command executes moments after login.", tag: "RULE" },
      { time: "02:12", title: "Threat-intel match", detail: "Source IP 185.203.116.42 is already listed as malicious (92%).", tag: "INTEL" },
      { time: "02:13", title: "Incident #1042 opened", detail: "Possible Server Compromise — Risk 97/100 · Critical.", tag: "INCIDENT" },
    ];
  }
  const inc = incidentById(id);
  if (!inc) return [];
  return [
    { time: shiftTime(inc.opened, -3), title: "Signals detected", detail: `Rule and ML engines flag anomalous activity on ${inc.asset}.`, tag: "DETECT" },
    { time: shiftTime(inc.opened, -1), title: "Alerts correlated", detail: `Related alerts are grouped into one incident — risk scored ${inc.risk}/100.`, tag: "CORRELATE" },
    { time: inc.opened, title: `Incident #${inc.id} opened`, detail: `${inc.title} — ${inc.severity}.`, tag: "INCIDENT" },
    { time: inc.opened, title: "AI assessment", detail: `${inc.confidence}% confidence · ${inc.mitre.join(" · ")}`, tag: "AI" },
  ];
}
