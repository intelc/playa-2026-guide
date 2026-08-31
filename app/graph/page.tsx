"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, LocateFixed, Minus, Plus, Search, Sparkles, X } from "lucide-react";

type EventItem = { uid: string; title: string; description: string; category: string; tags: string[]; camp: string; where: string; link: string; times: string[] };
type Node = { id: string; kind: "event" | "tag"; label: string; category: string; event?: EventItem; x: number; y: number; vx: number; vy: number; radius: number; links: string[] };
type Camera = { x: number; y: number; scale: number };

const colors: Record<string, string> = { party: "#6856c4", art: "#e85a39", community: "#4f8292", "food-drink": "#d9962d", healing: "#57966d", movement: "#c56f35", performance: "#b15176", spiritual: "#755aa6", workshop: "#7b9d68", adult: "#a04a6f", other: "#87909a" };
const categories = ["all", ...Object.keys(colors)];
const cleanTag = (tag: string) => tag.replaceAll("_", " ").replaceAll("-", " ").trim();
const hash = (value: string) => { let h = 2166136261; for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619); return Math.abs(h); };

function buildGraph(events: EventItem[]) {
  const counts = new Map<string, number>();
  events.forEach((event) => event.tags.forEach((tag) => { const key = cleanTag(tag).toLowerCase(); if (key.length > 1) counts.set(key, (counts.get(key) || 0) + 1); }));
  const topTags = [...counts.entries()].filter(([, count]) => count >= 3).sort((a, b) => b[1] - a[1]).slice(0, 64);
  const allowed = new Set(topTags.map(([tag]) => tag));
  const nodes: Node[] = topTags.map(([tag, count], index) => {
    const angle = (index / Math.max(topTags.length, 1)) * Math.PI * 2;
    const ring = 280 + (index % 4) * 120;
    return { id: `tag:${tag}`, kind: "tag", label: tag, category: "tag", x: Math.cos(angle) * ring, y: Math.sin(angle) * ring, vx: 0, vy: 0, radius: 7 + Math.sqrt(count) * 1.2, links: [] };
  });
  const tagNodes = new Map(nodes.map((node) => [node.label, node]));
  events.forEach((event, index) => {
    const matching = [...new Set(event.tags.map((tag) => cleanTag(tag).toLowerCase()).filter((tag) => allowed.has(tag)))].slice(0, 3);
    const fallback = matching.length ? matching : [];
    const seed = hash(event.uid);
    const angle = ((seed % 10000) / 10000) * Math.PI * 2;
    const radius = 430 + (seed % 1250);
    const node: Node = { id: event.uid, kind: "event", label: event.title, category: colors[event.category] ? event.category : "other", event, x: Math.cos(angle) * radius + ((index % 7) - 3) * 8, y: Math.sin(angle) * radius + ((index % 11) - 5) * 8, vx: 0, vy: 0, radius: 3.2, links: fallback.map((tag) => `tag:${tag}`) };
    nodes.push(node);
    fallback.forEach((tag) => tagNodes.get(tag)?.links.push(node.id));
  });
  return nodes;
}

export default function EventGraphPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const cameraRef = useRef<Camera>({ x: 0, y: 0, scale: .42 });
  const pointerRef = useRef<{ x: number; y: number; node: Node | null; moved: boolean } | null>(null);
  const touchPointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ distance: number; x: number; y: number } | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<EventItem | null>(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const [cameraVersion, setCameraVersion] = useState(0);

  useEffect(() => { fetch("/api/events?lang=en").then((r) => r.json()).then((data) => { setEvents(data.events || []); nodesRef.current = buildGraph(data.events || []); setLoading(false); }).catch(() => setLoading(false)); }, []);
  const matches = useMemo(() => { const q = query.trim().toLowerCase(); return new Set(events.filter((event) => (category === "all" || event.category === category) && (!q || [event.title, event.description, event.camp, ...event.tags].join(" ").toLowerCase().includes(q))).map((event) => event.uid)); }, [events, query, category]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2); const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) { canvas.width = rect.width * dpr; canvas.height = rect.height * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, rect.width, rect.height);
    const cam = cameraRef.current; const sx = (x: number) => rect.width / 2 + (x + cam.x) * cam.scale; const sy = (y: number) => rect.height / 2 + (y + cam.y) * cam.scale;
    const visible = (node: Node) => node.kind === "tag" || matches.has(node.id); const map = new Map(nodesRef.current.map((node) => [node.id, node]));
    ctx.lineWidth = .55; ctx.globalAlpha = .16;
    nodesRef.current.forEach((node) => { if (node.kind !== "event" || !visible(node)) return; node.links.forEach((id) => { const target = map.get(id); if (!target) return; ctx.strokeStyle = colors[node.category] || colors.other; ctx.beginPath(); ctx.moveTo(sx(node.x), sy(node.y)); ctx.lineTo(sx(target.x), sy(target.y)); ctx.stroke(); }); });
    ctx.globalAlpha = 1;
    nodesRef.current.forEach((node) => { if (!visible(node)) return; const x = sx(node.x), y = sy(node.y), r = Math.max(node.kind === "tag" ? 7 : 2.2, node.radius * Math.sqrt(cam.scale)); if (x < -30 || y < -30 || x > rect.width + 30 || y > rect.height + 30) return; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = node.kind === "tag" ? "#171713" : colors[node.category] || colors.other; ctx.fill(); if (node.kind === "tag" && cam.scale > .28) { ctx.font = `700 ${Math.max(10, 11 * Math.sqrt(cam.scale))}px ui-monospace, monospace`; ctx.fillStyle = "#171713"; ctx.fillText(`#${node.label}`, x + r + 5, y + 4); } });
  }, [matches, cameraVersion]);

  useEffect(() => { draw(); setVisibleCount(matches.size); }, [draw, matches]);
  useEffect(() => { const onResize = () => draw(); window.addEventListener("resize", onResize); return () => window.removeEventListener("resize", onResize); }, [draw]);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      cameraRef.current.scale = Math.max(.12, Math.min(2.4, cameraRef.current.scale * (event.deltaY > 0 ? .88 : 1.14)));
      setCameraVersion((version) => version + 1);
    };
    const preventGesture = (event: Event) => event.preventDefault();
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("gesturestart", preventGesture, { passive: false });
    canvas.addEventListener("gesturechange", preventGesture, { passive: false });
    return () => {
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("gesturestart", preventGesture);
      canvas.removeEventListener("gesturechange", preventGesture);
    };
  }, []);
  const screenToWorld = (clientX: number, clientY: number) => { const rect = canvasRef.current!.getBoundingClientRect(); const cam = cameraRef.current; return { x: (clientX - rect.left - rect.width / 2) / cam.scale - cam.x, y: (clientY - rect.top - rect.height / 2) / cam.scale - cam.y }; };
  const hitNode = (clientX: number, clientY: number) => { const p = screenToWorld(clientX, clientY); let best: Node | null = null, distance = Infinity; nodesRef.current.forEach((node) => { if (node.kind === "event" && !matches.has(node.id)) return; const d = Math.hypot(node.x - p.x, node.y - p.y); const range = Math.max(node.radius, 9 / cameraRef.current.scale); if (d < range && d < distance) { best = node; distance = d; } }); return best; };
  const zoom = (factor: number) => { cameraRef.current.scale = Math.max(.12, Math.min(2.4, cameraRef.current.scale * factor)); setCameraVersion((v) => v + 1); };
  const reset = () => { cameraRef.current = { x: 0, y: 0, scale: .42 }; setCameraVersion((v) => v + 1); };

  return <main className="graph-page">
    <header className="graph-header">
      <a href="/" className="graph-back"><ArrowLeft /> <span>PLAYA / 2026</span></a>
      <div className="graph-title"><Sparkles /><div><strong>EVENT CONSTELLATION</strong><small>Connections in the dust</small></div></div>
      <div className="graph-stats"><strong>{loading ? "—" : visibleCount.toLocaleString()}</strong><span>events visible</span></div>
    </header>
    <section className="graph-workspace">
      <aside className="graph-controls">
        <div><p className="graph-eyebrow">KNOWLEDGE GRAPH</p><h1>Follow the<br/><em>connections.</em></h1><p>Every dot is an event. Shared topics pull them into constellations. Drag the field, zoom in, and pick a node to explore.</p></div>
        <label className="graph-search"><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events, camps, tags…" />{query && <button onClick={() => setQuery("")} aria-label="Clear search"><X /></button>}</label>
        <div className="graph-categories" aria-label="Filter by category">{categories.map((key) => <button key={key} className={category === key ? "active" : ""} onClick={() => setCategory(key)}>{key === "all" ? "All topics" : key.replace("-", " ")}</button>)}</div>
        <div className="graph-legend"><span><i className="legend-event" /> Event</span><span><i className="legend-tag" /> Shared tag</span><small>Drag a node to move it · Scroll to zoom</small></div>
      </aside>
      <div className="graph-canvas-wrap">
        {loading && <div className="graph-loading"><span />Mapping the playa…</div>}
        {!loading && events.length === 0 && <div className="graph-loading">The constellation couldn’t be loaded.</div>}
        <canvas ref={canvasRef} aria-label="Interactive graph of Playa 2026 events connected by shared tags"
          onPointerDown={(e) => {
            if (e.pointerType === "touch") {
              touchPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
              if (touchPointersRef.current.size === 2) {
                const [a, b] = [...touchPointersRef.current.values()];
                pinchRef.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                pointerRef.current = null;
              }
            }
            if (touchPointersRef.current.size < 2) { const node = hitNode(e.clientX, e.clientY); pointerRef.current = { x: e.clientX, y: e.clientY, node, moved: false }; }
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (e.pointerType === "touch" && touchPointersRef.current.has(e.pointerId)) {
              touchPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
              if (touchPointersRef.current.size === 2) {
                const [a, b] = [...touchPointersRef.current.values()]; const nextDistance = Math.hypot(a.x - b.x, a.y - b.y); const nextX = (a.x + b.x) / 2, nextY = (a.y + b.y) / 2; const pinch = pinchRef.current;
                if (pinch && pinch.distance > 0) { cameraRef.current.scale = Math.max(.12, Math.min(2.4, cameraRef.current.scale * (nextDistance / pinch.distance))); cameraRef.current.x += (nextX - pinch.x) / cameraRef.current.scale; cameraRef.current.y += (nextY - pinch.y) / cameraRef.current.scale; }
                pinchRef.current = { distance: nextDistance, x: nextX, y: nextY }; setCameraVersion((v) => v + 1); return;
              }
            }
            const p = pointerRef.current; if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; if (Math.abs(dx) + Math.abs(dy) > 2) p.moved = true; if (p.node) { p.node.x += dx / cameraRef.current.scale; p.node.y += dy / cameraRef.current.scale; } else { cameraRef.current.x += dx / cameraRef.current.scale; cameraRef.current.y += dy / cameraRef.current.scale; } p.x = e.clientX; p.y = e.clientY; setCameraVersion((v) => v + 1);
          }}
          onPointerUp={(e) => {
            touchPointersRef.current.delete(e.pointerId); if (touchPointersRef.current.size < 2) pinchRef.current = null;
            const p = pointerRef.current; if (p && !p.moved && p.node?.event) setSelected(p.node.event); pointerRef.current = null; e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          onPointerCancel={(e) => { touchPointersRef.current.delete(e.pointerId); pointerRef.current = null; pinchRef.current = null; }} />
        <div className="graph-zoom"><button onClick={() => zoom(1.25)} aria-label="Zoom in"><Plus /></button><button onClick={() => zoom(.8)} aria-label="Zoom out"><Minus /></button><button onClick={reset} aria-label="Reset view"><LocateFixed /></button></div>
        <div className="graph-tip"><span>CLICK + DRAG</span> to wander the graph</div>
      </div>
      {selected && <aside className="graph-detail" style={{ "--detail-color": colors[selected.category] || colors.other } as React.CSSProperties}>
        <button className="graph-detail-close" onClick={() => setSelected(null)} aria-label="Close event"><X /></button>
        <p>{selected.category.replace("-", " ")} · EVENT NODE</p><h2>{selected.title}</h2>
        <div className="graph-detail-tags">{selected.tags.slice(0, 8).map((tag) => <button key={tag} onClick={() => setQuery(cleanTag(tag))}>#{cleanTag(tag)}</button>)}</div>
        <dl><div><dt>WHEN</dt><dd>{selected.times.filter((time) => time && time !== "-").slice(0, 3).join(" · ") || "See source"}</dd></div><div><dt>WHERE</dt><dd>{selected.where || selected.camp || "On playa"}</dd></div></dl>
        {selected.description && <p className="graph-detail-copy">{selected.description}</p>}
        {selected.link && <a href={selected.link} target="_blank" rel="noreferrer">Open event details <ExternalLink /></a>}
      </aside>}
    </section>
  </main>;
}
