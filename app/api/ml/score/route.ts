// Scores parsed log events through the NSL-KDD anomaly model.
// POST { events: [...normalized events...] } — feature construction happens
// here (lib/ingest/ml-features.ts), verdicts come from the Python service.
// The route returns per-event verdicts with the original event context echoed.

import { NextResponse } from "next/server";
import { analyzeEvents, mlServiceError } from "@/lib/ml-service";
import { buildFeatureRows } from "@/lib/ingest/ml-features";
import type { NormalizedEvent } from "@/lib/ingest/parse";

export const runtime = "nodejs";

const MAX_EVENTS = 300;

export async function POST(request: Request) {
  let events: NormalizedEvent[];
  try {
    const body = (await request.json()) as { events?: unknown };
    if (!Array.isArray(body.events)) {
      return NextResponse.json({ error: "Provide an { events } array." }, { status: 400 });
    }
    events = body.events as NormalizedEvent[];
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const rows = buildFeatureRows(events, MAX_EVENTS);
  if (rows.length === 0) {
    return NextResponse.json({ verdicts: [], summary: { scored: 0, flagged: 0, maxRisk: 0, avgRisk: 0 } });
  }

  try {
    const verdicts = await analyzeEvents(rows);
    const withCtx = verdicts.map((v, i) => ({
      ...v,
      context: rows[i]._ctx,
    }));
    const flagged = withCtx.filter((v) => v.is_anomaly).length;
    const risks = withCtx.map((v) => v.risk_score);
    return NextResponse.json({
      verdicts: withCtx,
      summary: {
        scored: withCtx.length,
        flagged,
        maxRisk: risks.length ? Math.max(...risks) : 0,
        avgRisk: risks.length ? risks.reduce((a, b) => a + b, 0) / risks.length : 0,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: mlServiceError(err) }, { status: 502 });
  }
}
