"use client";

import dynamic from "next/dynamic";
import { useMemo, useRef, useState } from "react";
import { lastDivision, nextMotion, type Vote } from "@/game/systems/dewan";
import { HOPPING_TEXT, hoppingLaw } from "@/game/systems/laws";
import { partyColor } from "@/game/systems/coalitions";
import { useGame } from "@/store/gameStore";
import { MAJORITY, SEATS, TOTAL_SEATS, type CoalitionId } from "@/game/world";
import { CHART_ORDER, coalColor } from "./common";
import { VOTE_COLOR } from "./SeatHolderCard";
import { PartyCard } from "./PartyCard";

const Hemicycle3D = dynamic(() => import("./Hemicycle3D").then((m) => m.Hemicycle3D), {
  ssr: false,
  loading: () => (
    <div className="h-[520px] grid place-items-center text-sm" style={{ color: "var(--muted)" }}>
      Building the chamber…
    </div>
  ),
});

export { hemicycle, type Dot, type Geo } from "./hemicycle";
import { hemicycle, type Geo } from "./hemicycle";

/** What the pointer is on: a party (and the seat, if it is over one). */
export type Hot = { party: string; seat: number | null; x: number; y: number };

const TILT_KEY = "dewan-tilt";
const readTilt = () => {
  try {
    return Math.min(60, Math.max(0, Number(localStorage.getItem(TILT_KEY)) || 0));
  } catch {
    return 0;
  }
};

/**
 * The Dewan Rakyat as a hemicycle: flat (2D, which tilts back like a model on a table) or a 3D chamber. Point at a seat
 * and its whole party lights up, with a card on the party; click for the seat.
 */
export function Dewan() {
  const { game, selected, select, showPanel, dewanColor: colorBy, setDewanColor: setColorBy } = useGame();
  const [view, setView] = useState<"2d" | "3d">("2d");
  const [hot, setHot] = useState<Hot | null>(null);
  const [tilt, setTiltState] = useState(() => (typeof window === "undefined" ? 0 : readTilt()));
  const [dragging, setDragging] = useState(false);
  const setTilt = (t: number) => {
    const v = Math.min(60, Math.max(0, Math.round(t)));
    setTiltState(v);
    try {
      localStorage.setItem(TILT_KEY, String(v));
    } catch {}
  };
  const drag = useRef<{ y: number; t: number; moved: boolean } | null>(null);

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

  // The parties in chart order (government first), for the legend.
  const parties = useMemo(() => {
    const g = game!;
    const seen: string[] = [];
    for (const d of geo.dots) if (!seen.includes(g.holderParties[d.seatIndex])) seen.push(g.holderParties[d.seatIndex]);
    return seen.map((p) => ({ party: p, seats: g.holderParties.filter((x) => x === p).length }));
  }, [geo, game]);

  if (!game) return null;
  const div = lastDivision(game);
  const gov = game.holders.filter((c) => game.government.includes(c)).length;
  const votes: Vote[] | undefined = colorBy === "vote" ? div?.result?.votes : undefined;
  const color = (i: number) => (votes ? VOTE_COLOR[votes[i]] : coalColor(game.holders[i]));
  const upcoming = nextMotion(game);
  const hotParty = hot?.party ?? null;
  const pointAt = (i: number, x: number, y: number) => setHot({ party: game.holderParties[i], seat: i, x, y });

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
        <button className="chip" aria-pressed={view === "2d"} onClick={() => (setView("2d"), setHot(null))}>
          2D
        </button>
        <button className="chip" aria-pressed={view === "3d"} onClick={() => (setView("3d"), setHot(null))}>
          3D
        </button>
        <span className="w-px h-5 mx-1" style={{ background: "var(--line)" }} />
        <button className="chip" aria-pressed={colorBy === "coalition"} onClick={() => setColorBy("coalition")}>
          Coalitions
        </button>
        <button className="chip" aria-pressed={colorBy === "vote"} disabled={!div} style={!div ? { opacity: 0.4 } : undefined} onClick={() => setColorBy("vote")} title={div ? div.title : "No vote yet"}>
          Last vote
        </button>
        {view === "2d" && (
          <label className="inline-flex items-center gap-2 text-xs ml-1" style={{ color: "var(--ink-2)" }}>
            Tilt
            <input type="range" min={0} max={60} value={tilt} onChange={(e) => setTilt(Number(e.target.value))} aria-label="Tilt the chamber" className="w-24 accent-[var(--brass-hi)]" />
          </label>
        )}
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
        <div
          className="dewan-tilt rounded-xl"
          style={{ cursor: dragging ? "grabbing" : tilt ? "grab" : undefined, background: tilt ? "radial-gradient(80% 60% at 50% 100%, rgb(227 194 122 / 0.07), transparent 70%)" : undefined }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            drag.current = { y: e.clientY, t: tilt, moved: false };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d || !(e.buttons & 1)) return;
            if (Math.abs(e.clientY - d.y) > 4) d.moved = true;
            if (d.moved) {
              setDragging(true);
              setTilt(d.t - (e.clientY - d.y) * 0.35);
            }
          }}
          onPointerUp={() => {
            setDragging(false);
            setTimeout(() => (drag.current = null), 0);
          }}
          onPointerLeave={() => {
            setDragging(false);
            drag.current = null;
          }}
          title="Drag up or down to tilt"
        >
          <svg
            viewBox={`0 0 ${geo.w} ${geo.h}`}
            className="w-full h-auto max-h-[70vh] block"
            role="img"
            aria-label="Dewan Rakyat seating"
            style={{ transform: `rotateX(${tilt}deg)`, filter: tilt ? `drop-shadow(0 ${Math.round(tilt / 3)}px ${Math.round(tilt / 4)}px rgb(0 0 0 / 0.45))` : undefined }}
          >
            {/* The floor of the House, so a tilted chart reads as a chamber */}
            {tilt > 0 && <path d={`M 4 ${geo.h - 8} A ${geo.w / 2 - 4} ${geo.w / 2 - 4} 0 0 1 ${geo.w - 4} ${geo.h - 8} Z`} fill="rgb(31 90 67 / 0.18)" stroke="rgb(227 194 122 / 0.25)" />}
            <text x={geo.w / 2} y={geo.h - 42} textAnchor="middle" className="map-label" style={{ fontSize: 22 }}>
              {gov} / {TOTAL_SEATS}
            </text>
            {geo.dots.map((d, k) => {
              const on = hotParty !== null && game.holderParties[d.seatIndex] === hotParty;
              return (
                <circle
                  key={d.seatIndex}
                  cx={d.x}
                  cy={d.y}
                  r={geo.size}
                  fill={color(d.seatIndex)}
                  stroke={selected === d.seatIndex ? "var(--ink)" : "var(--surface)"}
                  strokeWidth={selected === d.seatIndex ? 3 : 1.5}
                  data-on={on ? 1 : 0}
                  data-dim={hotParty !== null && !on ? 1 : 0}
                  className="cursor-pointer dewan-dot"
                  style={{ transitionDelay: hotParty ? "0ms" : `${(k % 40) * 12}ms` }}
                  onMouseMove={(e) => pointAt(d.seatIndex, e.clientX, e.clientY)}
                  onMouseLeave={() => setHot(null)}
                  onClick={() => !drag.current?.moved && select(d.seatIndex)}
                />
              );
            })}
          </svg>
        </div>
      ) : (
        <Hemicycle3D geo={geo} color={color} selected={selected} hotParty={hotParty} onHot={(h) => setHot(h ? { ...h, party: game.holderParties[h.seat] } : null)} onSelect={select} />
      )}

      {/* The parties: point at one to light it up */}
      <div className="dewan-legend flex flex-wrap gap-1.5">
        {parties.map(({ party, seats }) => (
          <button
            key={party}
            className="chip !py-1 !px-2 !text-[11px] inline-flex items-center gap-1.5"
            data-on={hotParty === party ? 1 : 0}
            onMouseEnter={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setHot({ party, seat: null, x: r.left, y: r.top });
            }}
            onMouseLeave={() => setHot(null)}
          >
            <span className="swatch" style={{ background: partyColor(game, party), width: 9, height: 9 }} />
            {party} <span className="num" style={{ color: "var(--muted)" }}>{seats}</span>
          </button>
        ))}
      </div>

      {hot && <PartyCard party={hot.party} seat={hot.seat} x={hot.x} y={hot.y} votes={votes ? div?.result?.votes : undefined} />}
    </div>
  );
}
