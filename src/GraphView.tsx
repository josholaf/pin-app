import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

/** v0.1.31: the wiki-link graph as a live force-directed layout.
 *  Nodes repel each other, edges pull theirs together, and every node
 *  can be dragged with the mouse or touchpad — the graph keeps moving
 *  and settles around wherever you drop it. Click (without dragging)
 *  a node to open its note. */

export type GraphNode = { id: string; title: string; favorite: boolean; dimmed: boolean };
export type GraphEdge = { from: string; to: string };

const W = 320;
const H = 300;
const CX = W / 2;
const CY = H / 2;
const REPULSION = 1400;
const LINK_LENGTH = 80;
const SPRING = 0.02;
const PULL_TO_CENTER = 0.0025;
const DAMPING = 0.85;
const MAX_STEP = 6;

type Dot = { id: string; x: number; y: number; vx: number; vy: number; pinned: boolean };
type Drag = { id: string; x: number; y: number; moved: boolean };

export function GraphView(props: { nodes: GraphNode[]; edges: GraphEdge[]; onOpen: (id: string) => void }) {
  const dotsRef = useRef<Dot[]>([]);
  const dragRef = useRef<Drag | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [, setFrame] = useState(0);

  const nodesRef = useRef(props.nodes);
  nodesRef.current = props.nodes;
  const edgesRef = useRef(props.edges);
  edgesRef.current = props.edges;
  const openRef = useRef(props.onOpen);
  openRef.current = props.onOpen;

  // One simulation dot per note, seeded on a ring so the first frame has
  // no overlaps. New notes join the ring, deleted notes drop out.
  useEffect(() => {
    const kept = dotsRef.current.filter((d) => props.nodes.some((n) => n.id === d.id));
    const count = Math.max(props.nodes.length, 1);
    props.nodes.forEach((n, i) => {
      if (kept.some((d) => d.id === n.id)) return;
      const angle = (i / count) * Math.PI * 2;
      const radius = n.favorite ? 60 : 110;
      kept.push({ id: n.id, x: CX + radius * Math.cos(angle), y: CY + radius * Math.sin(angle), vx: 0, vy: 0, pinned: false });
    });
    dotsRef.current = kept;
  }, [props.nodes]);

  // Physics runs for the whole life of the view. While you drag, the
  // pulled node is pinned and the rest keep drifting; on release the
  // graph animates to its new settled shape.
  useEffect(() => {
    let raf = 0;
    const step = () => {
      const dots = dotsRef.current;
      const edges = edgesRef.current;

      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const a = dots[i], b = dots[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 0.01) { dx = 0.5; dy = 0.5; d2 = 0.5; }
          const d = Math.sqrt(d2);
          const f = REPULSION / d2;
          const fx = (dx / d) * f, fy = (dy / d) * f;
          a.vx -= fx; a.vy -= fy; b.vx += fx; b.vy += fy;
        }
      }

      const byId = new Map(dots.map((d) => [d.id, d]));
      const seen = new Set<string>();
      edges.forEach((e) => {
        const a = byId.get(e.from), b = byId.get(e.to);
        if (!a || !b) return;
        const key = e.from < e.to ? e.from + "|" + e.to : e.to + "|" + e.from;
        if (seen.has(key)) return;
        seen.add(key);
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
        const f = (d - LINK_LENGTH) * SPRING;
        const fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      });

      dots.forEach((p) => {
        p.vx += (CX - p.x) * PULL_TO_CENTER;
        p.vy += (CY - p.y) * PULL_TO_CENTER;
        if (p.pinned) { p.vx = 0; p.vy = 0; return; }
        p.vx *= DAMPING; p.vy *= DAMPING;
        p.x += Math.max(-MAX_STEP, Math.min(MAX_STEP, p.vx));
        p.y += Math.max(-MAX_STEP, Math.min(MAX_STEP, p.vy));
        p.x = Math.max(18, Math.min(W - 18, p.x));
        p.y = Math.max(18, Math.min(H - 18, p.y));
      });

      setFrame((f) => f + 1);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (props.nodes.length === 0) {
    return <p className="graph-empty">No notes yet. Create a note and link it with [[double brackets]] to build your graph.</p>;
  }

  const toSvgPoint = (e: ReactPointerEvent) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
  };

  const onNodeDown = (e: ReactPointerEvent, id: string) => {
    e.stopPropagation();
    const dot = dotsRef.current.find((d) => d.id === id);
    if (!dot) return;
    const p = toSvgPoint(e);
    dot.pinned = true;
    dot.x = p.x; dot.y = p.y; dot.vx = 0; dot.vy = 0;
    dragRef.current = { id, x: e.clientX, y: e.clientY, moved: false };
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dot = dotsRef.current.find((d) => d.id === drag.id);
    if (!dot) return;
    if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 4) drag.moved = true;
    const p = toSvgPoint(e);
    dot.x = p.x; dot.y = p.y; dot.vx = 0; dot.vy = 0;
  };

  const onPointerUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    const dot = dotsRef.current.find((d) => d.id === drag.id);
    if (dot) dot.pinned = false;
    if (!drag.moved) openRef.current(drag.id);
  };

  const nodeById = new Map(props.nodes.map((n) => [n.id, n]));
  const dotOf = new Map(dotsRef.current.map((d) => [d.id, d]));
  const anyDimmed = props.nodes.some((n) => n.dimmed);

  return (
    <svg
      ref={svgRef}
      viewBox={"0 0 " + W + " " + H}
      className="graph-svg"
      style={{ touchAction: "none" }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {props.edges.map((e, i) => {
        const a = dotOf.get(e.from);
        const b = dotOf.get(e.to);
        if (!a || !b) return null;
        const dim = anyDimmed && ((nodeById.get(e.from)?.dimmed ?? false) || (nodeById.get(e.to)?.dimmed ?? false));
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="graph-edge" style={{ opacity: dim ? 0.06 : 0.5 }} />;
      })}
      {props.nodes.map((n) => {
        const d = dotOf.get(n.id);
        if (!d) return null;
        return (
          <g
            key={n.id}
            className={"graph-node" + (n.dimmed ? " dimmed" : "") + (n.favorite ? " favorite" : "")}
            style={{ cursor: "grab" }}
            onPointerDown={(e) => onNodeDown(e, n.id)}
          >
            <circle cx={d.x} cy={d.y} r={n.favorite ? 9 : 7} className="graph-node-dot" />
            <text x={d.x} y={d.y + 18} textAnchor="middle" className="graph-node-label">{n.title.slice(0, 18)}</text>
          </g>
        );
      })}
    </svg>
  );
}
