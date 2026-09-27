"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Database, PlayCircle, ShieldCheck, Upload, Link2, Lock } from "lucide-react";
import { LogoMark } from "@/components/logo-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { setSourcePreference } from "@/components/app/data-source";
import { usePageTitle } from "@/lib/use-page-title";

export default function StartPage() {
  usePageTitle("Choose your data — AegisSOC");
  const router = useRouter();

  function exploreDemo() {
    setSourcePreference("demo");
    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper dark:bg-void">
      {/* header */}
      <header className="border-b border-line dark:border-line-dark">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6 lg:px-10">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark className="h-6 w-6 text-signal" />
            <span className="font-display text-[17px] font-700 tracking-tightest">
              Aegis<span className="text-signal">SOC</span>
            </span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* choice */}
      <main className="relative flex-1 bg-grid">
        <div className="mx-auto flex max-w-[1100px] flex-col px-6 py-16 lg:px-10 lg:py-24">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 border border-line px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest2 text-ink-faint dark:border-line-dark dark:text-paper/40">
              <span className="h-1 w-1 animate-blink bg-signal" />
              Choose your data source
            </span>
            <h1 className="mt-5 font-display text-4xl font-700 leading-[1.05] tracking-tighter text-balance sm:text-5xl">
              Two ways into the console.
            </h1>
            <p className="mt-4 max-w-xl font-body text-[15px] leading-relaxed text-ink-soft dark:text-paper/70">
              Walk through a fully populated sample environment, or feed the
              console your own logs and let it do the analysis. Both open the
              same workspace — dashboard, incidents, AI analyst, assets, and
              reports.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {/* Demo card */}
            <button
              onClick={exploreDemo}
              className="group flex flex-col border border-line bg-paper p-6 text-left transition-colors hover:border-signal dark:border-line-dark dark:bg-void-surface"
            >
              <span className="flex h-10 w-10 items-center justify-center border border-line text-ink dark:border-line-dark dark:text-paper">
                <PlayCircle size={18} />
              </span>
              <h2 className="mt-5 font-display text-xl font-700 tracking-tight">
                Explore the demo
              </h2>
              <p className="mt-2 flex-1 font-body text-[13.5px] leading-relaxed text-ink-soft dark:text-paper/65">
                A spec-derived sample SOC — the WEB-SERVER-01 compromise scenario,
                a full incident queue, threat intel, and a working AI analyst.
                Nothing to upload.
              </p>
              <ul className="mt-4 space-y-1.5">
                {["8 live incidents", "Explainable risk scoring", "MITRE ATT&CK mapping"].map((f) => (
                  <li key={f} className="flex items-center gap-2 font-mono text-[11px] text-ink-soft dark:text-paper/60">
                    <span className="h-1 w-1 flex-none bg-clearance" /> {f}
                  </li>
                ))}
              </ul>
              <span className="mt-6 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wideish text-ink transition-colors group-hover:text-signal dark:text-paper">
                Open the demo
                <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>

            {/* Your data card */}
            <Link
              href="/connect"
              className="group relative flex flex-col border border-ink bg-ink p-6 text-left text-paper transition-colors hover:border-signal hover:bg-signal dark:border-paper/30 dark:bg-void-raised"
            >
              <span className="flex h-10 w-10 items-center justify-center border border-paper/30 text-paper">
                <Upload size={18} />
              </span>
              <h2 className="mt-5 font-display text-xl font-700 tracking-tight">
                Use your own data
              </h2>
              <p className="mt-2 flex-1 font-body text-[13.5px] leading-relaxed text-paper/75">
                Upload log files or connect a URL. The console parses your events,
                detects incidents, scores risk, and rebuilds every view around
                your data.
              </p>
              <ul className="mt-4 space-y-1.5">
                {[
                  { icon: Database, t: ".log / .txt / .json / .csv" },
                  { icon: Link2, t: "Connect a raw-log URL" },
                  { icon: Lock, t: "Analyzed in your browser" },
                ].map(({ icon: Icon, t }) => (
                  <li key={t} className="flex items-center gap-2 font-mono text-[11px] text-paper/70">
                    <Icon size={12} className="flex-none text-paper/50" /> {t}
                  </li>
                ))}
              </ul>
              <span className="mt-6 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wideish text-paper">
                Upload or connect
                <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </div>

          <p className="mt-10 flex items-center gap-2 font-mono text-[11px] text-ink-faint dark:text-paper/40">
            <ShieldCheck size={13} className="text-clearance" />
            Uploaded logs are analyzed locally in your browser — nothing is sent
            to a server, except a URL you explicitly ask us to fetch.
          </p>
        </div>
      </main>

      {/* footer credit */}
      <footer className="border-t border-line dark:border-line-dark">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-6 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <span className="font-mono text-[10.5px] uppercase tracking-wideish text-ink-faint dark:text-paper/40">
            AegisSOC — AI-Powered Security Operations Center
          </span>
          <span className="font-mono text-[10.5px] uppercase tracking-wideish text-ink-faint dark:text-paper/40">
            Designed by <span className="text-signal">Akshit Suthar</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
