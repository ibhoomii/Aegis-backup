// The Dataset contract.
//
// Everything the AegisSOC console renders is bundled into one `Dataset` object,
// so the same pages can be driven either by the built-in demo (spec-derived
// sample data) or by a dataset produced from a user's own logs (see
// `lib/ingest`). Base record types are reused from `lib/soc-data` — this module
// only adds the container type, thin accessors, an empty baseline, and the
// assembled `demoDataset`.

import type {
  Incident,
  SecurityEvent,
  ThreatIndicator,
  Asset,
  UserProfile,
  Notification,
  EvidenceItem,
  ResponseAction,
  TimelineStep,
  AnalystTurn,
} from "@/lib/soc-data";

import {
  incidents as demoIncidents,
  eventPool as demoEventPool,
  activitySeries as demoActivitySeries,
  topThreats as demoTopThreats,
  threatIntel as demoThreatIntel,
  assets as demoAssets,
  userProfiles as demoUserProfiles,
  securityHealth as demoSecurityHealth,
  mitreProgression as demoMitreProgression,
  notifications as demoNotifications,
  reportSummary as demoReportSummary,
  analystSuggestions as demoAnalystSuggestions,
  analystScript as demoAnalystScript,
  analystFallback as demoAnalystFallback,
  evidence as demoEvidence,
  riskFactors as demoRiskFactors,
  responseActions as demoResponseActions,
  incidentTimeline,
  mitreCatalog,
  type Incident as IncidentType,
} from "@/lib/soc-data";

export type RiskFactor = { factor: string; weight: number };

export type MitreStep = {
  tactic: string;
  technique: string;
  code: string;
  observed: boolean;
};

// A single dashboard stat card. `tone` is a semantic palette token, not a class.
export type Kpi = {
  label: string;
  value: number;
  spark: number[];
  tone: "ink" | "signal" | "clearance" | "caution";
  trend?: string;
};

// One node in an incident's "entities involved" list (the user-data stand-in
// for the demo hero's SVG relationship graph).
export type IncidentEntity = {
  kind: string;
  label: string;
  detail?: string;
  tone?: "signal" | "caution" | "clearance" | "ink";
};

export type SecurityHealth = {
  score: number;
  dimensions: { name: string; value: number }[];
};

export type ReportSummary = {
  window: string;
  totalEvents: number;
  totalAlerts: number;
  criticalIncidents: number;
  falsePositiveRate: number;
  avgResponseMins: number;
  securityScore: number;
  topAttackTypes: { name: string; value: number }[];
  topIps: { value: string; count: number }[];
  topTechniques: { code: string; name: string; count: number }[];
};

export type DatasetMeta = {
  source: "demo" | "user";
  label: string;
  generatedAt: string;
  eventCount: number;
  fileCount?: number;
  url?: string;
  note?: string;
};

export type Dataset = {
  meta: DatasetMeta;
  kpis: Kpi[];
  incidents: Incident[];
  eventPool: SecurityEvent[];
  activitySeries: { hour: string; events: number; alerts: number }[];
  topThreats: { name: string; count: number }[];
  threatIntel: ThreatIndicator[];
  assets: Asset[];
  userProfiles: UserProfile[];
  securityHealth: SecurityHealth;
  mitreProgression: MitreStep[];
  notifications: Notification[];
  reportSummary: ReportSummary;
  analyst: {
    suggestions: string[];
    script: AnalystTurn[];
    fallback: AnalystTurn;
  };
  // Per-incident detail, keyed by incident id.
  timelineByIncident: Record<string, TimelineStep[]>;
  riskFactorsByIncident: Record<string, RiskFactor[]>;
  evidenceByIncident: Record<string, EvidenceItem[]>;
  responseActionsByIncident: Record<string, ResponseAction[]>;
  mitreChainByIncident: Record<string, MitreStep[]>;
  entitiesByIncident: Record<string, IncidentEntity[]>;
  explainByIncident: Record<string, AnalystTurn>;
  // Optional ML screening summary produced when user logs are scored through
  // the anomaly service (see /connect + lib/ingest/ml-features.ts). Absent in
  // the demo dataset.
  ml?: MlScreening;
};

// Result of screening uploaded log events through the trained NSL-KDD model.
export type MlScreening = {
  model: string;
  scored: number;
  flagged: number;
  avgRisk: number;
  maxRisk: number;
  topEvents: {
    action: string;
    sourceIp?: string;
    risk: number;
    level: string;
    reasons: string[];
  }[];
};

// ---- Accessors -------------------------------------------------------------
// Thin, null-safe readers so pages stay declarative and never index a missing
// map by hand.

export const incidentFromDataset = (ds: Dataset, id: string) =>
  ds.incidents.find((i) => i.id === id);

export const timelineFor = (ds: Dataset, id: string): TimelineStep[] =>
  ds.timelineByIncident[id] ?? [];

export const riskFactorsFor = (ds: Dataset, id: string): RiskFactor[] =>
  ds.riskFactorsByIncident[id] ?? [];

export const evidenceFor = (ds: Dataset, id: string): EvidenceItem[] =>
  ds.evidenceByIncident[id] ?? [];

export const responseActionsFor = (ds: Dataset, id: string): ResponseAction[] =>
  ds.responseActionsByIncident[id] ?? [];

export const mitreChainFor = (ds: Dataset, id: string): MitreStep[] =>
  ds.mitreChainByIncident[id] ?? [];

export const entitiesFor = (ds: Dataset, id: string): IncidentEntity[] =>
  ds.entitiesByIncident[id] ?? [];

export const explainFor = (ds: Dataset, id: string): AnalystTurn | undefined =>
  ds.explainByIncident[id];

// ---- Empty baseline --------------------------------------------------------
// A structurally-valid, zeroed dataset. Used by the ingest pipeline when a
// user's logs yield nothing parseable, so every page still renders (with empty
// states) instead of throwing.

export function emptyDataset(meta: Partial<DatasetMeta> = {}): Dataset {
  return {
    meta: {
      source: "user",
      label: "No data",
      generatedAt: "",
      eventCount: 0,
      ...meta,
    },
    kpis: [
      { label: "Events parsed", value: 0, spark: [], tone: "ink" },
      { label: "Alerts", value: 0, spark: [], tone: "caution" },
      { label: "Incidents", value: 0, spark: [], tone: "signal" },
      { label: "Critical", value: 0, spark: [], tone: "signal" },
    ],
    incidents: [],
    eventPool: [],
    activitySeries: Array.from({ length: 24 }, (_, h) => ({
      hour: String(h).padStart(2, "0"),
      events: 0,
      alerts: 0,
    })),
    topThreats: [],
    threatIntel: [],
    assets: [],
    userProfiles: [],
    securityHealth: {
      score: 0,
      dimensions: [
        { name: "Threat Detection", value: 0 },
        { name: "Incident Response", value: 0 },
        { name: "User Risk", value: 0 },
        { name: "Network Security", value: 0 },
        { name: "Endpoint Security", value: 0 },
        { name: "Vulnerabilities", value: 0 },
      ],
    },
    mitreProgression: [],
    notifications: [],
    reportSummary: {
      window: "Uploaded logs",
      totalEvents: 0,
      totalAlerts: 0,
      criticalIncidents: 0,
      falsePositiveRate: 0,
      avgResponseMins: 0,
      securityScore: 0,
      topAttackTypes: [],
      topIps: [],
      topTechniques: [],
    },
    analyst: {
      suggestions: [],
      script: [],
      fallback: {
        a: "No events were parsed from this source, so there's nothing to investigate yet. Upload log files or connect a URL from Data Sources to get started.",
        confidence: undefined,
      },
    },
    timelineByIncident: {},
    riskFactorsByIncident: {},
    evidenceByIncident: {},
    responseActionsByIncident: {},
    mitreChainByIncident: {},
    entitiesByIncident: {},
    explainByIncident: {},
  };
}

// ---- Demo dataset ----------------------------------------------------------
// Assembles the built-in demo from the spec-derived arrays in `lib/soc-data`.
// Every value is passed through unchanged, so the demo console renders exactly
// as it did before the two-mode refactor.

// SHAP-style contributions for a demo incident. #1042 uses the authored
// factors; the rest are derived from their own fields. (Moved here verbatim
// from the incident-detail page so the demo dataset owns it.)
function demoFactorsFor(inc: IncidentType): RiskFactor[] {
  if (inc.id === "1042") return demoRiskFactors;
  const sevWeight: Record<string, number> = {
    Critical: 0.34,
    High: 0.26,
    Medium: 0.18,
    Low: 0.1,
  };
  return [
    { factor: `${inc.severity} severity classification`, weight: sevWeight[inc.severity] },
    { factor: `Model confidence ${inc.confidence}%`, weight: (inc.confidence / 100) * 0.3 },
    { factor: `Target asset — ${inc.asset}`, weight: 0.2 },
    { factor: `${inc.mitre.length} technique(s) mapped`, weight: 0.1 + inc.mitre.length * 0.03 },
  ];
}

function demoMitreChain(inc: IncidentType): MitreStep[] {
  if (inc.id === "1042") return demoMitreProgression;
  return inc.mitre.map((code) => ({
    code,
    tactic: mitreCatalog[code]?.tactic ?? "Technique",
    technique: mitreCatalog[code]?.name ?? code,
    observed: true,
  }));
}

const byIncident = <T,>(fn: (inc: IncidentType) => T): Record<string, T> =>
  Object.fromEntries(demoIncidents.map((inc) => [inc.id, fn(inc)]));

export const demoDataset: Dataset = {
  meta: {
    source: "demo",
    label: "Demo data",
    generatedAt: "2026-08-26 05:17 UTC",
    eventCount: demoReportSummary.totalEvents,
    note: "Spec-derived sample environment",
  },
  kpis: [
    { label: "Events / 24h", value: 128421, spark: demoActivitySeries.map((d) => d.events), tone: "ink", trend: "+4.2%" },
    { label: "Alerts raised", value: 342, spark: demoActivitySeries.map((d) => d.alerts), tone: "caution", trend: "+11%" },
    { label: "Incidents open", value: 18, spark: [9, 11, 10, 13, 12, 14, 16, 15, 18], tone: "signal", trend: "+3" },
    { label: "Critical", value: 7, spark: [2, 3, 3, 4, 5, 5, 6, 6, 7], tone: "signal", trend: "+2" },
  ],
  incidents: demoIncidents,
  eventPool: demoEventPool,
  activitySeries: demoActivitySeries,
  topThreats: demoTopThreats,
  threatIntel: demoThreatIntel,
  assets: demoAssets,
  userProfiles: demoUserProfiles,
  securityHealth: demoSecurityHealth,
  mitreProgression: demoMitreProgression,
  notifications: demoNotifications,
  reportSummary: demoReportSummary,
  analyst: {
    suggestions: demoAnalystSuggestions,
    script: demoAnalystScript,
    fallback: demoAnalystFallback,
  },
  timelineByIncident: byIncident((inc) => incidentTimeline(inc.id)),
  riskFactorsByIncident: byIncident(demoFactorsFor),
  // Only the hero incident ships captured artifacts in the demo; the detail
  // page shows a "collection pending" note for the rest.
  evidenceByIncident: { "1042": demoEvidence },
  // The demo recommends the same authored response playbook on every incident,
  // matching the pre-refactor behaviour.
  responseActionsByIncident: byIncident(() => demoResponseActions),
  mitreChainByIncident: byIncident(demoMitreChain),
  // The demo hero uses the SVG relationship graph, so it needs no entity list.
  entitiesByIncident: {},
  explainByIncident: { "1042": demoAnalystScript[0] },
};
