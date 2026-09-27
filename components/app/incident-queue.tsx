"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { SeverityBadge, StatusBadge, riskTone } from "@/components/app/primitives";
import { useDataset } from "@/components/app/data-source";
import type { Severity, IncidentStatus } from "@/lib/soc-data";

const severityFilters: (Severity | "All")[] = ["All", "Critical", "High", "Medium", "Low"];
const statusFilters: (IncidentStatus | "All")[] = [
  "All",
  "Investigating",
  "Open",
  "Contained",
  "Monitoring",
  "Resolved",
];

export function IncidentQueue() {
  const { incidents } = useDataset();
  const [severity, setSeverity] = useState<Severity | "All">("All");
  const [status, setStatus] = useState<IncidentStatus | "All">("All");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return incidents
      .filter((i) => (severity === "All" ? true : i.severity === severity))
      .filter((i) => (status === "All" ? true : i.status === status))
      .filter((i) =>
        q === ""
          ? true
          : [i.id, i.title, i.asset, i.assignee, ...i.mitre]
              .join(" ")
              .toLowerCase()
              .includes(q)
      )
      .sort((a, b) => b.risk - a.risk);
  }, [incidents, severity, status, query]);

  return (
    <div className="space-y-5">
      {/* controls */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {severityFilters.map((s) => (
            <button
              key={s}
              onClick={() => setSeverity(s)}
              className={`border px-2.5 py-1.5 font-mono text-[10.5px] uppercase tracking-wideish transition-colors ${
                severity === s
                  ? "border-signal bg-signal text-paper"
                  : "border-line text-ink-soft hover:border-signal hover:text-signal dark:border-line-dark dark:text-paper/60"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex flex-1 items-center gap-2 border border-line px-3 py-2 text-ink-faint focus-within:border-signal dark:border-line-dark dark:text-paper/40 lg:max-w-xs">
          <Search size={13} className="flex-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by title, asset, IP, technique…"
            className="w-full bg-transparent font-mono text-[11px] text-ink outline-none placeholder:text-ink-faint dark:text-paper dark:placeholder:text-paper/40"
          />
        </div>
      </div>

      {/* status row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-line py-2.5 dark:border-line-dark">
        {statusFilters.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`font-mono text-[10.5px] uppercase tracking-wideish transition-colors ${
              status === s
                ? "text-signal"
                : "text-ink-faint hover:text-ink-soft dark:text-paper/40 dark:hover:text-paper/70"
            }`}
          >
            {s}
          </button>
        ))}
        <span className="ml-auto font-mono text-[10.5px] text-ink-faint dark:text-paper/40">
          {rows.length} of {incidents.length} incidents
        </span>
      </div>

      {/* table */}
      <div className="overflow-x-auto border border-line dark:border-line-dark">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-line bg-paper-dim/50 text-left dark:border-line-dark dark:bg-void-surface/40">
              {["ID", "Incident", "Asset", "Risk", "Severity", "Status", "MITRE", "Assignee", ""].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2.5 font-mono text-[9.5px] uppercase tracking-wideish text-ink-faint dark:text-paper/40"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line dark:divide-line-dark">
            {rows.map((i) => (
              <tr
                key={i.id}
                className="group bg-paper transition-colors hover:bg-paper-dim/60 dark:bg-void dark:hover:bg-void-surface/50"
              >
                <td className="px-4 py-3 font-mono text-[11px] text-ink-faint dark:text-paper/40">#{i.id}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/incidents/${i.id}`}
                    className="font-display text-[13px] font-500 transition-colors group-hover:text-signal"
                  >
                    {i.title}
                  </Link>
                  <div className="mt-0.5 font-mono text-[9.5px] text-ink-faint dark:text-paper/35">
                    opened {i.opened}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-[11px] text-ink-soft dark:text-paper/60">{i.asset}</td>
                <td className={`px-4 py-3 font-mono text-[12px] font-600 tabular-nums ${riskTone(i.risk)}`}>{i.risk}</td>
                <td className="px-4 py-3"><SeverityBadge level={i.severity} /></td>
                <td className="px-4 py-3"><StatusBadge status={i.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {i.mitre.map((m) => (
                      <span
                        key={m}
                        className="border border-line px-1 py-0.5 font-mono text-[9px] text-ink-soft dark:border-line-dark dark:text-paper/50"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-[10.5px] text-ink-soft dark:text-paper/55">
                  {i.assignee}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/incidents/${i.id}`}
                    aria-label={`Open incident ${i.id}`}
                    className="text-ink-faint transition-colors group-hover:text-signal dark:text-paper/40"
                  >
                    <ArrowUpRight size={14} />
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-14 text-center font-mono text-[11px] text-ink-faint dark:text-paper/40">
                  {incidents.length === 0
                    ? "No incidents detected in this source."
                    : "No incidents match these filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
