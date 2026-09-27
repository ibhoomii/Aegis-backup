// Proxy to the Python ML service's batch anomaly analysis.
// POST { events: [{...}, ...], model?: "nslkdd" | "cicids" }

import { NextResponse } from "next/server";
import { analyzeEvents, mlServiceError } from "@/lib/ml-service";

export const runtime = "nodejs";

const MAX_EVENTS = 500;

type Parsed =
  | { events: Record<string, unknown>[]; model?: string }
  | { response: ReturnType<typeof NextResponse.json> };

async function parseBody(request: Request): Promise<Parsed> {
  let body: { events?: unknown; model?: unknown };
  try {
    body = (await request.json()) as { events?: unknown; model?: unknown };
  } catch {
    return { response: NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }) };
  }
  if (!Array.isArray(body.events)) {
    return { response: NextResponse.json({ error: "Provide an { events } array." }, { status: 400 }) };
  }
  if (body.events.length === 0) {
    return { response: NextResponse.json({ error: "The events array is empty." }, { status: 400 }) };
  }
  if (body.events.length > MAX_EVENTS) {
    return {
      response: NextResponse.json(
        { error: `Batch is limited to ${MAX_EVENTS} events per call.` },
        { status: 413 },
      ),
    };
  }
  const events = body.events.filter(
    (e): e is Record<string, unknown> => typeof e === "object" && e !== null,
  );
  const model =
    typeof body.model === "string"
      ? body.model
      : typeof events[0]?.model === "string"
        ? (events[0].model as string)
        : undefined;
  return { events, model };
}

export async function POST(request: Request) {
  const parsed = await parseBody(request);
  if ("response" in parsed) return parsed.response;
  const { events, model } = parsed;

  try {
    const results = await analyzeEvents(events, model);
    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json({ error: mlServiceError(err) }, { status: 502 });
  }
}
