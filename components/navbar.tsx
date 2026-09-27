"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X, ArrowUpRight, Terminal } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoMark } from "@/components/logo-mark";

const links = [
  { href: "#pipeline", label: "Pipeline", id: "pipeline" },
  { href: "#capabilities", label: "Capabilities", id: "capabilities" },
  { href: "#graph", label: "Graph", id: "graph" },
  { href: "#dashboard", label: "Dashboard", id: "dashboard" },
  { href: "#stack", label: "Stack", id: "stack" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sections = links
      .map((l) => document.getElementById(l.id))
      .filter((el): el is HTMLElement => Boolean(el));

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 border-b bg-paper/90 dark:bg-void/90 backdrop-blur transition-all duration-300 ${
        scrolled
          ? "border-line dark:border-line-dark shadow-[0_1px_12px_-4px_rgba(0,0,0,0.08)]"
          : "border-transparent"
      }`}
    >
      <div
        className={`mx-auto flex max-w-[1400px] items-center justify-between px-6 transition-all duration-300 lg:px-10 ${
          scrolled ? "h-14" : "h-16"
        }`}
      >
        <a href="#top" className="flex items-center gap-2.5">
          <LogoMark className="h-6 w-6 text-signal" />
          <span className="font-display text-[17px] font-700 tracking-tightest">
            Aegis<span className="text-signal">SOC</span>
          </span>
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`relative py-1.5 font-mono text-[11px] uppercase tracking-wideish transition-colors ${
                active === link.id
                  ? "text-signal"
                  : "text-ink-soft hover:text-signal dark:text-paper/70 dark:hover:text-signal"
              }`}
            >
              {link.label}
              <span
                className={`absolute -bottom-0.5 left-0 h-px bg-signal transition-all duration-300 ${
                  active === link.id ? "w-full" : "w-0"
                }`}
              />
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggle />
          <Link
            href="/start"
            className="hidden items-center gap-1.5 border border-line px-4 py-2 font-mono text-[11px] uppercase tracking-wideish text-ink-soft transition-colors hover:border-signal hover:text-signal dark:border-line-dark dark:text-paper/70 lg:inline-flex"
          >
            <Terminal size={13} />
            Launch console
          </Link>
          <a
            href="#request"
            className="group inline-flex items-center gap-1.5 border border-ink dark:border-paper bg-ink dark:bg-paper px-4 py-2 font-mono text-[11px] uppercase tracking-wideish text-paper dark:text-ink transition-colors hover:bg-signal hover:border-signal dark:hover:bg-signal dark:hover:border-signal dark:hover:text-paper"
          >
            Request access
            <ArrowUpRight
              size={13}
              className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </a>
        </div>

        <div className="flex items-center gap-3 md:hidden">
          <ThemeToggle />
          <button
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center border border-line dark:border-line-dark"
          >
            {open ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-line dark:border-line-dark bg-paper dark:bg-void md:hidden">
          <div className="flex flex-col gap-1 px-6 py-4">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="border-b border-line/70 dark:border-line-dark/70 py-3 font-mono text-xs uppercase tracking-wideish text-ink-soft dark:text-paper/70"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/start"
              onClick={() => setOpen(false)}
              className="mt-3 inline-flex items-center justify-center gap-1.5 border border-line px-4 py-2.5 font-mono text-[11px] uppercase tracking-wideish text-ink-soft dark:border-line-dark dark:text-paper/70"
            >
              <Terminal size={13} />
              Launch console
            </Link>
            <a
              href="#request"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex items-center justify-center gap-1.5 border border-ink dark:border-paper bg-ink dark:bg-paper px-4 py-2.5 font-mono text-[11px] uppercase tracking-wideish text-paper dark:text-ink"
            >
              Request access
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
