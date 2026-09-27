"use client";

// Dashboard "ML Anomaly Detection" section: live model health for both
// detectors, plus the ML screening summary when the console is running on
// user-uploaded logs.

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrainCircuit, ArrowRight } from "lucide-react";
import { Panel } from "@/components/app/primitives";
import type { MlModelInfo } from "@/lib/ml-service";

type ModelHealth = {
  name: string;
  loaded: boolean;
  roc?: number;
  precision?: number;
  recall?: number;
  dataset?: string;
};

function useModelHealth(model: string, enabled: boolean): ModelHealth | null {
  const [state, setState] = useState<ModelHealth | null>(
    model === "nslkdd" ? { name: model, loaded: false } : null,
  );
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    fetch(`/api/ml/info?model=${model}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((info: MlModelInfo) => {
        if (!alive) return;
        setState({
          name: model,
          loaded: true,
          roc: info.test_metrics.roc_auc,
          precision: info.test_metrics.precision,
          recall: info.test_metrics.recall,
          dataset: info.dataset,
        });
      })
      .catch(() => {
        if (alive && model === "nslkdd") setState({ name: model, loaded: false });
      });
    return () => {
      alive = false;
    };
  }, [model, enabled]);
  return state;
}

export function DashboardMlSection() {
  const nslkdd = useModelHealth("nslkdd", true);
  const cicids = useModelHealth("cicids", true);

  const models = [nslkdd, cicids];

  return (
    <Panel
      label="ML anomaly detection — live engines"
      right={
        <Link
          href="/ml"
          className="inline-flex items-center gap-1 font-mono text-[10px] text-signal transition-transform hover:translate-x-0.5"
        >
          Open ML Detection <ArrowRight size={11} />
        </Link>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {models.map((m) => (
          <div key={m?.name ?? "pending"} className="border border-line p-3.5 dark:border-line-dark">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink dark:text-paper/85">
                <BrainCircuit size={13} className={m?.loaded ? "text-clearance" : "text-ink-faint dark:text-paper/40"} />
                {m?.name === "cicids" ? "Flow model" : "Event model"}
              </span>
              <span
                className={`font-mono text-[9px] uppercase tracking-wideish ${
                  m?.loaded ? "text-clearance" : "text-ink-faint dark:text-paper/40"
                }`}
              >
                {m ? (m.loaded ? "online" : "offline") : "…"}
              </span>
            </div>
            <div className="mt-2.5 grid grid-cols-3 gap-2">
              {[
                ["ROC-AUC", m?.roc],
                ["Precision", m?.precision],
                ["Recall", m?.recall],
              ].map(([label, v]) => (
                <div key={label as string}>
                  <div className="font-mono text-[8.5px] uppercase tracking-wideish text-ink-faint dark:text-paper/40">
                    {label}
                  </div>
                  <div className="mt-0.5 font-mono text-[13px] font-600 tabular-nums text-ink dark:text-paper/85">
                    {typeof v === "number" ? `${(v * 100).toFixed(1)}%` : "—"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 font-mono text-[9.5px] leading-relaxed text-ink-faint dark:text-paper/35">
        Both engines are semi-supervised Isolation Forests trained on real intrusion data
        (NSL-KDD connection records · CICIDS2017 network flows) — they score events without ever
        seeing a labelled attack during training. Service offline? Start it from
        aegis_ml/aegissoc-ml (activate .venv) with: uvicorn app:app --port 8000.
      </p>
    </Panel>
  );
}
