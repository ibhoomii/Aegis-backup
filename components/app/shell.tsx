"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutGrid,
  Siren,
  Bot,
  Server,
  FileText,
  Bell,
  Search,
  Menu,
  X,
  ArrowLeft,
  ShieldCheck,
  Database,
  Upload,
  BrainCircuit,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoMark } from "@/components/logo-mark";
import { SeverityBadge } from "@/components/app/primitives";
import { useDataSource } from "@/components/app/data-source";
import type { Incident } from "@/lib/soc-data";

const nav = [
  {
    group: "Operations",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
      { href: "/incidents", label: "Incidents", icon: Siren },
      { href: "/analyst", label: "AI Analyst", icon: Bot },
      { href: "/ml", label: "ML Detection", icon: BrainCircuit },
    ],
  },
  {
    group: "Context",
    items: [
      { href: "/assets", label: "Assets & Risk", icon: Server },
      { href: "/reports", label: "Reports", icon: FileText },
    ],
  },
  {
    group: "Data",
    items: [{ href: "/connect", label: "Data Sources", icon: Database }],
  },
];

function countCriticalOpen(incidents: Incident[]) {
  return incidents.filter((i) => i.severity === "Critical" && i.status !== "Resolved").length;
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { dataset } = useDataSource();
  const criticalOpen = countCriticalOpen(dataset.incidents);
  return (
    <nav className="flex flex-col gap-6 px-3 py-5">
      {nav.map((section) => (
        <div key={section.group}>
          <div className="px-3 pb-2 font-mono text-[9.5px] uppercase tracking-widest2 text-ink-faint dark:text-paper/35">
            {section.group}
          </div>
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={`group flex items-center gap-3 border-l-2 px-3 py-2 font-mono text-[12.5px] transition-colors ${
                      active
                        ? "border-l-signal bg-signal-soft/60 text-signal dark:bg-signal/10"
                        : "border-l-transparent text-ink-soft hover:border-l-line hover:bg-paper-dim/60 dark:text-paper/60 dark:hover:border-l-line-dark dark:hover:bg-void-surface/60"
                    }`}
                  >
                    <Icon size={15} strokeWidth={1.9} className="flex-none" />
                    <span className="flex-1">{item.label}</span>
                    {item.href === "/incidents" && criticalOpen > 0 && (
                      <span className="flex h-4 min-w-4 items-center justify-center bg-signal px-1 font-mono text-[9.5px] text-paper">
                        {criticalOpen}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function SidebarFooter() {
  return (
    <div className="mt-auto border-t border-line dark:border-line-dark px-5 py-4">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-wideish text-ink-faint transition-colors hover:text-signal dark:text-paper/40"
      >
        <ArrowLeft size={12} /> Back to site
      </Link>
      <div className="mt-3 font-mono text-[10px] leading-relaxed text-ink-faint dark:text-paper/30">
        Designed by
        <br />
        <span className="text-ink-soft dark:text-paper/60">Akshit Suthar</span>
      </div>
    </div>
  );
}

// Compact indicator of which dataset is driving the console. Links to /start so
// the user can switch between the demo and their own data.
function SourceChip() {
  const { source, meta } = useDataSource();
  const isUser = source === "user";
  return (
    <Link
      href="/start"
      title="Switch data source"
      className="hidden items-center gap-1.5 border border-line px-2.5 py-1.5 font-mono text-[10.5px] uppercase tracking-wideish text-ink-soft transition-colors hover:border-signal hover:text-signal dark:border-line-dark dark:text-paper/60 sm:inline-flex"
    >
      {isUser ? (
        <Upload size={12} className="text-signal" />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-clearance" />
      )}
      {isUser ? "Your data" : "Demo"}
      {isUser && meta.fileCount ? (
        <span className="text-ink-faint dark:text-paper/35">· {meta.fileCount}</span>
      ) : null}
    </Link>
  );
}

function Clock() {
  // Real-time clock: ticks every second, shows local date/time with the
  // timezone label so analysts can tell UTC from their own clock at a glance.
  const [time, setTime] = useState<{ label: string; tz: string; date: string } | null>(null);
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const tz =
        Intl.DateTimeFormat("en", { timeZoneName: "short" })
          .formatToParts(now)
          .find((p) => p.type === "timeZoneName")?.value ?? "local";
      setTime({
        label: now.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        tz,
        date: now.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="hidden items-center gap-1.5 font-mono text-[11px] tabular-nums text-ink-faint dark:text-paper/40 sm:inline-flex">
      <span className="h-1.5 w-1.5 animate-blink rounded-full bg-clearance" />
      {time ? `${time.date} ${time.label} ${time.tz}` : "--:--:--"}
    </span>
  );
}

function Notifications() {
  const { dataset } = useDataSource();
  const { notifications, incidents } = dataset;
  const criticalOpen = countCriticalOpen(incidents);
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center border border-line text-ink transition-colors hover:border-signal dark:border-line-dark dark:text-paper"
      >
        <Bell size={15} strokeWidth={1.9} />
        {notifications.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center bg-signal px-1 font-mono text-[9px] text-paper">
            {notifications.length}
          </span>
        )}
      </button>
      {open && (
        <>
          <button
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 top-11 z-50 w-[320px] border border-line bg-paper shadow-[0_8px_30px_-12px_rgba(0,0,0,0.25)] dark:border-line-dark dark:bg-void-surface">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5 dark:border-line-dark">
              <span className="font-mono text-[10px] uppercase tracking-widest2 text-ink-faint dark:text-paper/50">
                Notifications
              </span>
              <span className="font-mono text-[10px] text-signal">
                {criticalOpen} critical
              </span>
            </div>
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center font-mono text-[10.5px] text-ink-faint dark:text-paper/40">
                No notifications.
              </div>
            ) : (
              <ul className="max-h-[320px] divide-y divide-line overflow-y-auto dark:divide-line-dark">
                {notifications.map((n) => (
                  <li key={n.title} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-[12.5px] font-500">
                        {n.title}
                      </span>
                      <SeverityBadge level={n.severity} />
                    </div>
                    <p className="mt-1 font-mono text-[10.5px] leading-relaxed text-ink-soft dark:text-paper/55">
                      {n.detail}
                    </p>
                    <span className="mt-1 block font-mono text-[9.5px] text-ink-faint dark:text-paper/35">
                      {n.time}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const { dataset } = useDataSource();

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-60 flex-col border-r border-line bg-paper dark:border-line-dark dark:bg-void lg:flex">
        <Link
          href="/dashboard"
          className="flex h-16 flex-none items-center gap-2.5 border-b border-line px-5 dark:border-line-dark"
        >
          <LogoMark className="h-6 w-6 text-signal" />
          <span className="font-display text-[16px] font-700 tracking-tightest">
            Aegis<span className="text-signal">SOC</span>
          </span>
          <span className="ml-1 border border-line px-1.5 py-0.5 font-mono text-[8.5px] uppercase tracking-wideish text-ink-faint dark:border-line-dark dark:text-paper/40">
            Console
          </span>
        </Link>
        <div className="flex flex-1 flex-col overflow-y-auto">
          <NavList />
          <SidebarFooter />
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close menu"
            onClick={() => setDrawer(false)}
            className="absolute inset-0 bg-void/40 backdrop-blur-sm"
          />
          <div className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-line bg-paper dark:border-line-dark dark:bg-void">
            <div className="flex h-16 flex-none items-center justify-between border-b border-line px-5 dark:border-line-dark">
              <span className="flex items-center gap-2.5">
                <LogoMark className="h-6 w-6 text-signal" />
                <span className="font-display text-[16px] font-700 tracking-tightest">
                  Aegis<span className="text-signal">SOC</span>
                </span>
              </span>
              <button aria-label="Close menu" onClick={() => setDrawer(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="flex flex-1 flex-col overflow-y-auto">
              <NavList onNavigate={() => setDrawer(false)} />
              <SidebarFooter />
            </div>
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-paper/85 px-4 backdrop-blur dark:border-line-dark dark:bg-void/85 lg:px-8">
          <button
            aria-label="Open menu"
            onClick={() => setDrawer(true)}
            className="flex h-9 w-9 items-center justify-center border border-line text-ink dark:border-line-dark dark:text-paper lg:hidden"
          >
            <Menu size={16} />
          </button>

          <div className="flex flex-1 items-center gap-2 border border-line px-3 py-2 text-ink-faint dark:border-line-dark dark:text-paper/40 sm:max-w-sm">
            <Search size={13} className="flex-none" />
            <span className="truncate font-mono text-[11px]">
              Search incidents, assets, IPs…
            </span>
            <kbd className="ml-auto hidden border border-line px-1 font-mono text-[9px] dark:border-line-dark sm:block">
              /
            </kbd>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <SourceChip />
            <Clock />
            <span className="hidden items-center gap-1.5 border border-line px-2.5 py-1.5 font-mono text-[10.5px] text-ink-soft dark:border-line-dark dark:text-paper/60 md:inline-flex">
              <ShieldCheck size={13} className="text-clearance" />
              {dataset.securityHealth.score}
              <span className="text-ink-faint dark:text-paper/35">/100</span>
            </span>
            <Notifications />
            <ThemeToggle />
          </div>
        </header>

        <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
