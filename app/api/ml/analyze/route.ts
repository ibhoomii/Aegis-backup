// Proxy to the Python ML service's single-event anomaly analysis.
// POST { event: {...normalized security event fields...} }

import { NextResponse } from "next/server";
import { analyzeEvent, mlServiceError } from "@/lib/ml-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let event: Record<string, unknown>;
  try {
    const body = (await request.json()) as { event?: unknown };
    if (typeof body.event !== "object" || body.event === null) {
      return NextResponse.json({ error: "Provide a { event } object." }, { status: 400 });
    }
    event = body.event as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const model = typeof event.model === "string" ? event.model : undefined;
    delete event.model;
    const result = await analyzeEvent(event, model);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: mlServiceError(err) }, { status: 502 });
  }
}
