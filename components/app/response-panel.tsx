"use client";

import { useState } from "react";
import { Check, ShieldAlert, Lock, Zap } from "lucide-react";
import type { ResponseAction, Severity } from "@/lib/soc-data";

type ActionState = "idle" | "approved" | "executed";

const impactTone: Record<Severity, string> = {
  Critical: "text-signal",
  High: "text-signal",
  Medium: "text-caution",
  Low: "text-clearance",
};

export function ResponsePanel({ actions }: { actions: ResponseAction[] }) {
  const [states, setStates] = useState<Record<number, ActionState>>(() =>
    Object.fromEntries(actions.map((a, i) => [i, a.done ? "executed" : "idle"]))
  );

  const set = (i: number, s: ActionState) => setStates((prev) => ({ ...prev, [i]: s }));

  const executed = Object.values(states).filter((s) => s === "executed").length;

  if (actions.length === 0) {
    return (
      <p className="font-mono text-[10.5px] leading-relaxed text-ink-faint dark:text-paper/40">
        No response playbook was generated for this incident.
      </p>
    );
  }

  return (
    <div>
      <div className="space-y-2">
        {actions.map((a, i) => {
          const state = states[i];
          return (
            <div
              key={a.action}
              className={`flex items-center gap-3 border px-3 py-2.5 transition-colors ${
                state === "executed"
                  ? "border-clearance/40 bg-clearance-soft/50 dark:bg-clearance/5"
                  : state === "approved"
                  ? "border-signal/40 bg-signal-soft/50 dark:bg-signal/5"
                  : "border-line dark:border-line-dark"
              }`}
            >
              <span
                className={`flex h-6 w-6 flex-none items-center justify-center border ${
                  state === "executed"
                    ? "border-clearance/40 text-clearance"
                    : "border-line text-ink-faint dark:border-line-dark dark:text-paper/40"
                }`}
              >
                {state === "executed" ? <Check size={13} /> : a.requiresApproval ? <Lock size={12} /> : <Zap size={12} />}
              </span>

              <div className="min-w-0 flex-1">
                <div className="font-mono text-[11.5px] text-ink dark:text-paper/85">{a.action}</div>
                <div className="mt-0.5 flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-wideish text-ink-faint dark:text-paper/40">
                  <span className={impactTone[a.impact]}>{a.impact} impact</span>
                  <span>·</span>
                  <span>{a.requiresApproval ? "approval required" : "auto"}</span>
                </div>
              </div>

              <div className="flex-none">
                {state === "executed" ? (
                  <span className="font-mono text-[10px] uppercase tracking-wideish text-clearance">Executed</span>
                ) : state === "approved" ? (
                  <button
                    onClick={() => set(i, "executed")}
                    className="border border-signal bg-signal px-2.5 py-1 font-mono text-[10px] uppercase tracking-wideish text-paper transition-transform hover:translate-x-0.5"
                  >
                    Execute
                  </button>
                ) : (
                  <button
                    onClick={() => set(i, "approved")}
                    className="border border-line px-2.5 py-1 font-mono text-[10px] uppercase tracking-wideish text-ink-soft transition-colors hover:border-signal hover:text-signal dark:border-line-dark dark:text-paper/60"
                  >
                    Approve
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-line pt-3 dark:border-line-dark">
        <ShieldAlert size={12} className="flex-none text-caution" />
        <p className="font-mono text-[9.5px] leading-relaxed text-ink-faint dark:text-paper/40">
          {executed}/{actions.length} actions executed. Human approval gates every
          production-touching action — nothing is dispatched in this concept build.
        </p>
      </div>
    </div>
  );
}
