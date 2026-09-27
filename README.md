# AegisSOC — Frontend

A standalone Next.js marketing/product site for **AegisSOC**, an AI-powered
Security Operations Center concept. This is frontend only — no backend, no
database, no live data connections. Every number and log line on the page is
drawn from the project's own written spec (the dashboard mockup, the
WEB-SERVER-01 walkthrough, the MITRE mappings), not invented placeholder data.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. `npm run build && npm start` for a production
build.

Requires internet access on first build — headings/body/data type use Google
Fonts (Space Grotesk, Inter, IBM Plex Mono) loaded via `next/font/google`.

## Design system

- **Palette** — warm off-white `paper` (#F6F4EF) and near-black `void`
  (#0A0C0E) as the two surfaces, `ink` for text, and three semantic accents:
  `signal` (alarm red-orange, #E8471C) for critical/brand moments,
  `clearance` (#0E8F6B) for safe/verified states, `caution` (#DB9A1E) for
  medium/high risk. No purple, no gradients.
- **Type** — Space Grotesk (display headlines), Inter (body copy), IBM Plex
  Mono (labels, stats, log lines, badges) — the mono face is doing a lot of
  the "security console" personality work.
- **Layout motif** — hairline 1px borders, sharp corners, a light dot-grid
  backdrop in the hero, and structure that mirrors the product itself:
  timestamps instead of decorative step numbers, phase labels
  (Detect/Understand/Investigate/Act) instead of a generic feature grid.
- **Dark mode** — toggle in the navbar (`next-themes`, class strategy),
  defaults to light per the brief. All colors have a `dark:` counterpart.
- **Signature moment** — the hero visual: scattered raw alerts animate and
  funnel into one bordered incident card, which is the actual core pitch of
  the product ("don't just detect alerts — connect them").
- **Incident graph** — a second signature piece: an interactive SVG
  entity-relationship graph (IP → User → Server → Process/File → Network
  Connection, straight from the spec's own "Attack Graph" section). Hover or
  tap a node to trace its connected edges and see a detail readout; a small
  pulse travels each edge continuously (disabled under
  `prefers-reduced-motion`).
- **Motion polish** — a scroll progress bar, scrollspy nav with a shrink-on-
  scroll header, count-up stat numbers, animated radial risk gauges (SVG
  ring, not a plain badge), a subtle pointer-reactive tilt/glow on capability
  cards, and a barely-there grain overlay for surface texture. All of it
  respects `prefers-reduced-motion`.

## Structure

```
app/
  layout.tsx        Fonts, metadata, theme provider
  page.tsx           Assembles all sections
  globals.css        Tokens, focus states, reduced-motion, scrollbar
components/
  navbar.tsx, hero.tsx, ticker.tsx, problem.tsx, pipeline.tsx,
  capabilities.tsx, incident-graph.tsx, risk-scale.tsx, dashboard-preview.tsx,
  attack-scenario.tsx, stack.tsx, cta.tsx, footer.tsx
  theme-provider.tsx, theme-toggle.tsx, reveal.tsx, eyebrow.tsx, logo-mark.tsx
  count-up.tsx, radial-gauge.tsx, tilt-card.tsx, scroll-progress.tsx, grain.tsx
lib/
  content.ts          All copy/data in one place, sourced from the spec
```

## Notes for the next stage

- The "Request access" form in the CTA section is client-side only (no
  submit endpoint) — wire it to a real API route when the backend exists.
- `components/dashboard-preview.tsx` is a static mockup of the SOC dashboard
  described in the spec — swap the hardcoded arrays in `lib/content.ts` for
  live data once there's an API to call.
