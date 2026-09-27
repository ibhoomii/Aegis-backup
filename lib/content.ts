// Content sourced from the AegisSOC project specification.
// Kept in one module so copy stays consistent across sections.

export const stats: { label: string; value: number }[] = [
  { label: "Events / day", value: 128421 },
  { label: "Alerts raised", value: 342 },
  { label: "Incidents opened", value: 18 },
  { label: "Critical", value: 7 },
];

export const rawAlerts = [
  "Failed Login — 10.0.0.25",
  "Failed Login — 10.0.0.25",
  "Failed Login — 10.0.0.25",
  "Suspicious IP flagged",
  "Port Scan detected",
  "Successful Login — admin",
  "Privilege Escalation",
  "File Modification — /etc/shadow",
];

export const correlatedChain = [
  "Brute Force",
  "Successful Login",
  "Privilege Escalation",
  "Suspicious Process",
  "Sensitive File Modification",
];

export type Phase = {
  id: string;
  index: string;
  title: string;
  description: string;
  capabilities: { name: string; detail: string }[];
};

export const phases: Phase[] = [
  {
    id: "detect",
    index: "01",
    title: "Detect",
    description:
      "Every event is checked twice — once against known attack signatures, once against what's normal for this exact environment.",
    capabilities: [
      {
        name: "Rule-based detection",
        detail:
          "Catches known patterns fast — 10+ failed logins in 2 minutes, one IP sweeping many ports, logins from a new device at an unusual hour.",
      },
      {
        name: "ML anomaly detection",
        detail:
          "An Isolation Forest baseline learns what normal looks like per user, then scores deviation — 5,000 requests at 3 AM from an unknown device stands out on its own.",
      },
      {
        name: "Behavioral analytics",
        detail:
          "Watches login frequency, access patterns, and resource usage over time to surface account takeover and insider threats no single event would reveal.",
      },
    ],
  },
  {
    id: "understand",
    index: "02",
    title: "Understand",
    description:
      "Individual alerts rarely mean much alone. This is where scattered signals become one legible story with a number attached.",
    capabilities: [
      {
        name: "Alert correlation engine",
        detail:
          "Groups related alerts — brute force, root login, sudo, file write, outbound connection — into a single incident instead of five open tabs.",
      },
      {
        name: "Risk scoring engine",
        detail:
          "0–100 score built from severity, anomaly score, threat intel, asset importance, user risk, and technique — so Critical always means critical.",
      },
      {
        name: "Threat intelligence",
        detail:
          "Cross-references IPs, domains, hashes, and CVEs against reputation data and raises the score automatically on a known-malicious match.",
      },
      {
        name: "MITRE ATT&CK mapping",
        detail:
          "Tags every technique observed — T1110, T1059, T1068 — and plots the attack's progression from initial access to exfiltration.",
      },
    ],
  },
  {
    id: "investigate",
    index: "03",
    title: "Investigate",
    description:
      "The AI analyst doesn't just flag a threat — it explains its reasoning in the same language a human analyst would use.",
    capabilities: [
      {
        name: "AI security analyst",
        detail:
          '"What happened to server-03?" gets a real answer: a reconstructed timeline, an assessment, and a confidence score — not a chatbot deflection.',
      },
      {
        name: "RAG-based knowledge",
        detail:
          "Retrieves your own runbooks, past incident reports, and MITRE references before answering, so guidance is grounded in your environment.",
      },
      {
        name: "Explainable AI",
        detail:
          "Every score ships with its reasons — unusual login time, unknown device, new IP, matching a past attack — not a bare verdict.",
      },
    ],
  },
  {
    id: "act",
    index: "04",
    title: "Act",
    description:
      "Automation prepares the response. A person still approves anything that touches production.",
    capabilities: [
      {
        name: "Incident management",
        detail:
          "Assign, escalate, comment, attach evidence, and close — with severity and status tracked against a single incident record.",
      },
      {
        name: "Evidence integrity",
        detail:
          "Every artifact is SHA-256 hashed on capture, so tampering shows up the moment a current hash stops matching the original.",
      },
      {
        name: "Controlled response",
        detail:
          "Block an IP, disable an account, force a reset, isolate a host — recommended by the system, executed only after analyst approval.",
      },
    ],
  },
];

export const pipelineStages = [
  "Servers · Endpoints · APIs",
  "Log Collector",
  "Event Processor",
  "Rule Engine + ML Engine",
  "Correlation Engine",
  "Risk Engine",
  "Threat Intel · MITRE · Asset Risk",
  "Incident Engine",
  "AI Analyst",
  "Human Approval",
  "Controlled Response",
];

export const scenario = {
  asset: "WEB-SERVER-01",
  timeline: [
    {
      time: "02:10",
      title: "Brute force begins",
      detail: "15 failed logins from a single IP inside 60 seconds trip the rule engine.",
      tag: "RULE",
    },
    {
      time: "02:11",
      title: "Successful login",
      detail: "Authentication succeeds from an unrecognized device at an unusual hour.",
      tag: "RULE",
    },
    {
      time: "02:11",
      title: "Anomaly score: 0.91",
      detail: "The ML engine flags the session against the server's learned baseline.",
      tag: "ML",
    },
    {
      time: "02:12",
      title: "Privilege escalation",
      detail: "A privileged command executes moments after login.",
      tag: "RULE",
    },
    {
      time: "02:12",
      title: "Threat intel match",
      detail: "The source IP is already listed as malicious.",
      tag: "INTEL",
    },
    {
      time: "02:13",
      title: "Incident #1042 opened",
      detail: "Possible Server Compromise — Risk 97/100 · Critical.",
      tag: "INCIDENT",
    },
  ],
  summary:
    "The activity indicates a likely credential-based attack against WEB-SERVER-01. Multiple failed authentication attempts were followed by a successful login from an unusual source and privileged activity.",
  recommended: [
    "Investigate the source IP",
    "Verify the successful login",
    "Review privileged commands",
    "Rotate affected credentials",
    "Investigate outbound connections",
  ],
  mitre: ["T1110 · Brute Force", "T1059 · Command Execution", "T1068 · Privilege Escalation"],
};

export const dashboard = {
  topThreats: ["Brute Force", "Port Scanning", "Credential Attack"],
  threatIntel: ["Malicious IPs", "Suspicious Domains", "Malware Hashes"],
  assetRisk: [
    { name: "Database-01", level: "Critical" },
    { name: "Web-Server", level: "High" },
    { name: "Server-03", level: "High" },
  ],
  mitreRow: ["T1110", "T1059", "T1068"],
};

export type GraphNodeId =
  | "ip"
  | "user"
  | "server"
  | "process"
  | "file"
  | "network";

export const incidentGraphNodes: {
  id: GraphNodeId;
  label: string;
  detail: string;
  x: number;
  y: number;
}[] = [
  {
    id: "ip",
    label: "IP Address",
    detail: "External source IP, matched against threat intelligence as malicious.",
    x: 320,
    y: 40,
  },
  {
    id: "user",
    label: "User",
    detail: "Login session on an unrecognized device, 0.91 anomaly score.",
    x: 320,
    y: 148,
  },
  {
    id: "server",
    label: "Server",
    detail: "WEB-SERVER-01 — the asset under investigation.",
    x: 320,
    y: 256,
  },
  {
    id: "process",
    label: "Process",
    detail: "Privileged command executed moments after login.",
    x: 200,
    y: 356,
  },
  {
    id: "file",
    label: "File",
    detail: "Sensitive configuration file modified.",
    x: 440,
    y: 356,
  },
  {
    id: "network",
    label: "Network Connection",
    detail: "Outbound connection opened to an unlisted external host.",
    x: 200,
    y: 440,
  },
];

export const incidentGraphEdges: { from: GraphNodeId; to: GraphNodeId }[] = [
  { from: "ip", to: "user" },
  { from: "user", to: "server" },
  { from: "server", to: "process" },
  { from: "server", to: "file" },
  { from: "process", to: "network" },
];

export const graphReveals = [
  "Attack source",
  "Compromised account",
  "Affected machine",
  "Suspicious process",
  "Modified files",
  "External destinations",
];

export const stack = [
  {
    label: "Frontend",
    comment: "SOC dashboard, incident workspace, AI chat",
    items: ["Next.js", "React", "TypeScript", "Tailwind CSS", "Shadcn UI", "WebSockets"],
  },
  {
    label: "Backend",
    comment: "REST + realtime, auth, RBAC",
    items: ["Spring Boot / FastAPI", "REST APIs", "WebSockets", "JWT sessions"],
  },
  {
    label: "Data",
    comment: "Structured records + log-scale search",
    items: ["PostgreSQL", "OpenSearch / Elasticsearch", "Redis", "pgvector"],
  },
  {
    label: "ML",
    comment: "Anomaly scoring + explainability",
    items: ["Python", "Scikit-learn", "XGBoost", "SHAP"],
  },
  {
    label: "AI",
    comment: "Investigation assistant",
    items: ["LLM", "RAG", "Embeddings"],
  },
  {
    label: "Platform",
    comment: "Ingestion + deployment",
    items: ["Kafka / RabbitMQ", "Docker Compose", "Wazuh · Sysmon", "Nginx"],
  },
];

export const severityScale = [
  { range: "0–25", label: "Low", tone: "clearance" },
  { range: "26–50", label: "Medium", tone: "caution" },
  { range: "51–75", label: "High", tone: "caution" },
  { range: "76–100", label: "Critical", tone: "signal" },
];

export const tickerItems = [
  "T1110 BRUTE FORCE",
  "T1059 COMMAND EXECUTION",
  "T1068 PRIVILEGE ESCALATION",
  "ALERT CORRELATION ACTIVE",
  "THREAT INTEL MATCH",
  "EVIDENCE HASH VERIFIED",
  "RISK SCORE 97 / 100",
  "HUMAN APPROVAL REQUIRED",
];
