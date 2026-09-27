"use client";

import { PageHeader } from "@/components/app/primitives";
import { IncidentQueue } from "@/components/app/incident-queue";
import { useDataset } from "@/components/app/data-source";
import { usePageTitle } from "@/lib/use-page-title";

export default function IncidentsPage() {
  usePageTitle("Incidents — AegisSOC");
  const { incidents } = useDataset();
  const criticalOpen = incidents.filter(
    (i) => i.severity === "Critical" && i.status !== "Resolved"
  ).length;
  const investigating = incidents.filter((i) => i.status === "Investigating").length;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Operations" title="Incident Queue">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 border border-signal/50 bg-signal-soft px-3 py-1.5 font-mono text-[11px] text-signal dark:bg-signal/10">
            <span className="h-1.5 w-1.5 rounded-full bg-signal" />
            {criticalOpen} critical open
          </span>
          <span className="inline-flex items-center gap-2 border border-line px-3 py-1.5 font-mono text-[11px] text-ink-soft dark:border-line-dark dark:text-paper/60">
            {investigating} investigating
          </span>
        </div>
      </PageHeader>

      <IncidentQueue />
    </div>
  );
}
