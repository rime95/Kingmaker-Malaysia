"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { lastDivision, nextMotion, type Vote } from "@/game/systems/dewan";
import { HOPPING_TEXT, hoppingLaw } from "@/game/systems/laws";
import { useGame } from "@/store/gameStore";
import { MAJORITY, SEATS, TOTAL_SEATS, type CoalitionId } from "@/game/world";
import { CHART_ORDER, coalColor } from "./common";
import { SeatHolderCard, VOTE_COLOR } from "./SeatHolderCard";

const Hemicycle3D = dynamic(() => import("./Hemicycle3D").then((m) => m.Hemicycle3D), {
  ssr: false,
  loading: () => (
    <div className="h-[440px] grid place-items-center text-sm" style={{ color: "var(--muted)" }}>
      Building the chamber…
    </div>
  ),
});

export { hemicycle, type Dot, type Geo } from "./hemicycle";
import { hemicycle, type Geo } from "./hemicycle";

/** The Dewan Rakyat as a hemicycle: flat (2D) or a chamber you can orbit, zoom and tilt (3D). Hover any seat for its MP. */
export function Dewan() {
  const { game, selected, select, showPanel } = useGame();
  const [view, setView] = useState<"2d" | "3d">("2d");
  const [colorBy, setColorBy] = useState<"coalition" | "vote">("coalition");
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);

  const geo: Geo = useMemo(() => {
    const g = game!;
    const byOrder = (order: CoalitionId[]) =>
      SEATS.map((s) => s.index)
        .filter((i) => order.includes(g.holders[i]))
        .sort((a, b) => order.indexOf(g.holders[a]) - order.indexOf(g.holders[b]) || g.holderParties[a].localeCompare(g.holderParties[b]) || a - b);
    // The government on the left of the chart, the PM's coalition at the far left; the opposition on the right.
    const govOrder = [g.parliament.pm, ...CHART_ORDER.filter((c) => c !== g.parliament.pm && g.government.includes(c))];
    const oppOrder = CHART_ORDER.filter((c) => !g.government.includes(c)).reverse();
    return hemicycle(byOrder([...govOrder, ...[...oppOrder].reverse()]));
  }, [game]);

  if (!game) return null;
  const div = lastDivision(game);
  const gov = game.holders.filter((c) => game.government.includes(c)).length;
  const votes: Vote[] | undefined = colorBy === "vote" ? div?.result?.votes : undefined;
  const color = (i: number) => (votes ? VOTE_COLOR[votes[i]] : coalColor(game.holders[i]));
  const upcoming = nextMotion(game);

  const law = hoppingLaw(game);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs" style={{ color: "var(--ink-2)" }}>
        <b>Anti-hopping law (Art. 49A): {HOPPING_TEXT[law].name}.</b> {HOPPING_TEXT[law].rules} Changing it is a constitutional amendment: 148 votes.
      </p>
      {upcoming ? (
        <button className="inset p-3 text-left text-sm" style={{ outline: "1px solid var(--accent)" }} onClick={() => showPanel("orderpaper")}>
          <span className="eyebrow" style={{ color: "var(--accent)" }}>
            {upcoming.voteWeek <= game.week + 1 ? "Votes this turn" : `Next vote in ${upcoming.voteWeek - game.week} weeks`}
          </span>
          <span className="block font-semibold">{upcoming.title}</span>
          <span className="text-xs" style={{ color: "var(--ink-2)" }}>
            Whip, court, amend or speak before the bells ring: open the Order Paper →
          </span>
        </button>
      ) : (
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          {game.dewan.meeting ? "Nothing left on this meeting's Order Paper." : "The Dewan is in recess. It sits in Feb–Mar, Jun–Jul and Oct–Nov."}
        </p>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <button className="chip" aria-pressed={view === "2d"} onClick={() => setView("2d")}>
          2D
        </button>
        <button className="chip" aria-pressed={view === "3d"} onClick={() => setView("3d")}>
          3D
        </button>
        <span className="w-px h-5 mx-1" style={{ background: "var(--line)" }} />
        <button className="chip" aria-pressed={colorBy === "coalition"} onClick={() => setColorBy("coalition")}>
          Coalitions
        </button>
        <button className="chip" aria-pressed={colorBy === "vote"} disabled={!div} style={!div ? { opacity: 0.4 } : undefined} onClick={() => setColorBy("vote")} title={div ? div.title : "No vote yet"}>
          Last vote
        </button>
        <span className="ml-auto text-xs tabular-nums" style={{ color: "var(--ink-2)" }}>
          Government {gov} · Opposition {TOTAL_SEATS - gov} · {gov >= MAJORITY ? "majority held" : `${MAJORITY - gov} short of ${MAJORITY}`}
        </span>
      </div>

      {votes && div?.result && (
        <div className="text-xs flex flex-wrap gap-3" style={{ color: "var(--ink-2)" }}>
          <b className="w-full truncate" style={{ color: "var(--ink)" }}>
            {div.title}: {div.result.passed ? "passed" : "defeated"}
          </b>
          {(["aye", "no", "abstain", "absent"] as Vote[]).map((v) => (
            <span key={v} className="inline-flex items-center gap-1">
              <span className="swatch" style={{ background: VOTE_COLOR[v], width: 8, height: 8 }} />
              {div.result!.votes.filter((x) => x === v).length} {v}
            </span>
          ))}
        </div>
      )}

      {view === "2d" ? (
        <svg viewBox={`0 0 ${geo.w} ${geo.h}`} className="w-full h-auto max-h-[70vh]" role="img" aria-label="Dewan Rakyat seating">
          <text x={geo.w / 2} y={geo.h - 42} textAnchor="middle" className="map-label" style={{ fontSize: 22 }}>
            {gov} / {TOTAL_SEATS}
          </text>
          {geo.dots.map((d, k) => (
            <circle
              key={d.seatIndex}
              cx={d.x}
              cy={d.y}
              r={geo.size}
              fill={color(d.seatIndex)}
              stroke={selected === d.seatIndex ? "var(--ink)" : "var(--surface)"}
              strokeWidth={selected === d.seatIndex ? 3 : 1.5}
              className="cursor-pointer dewan-dot"
              style={{ transitionDelay: `${(k % 40) * 12}ms` }}
              onMouseMove={(e) => setHover({ i: d.seatIndex, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setHover(null)}
              onClick={() => select(d.seatIndex)}
            />
          ))}
        </svg>
      ) : (
        <Hemicycle3D geo={geo} color={color} selected={selected} onHover={setHover} onSelect={select} />
      )}

      {hover && <SeatHolderCard i={hover.i} x={hover.x} y={hover.y} vote={div?.result?.votes[hover.i]} />}
    </div>
  );
}
