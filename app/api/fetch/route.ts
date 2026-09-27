// URL-connect proxy.
//
// The browser can't fetch arbitrary log URLs directly (CORS), so /connect posts
// the URL here and we fetch it server-side, returning the raw text for the same
// client-side parse+analyze path used for uploads.
//
// Security note: this is a local college-project app, so the proxy is
// deliberately permissive — it will fetch any http/https URL the user pastes,
// including internal addresses (an SSRF trade-off). It is NOT hardened for a
// public deployment; a real one would allow-list hosts and block private/link-
// local ranges. Guards here are limited to scheme, a request timeout, and a
// response-size cap.

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const TIMEOUT_MS = 10_000;
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export async function POST(request: Request) {
  let url: string;
  try {
    const body = (await request.json()) as { url?: unknown };
    if (typeof body.url !== "string" || !body.url.trim()) {
      return NextResponse.json({ error: "Provide a { url } string." }, { status: 400 });
    }
    url = body.url.trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "That doesn't look like a valid URL." }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "Only http and https URLs are supported." }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: { Accept: "text/plain, application/json, text/*;q=0.9, */*;q=0.5" },
    });

    // Stream with a hard size cap so a huge/endless response can't exhaust memory.
    const reader = res.body?.getReader();
    let received = 0;
    const chunks: Uint8Array[] = [];
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          received += value.byteLength;
          if (received > MAX_BYTES) {
            await reader.cancel();
            return NextResponse.json(
              { error: `Response exceeds the ${MAX_BYTES / (1024 * 1024)} MB limit.` },
              { status: 413 },
            );
          }
          chunks.push(value);
        }
      }
    }

    const text = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf-8");
    return NextResponse.json({
      text,
      contentType: res.headers.get("content-type") ?? "",
      status: res.status,
    });
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return NextResponse.json(
      { error: aborted ? "The request timed out after 10s." : "Could not reach that URL." },
      { status: aborted ? 504 : 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
