import { incidentGraphNodes, incidentGraphEdges, type GraphNodeId } from "@/lib/content";

// Static entity-relationship graph of the WEB-SERVER-01 compromise (§18).
// Pure SVG so it renders on the server and matches the site's other visuals.
const nodeTone: Record<GraphNodeId, "signal" | "caution" | "ink"> = {
  ip: "signal",
  user: "caution",
  server: "signal",
  process: "caution",
  file: "caution",
  network: "ink",
};

const toneStroke: Record<string, string> = {
  signal: "stroke-signal",
  caution: "stroke-caution",
  ink: "stroke-ink/40 dark:stroke-paper/30",
};
const toneText: Record<string, string> = {
  signal: "fill-signal",
  caution: "fill-caution",
  ink: "fill-ink-soft dark:fill-paper/70",
};

const NODE_W = 150;
const NODE_H = 46;

export function AttackGraph() {
  const byId = Object.fromEntries(incidentGraphNodes.map((n) => [n.id, n]));

  return (
    <svg viewBox="60 10 520 470" className="w-full" role="img" aria-label="Incident entity graph">
      {/* edges */}
      {incidentGraphEdges.map((e, i) => {
        const from = byId[e.from];
        const to = byId[e.to];
        return (
          <line
            key={i}
            x1={from.x}
            y1={from.y + NODE_H / 2}
            x2={to.x}
            y2={to.y - NODE_H / 2}
            className="stroke-line dark:stroke-line-dark"
            strokeWidth={1.5}
          />
        );
      })}

      {/* nodes */}
      {incidentGraphNodes.map((n) => {
        const tone = nodeTone[n.id];
        return (
          <g key={n.id}>
            <rect
              x={n.x - NODE_W / 2}
              y={n.y - NODE_H / 2}
              width={NODE_W}
              height={NODE_H}
              className={`fill-paper dark:fill-void ${toneStroke[tone]}`}
              strokeWidth={1.4}
            />
            <text
              x={n.x}
              y={n.y - 4}
              textAnchor="middle"
              className={`font-mono ${toneText[tone]}`}
              style={{ fontSize: 11, fontWeight: 600 }}
            >
              {n.label}
            </text>
            <text
              x={n.x}
              y={n.y + 11}
              textAnchor="middle"
              className="fill-ink-faint font-mono dark:fill-paper/40"
              style={{ fontSize: 8 }}
            >
              {n.id === "ip"
                ? "185.203.116.42"
                : n.id === "server"
                ? "WEB-SERVER-01"
                : n.id === "user"
                ? "unknown device"
                : n.id === "process"
                ? "priv command"
                : n.id === "file"
                ? "/etc/shadow"
                : "outbound"}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
