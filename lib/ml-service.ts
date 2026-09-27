// Server-side client for the AegisSOC Python ML Anomaly Detection service
// (aegis_ml/aegissoc-ml/src/app.py — FastAPI + Isolation Forest trained on
// NSL-KDD). The Next.js API routes under /api/ml/* proxy to it so the browser
// only ever talks to our own origin.
//
// Start the ML service before using these routes:
//   cd aegis_ml/aegissoc-ml
//   source .venv/bin/activate
//   uvicorn app:app --host 0.0.0.0 --port 8000
//
// Override the target with the ML_SERVICE_URL env var.

const BASE_URL = (process.env.ML_SERVICE_URL ?? "http://localhost:8000").replace(/\/$/, "");
const TIMEOUT_MS = 15_000;

export type MlReason = {
  feature: string;
  description: string;
  magnitude: number;
};

export type MlAnalyzeResult = {
  event_id?: string | null;
  is_anomaly: boolean;
  risk_score: number;
  risk_level: "Low" | "Medium" | "High" | "Critical";
  raw_isolation_forest_score: number;
  operating_threshold?: number;
  model?: string;
  reasons: MlReason[];
};

export type MlModelInfo = {
  model_type: string;
  training_mode: string;
  dataset: string;
  operating_threshold: number;
  target_false_positive_rate: number;
  test_metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
    roc_auc: number;
    pr_auc: number;
    confusion_matrix: number[][];
    recall_by_attack_family: Record<string, number>;
    recall_by_attack_class?: Record<string, number>;
    recall_on_novel_unseen_attack_types: number;
    novel_attack_types_in_test_set: string[];
  };
};

export function mlServiceError(err: unknown): string {
  const aborted = err instanceof Error && err.name === "AbortError";
  return aborted
    ? "The ML service did not respond in time."
    : "The ML service is unreachable. Start it with: cd aegis_ml/aegissoc-ml && source .venv/bin/activate && uvicorn app:app --port 8000";
}

async function mlFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { detail?: string } | null;
      throw new Error(body?.detail ?? `ML service returned ${res.status}.`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export function analyzeEvent(
  event: Record<string, unknown>,
  model?: string,
): Promise<MlAnalyzeResult> {
  return mlFetch("/api/v1/analyze", {
    method: "POST",
    body: JSON.stringify(model ? { ...event, model } : event),
  });
}

export function analyzeEvents(
  events: Record<string, unknown>[],
  model?: string,
): Promise<MlAnalyzeResult[]> {
  const cleaned = model ? events.map((e) => ({ ...e, model })) : events;
  return mlFetch("/api/v1/analyze/batch", {
    method: "POST",
    body: JSON.stringify({ events: cleaned }),
  });
}

export function getModelInfo(model?: string): Promise<MlModelInfo> {
  return mlFetch(`/model/info${model ? `?model=${encodeURIComponent(model)}` : ""}`);
}

export type MlModelAvailability = { available: string[]; loaded: string[] };

export function listModels(): Promise<MlModelAvailability> {
  return mlFetch("/models");
}
