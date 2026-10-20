"use client";

// The Dewan Rakyat as a stylised chamber, laid out like the real seating plan (seen from the Speaker's chair):
// a horseshoe of five bench rows on green carpet, split into blocks A to G. The government fills from block A on the
// Speaker's right (Prime Minister and ministers on the front bench), the opposition from block G on the left, and any
// spare seats are left in block D at the far end. Tilted in 3D, lit from above; seats light up as you hover.

import { useMemo, useState } from "react";
import { PORTFOLIOS } from "@/game/data/people";
import { partyColor } from "@/game/systems/coalitions";
import { leaderOfParty, mpOf, postOf } from "@/game/systems/people";
import type { GameState } from "@/game/state";
import { COALITIONS, MAJORITY, SEATS, STATE_BY_ID, TOTAL_SEATS, cshort, type CoalitionId } from "@/game/world";
import { useGame } from "@/store/gameStore";
import { coalColor } from "./common";

const W = 1000;
const H = 760;
const CX = W / 2;
/** The floor: legs run up from the Speaker's end, then curve round the far end. */
const LEG_BOTTOM = 640;
const LEG_TOP = 300;
const INNER = 175;
const ROW_GAP = 30;
const ROWS = 5;
const PITCH = 25;
/** Block boundaries along the horseshoe, from the Speaker's right (A) round to the left (G). */
const BLOCKS = ["A", "B", "C", "D", "E", "F", "G"] as const;
const CUTS = [0, 0.135, 0.27, 0.4, 0.6, 0.73, 0.865, 1];

interface Spot {
  x: number;
  y: number;
  /** Facing angle (deg): seats face the floor. */
  angle: number;
  /** 0 at the Speaker's right … 1 at the Speaker's left. */
  t: number;
  row: number;
  block: string;
  label: string;
}

/** Every seat position in the chamber, in order round the horseshoe. */
function spots(): Spot[] {
  const out: Spot[] = [];
  for (let row = 0; row < ROWS; row++) {
    const r = INNER + row * ROW_GAP;
    const leg = LEG_BOTTOM - LEG_TOP;
    const arc = Math.PI * r;
    const total = 2 * leg + arc;
    const n = Math.floor(total / PITCH);
    for (let k = 0; k < n; k++) {
      const d = (k + 0.5) * (total / n);
      const t = d / total;
      // Leave an aisle at each block boundary.
      if (CUTS.slice(1, -1).some((c) => Math.abs(t - c) < 0.012)) continue;
      let x: number;
      let y: number;
      let angle: number;
      if (d < leg) {
        x = CX + r;
        y = LEG_BOTTOM - d;
        angle = 180;
      } else if (d < leg + arc) {
        const a = (d - leg) / r; // 0 → π
        x = CX + r * Math.cos(a);
        y = LEG_TOP - r * Math.sin(a);
        angle = 180 - (a * 180) / Math.PI;
      } else {
        x = CX - r;
        y = LEG_TOP + (d - leg - arc);
        angle = 0;
      }
      const b = CUTS.findIndex((c, i) => t >= c && t < CUTS[i + 1]);
      out.push({ x, y, angle, t, row, block: BLOCKS[Math.max(0, b)], label: "" });
    }
  }
  // Number seats within each block, front row first.
  for (const block of BLOCKS) {
    out
      .filter((s) => s.block === block)
      .sort((a, b) => a.row - b.row || a.t - b.t)
      .forEach((s, i) => (s.label = `${block}${i + 1}`));
  }
  return out;
}

const SPOTS = spots();

/** Who sits where: front benches first, government from A, opposition from G. */
function seating(game: GameState): Map<number, number> {
  const holders = game.holders;
  const gov = SEATS.map((s) => s.index).filter((i) => game.government.includes(holders[i]));
  const opp = SEATS.map((s) => s.index).filter((i) => !game.government.includes(holders[i]));
  /** Cabinet order (0 = Prime Minister); backbenchers come after, seniors first. */
  const rank = (i: number) => {
    const p = mpOf(game, i);
    const posts = p ? postOf(game, p.id) : [];
    const post = posts.length ? Math.min(...posts.map((k) => PORTFOLIOS.findIndex((x) => x.id === k))) : 99;
    return post * 10 - (p?.rank ?? 0);
  };
  const isMinister = (i: number) => {
    const p = mpOf(game, i);
    return !!p && postOf(game, p.id).length > 0;
  };
  const coalOrder = (list: CoalitionId[]) => (i: number) => list.indexOf(holders[i]);
  const govOrder = [game.parliament.pm, ...COALITIONS.filter((c) => c !== game.parliament.pm && game.government.includes(c))];
  const oppCounts = COALITIONS.filter((c) => !game.government.includes(c)).sort((a, b) => holders.filter((h) => h === b).length - holders.filter((h) => h === a).length);
  const sortSide = (list: number[], order: (i: number) => number) => [...list].sort((a, b) => rank(a) - rank(b) || order(a) - order(b) || game.holderParties[a].localeCompare(game.holderParties[b]) || a - b);
  const govSorted = sortSide(gov, coalOrder(govOrder));
  const oppSorted = sortSide(opp, coalOrder(oppCounts));
  // Opposition front bench: each opposition coalition's leaders first.
  const leaders = new Set(oppCounts.flatMap((c) => game.coalitions[c].members.map((p) => leaderOfParty(game, p)?.seat).filter((x): x is number => x !== null && x !== undefined)));
  const oppFinal = [...oppSorted.filter((i) => leaders.has(i)), ...oppSorted.filter((i) => !leaders.has(i))];

  const byT = [...SPOTS.keys()].sort((a, b) => SPOTS[a].row - SPOTS[b].row || SPOTS[a].t - SPOTS[b].t);
  const used = new Set<number>();
  const map = new Map<number, number>();
  // Ministers take the government front bench in order from A1; backbenchers fill behind, block by block.
  const govSpots = [...SPOTS.keys()].sort((a, b) => SPOTS[a].t - SPOTS[b].t || SPOTS[a].row - SPOTS[b].row);
  const front = byT.filter((k) => SPOTS[k].row === 0);
  const ministers = govSorted.filter(isMinister);
  ministers.forEach((seat, n) => {
    const k = front[n];
    if (k === undefined) return;
    map.set(k, seat);
    used.add(k);
  });
  let g = 0;
  for (const seat of govSorted.filter((i) => !isMinister(i))) {
    while (g < govSpots.length && used.has(govSpots[g])) g++;
    if (g >= govSpots.length) break;
    map.set(govSpots[g], seat);
    used.add(govSpots[g]);
  }
  // Opposition from the far end of block G, front row first.
  const oppSpots = [...SPOTS.keys()].sort((a, b) => SPOTS[b].t - SPOTS[a].t || SPOTS[a].row - SPOTS[b].row);
  const oppFront = oppSpots.filter((k) => SPOTS[k].row === 0);
  let o = 0;
  oppFinal.forEach((seat, n) => {
    if (n < 6 && oppFront[n] !== undefined && !used.has(oppFront[n])) {
      map.set(oppFront[n], seat);
      used.add(oppFront[n]);
      return;
    }
    while (o < oppSpots.length && used.has(oppSpots[o])) o++;
    if (o >= oppSpots.length) return;
    map.set(oppSpots[o], seat);
    used.add(oppSpots[o]);
  });
  return map;
}

export function Chamber({ colorBy }: { colorBy: "coalition" | "party" }) {
  const game = useGame((s) => s.game)!;
  const { selected, focusSeat } = useGame();
  const [hover, setHover] = useState<{ spot: number; x: number; y: number } | null>(null);
  const seatOf = useMemo(() => seating(game), [game]);
  const gov = game.holders.filter((h) => game.government.includes(h)).length;

  const hoverSeat = hover ? seatOf.get(hover.spot) : undefined;
  const mp = hoverSeat !== undefined ? mpOf(game, hoverSeat) : undefined;
  const posts = mp ? postOf(game, mp.id) : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <Count label="Government" n={gov} color="var(--good)" />
        <Count label="Opposition" n={TOTAL_SEATS - gov} color="var(--ink-2)" />
        <div className="flex-1 min-w-[160px]">
          <div className="relative h-2.5 rounded-full overflow-hidden flex" style={{ background: "var(--surface-2)" }}>
            <div style={{ width: `${(gov / TOTAL_SEATS) * 100}%`, background: "linear-gradient(90deg, #1f8f55, #34d17a)" }} />
            <div className="absolute inset-y-0 w-0.5" style={{ left: `${(MAJORITY / TOTAL_SEATS) * 100}%`, background: "#fff" }} />
          </div>
          <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
            {MAJORITY} for a majority · {gov >= MAJORITY ? `${gov - MAJORITY + 1} to spare` : `${MAJORITY - gov} short`}
          </div>
        </div>
      </div>

      <div className="chamber-stage">
        <div className="chamber-tilt">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="img" aria-label="The Dewan Rakyat chamber">
            <defs>
              <radialGradient id="ch-floor" cx="50%" cy="45%" r="65%">
                <stop offset="0%" stopColor="#1d5a3a" />
                <stop offset="70%" stopColor="#123a26" />
                <stop offset="100%" stopColor="#0a2217" />
              </radialGradient>
              <pattern id="ch-carpet" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="18" height="18" fill="transparent" />
                <path d="M0 9h18" stroke="rgb(255 255 255 / 0.035)" strokeWidth="1" />
              </pattern>
              <radialGradient id="ch-light" cx="50%" cy="40%" r="55%">
                <stop offset="0%" stopColor="rgb(255 236 190 / 0.18)" />
                <stop offset="100%" stopColor="rgb(255 236 190 / 0)" />
              </radialGradient>
              <linearGradient id="ch-wood" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7a4a26" />
                <stop offset="100%" stopColor="#4a2b14" />
              </linearGradient>
              <linearGradient id="ch-gold" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#f5d77a" />
                <stop offset="50%" stopColor="#c9a227" />
                <stop offset="100%" stopColor="#8a6a12" />
              </linearGradient>
              <filter id="ch-glow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="4" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="ch-shadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000" floodOpacity="0.55" />
              </filter>
            </defs>

            {/* The chamber floor and the tiers of the benches */}
            <path d={horseshoe(INNER + ROWS * ROW_GAP + 26)} fill="#0c1a14" stroke="url(#ch-gold)" strokeWidth={3} opacity={0.95} />
            <path d={horseshoe(INNER + ROWS * ROW_GAP + 26)} fill="url(#ch-floor)" />
            <path d={horseshoe(INNER + ROWS * ROW_GAP + 26)} fill="url(#ch-carpet)" />
            {Array.from({ length: ROWS }, (_, row) => (
              <path key={row} d={horseshoeLine(INNER + row * ROW_GAP + ROW_GAP / 2 + 2)} fill="none" stroke="rgb(201 162 39 / 0.28)" strokeWidth={1.2} />
            ))}
            <path d={horseshoe(INNER - 18)} fill="#0e2b1d" stroke="rgb(201 162 39 / 0.5)" strokeWidth={1.5} />
            <path d={horseshoe(INNER + ROWS * ROW_GAP + 26)} fill="url(#ch-light)" />

            {/* Block letters */}
            {BLOCKS.map((b, i) => {
              const mid = SPOTS.filter((s) => s.block === b && s.row === ROWS - 1);
              const s = mid[Math.floor(mid.length / 2)];
              if (!s) return null;
              // Just outside the back row, away from the floor.
              const out = ((s.angle + 180) * Math.PI) / 180;
              return (
                <text key={b} x={s.x + Math.cos(out) * 44} y={Math.max(36, s.y + Math.sin(out) * 44 + 13)} textAnchor="middle" className="chamber-block" style={{ animationDelay: `${i * 60}ms` }}>
                  {b}
                </text>
              );
            })}

            {/* The Clerk's table with the mace, and the Speaker's chair */}
            <g filter="url(#ch-shadow)">
              <rect x={CX - 48} y={430} width={96} height={150} rx={8} fill="url(#ch-wood)" stroke="rgb(245 215 122 / 0.5)" />
              <rect x={CX - 6} y={445} width={12} height={120} rx={6} fill="url(#ch-gold)" />
              <circle cx={CX} cy={443} r={9} fill="url(#ch-gold)" />
              <text x={CX} y={598} textAnchor="middle" className="chamber-caption">
                Bentara · the mace
              </text>
            </g>
            <g filter="url(#ch-shadow)">
              <path d={`M${CX - 60} ${H - 40} L${CX - 60} ${H - 110} Q${CX} ${H - 165} ${CX + 60} ${H - 110} L${CX + 60} ${H - 40} Z`} fill="url(#ch-wood)" stroke="url(#ch-gold)" strokeWidth={3} />
              <path d={`M${CX - 44} ${H - 50} L${CX - 44} ${H - 104} Q${CX} ${H - 145} ${CX + 44} ${H - 104} L${CX + 44} ${H - 50} Z`} fill="#1f6b43" />
              <circle cx={CX} cy={H - 128} r={10} fill="url(#ch-gold)" />
              <text x={CX} y={H - 18} textAnchor="middle" className="chamber-caption">
                Tuan Yang di-Pertua
              </text>
            </g>

            {/* Seats */}
            {SPOTS.map((s, k) => {
              const seat = seatOf.get(k);
              const holder = seat !== undefined ? game.holders[seat] : undefined;
              const color = seat === undefined ? "#2b3a33" : colorBy === "party" ? partyColor(game, game.holderParties[seat]) : coalColor(holder!);
              const isHover = hover?.spot === k;
              const isSel = seat !== undefined && selected === seat;
              return (
                <g
                  key={k}
                  transform={`translate(${s.x} ${s.y}) rotate(${s.angle})`}
                  className={`chamber-seat${seat === undefined ? " empty" : ""}`}
                  style={{ animationDelay: `${Math.round(s.t * 700 + s.row * 60)}ms` }}
                  onMouseMove={(e) => setHover({ spot: k, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => seat !== undefined && focusSeat(seat)}
                >
                  <g transform={isHover || isSel ? "scale(1.35)" : undefined} filter={isHover || isSel ? "url(#ch-glow)" : undefined}>
                    <rect x={-6} y={-10} width={5} height={20} rx={2} fill={color} style={{ filter: "brightness(0.6)" }} />
                    <rect x={-2} y={-9} width={10} height={18} rx={3} fill={color} />
                    <rect x={-1} y={-8} width={8} height={4} rx={2} fill="rgb(255 255 255 / 0.22)" />
                    {isSel && <rect x={-8} y={-12} width={18} height={24} rx={4} fill="none" stroke="#fff" strokeWidth={1.5} />}
                  </g>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {hover && (
        <div className="tooltip" style={{ left: hover.x + 14, top: hover.y + 14 }}>
          <div className="text-[11px]" style={{ color: "var(--accent)" }}>
            Seat {SPOTS[hover.spot].label}
          </div>
          {hoverSeat === undefined ? (
            <div style={{ color: "var(--muted)" }}>Empty seat</div>
          ) : (
            <>
              <div className="font-semibold">{mp?.name ?? "—"}</div>
              <div>
                {game.holderParties[hoverSeat]} · {cshort(game.holders[hoverSeat])}
                {mp?.id === game.youId ? " · you" : ""}
              </div>
              <div style={{ color: "var(--muted)" }}>
                MP for {SEATS[hoverSeat].name}, {STATE_BY_ID[SEATS[hoverSeat].state].name}
              </div>
              {posts.length > 0 && <div style={{ color: "var(--good)" }}>{posts.map((k) => PORTFOLIOS.find((x) => x.id === k)!.name).join(", ")}</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Count({ label, n, color }: { label: string; n: number; color: string }) {
  return (
    <div>
      <div className="text-3xl font-black tabular-nums leading-none" style={{ color }}>
        {n}
      </div>
      <div className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: "var(--muted)" }}>
        {label}
      </div>
    </div>
  );
}

/** A filled horseshoe at radius r (legs plus the far-end curve), closed at the Speaker's end. */
function horseshoe(r: number): string {
  return `M${CX + r} ${LEG_BOTTOM + 30} L${CX + r} ${LEG_TOP} A${r} ${r} 0 0 0 ${CX - r} ${LEG_TOP} L${CX - r} ${LEG_BOTTOM + 30} Z`;
}

/** The same outline, open at the Speaker's end (a bench edge). */
function horseshoeLine(r: number): string {
  return `M${CX + r} ${LEG_BOTTOM + 14} L${CX + r} ${LEG_TOP} A${r} ${r} 0 0 0 ${CX - r} ${LEG_TOP} L${CX - r} ${LEG_BOTTOM + 14}`;
}
