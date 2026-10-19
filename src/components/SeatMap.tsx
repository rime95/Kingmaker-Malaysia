"use client";

import { useState } from "react";
import { useGame, type Lens } from "@/store/gameStore";
import { HEX_MAP, STATE_BORDERS, hexPath } from "@/game/hexLayout";
import { BLOC_LABEL, COALITION_INFO, SEATS, STATE_BY_ID, contestingIn, majorityBloc } from "@/game/world";
import { FORTRESS } from "@/game/config";
import type { Rating } from "@/game/voter";
import { coalColor, pct, useProjections } from "./common";

const LENSES: { id: Lens; label: string }[] = [
  { id: "holder", label: "Current holder" },
  { id: "projection", label: "If held today" },
  { id: "support", label: "Your support" },
  { id: "presence", label: "Your strongholds" },
  { id: "ethnic", label: "Ethnic majority" },
  { id: "urban", label: "Urban / rural" },
  { id: "result", label: "Test election" },
];

const RATING_OPACITY: Record<Rating, number> = { safe: 1, likely: 0.75, lean: 0.5, tossup: 0.28 };
const RATING_LABEL: Record<Rating, string> = { safe: "Safe", likely: "Likely", lean: "Leaning", tossup: "Toss-up" };

const mixFill = (color: string, t: number) => `color-mix(in oklch, ${color} ${Math.round(Math.min(1, Math.max(0, t)) * 100)}%, var(--surface-2))`;

export function SeatMap() {
  const { game, lens, setLens, selected, select } = useGame();
  const projections = useProjections();
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  if (!game) return null;
  const result = game.lastElection;

  const fill = (i: number): { fill: string; opacity?: number } => {
    const seat = SEATS[i];
    switch (lens) {
      case "holder":
        return { fill: coalColor(game.holders[i]) };
      case "projection":
        return { fill: coalColor(projections[i].leader), opacity: RATING_OPACITY[projections[i].rating] };
      case "support":
        return { fill: mixFill(coalColor(game.player), (projections[i].shares[game.player] ?? 0) / 0.7) };
      case "presence":
        return contestingIn(seat).includes(game.player) ? { fill: mixFill(coalColor(game.player), game.me.service[i] / 90) } : { fill: "var(--surface)" };
      case "ethnic":
        return { fill: `var(--e-${majorityBloc(seat)})` };
      case "urban":
        return { fill: mixFill("var(--ink-2)", seat.demo.urbanity) };
      case "result":
        return result ? { fill: coalColor(result.seats[i].winner) } : { fill: "var(--surface-2)" };
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {LENSES.map((l) => (
          <button key={l.id} className="chip" aria-pressed={lens === l.id} onClick={() => setLens(l.id)} disabled={l.id === "result" && !result} style={l.id === "result" && !result ? { opacity: 0.4, cursor: "not-allowed" } : undefined}>
            {l.label}
          </button>
        ))}
      </div>
      <Legend lens={lens} player={game.player} />
      <div className="relative">
        <svg viewBox={`0 0 ${HEX_MAP.width} ${HEX_MAP.height}`} className="w-full h-auto select-none" role="img" aria-label="Hex map of all 222 Dewan Rakyat seats, grouped by state">
          {HEX_MAP.cells.map((cell) => {
            const f = fill(cell.seatIndex);
            const flipped = lens === "result" && result && result.seats[cell.seatIndex].winner !== game.holders[cell.seatIndex];
            const isSel = selected === cell.seatIndex;
            return (
              <path
                key={cell.seatIndex}
                d={hexPath(cell.x, cell.y)}
                fill={f.fill}
                fillOpacity={f.opacity ?? 1}
                stroke={isSel ? "var(--ink)" : flipped ? "var(--ink)" : "var(--surface)"}
                strokeWidth={isSel ? 3 : flipped ? 2 : 1.5}
                strokeDasharray={flipped && !isSel ? "3 2" : undefined}
                className="cursor-pointer"
                onMouseMove={(e) => setHover({ i: cell.seatIndex, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHover(null)}
                onClick={() => select(cell.seatIndex)}
              />
            );
          })}
          <path d={STATE_BORDERS} fill="none" stroke="var(--ink-2)" strokeWidth={1.6} strokeLinecap="round" pointerEvents="none" />
          {HEX_MAP.labels.map((l) => (
            <text key={l.state} x={l.x} y={l.y} textAnchor={l.anchor} className="map-label">
              {STATE_BY_ID[l.state].name}
            </text>
          ))}
        </svg>
      </div>
      {hover && <MapTooltip {...hover} />}
    </div>
  );
}

function MapTooltip({ i, x, y }: { i: number; x: number; y: number }) {
  const game = useGame((s) => s.game)!;
  const projections = useProjections();
  const seat = SEATS[i];
  const p = projections[i];
  const r = game.lastElection?.seats[i];
  return (
    <div className="tooltip" style={{ left: x + 14, top: y + 14 }}>
      <div className="font-semibold">
        {seat.code} {seat.name}
      </div>
      <div style={{ color: "var(--muted)" }}>{STATE_BY_ID[seat.state].name}</div>
      <div className="mt-1">
        Held by {game.holderParties[i]} ({COALITION_INFO[game.holders[i]].short})
      </div>
      <div>
        Today: {COALITION_INFO[p.leader].short} by {pct(p.margin, 1)} · {RATING_LABEL[p.rating]}
      </div>
      {r && (
        <div>
          Test election: {r.winnerParty} ({COALITION_INFO[r.winner].short}) by {r.majority.toLocaleString("en-MY")}
        </div>
      )}
    </div>
  );
}

function Legend({ lens, player }: { lens: Lens; player: keyof typeof COALITION_INFO }) {
  const item = (key: string, color: string, label: string, opacity = 1) => (
    <span key={key} className="inline-flex items-center gap-1.5">
      <span className="swatch" style={{ background: color, opacity }} />
      {label}
    </span>
  );
  let items: React.ReactNode;
  if (lens === "projection")
    items = (Object.keys(RATING_OPACITY) as Rating[]).map((r) => item(r, "var(--ink-2)", RATING_LABEL[r], RATING_OPACITY[r]));
  else if (lens === "support")
    items = [0, 0.2, 0.4, 0.6].map((v) => item(String(v), mixFill(coalColor(player), v / 0.7), `${pct(v)}${v === 0.6 ? "+" : ""}`)).concat(<span key="t">{COALITION_INFO[player].short} vote share</span>);
  else if (lens === "presence")
    items = [...FORTRESS].reverse().map((f) => item(f.name, mixFill(coalColor(player), (f.min + 10) / 90), `${f.name} (${f.min}+)`)).concat(<span key="t">constituency service; blank = not contested</span>);
  else if (lens === "ethnic")
    items = (["malay", "chinese", "indian", "sabah", "sarawak", "mixed"] as const).map((b) => item(b, `var(--e-${b})`, b === "mixed" ? "No majority" : BLOC_LABEL[b]));
  else if (lens === "urban") items = [0.1, 0.4, 0.7, 1].map((v) => item(String(v), mixFill("var(--ink-2)", v), v === 0.1 ? "Rural" : v === 1 ? "City" : ""));
  else if (lens === "result")
    items = [
      <span key="r">Colour = test-election winner.</span>,
      <span key="f" className="inline-flex items-center gap-1.5">
        <svg width="14" height="14">
          <path d={hexPath(7, 7, 6)} fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeDasharray="3 2" />
        </svg>
        Seat would change hands
      </span>,
    ];
  else items = <span>Colour = coalition holding the seat (see the legend above).</span>;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: "var(--ink-2)" }}>
      {items}
      <span className="ml-auto" style={{ color: "var(--muted)" }}>
        One hex = one seat. Click a seat for details.
      </span>
    </div>
  );
}
