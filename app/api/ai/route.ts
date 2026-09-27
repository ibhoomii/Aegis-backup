// Unified Gemini AI endpoint for every AI feature in the console.
// POST { task: "brief" | "ml-explain" | "incident" | "chat" | "log-insights", payload }
//
// If GEMINI_API_KEY is missing or Gemini fails, the route returns { error }
// and every UI feature falls back to its scripted behaviour.

import { NextResponse } from "next/server";
import { aiEnabled, geminiText, parseJsonLoose, AiError } from "@/lib/ai/gemini";

export const runtime = "nodejs";

const GUARD = `You are AegisSOC's embedded AI security analyst inside a SOC console.
Rules:
- Ground every statement in the data provided; never invent incidents, IPs, users or CVEs.
- Be concise and operational. Analysts want signal, not essays.
- Plain English for a college-level SOC audience; expand acronyms on first use.
- If the data is insufficient, say so briefly and give the best data-backed answer possible.
- Never provide offensive instructions; defensive guidance only.
Return ONLY valid JSON matching the requested schema. No markdown fences.`;

type ChatPayload = {
  question: string;
  history: { role: "user" | "assistant"; text: string }[];
  datasetDigest: string;
};

const tasks = {
  async brief(payload: { datasetDigest: string }) {
    const text = await geminiText({
      system: `${GUARD}
Schema: {"headline": string (<=90 chars), "summary": string (2-3 sentences), "topRisks": string[] (2-4 short bullets, each naming the concrete item), "recommendedActions": string[] (2-4 imperative bullets), "confidenceNote": string (<=120 chars, state data limits)}`,
      user: `Current SOC state digest:\n${payload.datasetDigest}\n\nProduce the shift-handover briefing.`,
    });
    return parseJsonLoose(text);
  },

  async mlExplain(payload: {
    event: Record<string, unknown>;
    verdict: Record<string, unknown>;
    modelName: string;
  }) {
    const text = await geminiText({
      system: `${GUARD}
You are explaining an unsupervised Isolation Forest verdict. The score is a deviation-from-baseline measure, not proof of attack - calibrate your language accordingly.
Schema: {"plainEnglish": string (2-3 sentences, what the verdict means), "likelyScenarios": string[] (2-3, most plausible first, with reasoning), "mitre": {"code": string, "name": string, "why": string}[] (0-2 entries; only if genuinely suggested), "nextSteps": string[] (2-4 concrete triage steps), "caveat": string (<=110 chars)}`,
      user: `Model: ${payload.modelName}\nSecurity event: ${JSON.stringify(payload.event)}\nModel verdict: ${JSON.stringify(payload.verdict)}\n\nExplain this verdict.`,
    });
    return parseJsonLoose(text);
  },

  async incident(payload: { incident: Record<string, unknown>; datasetDigest: string }) {
    const text = await geminiText({
      system: `${GUARD}
Schema: {"summary": string (2-3 sentence analyst handover), "assessment": string (what most likely happened, hedged appropriately), "iocs": {"type": string, "value": string, "note": string}[] (only values present in the incident data), "severityOpinion": "Critical" | "High" | "Medium" | "Low", "recommendedActions": string[] (3-5 prioritized), "questions": string[] (1-3 things the analyst should verify)}`,
      user: `Incident record: ${JSON.stringify(payload.incident)}\nSurrounding SOC state: ${payload.datasetDigest}\n\nTriage this incident.`,
    });
    return parseJsonLoose(text);
  },

  async chat(payload: ChatPayload) {
    const text = await geminiText({
      system: `${GUARD}
You are answering a SOC analyst's question about the current dataset.
Schema: {"answer": string (2-5 sentences), "bullets": string[] (optional supporting points, max 5), "sources": string[] (which parts of the digest support this), "confidence": number (0-100)}`,
      user: `SOC state digest:\n${payload.datasetDigest}\n\nConversation so far:\n${payload.history
        .slice(-6)
        .map((m) => `${m.role}: ${m.text}`)
        .join("\n")}\n\nAnalyst question: ${payload.question}`,
    });
    return parseJsonLoose(text);
  },

  async logInsights(payload: {
    files: { name: string; events: number; format: string }[];
    heuristics: Record<string, unknown>;
    mlScreening: Record<string, unknown> | null;
    sampleLines: string[];
  }) {
    const text = await geminiText({
      system: `${GUARD}
You are reviewing what a log-upload pipeline found before it hits the SOC views.
Schema: {"overview": string (2-3 sentences: what these logs are and their overall state), "notableFindings": string[] (2-5, each referencing concrete files/counts/IPs/actions from the data), "dataQuality": string[] (0-3 notes: missing fields, parse gaps, sampling), "suggestedNext": string[] (2-4 next steps for the analyst)}`,
      user: `Uploaded files: ${JSON.stringify(payload.files)}\nHeuristic pipeline summary: ${JSON.stringify(
        payload.heuristics,
      )}\nML anomaly screening: ${
        payload.mlScreening ? JSON.stringify(payload.mlScreening) : "not available (ML service offline)"
      }\nSample log lines (truncated): ${JSON.stringify(payload.sampleLines)}\n\nReview these logs.`,
    });
    return parseJsonLoose(text);
  },
};

export async function POST(request: Request) {
  if (!aiEnabled()) {
    return NextResponse.json(
      { error: "AI is not configured on this server (missing GEMINI_API_KEY)." },
      { status: 503 },
    );
  }

  let task: keyof typeof tasks;
  let payload: unknown;
  try {
    const body = (await request.json()) as { task?: unknown; payload?: unknown };
    if (typeof body.task !== "string") {
      return NextResponse.json({ error: "Unknown AI task." }, { status: 400 });
    }
    // Clients use kebab-case ("ml-explain"); tasks are camelCase ("mlExplain").
    const taskKey = body.task.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    if (!(taskKey in tasks)) {
      return NextResponse.json({ error: "Unknown AI task." }, { status: 400 });
    }
    task = taskKey as keyof typeof tasks;
    payload = body.payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const result = await tasks[task](payload as never);
    return NextResponse.json(result);
  } catch (err) {
    const status = err instanceof AiError ? err.status : 502;
    const message = err instanceof Error ? err.message : "The AI request failed.";
    return NextResponse.json({ error: message }, { status });
  }
}
