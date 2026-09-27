// Server-only Gemini client (REST — no SDK dependency).
//
// All AI features in the console funnel through this module. The API key is
// read from GEMINI_API_KEY (.env). If it's missing or the call fails, callers
// get a clean `null` / thrown AiError and every UI feature degrades to the
// scripted/heuristic fallback it already has — the console never breaks
// because AI is unavailable.

const API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models";
const PREFERRED_MODELS = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-2.0-flash"];
const TIMEOUT_MS = 45_000;

export function aiEnabled(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export class AiError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

export type GeminiPart = { text: string };

type GenerateOpts = {
  system: string;
  user: string;
  temperature?: number;
  maxOutputTokens?: number;
};

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  error?: { message?: string; status?: string };
};

async function callModel(model: string, opts: GenerateOpts): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new AiError("GEMINI_API_KEY is not configured.", 503);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_ROOT}/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: [{ role: "user", parts: [{ text: opts.user }] }],
        generationConfig: {
          temperature: opts.temperature ?? 0.4,
          // Thinking models (2.5+/3.x) spend output budget on internal thoughts
          // before emitting the answer — keep the ceiling generous.
          maxOutputTokens: opts.maxOutputTokens ?? 4000,
        },
      }),
    });
    const body = (await res.json()) as GeminiResponse;
    if (!res.ok) {
      throw new AiError(body.error?.message ?? `Gemini returned ${res.status}.`, res.status);
    }
    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
    if (!text) throw new AiError("Gemini returned an empty response.");
    return text;
  } catch (err) {
    if (err instanceof AiError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new AiError("The AI request timed out.", 504);
    }
    throw new AiError("Could not reach the Gemini API.");
  } finally {
    clearTimeout(timer);
  }
}

export async function geminiText(opts: GenerateOpts): Promise<string> {
  let last: unknown;
  for (const model of PREFERRED_MODELS) {
    try {
      return await callModel(model, opts);
    } catch (err) {
      last = err;
      // Try the next model only when the preferred one is missing/blocked.
      const status = err instanceof AiError ? err.status : 0;
      if (status !== 404 && status !== 400) throw err;
    }
  }
  throw last instanceof Error ? new AiError(last.message) : new AiError("Gemini request failed.");
}

// Robust JSON extraction — Gemini occasionally wraps JSON in ``` fences or
// prose even when asked not to.
export function parseJsonLoose<T>(raw: string): T {
  const cleaned = raw
    .replace(/^```(?:json)?/gim, "")
    .replace(/```$/gim, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.search(/[[{]/);
    const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    }
    throw new AiError("The AI response was not valid JSON.");
  }
}
