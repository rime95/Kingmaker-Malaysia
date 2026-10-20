"use client";

// The real map of Malaysia: 222 parliamentary seats (and the 600 state seats when you zoom in), with smooth
// wheel / pinch / drag zoom, fly-to, labels that appear as you zoom, and markers that stay the same size on screen.
// One component for the main screen, Election Night and the States panel.

import { memo, useEffect, useRef, useState } from "react";
import { select } from "d3-selection";
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import "d3-transition";
import { DUNS } from "@/game/systems/dun";
import { SEATS, STATES } from "@/game/world";
import { MAP_H, MAP_W, useMapGeometry, type MapGeometry, type Shape } from "./geo";
import type { SeatFill } from "./lenses";

export interface MapMarker {
  key: string;
  seat: number;
  kind: "bubble" | "pulse";
  icon: string;
  label?: string;
  color?: string;
  onClick?: () => void;
}

export type MapFocus = { kind: "seat"; index: number; nonce: number } | { kind: "state"; id: string; nonce: number } | { kind: "reset"; nonce: number } | null;

interface Props {
  /** One fill per parliamentary seat (index = SEATS index). */
  fills: SeatFill[];
  /** One fill per state seat, when state seats are coloured (States panel); otherwise they show as outlines. */
  dunFills?: (string | null)[] | null;
  /** State seats: shown when zoomed in ("auto"), always, or never. */
  showDuns?: "auto" | "always" | "never";
  selected?: number | null;
  selectedDun?: number | null;
  onSelect?: (seat: number) => void;
  onSelectDun?: (dun: number) => void;
  onHover?: (seat: number | null, x: number, y: number) => void;
  onHoverDun?: (dun: number | null, x: number, y: number) => void;
  focus?: MapFocus;
  markers?: MapMarker[];
  /** Text that floats up from a seat (e.g. after claiming a bubble); a new id replays it. */
  floater?: { id: number; seat: number; text: string } | null;
  /** Screen space (px) taken by floating UI; "show all" frames Malaysia inside what is left. */
  safeArea?: { top: number; right: number; bottom: number; left: number };
  /** Hide zoom buttons (e.g. small embedded maps). */
  controls?: boolean;
  className?: string;
  ariaLabel?: string;
}

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 40;
const DUN_ZOOM = 6;

export function MalaysiaMap(props: Props) {
  const { geo, error } = useMapGeometry();
  if (error) return <div className="map-empty">Couldn&apos;t load the map ({error}). Check your connection and reload.</div>;
  if (!geo) return <div className="map-empty">Loading the map…</div>;
  return <MapView geo={geo} {...props} />;
}

function MapView({ geo, fills, dunFills, showDuns = "auto", selected, selectedDun, onSelect, onSelectDun, onHover, onHoverDun, focus, markers, floater, safeArea, controls = true, className, ariaLabel }: Props & { geo: MapGeometry }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const [pxPerUnit, setPxPerUnit] = useState(1);
  const safeRef = useRef(safeArea);
  useEffect(() => {
    safeRef.current = safeArea;
  }, [safeArea]);

  /** The "whole country" view: Malaysia fitted inside the screen area not covered by floating UI. */
  const home = () => {
    const svg = svgRef.current;
    const area = safeRef.current;
    if (!svg || !area) return zoomIdentity;
    const r = svg.getBoundingClientRect();
    const sc = Math.min(r.width / MAP_W, r.height / MAP_H) || 1;
    const ox = (r.width - MAP_W * sc) / 2;
    const oy = (r.height - MAP_H * sc) / 2;
    const x0 = (area.left - ox) / sc;
    const x1 = (r.width - area.right - ox) / sc;
    const y0 = (area.top - oy) / sc;
    const y1 = (r.height - area.bottom - oy) / sc;
    const k = Math.max(MIN_ZOOM, Math.min((x1 - x0) / (MAP_W - 40), (y1 - y0) / (MAP_H - 40)));
    return zoomIdentity.translate(x0 + (x1 - x0 - k * (MAP_W - 40)) / 2 - k * 20, y0 + (y1 - y0 - k * (MAP_H - 40)) / 2 - k * 20).scale(k);
  };

  // Zoom and pan. The transform is applied straight to the DOM; React only hears about it once per frame (for labels).
  useEffect(() => {
    const svg = svgRef.current!;
    let frame = 0;
    const z = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([MIN_ZOOM, MAX_ZOOM])
      .translateExtent([
        [-MAP_W * 0.25, -MAP_H * 0.25],
        [MAP_W * 1.25, MAP_H * 1.25],
      ])
      .clickDistance(5)
      .on("zoom", (e) => {
        gRef.current?.setAttribute("transform", e.transform.toString());
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => setView({ k: e.transform.k, x: e.transform.x, y: e.transform.y }));
      });
    zoomRef.current = z;
    select(svg).call(z);
    const measure = () => {
      const r = svg.getBoundingClientRect();
      setPxPerUnit(Math.min(r.width / MAP_W, r.height / MAP_H) || 1);
    };
    measure();
    select(svg).call(z.transform, home());
    const ro = new ResizeObserver(measure);
    ro.observe(svg);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame);
      select(svg).on(".zoom", null);
    };
  }, []);

  // Fly to a seat or state when asked.
  useEffect(() => {
    if (!focus || !zoomRef.current || !svgRef.current) return;
    const sel = select(svgRef.current).transition().duration(750);
    if (focus.kind === "reset") {
      sel.call(zoomRef.current.transform, home());
      return;
    }
    const shape = focus.kind === "seat" ? geo.seats[focus.index] : geo.states[focus.id];
    if (!shape?.d) return;
    const [[x0, y0], [x1, y1]] = shape.bounds;
    const k = Math.max(1, Math.min(focus.kind === "seat" ? 10 : 8, 0.7 / Math.max((x1 - x0) / MAP_W, (y1 - y0) / MAP_H)));
    const t = zoomIdentity.translate(MAP_W / 2 - (k * (x0 + x1)) / 2, MAP_H / 2 - (k * (y0 + y1)) / 2).scale(k);
    sel.call(zoomRef.current.transform, t);
  }, [focus, geo]);

  const k = view.k;
  const dunsOn = showDuns === "always" || (showDuns === "auto" && k >= DUN_ZOOM);
  // The visible part of the map, in drawing units, to skip labels that are off screen.
  const vis = { x0: -view.x / k, y0: -view.y / k, x1: (MAP_W - view.x) / k, y1: (MAP_H - view.y) / k };
  const onScreen = (s: Shape) => s.cx >= vis.x0 && s.cx <= vis.x1 && s.cy >= vis.y0 && s.cy <= vis.y1;
  const screenWidth = (s: Shape) => (s.bounds[1][0] - s.bounds[0][0]) * k * pxPerUnit;
  const font = 12 / (k * pxPerUnit);

  const zoomBy = (f: number) => svgRef.current && zoomRef.current && select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, f);

  return (
    <div className={className ?? "relative"}>
      <svg ref={svgRef} viewBox={`0 0 ${MAP_W} ${MAP_H}`} preserveAspectRatio="xMidYMid meet" className="w-full h-full block touch-none select-none" style={{ overflow: "visible" }} role="img" aria-label={ariaLabel ?? "Map of Malaysia's parliamentary seats"}>
        <defs>
          <filter id="seat-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect x={-MAP_W} y={-MAP_H} width={MAP_W * 3} height={MAP_H * 3} fill="transparent" />
        <g ref={gRef}>
          <SeatsLayer geo={geo} fills={fills} onSelect={onSelect} onHover={onHover} interactive={!(dunsOn && dunFills)} />
          {dunsOn && <DunsLayer geo={geo} fills={dunFills ?? null} onSelect={onSelectDun} onHover={onHoverDun} />}
          <path d={geo.seatBorders} className="map-seat-line" />
          <path d={geo.stateBorders} className="map-state-halo" />
          <path d={geo.stateBorders} className="map-state-line" />
          {fills.map((f, i) => (f.flipped && geo.seats[i].d ? <path key={i} d={geo.seats[i].d} className="map-flip" /> : null))}
          {selected != null && geo.seats[selected]?.d && <path d={geo.seats[selected].d} className="map-selected" filter="url(#seat-glow)" />}
          {selectedDun != null && geo.duns[selectedDun]?.d && <path d={geo.duns[selectedDun].d} className="map-selected" />}

          {/* Labels: states when zoomed out, seats as you zoom in, state seats when they show */}
          {k < 3
            ? STATES.map((s) => {
                const sh = geo.states[s.id];
                return sh && screenWidth(sh) > 70 ? (
                  <text key={s.id} x={sh.cx} y={sh.cy} className="map-label map-label-state" style={{ fontSize: font * 1.05, strokeWidth: font * 0.3 }}>
                    {s.name}
                  </text>
                ) : null;
              })
            : (dunsOn ? DUNS.map((d, i) => ({ s: geo.duns[i], name: d.name, key: `d${i}` })) : SEATS.map((s, i) => ({ s: geo.seats[i], name: s.name, key: `p${i}` })))
                .filter(({ s }) => s.d && onScreen(s) && screenWidth(s) > 48)
                .map(({ s, name, key }) => (
                  <text key={key} x={s.cx} y={s.cy} className="map-label" style={{ fontSize: font, strokeWidth: font * 0.3 }}>
                    {name}
                  </text>
                ))}

          {markers?.map((m) => {
            const s = geo.seats[m.seat];
            if (!s?.d) return null;
            return (
              <g key={m.key} transform={`translate(${s.cx},${s.cy}) scale(${1 / (k * pxPerUnit)})`} className={m.kind === "bubble" ? "map-bubble" : "map-pulse"} onClick={(e) => (e.stopPropagation(), m.onClick?.())}>
                {m.kind === "pulse" && <circle r={14} className="map-pulse-ring" style={{ stroke: m.color }} />}
                {m.kind === "bubble" && <circle r={17} className="map-bubble-ring" />}
                <circle r={m.kind === "bubble" ? 13 : 6} style={{ fill: m.color ?? "var(--accent)" }} />
                <text y={4.5} textAnchor="middle" className="map-bubble-icon">
                  {m.icon}
                </text>
                {m.label && (
                  <text y={-22} textAnchor="middle" className="map-bubble-label">
                    {m.label}
                  </text>
                )}
              </g>
            );
          })}
          {floater && geo.seats[floater.seat]?.d && (
            <g key={floater.id} transform={`translate(${geo.seats[floater.seat].cx},${geo.seats[floater.seat].cy}) scale(${1 / (k * pxPerUnit)})`} pointerEvents="none">
              <text y={-26} textAnchor="middle" className="map-float">
                {floater.text}
              </text>
            </g>
          )}
        </g>
      </svg>
      {controls && (
        <div className="map-controls" role="group" aria-label="Zoom">
          <button onClick={() => zoomBy(1.8)} aria-label="Zoom in">
            +
          </button>
          <button onClick={() => zoomBy(1 / 1.8)} aria-label="Zoom out">
            −
          </button>
          <button onClick={() => svgRef.current && zoomRef.current && select(svgRef.current).transition().duration(500).call(zoomRef.current.transform, home())} aria-label="Show all of Malaysia" title="Show all of Malaysia">
            ⌂
          </button>
        </div>
      )}
    </div>
  );
}

const SeatsLayer = memo(function SeatsLayer({
  geo,
  fills,
  onSelect,
  onHover,
  interactive,
}: {
  geo: MapGeometry;
  fills: SeatFill[];
  onSelect?: (i: number) => void;
  onHover?: (i: number | null, x: number, y: number) => void;
  interactive: boolean;
}) {
  return (
    <g>
      {geo.seats.map((s, i) =>
        s.d ? (
          <path
            key={i}
            d={s.d}
            fill={fills[i]?.fill ?? "var(--land)"}
            fillOpacity={fills[i]?.opacity ?? 1}
            className={interactive ? "map-seat" : undefined}
            pointerEvents={interactive ? undefined : "none"}
            onClick={onSelect ? () => onSelect(i) : undefined}
            onMouseMove={onHover ? (e) => onHover(i, e.clientX, e.clientY) : undefined}
            onMouseLeave={onHover ? () => onHover(null, 0, 0) : undefined}
          />
        ) : null,
      )}
    </g>
  );
});

const DunsLayer = memo(function DunsLayer({
  geo,
  fills,
  onSelect,
  onHover,
}: {
  geo: MapGeometry;
  fills: (string | null)[] | null;
  onSelect?: (i: number) => void;
  onHover?: (i: number | null, x: number, y: number) => void;
}) {
  return (
    <g>
      {geo.duns.map((s, i) =>
        s.d ? (
          <path
            key={i}
            d={s.d}
            fill={fills?.[i] ?? "none"}
            className={fills ? "map-dun map-dun-filled" : "map-dun"}
            pointerEvents={fills ? undefined : "none"}
            onClick={fills && onSelect ? () => onSelect(i) : undefined}
            onMouseMove={fills && onHover ? (e) => onHover(i, e.clientX, e.clientY) : undefined}
            onMouseLeave={fills && onHover ? () => onHover(null, 0, 0) : undefined}
          />
        ) : null,
      )}
    </g>
  );
});

