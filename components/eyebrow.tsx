export function Eyebrow({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "signal";
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`h-1.5 w-1.5 ${
          tone === "signal" ? "bg-signal" : "bg-ink dark:bg-paper"
        }`}
      />
      <span className="font-mono text-[11px] uppercase tracking-widest2 text-ink-soft dark:text-paper/60">
        {children}
      </span>
    </div>
  );
}
