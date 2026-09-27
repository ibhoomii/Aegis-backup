"use client";

import { useState, type FormEvent } from "react";
import { ArrowUpRight } from "lucide-react";
import { Eyebrow } from "@/components/eyebrow";
import { Reveal } from "@/components/reveal";

export function CTA() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitted(true);
  }

  return (
    <section id="request" className="relative overflow-hidden border-b border-line dark:border-line-dark bg-ink dark:bg-void-surface">
      <div className="bg-grid absolute inset-0 opacity-[0.06]" />
      <div className="relative mx-auto max-w-[1400px] px-6 py-20 lg:px-10 lg:py-28">
        <Reveal className="mx-auto max-w-2xl text-center">
          <div className="flex justify-center">
            <span className="font-mono text-[11px] uppercase tracking-widest2 text-signal">
              Get access
            </span>
          </div>
          <h2 className="mt-5 font-display text-4xl font-700 leading-[1.05] tracking-tighter text-balance text-paper sm:text-5xl">
            Give your analysts an
            <br />
            eighth teammate that never sleeps.
          </h2>
          <p className="mt-6 font-body text-[15px] leading-relaxed text-paper/60">
            AegisSOC is in active development. Leave your email and
            we&rsquo;ll reach out when the lab environment opens up.
          </p>

          {submitted ? (
            <div className="mx-auto mt-8 max-w-sm border border-clearance/40 bg-clearance/10 px-5 py-4 font-mono text-[12.5px] text-clearance">
              Request received &mdash; we&rsquo;ll be in touch.
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="mx-auto mt-8 flex max-w-sm flex-col gap-3 sm:flex-row"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                aria-label="Email address"
                className="w-full flex-1 border border-paper/20 bg-transparent px-4 py-3 font-mono text-[13px] text-paper placeholder:text-paper/35 focus:border-signal"
              />
              <button
                type="submit"
                className="group inline-flex flex-none items-center justify-center gap-1.5 bg-signal px-5 py-3 font-mono text-xs uppercase tracking-wideish text-paper transition-colors hover:bg-signal-dim"
              >
                Request access
                <ArrowUpRight
                  size={14}
                  className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </button>
            </form>
          )}
        </Reveal>
      </div>
    </section>
  );
}
