import type { Metadata } from "next";
import { AppShell } from "@/components/app/shell";
import { DataSourceProvider } from "@/components/app/data-source";

export const metadata: Metadata = {
  title: "AegisSOC Console",
  description:
    "The AegisSOC operations console — dashboard, incident workspace, and AI security analyst.",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <DataSourceProvider>
      <AppShell>{children}</AppShell>
    </DataSourceProvider>
  );
}
