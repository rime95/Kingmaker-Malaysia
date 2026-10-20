"use client";

import { useMemo, useState } from "react";
import { useGame } from "@/store/gameStore";
import { cname, MAJORITY, SEATS, STATE_BY_ID, TOTAL_SEATS, type CoalitionId } from "@/game/world";
import { CHART_ORDER } from "./common";
import { coalColor } from "./common";
import { Chamber } from "./Chamber";

type Layout = "chamber" | "hemicycle";
interface Geo {
  dots: Dot[];
  size: number;
  w: number;
  h: number;
}
interface Dot {
  seatIndex: number;
  x: number;
  y: number;
}

/** Parliament-chart layout for any number of seats: rows of a half circle, filled left to right in `order`. */
export function hemicycle(order: number[]): Geo {
  const n = order.length;
  const rows = Math.max(2, Math.min(8, Math.round(Math.sqrt(n / 3.5))));
  const r0 = 0.38;
  const radii = Array.from({ length: rows }, (_, k) => r0 + ((1 - r0) * k) / (rows - 1));
  const sum = radii.reduce((a, b) => a + b, 0);
  const counts = radii.map((r) => Math.max(2, Math.round((n * r) / sum)));
  counts[rows - 1] += n - counts.reduce((a, b) => a + b, 0);
  const pos: { a: number; r: number }[] = [];
  radii.forEach((r, k) => {
    const m = counts[k];
    for (let j = 0; j < m; j++) pos.push({ a: Math.PI - (j * Math.PI) / Math.max(1, m - 1), r });
  });
  pos.sort((p, q) => q.a - p.a || p.r - q.r);
  const R = 300;
  // Dots as big as the tighter of row spacing and spacing along the outer row allows.
  const rowGap = ((1 - r0) * R) / (rows - 1);
  const arcGap = (Math.PI * R) / Math.max(1, counts[rows - 1] - 1);
  const size = Math.min(16, Math.min(rowGap, arcGap) * 0.42);
  const dots = order.map((seatIndex, i) => ({
    seatIndex,
    x: R + 14 + pos[i].r * R * Math.cos(pos[i].a),
    y: R + 14 - pos[i].r * R * Math.sin(pos[i].a),
  }));
  return { dots, size, w: 2 * R + 28, h: R + 40 };
}

export function Dewan() {
  const { game, selected, select } = useGame();
  const [layout, setLayout] = useState<Layout>("chamber");
  const [colorBy, setColorBy] = useState<"coalition" | "party">("coalition");
  const [source, setSource] = useState<"now" | "result">("now");
  const [hover, setHover] = useState<{
    i: number;
    x: number;
    y: number;
  } | null>(null);

  const result = game?.lastElection;
  const useResult = source === "result" && !!result;
  const holders: CoalitionId[] = useMemo(() => (game ? (useResult ? result!.seats.map((s) => s.winner) : game.holders) : []), [game, useResult, result]);
  const parties: string[] = useMemo(() => (game ? (useResult ? result!.seats.map((s) => s.winnerParty) : game.holderParties) : []), [game, useResult, result]);

  const geo: Geo = useMemo(() => {
    const byOrder = (order: CoalitionId[]) =>
      SEATS.map((s) => s.index)
        .filter((i) => order.includes(holders[i]))
        .sort((a, b) => order.indexOf(holders[a]) - order.indexOf(holders[b]) || parties[a].localeCompare(parties[b]) || a - b);
    // Front bench first on each side: the PM's coalition leads the government, the biggest party the opposition.
    const govOrder = [game!.parliament.pm, ...CHART_ORDER.filter((c) => c !== game!.parliament.pm && game!.government.includes(c))];
    const oppOrder = CHART_ORDER.filter((c) => !game!.government.includes(c)).reverse();
    // Hemicycle, left to right: opposition first, the PM's coalition at the far right.
    return hemicycle(byOrder([...oppOrder, ...[...govOrder].reverse()]));
  }, [holders, parties, game]);

  if (!game) return null;
  const gov = holders.filter((c) => game.government.includes(c)).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 items-center">
        <button className="chip" aria-pressed={layout === "chamber"} onClick={() => setLayout("chamber")}>
          Chamber
        </button>
        <button className="chip" aria-pressed={layout === "hemicycle"} onClick={() => setLayout("hemicycle")}>
          Hemicycle
        </button>
        <span className="w-px h-5 mx-1" style={{ background: "var(--line)" }} />
        {layout === "chamber" ? (
          <>
            <button className="chip" aria-pressed={colorBy === "coalition"} onClick={() => setColorBy("coalition")}>
              Coalitions
            </button>
            <button className="chip" aria-pressed={colorBy === "party"} onClick={() => setColorBy("party")}>
              Parties
            </button>
          </>
        ) : (
          <>
            <button className="chip" aria-pressed={!useResult} onClick={() => setSource("now")}>
              Today
            </button>
            <button
              className="chip"
              aria-pressed={useResult}
              disabled={!result}
              onClick={() => setSource("result")}
              style={!result ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
            >
              After war room
            </button>
          </>
        )}
        <span className="ml-auto text-xs tabular-nums" style={{ color: "var(--ink-2)" }}>
          Government bloc {gov} · Opposition {TOTAL_SEATS - gov} · {gov >= MAJORITY ? "majority held" : `${MAJORITY - gov} short of ${MAJORITY}`}
        </span>
      </div>

      {layout === "chamber" ? (
        <Chamber colorBy={colorBy} />
      ) : (
        <svg viewBox={`0 0 ${geo.w} ${geo.h}`} className="w-full h-auto max-h-[70vh]" role="img" aria-label={`Dewan Rakyat seating, ${layout}`}>
            {layout === "hemicycle" && (
            <text x={geo.w / 2} y={geo.h - 42} textAnchor="middle" className="map-label" style={{ fontSize: 22 }}>
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
      )}

      {hover && layout === "hemicycle" && (
        <div className="tooltip" style={{ left: hover.x + 14, top: hover.y + 14 }}>
          <div className="font-semibold">
            {SEATS[hover.i].code} {SEATS[hover.i].name}
          </div>
          <div style={{ color: "var(--muted)" }}>{STATE_BY_ID[SEATS[hover.i].state].name}</div>
          <div className="mt-1">
            {parties[hover.i]} · {cname(holders[hover.i])}
          </div>
          <div style={{ color: "var(--muted)" }}>{game.government.includes(holders[hover.i]) ? "Government bench" : "Opposition bench"}</div>
        </div>
      )}
    </div>
  );
}
