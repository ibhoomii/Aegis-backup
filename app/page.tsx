import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { Ticker } from "@/components/ticker";
import { Problem } from "@/components/problem";
import { Pipeline } from "@/components/pipeline";
import { Capabilities } from "@/components/capabilities";
import { IncidentGraph } from "@/components/incident-graph";
import { RiskScale } from "@/components/risk-scale";
import { DashboardPreview } from "@/components/dashboard-preview";
import { AttackScenario } from "@/components/attack-scenario";
import { Stack } from "@/components/stack";
import { Comparison } from "@/components/comparison";
import { CTA } from "@/components/cta";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <Ticker />
      <Problem />
      <Pipeline />
      <Capabilities />
      <IncidentGraph />
      <RiskScale />
      <DashboardPreview />
      <AttackScenario />
      <Stack />
      <Comparison />
      <CTA />
      <Footer />
    </main>
  );
}
