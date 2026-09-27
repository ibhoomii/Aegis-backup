// Proxy to the Python ML service's model info (metadata + test metrics).

import { NextResponse } from "next/server";
import { getModelInfo, mlServiceError } from "@/lib/ml-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const model = new URL(request.url).searchParams.get("model") ?? undefined;
  try {
    const info = await getModelInfo(model);
    return NextResponse.json(info);
  } catch (err) {
    return NextResponse.json({ error: mlServiceError(err) }, { status: 502 });
  }
}
