"use client";

import { useMemo, useState } from "react";
import { BUBBLE_INFO } from "@/game/systems/bubbles";
import { DUNS } from "@/game/systems/dun";
import { isHostile } from "@/game/systems/rivals";
import { useGame } from "@/store/gameStore";
import { COALITION_INFO, SEATS, STATE_BY_ID, type CoalitionId } from "@/game/world";
import { pct, useProjections } from "../common";
import { MalaysiaMap, type MapMarker } from "../map/MalaysiaMap";
import { RATING_LABEL, coalColor, lensFill } from "../map/lenses";

/** The full-screen map behind everything: coloured by the current lens, with bubbles and rival pulses. */
export function MainMap() {
  const game = useGame((s) => s.game)!;
  const { lens, selected, focusSeat, mapFocus, claim, panel, floater } = useGame();
  const projections = useProjections();
  const [hover, setHover] = useState<{ i: number; x: number; y: number; dun?: boolean } | null>(null);

  const fills = useMemo(() => SEATS.map((_, i) => lensFill(game, projections, lens, i)), [game, projections, lens]);
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
        onSelect={focusSeat}
        onHover={(i, x, y) => setHover(i === null ? null : { i, x, y })}
        onHoverDun={(i, x, y) => setHover(i === null ? null : { i, x, y, dun: true })}
        focus={mapFocus}
        markers={markers}
        floater={floater}
        safeArea={SAFE_AREA()}
      />
      {hover && (hover.dun ? <DunTip {...hover} /> : <SeatTip {...hover} projections={projections} />)}
    </>
  );
}

function SeatTip({ i, x, y, projections }: { i: number; x: number; y: number; projections: ReturnType<typeof useProjections> }) {
  const game = useGame((s) => s.game)!;
  const seat = SEATS[i];
  const p = projections[i];
  const bubble = game.bubbles.find((b) => b.seat === i);
  return (
    <div className="tooltip" style={{ left: x + 14, top: y + 14 }}>
      <div className="font-semibold">
        {seat.code} {seat.name}
      </div>
      <div style={{ color: "var(--muted)" }}>{STATE_BY_ID[seat.state].name}</div>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="swatch" style={{ background: coalColor(game.holders[i]) }} />
        {game.holderParties[i]} ({COALITION_INFO[game.holders[i]].short})
      </div>
      <div style={{ color: "var(--ink-2)" }}>
        Today: {COALITION_INFO[p.leader].short} by {pct(p.margin, 1)} · {RATING_LABEL[p.rating]}
      </div>
      {bubble && <div style={{ color: "var(--accent)" }}>{BUBBLE_INFO[bubble.kind].title}: click the bubble</div>}
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
        {COALITION_INFO[game.dunHolders[i]].short}
      </div>
    </div>
  );
}

/** Screen space taken by the floating UI (top bar + lens bar, nav rail, ticker), so "show all" frames Malaysia in the rest. */
function SAFE_AREA() {
  const phone = typeof window !== "undefined" && window.innerWidth < 768;
  return phone ? { top: 170, right: 10, bottom: 130, left: 10 } : { top: 160, right: 60, bottom: 70, left: 100 };
}
