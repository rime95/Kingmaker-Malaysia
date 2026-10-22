"use client";

import { useMemo, useState } from "react";
import { BUBBLE_INFO } from "@/game/systems/bubbles";
import { DUNS } from "@/game/systems/dun";
import { isHostile } from "@/game/systems/rivals";
import { useGame } from "@/store/gameStore";
import { contestingIn, cshort, SEATS, STATE_BY_ID, type CoalitionId } from "@/game/world";
import { chancePct, pct, useReads } from "../common";
import { seatBreakdown } from "@/game/state";
import { asideFor } from "@/game/systems/pacts";
import { SeatIssues } from "./SeatBits";
import { winChance, type SeatRead } from "@/game/systems/polls";
import { resultView } from "@/game/systems/results";
import { byId, mpOf } from "@/game/systems/people";
import { MalaysiaMap, type MapMarker } from "../map/MalaysiaMap";
import { coalColor, lensFill } from "../map/lenses";

/** The full-screen map behind everything: coloured by the current lens, with bubbles and rival pulses. */
export function MainMap() {
  const game = useGame((s) => s.game)!;
  const { lens, selected, pick, mapFocus, claim, panel, floater } = useGame();
  const reads = useReads();
  const [hover, setHover] = useState<{ i: number; x: number; y: number; dun?: boolean } | null>(null);

  const fills = useMemo(() => SEATS.map((_, i) => lensFill(game, reads, lens, i)), [game, reads, lens]);
  // The States panel colours the 600 state seats by who holds them.
  const statesMode = panel === "states";
  const dunFills = useMemo(() => (statesMode ? DUNS.map((d) => coalColor(game.dunHolders[d.index])) : null), [statesMode, game.dunHolders]);

  const markers = useMemo<MapMarker[]>(() => {
    const out: MapMarker[] = game.bubbles.map((b) => ({
      key: `b${b.id}`,
      seat: b.seat,
      kind: "bubble",
      icon: BUBBLE_INFO[b.kind].icon,
      label: BUBBLE_INFO[b.kind].reward(b.value),
      color: "var(--accent)",
      onClick: () => claim(b.id),
    }));
    // Pulses where hostile rivals are working your seats this week.
    const seen = new Set<number>();
    for (const [c, r] of Object.entries(game.rivals) as [CoalitionId, NonNullable<(typeof game.rivals)[CoalitionId]>][]) {
      if (!isHostile(c, game.player, game.me.trust, game.government)) continue;
      for (const i of r.targets) {
        if (game.holders[i] !== game.player || seen.has(i)) continue;
        seen.add(i);
        out.push({ key: `p${c}${i}`, seat: i, kind: "pulse", icon: "", color: coalColor(c) });
      }
    }
    return out;
  }, [game, claim]);

  return (
    <>
      <MalaysiaMap
        className="absolute inset-0"
        fills={fills}
        dunFills={dunFills}
        showDuns={statesMode ? "always" : "auto"}
        selected={selected}
        onSelect={(i, x, y) => {
          setHover(null);
          pick(i, x, y);
        }}
        onHover={(i, x, y) => setHover(i === null ? null : { i, x, y })}
        onHoverDun={(i, x, y) => setHover(i === null ? null : { i, x, y, dun: true })}
        focus={mapFocus}
        markers={markers}
        floater={floater}
        safeArea={SAFE_AREA()}
      />
      {hover && (hover.dun ? <DunTip {...hover} /> : <SeatTip {...hover} reads={reads} />)}
    </>
  );
}

/** Hover a seat: everything you need at a glance (click it for your moves there). */
function SeatTip({ i, x, y, reads }: { i: number; x: number; y: number; reads: SeatRead[] }) {
  const game = useGame((s) => s.game)!;
  const seat = SEATS[i];
  const last = resultView(game.seatResults, i);
  const contests = contestingIn(seat, game.entries).includes(game.player);
  const chance = contests ? winChance(reads[i], game.player, game.week) : null;
  const bubble = game.bubbles.find((b) => b.seat === i);
  const shares = (Object.entries(reads[i].shares) as [CoalitionId, number][]).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const why = contests ? seatBreakdown(game, i).sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 2) : [];
  const aside = asideFor(game)[i]?.[0];
  const nominee = byId(game, game.nominations?.picks[i]);
  // Keep it on screen.
  const left = typeof window !== "undefined" && x + 300 > window.innerWidth ? x - 300 : x + 14;
  const top = typeof window !== "undefined" && y + 260 > window.innerHeight ? y - 250 : y + 14;
  return (
    <div className="tooltip" style={{ left, top, width: 280 }}>
      <div className="font-semibold">
        {seat.code} {seat.name}
      </div>
      <div style={{ color: "var(--muted)" }}>{STATE_BY_ID[seat.state].name}</div>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="swatch" style={{ background: coalColor(game.holders[i]) }} />
        {mpOf(game, i)?.name ?? last.candidates[0].name} · {game.holderParties[i]} ({cshort(game.holders[i])})
      </div>
      <div style={{ color: "var(--ink-2)" }}>
        {last.label}: won by {last.majority.toLocaleString("en-MY")} votes
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-2.5" style={{ color: "var(--ink-2)" }}>
        {shares.map(([c, v]) => (
          <span key={c} className="inline-flex items-center gap-1">
            <span className="swatch" style={{ background: coalColor(c), width: 7, height: 7 }} />
            {cshort(c)} {pct(v)}
          </span>
        ))}
      </div>
      {chance !== null && (
        <div className="mt-1 font-semibold" style={{ color: chance >= 0.56 ? "var(--good)" : chance > 0.44 ? "var(--accent)" : "var(--bad)" }}>
          Your chance: {chancePct(chance)}
          {reads[i].source === "estimate" ? " (rough)" : ""}
        </div>
      )}
      {why.length > 0 && (
        <div style={{ color: "var(--muted)" }}>
          Biggest factors: {why.map((w) => `${w.label.split(" (")[0].toLowerCase()} ${w.value >= 0 ? "+" : "−"}${Math.abs(Math.round(w.value * 100))}`).join(", ")}
        </div>
      )}
      {contests && (
        <div style={{ color: "var(--muted)" }}>
          Your service {Math.round(game.me.service[i])} · machinery {Math.round(game.me.machinery[i])} · buzz {Math.round(game.me.buzz[i])}
        </div>
      )}
      {!contests && <div style={{ color: "var(--muted)" }}>You don&apos;t stand here yet: click to open a branch.</div>}
      <div className="mt-1">
        <SeatIssues seat={i} compact />
      </div>
      {nominee && <div style={{ color: "var(--ink-2)" }}>Your candidate: {nominee.name}</div>}
      {aside && (
        <div style={{ color: "var(--ink-2)" }}>
          Pact: {cshort(aside.out)} stands aside for {cshort(aside.to)}
        </div>
      )}
      {bubble && <div style={{ color: "var(--accent)" }}>{BUBBLE_INFO[bubble.kind].title}: click the bubble</div>}
      <div className="mt-1 text-[10px]" style={{ color: "var(--muted)" }}>
        Click for your moves here
      </div>
    </div>
  );
}

function DunTip({ i, x, y }: { i: number; x: number; y: number }) {
  const game = useGame((s) => s.game)!;
  const d = DUNS[i];
  return (
    <div className="tooltip" style={{ left: x + 14, top: y + 14 }}>
      <div className="font-semibold">
        {d.code} {d.name}
      </div>
      <div style={{ color: "var(--muted)" }}>
        {STATE_BY_ID[d.state].name} · in {SEATS[d.parent].name}
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="swatch" style={{ background: coalColor(game.dunHolders[i]) }} />
        {cshort(game.dunHolders[i])}
      </div>
    </div>
  );
}

/** Screen space taken by the floating UI (top bar + lens bar, nav rail, ticker), so "show all" frames Malaysia in the rest. */
function SAFE_AREA() {
  const phone = typeof window !== "undefined" && window.innerWidth < 768;
  return phone ? { top: 170, right: 10, bottom: 130, left: 10 } : { top: 160, right: 60, bottom: 70, left: 100 };
}
