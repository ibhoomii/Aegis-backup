import { tickerItems } from "@/lib/content";

export function Ticker() {
  const items = [...tickerItems, ...tickerItems];

  return (
    <div className="overflow-hidden border-b border-line dark:border-line-dark bg-ink dark:bg-void-surface py-3">
      <div className="flex w-max animate-marquee gap-8">
        {items.map((item, i) => (
          <span
            key={item + i}
            className="flex items-center gap-8 font-mono text-[11px] uppercase tracking-wideish text-paper/60"
          >
            {item}
            <span className="text-signal">/</span>
          </span>
        ))}
      </div>
    </div>
  );
}
