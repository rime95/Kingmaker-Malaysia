"use client";

import { useMemo, useState } from "react";
import { useGame } from "@/store/gameStore";
import { COALITION_INFO, MAJORITY, SEATS, STATE_BY_ID, TOTAL_SEATS, type CoalitionId } from "@/game/world";
import { coalColor } from "./common";

/** Left-to-right in the hemicycle: opposition first, the leading government party at the far right. */
const HEMI_ORDER: CoalitionId[] = ["PN", "MUDA", "WARISAN", "OTHERS", "GRS", "GPS", "BN", "PH"];
/** Front bench first on each side of the chamber. */
const GOV_ORDER: CoalitionId[] = ["PH", "BN", "GPS", "GRS", "OTHERS"];
const OPP_ORDER: CoalitionId[] = ["PN", "WARISAN", "MUDA"];

type Layout = "hemicycle" | "benches";
interface Geo {
  dots: Dot[];
  size: number;
  w: number;
  h: number;
  aisleY?: number;
  left?: number;
}
interface Dot {
  seatIndex: number;
  x: number;
  y: number;
}

function hemicycle(order: number[]): Geo {
  const rows = 8;
  const r0 = 0.38;
  const radii = Array.from({ length: rows }, (_, k) => r0 + ((1 - r0) * k) / (rows - 1));
  const sum = radii.reduce((a, b) => a + b, 0);
  const counts = radii.map((r) => Math.round((TOTAL_SEATS * r) / sum));
  counts[rows - 1] += TOTAL_SEATS - counts.reduce((a, b) => a + b, 0);
  const pos: { a: number; r: number }[] = [];
  radii.forEach((r, k) => {
    const n = counts[k];
    for (let j = 0; j < n; j++) pos.push({ a: Math.PI - (j * Math.PI) / (n - 1), r });
  });
  pos.sort((p, q) => q.a - p.a || p.r - q.r);
  const R = 300;
  const dots = order.map((seatIndex, i) => ({
    seatIndex,
    x: R + 14 + pos[i].r * R * Math.cos(pos[i].a),
    y: R + 14 - pos[i].r * R * Math.sin(pos[i].a),
  }));
  return { dots, size: 7.5, w: 2 * R + 28, h: R + 40 };
}

/**
 * The chamber seen from above with the Speaker on the left, facing along the aisle.
 * The Speaker's right is the bottom of the picture, so the government sits below the aisle.
 * Seats fill one column (across all bench rows) at a time, so each party forms a block along the benches.
 */
function benches(gov: number[], opp: number[]): Geo & { aisleY: number; left: number } {
  const rows = 7;
  const step = 18;
  const left = 110;
  const top = 34;
  const aisle = 40;
  const aisleY = top + rows * step + aisle / 2;
  const place = (list: number[], side: -1 | 1) =>
    list.map((seatIndex, i) => ({
      seatIndex,
      x: left + Math.floor(i / rows) * step + step / 2,
      y: aisleY + side * (aisle / 2 + (i % rows) * step + step / 2),
    }));
  const len = Math.ceil(Math.max(gov.length, opp.length) / rows);
  return { dots: [...place(gov, 1), ...place(opp, -1)], size: 7, w: left + len * step + 16, h: aisleY * 2 - 4, aisleY, left };
}

export function Dewan() {
  const { game, selected, select } = useGame();
  const [layout, setLayout] = useState<Layout>("hemicycle");
  const [source, setSource] = useState<"now" | "result">("now");
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);

  const result = game?.lastElection;
  const useResult = source === "result" && !!result;
  const holders: CoalitionId[] = useMemo(() => (game ? (useResult ? result!.seats.map((s) => s.winner) : game.holders) : []), [game, useResult, result]);
  const parties: string[] = useMemo(() => (game ? (useResult ? result!.seats.map((s) => s.winnerParty) : game.holderParties) : []), [game, useResult, result]);

  const geo: Geo = useMemo(() => {
    const byOrder = (order: CoalitionId[]) =>
      SEATS.map((s) => s.index)
        .filter((i) => order.includes(holders[i]))
        .sort((a, b) => order.indexOf(holders[a]) - order.indexOf(holders[b]) || parties[a].localeCompare(parties[b]) || a - b);
    if (layout === "hemicycle") return hemicycle(byOrder(HEMI_ORDER));
    return benches(byOrder(GOV_ORDER), byOrder(OPP_ORDER));
  }, [layout, holders, parties]);

  if (!game) return null;
  const gov = holders.filter((c) => COALITION_INFO[c].inGovernment).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 items-center">
        <button className="chip" aria-pressed={layout === "hemicycle"} onClick={() => setLayout("hemicycle")}>
          Hemicycle
        </button>
        <button className="chip" aria-pressed={layout === "benches"} onClick={() => setLayout("benches")}>
          Chamber benches
        </button>
        <span className="w-px h-5 mx-1" style={{ background: "var(--line)" }} />
        <button className="chip" aria-pressed={!useResult} onClick={() => setSource("now")}>
          Today
        </button>
        <button className="chip" aria-pressed={useResult} disabled={!result} onClick={() => setSource("result")} style={!result ? { opacity: 0.4, cursor: "not-allowed" } : undefined}>
          After test election
        </button>
        <span className="ml-auto text-xs tabular-nums" style={{ color: "var(--ink-2)" }}>
          Government bloc {gov} · Opposition {TOTAL_SEATS - gov} · {gov >= MAJORITY ? "majority held" : `${MAJORITY - gov} short of ${MAJORITY}`}
        </span>
      </div>

      <svg viewBox={`0 0 ${geo.w} ${geo.h}`} className="w-full h-auto max-h-[70vh]" role="img" aria-label={`Dewan Rakyat seating, ${layout}`}>
        {geo.aisleY !== undefined && geo.left !== undefined && (
          <g>
            <rect x={14} y={geo.aisleY - 22} width={26} height={44} rx={4} fill="var(--accent)" />
            <text x={48} y={geo.aisleY + 4} className="map-label">
              Speaker
            </text>
            <rect x={geo.left} y={geo.aisleY - 6} width={geo.w - geo.left - 12} height={12} rx={3} fill="var(--accent)" opacity={0.3} />
            <text x={geo.left} y={20} className="map-label">
              Opposition
            </text>
            <text x={geo.left} y={geo.h - 2} className="map-label">
              Government (Speaker&apos;s right)
            </text>
          </g>
        )}
        {layout === "hemicycle" && (
          <text x={geo.w / 2} y={geo.h - 8} textAnchor="middle" className="map-label" style={{ fontSize: 22 }}>
            {gov} / {TOTAL_SEATS}
          </text>
        )}
        {geo.dots.map((d) => {
          const isSel = selected === d.seatIndex;
          const common = {
            fill: coalColor(holders[d.seatIndex]),
            stroke: isSel ? "var(--ink)" : "var(--surface)",
            strokeWidth: isSel ? 3 : 1.5,
            className: "cursor-pointer",
            onMouseMove: (e: React.MouseEvent) => setHover({ i: d.seatIndex, x: e.clientX, y: e.clientY }),
            onMouseLeave: () => setHover(null),
            onClick: () => select(d.seatIndex),
          };
          return layout === "hemicycle" ? (
            <circle key={d.seatIndex} cx={d.x} cy={d.y} r={geo.size} {...common} />
          ) : (
            <rect key={d.seatIndex} x={d.x - geo.size} y={d.y - geo.size} width={geo.size * 2} height={geo.size * 2} rx={3} {...common} />
          );
        })}
      </svg>

      {hover && (
        <div className="tooltip" style={{ left: hover.x + 14, top: hover.y + 14 }}>
          <div className="font-semibold">
            {SEATS[hover.i].code} {SEATS[hover.i].name}
          </div>
          <div style={{ color: "var(--muted)" }}>{STATE_BY_ID[SEATS[hover.i].state].name}</div>
          <div className="mt-1">
            {parties[hover.i]} · {COALITION_INFO[holders[hover.i]].name}
          </div>
          <div style={{ color: "var(--muted)" }}>{COALITION_INFO[holders[hover.i]].inGovernment ? "Government bench" : "Opposition bench"}</div>
        </div>
      )}
    </div>
  );
}
