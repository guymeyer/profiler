"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

// Small force-directed graph. No graph library — Verlet-style simulation
// at ~30 fps for a few hundred nodes, rendered to SVG so clicks and
// hovers compose with the rest of the app naturally.
//
// Node kinds + edge kinds are renderer-defined so the page can colour
// and label them however it wants.

export interface GraphNode {
  id: string;
  label: string;
  kind: string;
  href?: string;
  // Optional rendering hint; computed from degree if absent.
  size?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  kind?: string;
}

interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  degree: number;
}

interface SimEdge {
  source: SimNode;
  target: SimNode;
  kind?: string;
}

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  // Map of kind → CSS-color (or any valid SVG fill).
  colorByKind: Record<string, string>;
  // Optional dim filter — nodes matching this predicate get reduced opacity.
  // Used by the page's search box without re-running the simulation.
  isDimmed?: (n: GraphNode) => boolean;
  className?: string;
}

const WIDTH = 1200;
const HEIGHT = 720;
const REPULSION = 1200;
const SPRING_K = 0.02;
const SPRING_REST = 80;
const CENTER_K = 0.005;
const DAMPING = 0.85;
const MAX_TICKS = 360;

export function ForceGraph({
  nodes,
  edges,
  colorByKind,
  isDimmed,
  className,
}: Props) {
  const router = useRouter();
  const [, forceRerender] = useState(0);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const simNodes = useRef<SimNode[]>([]);
  const simEdges = useRef<SimEdge[]>([]);
  const rafRef = useRef<number | null>(null);
  const ticksLeft = useRef(0);

  // Re-seed the simulation whenever the input set changes.
  const dataKey = useMemo(
    () => `${nodes.length}-${edges.length}-${nodes.map((n) => n.id).join("|")}`,
    [nodes, edges],
  );

  useEffect(() => {
    const byId = new Map<string, SimNode>();
    for (const n of nodes) {
      byId.set(n.id, {
        ...n,
        x: WIDTH / 2 + (Math.random() - 0.5) * WIDTH * 0.6,
        y: HEIGHT / 2 + (Math.random() - 0.5) * HEIGHT * 0.6,
        vx: 0,
        vy: 0,
        degree: 0,
      });
    }
    const edgeList: SimEdge[] = [];
    for (const e of edges) {
      const s = byId.get(e.source);
      const t = byId.get(e.target);
      if (!s || !t) continue;
      s.degree += 1;
      t.degree += 1;
      edgeList.push({ source: s, target: t, kind: e.kind });
    }
    simNodes.current = Array.from(byId.values());
    simEdges.current = edgeList;
    ticksLeft.current = MAX_TICKS;

    function step() {
      if (ticksLeft.current <= 0) {
        rafRef.current = null;
        return;
      }
      ticksLeft.current -= 1;
      tick(simNodes.current, simEdges.current);
      forceRerender((v) => v + 1);
      rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [dataKey, edges, nodes]);

  // Highlight the hovered node + its neighbors.
  const neighborSet = useMemo(() => {
    if (!hoverId) return null;
    const s = new Set<string>([hoverId]);
    for (const e of simEdges.current) {
      if (e.source.id === hoverId) s.add(e.target.id);
      if (e.target.id === hoverId) s.add(e.source.id);
    }
    return s;
  }, [hoverId]);

  return (
    <svg
      className={cn("w-full h-auto select-none", className)}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label="Document graph"
    >
      <rect width={WIDTH} height={HEIGHT} fill="transparent" />
      {/* Edges */}
      <g>
        {simEdges.current.map((e, i) => {
          const dim =
            (neighborSet && !neighborSet.has(e.source.id) && !neighborSet.has(e.target.id)) ||
            (isDimmed?.(e.source) && isDimmed?.(e.target));
          return (
            <line
              key={i}
              x1={e.source.x}
              y1={e.source.y}
              x2={e.target.x}
              y2={e.target.y}
              stroke="currentColor"
              strokeOpacity={dim ? 0.06 : 0.22}
              strokeWidth={1}
            />
          );
        })}
      </g>
      {/* Nodes */}
      <g>
        {simNodes.current.map((n) => {
          const r = Math.min(18, 6 + Math.sqrt(n.degree) * 2.5);
          const fill = colorByKind[n.kind] ?? "var(--muted)";
          const dim =
            (neighborSet && !neighborSet.has(n.id)) || isDimmed?.(n);
          const active = hoverId === n.id;
          return (
            <g
              key={n.id}
              transform={`translate(${n.x}, ${n.y})`}
              opacity={dim ? 0.25 : 1}
              style={{ cursor: n.href ? "pointer" : "default" }}
              onMouseEnter={() => setHoverId(n.id)}
              onMouseLeave={() =>
                setHoverId((id) => (id === n.id ? null : id))
              }
              onClick={() => {
                if (n.href) router.push(n.href);
              }}
            >
              <circle
                r={r}
                fill={fill}
                stroke="var(--background)"
                strokeWidth={1.5}
              />
              {(active || r > 11) && (
                <text
                  x={r + 4}
                  y={4}
                  fontSize={11}
                  fill="var(--foreground)"
                  style={{ pointerEvents: "none" }}
                >
                  {n.label.length > 36
                    ? n.label.slice(0, 33) + "…"
                    : n.label}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

// One simulation tick. Mutates `nodes` in place.
function tick(nodes: SimNode[], edges: SimEdge[]) {
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;

  // Repulsion — O(N²). Fine for a few hundred nodes.
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist2 = Math.max(dx * dx + dy * dy, 1);
      const dist = Math.sqrt(dist2);
      const force = REPULSION / dist2;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }
  }

  // Springs along edges.
  for (const e of edges) {
    const dx = e.target.x - e.source.x;
    const dy = e.target.y - e.source.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const k = SPRING_K * (dist - SPRING_REST);
    const fx = (dx / dist) * k;
    const fy = (dy / dist) * k;
    e.source.vx += fx;
    e.source.vy += fy;
    e.target.vx -= fx;
    e.target.vy -= fy;
  }

  // Weak pull toward the center to keep the graph on-screen.
  for (const n of nodes) {
    n.vx += (cx - n.x) * CENTER_K;
    n.vy += (cy - n.y) * CENTER_K;
    n.vx *= DAMPING;
    n.vy *= DAMPING;
    n.x += n.vx;
    n.y += n.vy;
    // Clamp to canvas with a small margin.
    n.x = Math.max(20, Math.min(WIDTH - 20, n.x));
    n.y = Math.max(20, Math.min(HEIGHT - 20, n.y));
  }
}
