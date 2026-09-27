import { LogoMark } from "@/components/logo-mark";

export function Footer() {
  return (
    <footer className="bg-paper dark:bg-void">
      <div className="mx-auto max-w-[1400px] px-6 py-10 lg:px-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-5 w-5 text-ink-faint dark:text-paper/40" />
            <span className="font-mono text-[11px] uppercase tracking-wideish text-ink-faint dark:text-paper/40">
              AegisSOC &mdash; AI-Powered Security Operations Center
            </span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-wideish text-ink-faint dark:text-paper/40">
            <span>Rules + ML</span>
            <span>MITRE ATT&amp;CK</span>
            <span>Human-approved response</span>
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-4 border-t border-line dark:border-line-dark pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl font-mono text-[10.5px] text-ink-faint dark:text-paper/30">
            Designed as a project concept. Log analysis runs entirely in your
            browser; recommended response actions are not executed.
          </p>
          <p className="flex-none font-mono text-[10.5px] uppercase tracking-wideish text-ink-faint dark:text-paper/40">
            Designed by{" "}
            <span className="text-signal">Akshit Suthar</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
