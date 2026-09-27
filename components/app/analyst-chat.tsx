"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot, User, ArrowRight, CornerDownLeft, Sparkles } from "lucide-react";
import { useDataset } from "@/components/app/data-source";
import { buildDatasetDigest, askAi } from "@/lib/ai/digest";
import type { AnalystTurn } from "@/lib/soc-data";

type Message =
  | { role: "user"; text: string }
  | { role: "assistant"; turn: AnalystTurn; via?: "ai" | "script" };

const normalize = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

// Score a scripted turn against the question by token overlap across its
// question, answer, bullets, incident ref, and sources. Works for both the
// demo script and a script generated from a user's own logs.
function scoreTurn(turn: AnalystTurn, q: string): number {
  const hay = normalize(
    `${turn.q ?? ""} ${turn.a} ${(turn.bullets ?? []).join(" ")} ${turn.incidentRef ?? ""} ${(turn.sources ?? []).join(" ")}`
  );
  const tokens = q.split(" ").filter((t) => t.length >= 3);
  let score = 0;
  for (const t of tokens) if (hay.includes(t)) score += 1;
  return score;
}

function findAnswer(input: string, script: AnalystTurn[], fallback: AnalystTurn): AnalystTurn {
  const q = normalize(input);
  if (!q || script.length === 0) return fallback;

  const exact = script.find((t) => t.q && normalize(t.q) === q);
  if (exact) return exact;

  const partial = script.find((t) => {
    const nq = normalize(t.q ?? "");
    return nq !== "" && (nq.includes(q) || q.includes(nq));
  });
  if (partial) return partial;

  let best: AnalystTurn | null = null;
  let bestScore = 0;
  for (const t of script) {
    const s = scoreTurn(t, q);
    if (s > bestScore) {
      bestScore = s;
      best = t;
    }
  }
  if (best && bestScore >= 1) return best;
  return fallback;
}

export function AnalystChat() {
  const dataset = useDataset();
  const { script, suggestions, fallback } = dataset.analyst;

  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", turn: fallback },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset the transcript when the active dataset changes (demo ↔ your data).
  useEffect(() => {
    setMessages([{ role: "assistant", turn: fallback }]);
  }, [fallback]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  function ask(text: string) {
    const q = text.trim();
    if (!q || thinking) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // AI-first: ask Gemini with the current dataset as grounding; fall back
    // to the deterministic scripted matcher when AI is unavailable or fails.
    setThinking(true);
    const history = messages
      .slice(-6)
      .map((m) =>
        m.role === "user"
          ? { role: "user" as const, text: m.text }
          : { role: "assistant" as const, text: m.turn.a },
      );

    askAi<{ answer: string; bullets?: string[]; sources?: string[]; confidence?: number }>(
      "chat",
      { question: q, history, datasetDigest: buildDatasetDigest(dataset) },
    )
      .then((ai) => {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            via: "ai",
            turn: {
              a: ai.answer,
              bullets: ai.bullets,
              sources: ai.sources,
              confidence: ai.confidence,
            },
          },
        ]);
      })
      .catch(() => {
        const answer = findAnswer(q, script, fallback);
        setMessages((m) => [...m, { role: "assistant", via: "script", turn: answer }]);
      })
      .finally(() => setThinking(false));

    if (reduce) return; // skip the fake thinking delay in reduced-motion mode
  }

  return (
    <div className="flex h-[calc(100vh-13rem)] min-h-[520px] flex-col border border-line bg-paper dark:border-line-dark dark:bg-void">
      {/* transcript */}
      <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto p-5">
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="flex max-w-[80%] items-start gap-2.5">
                <div className="border border-ink bg-ink px-3.5 py-2.5 font-mono text-[12px] leading-relaxed text-paper dark:border-paper/20 dark:bg-void-surface dark:text-paper">
                  {m.text}
                </div>
                <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center border border-line text-ink-faint dark:border-line-dark dark:text-paper/50">
                  <User size={12} />
                </span>
              </div>
            </div>
          ) : (
            <div key={i} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center border border-signal/40 bg-signal-soft text-signal dark:bg-signal/10">
                <Bot size={12} />
              </span>
              <div className="max-w-[85%] space-y-3">
                <p className="font-body text-[13.5px] leading-relaxed text-ink dark:text-paper/85">
                  {m.turn.a}
                </p>
                {m.turn.bullets && (
                  <div className="space-y-1.5">
                    {m.turn.bullets.map((b) => (
                      <div key={b} className="flex items-start gap-2.5">
                        <span className="mt-1.5 h-1 w-1 flex-none bg-signal" />
                        <span className="font-mono text-[11px] leading-relaxed text-ink-soft dark:text-paper/65">{b}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {m.via === "ai" && (
                    <span className="inline-flex items-center gap-1 border border-clearance/50 bg-clearance-soft px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wideish text-clearance dark:bg-clearance/10">
                      <Sparkles size={9} /> Gemini
                    </span>
                  )}
                  {m.via === "script" && (
                    <span className="inline-flex items-center gap-1 border border-line px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wideish text-ink-faint dark:border-line-dark dark:text-paper/40">
                      scripted
                    </span>
                  )}
                  {typeof m.turn.confidence === "number" && (
                    <span className="inline-flex items-center gap-1 border border-clearance/50 bg-clearance-soft px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wideish text-clearance dark:bg-clearance/10">
                      {m.turn.confidence}% confidence
                    </span>
                  )}
                  {m.turn.incidentRef && (
                    <Link
                      href={`/incidents/${m.turn.incidentRef}`}
                      className="inline-flex items-center gap-1 border border-signal/50 px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wideish text-signal transition-colors hover:bg-signal-soft dark:hover:bg-signal/10"
                    >
                      Open #{m.turn.incidentRef} <ArrowRight size={10} />
                    </Link>
                  )}
                </div>
                {m.turn.sources && (
                  <div className="flex flex-wrap items-center gap-1.5 border-t border-line pt-2.5 dark:border-line-dark">
                    <span className="font-mono text-[8.5px] uppercase tracking-widest2 text-ink-faint dark:text-paper/35">
                      Retrieved from
                    </span>
                    {m.turn.sources.map((s) => (
                      <span key={s} className="border border-line px-1.5 py-0.5 font-mono text-[9px] text-ink-soft dark:border-line-dark dark:text-paper/55">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        )}

        {thinking && (
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 flex-none items-center justify-center border border-signal/40 bg-signal-soft text-signal dark:bg-signal/10">
              <Bot size={12} />
            </span>
            <div className="flex items-center gap-1 px-1 py-2">
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  className="h-1.5 w-1.5 animate-blink rounded-full bg-ink-faint dark:bg-paper/40"
                  style={{ animationDelay: `${d * 0.18}s` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* suggestions */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-line px-4 pt-3 dark:border-line-dark">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              className="inline-flex items-center gap-1 border border-line px-2 py-1 font-mono text-[10px] text-ink-soft transition-colors hover:border-signal hover:text-signal dark:border-line-dark dark:text-paper/60"
            >
              <Sparkles size={10} className="text-signal" /> {s}
            </button>
          ))}
        </div>
      )}

      {/* input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="flex items-center gap-3 p-4"
      >
        <div className="flex flex-1 items-center gap-2 border border-line px-3 py-2.5 focus-within:border-signal dark:border-line-dark">
          <Bot size={14} className="flex-none text-ink-faint dark:text-paper/40" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about an incident, asset, IP, or technique…"
            className="w-full bg-transparent font-mono text-[12px] text-ink outline-none placeholder:text-ink-faint dark:text-paper dark:placeholder:text-paper/40"
          />
          <kbd className="hidden items-center gap-1 border border-line px-1.5 py-0.5 font-mono text-[9px] text-ink-faint dark:border-line-dark dark:text-paper/40 sm:flex">
            <CornerDownLeft size={9} /> send
          </kbd>
        </div>
        <button
          type="submit"
          disabled={!input.trim() || thinking}
          className="inline-flex items-center gap-1.5 border border-signal bg-signal px-4 py-2.5 font-mono text-[11px] uppercase tracking-wideish text-paper transition-opacity disabled:opacity-40"
        >
          Ask <ArrowRight size={13} />
        </button>
      </form>
    </div>
  );
}
