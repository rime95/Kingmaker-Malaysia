"use client";

import { useState } from "react";
import { COALITION_RULES, partyColor } from "@/game/systems/coalitions";
import { isPresident } from "@/game/systems/career";
import { useGame } from "@/store/gameStore";
import { PARTIES, cname } from "@/game/world";
import { NameCoalition } from "./shell/NameCoalition";

/** Your coalition: its member parties, their MPs and leaders, and how happy each partner is. */
export function CoalitionCard() {
  const game = useGame((s) => s.game)!;
  const [naming, setNaming] = useState(false);
  const mine = game.coalitions[game.player];
  return (
    <section>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="eyebrow">Your coalition</h3>
        {isPresident(game.career) && (
          <button className="text-xs underline" style={{ color: "var(--ink-2)" }} onClick={() => setNaming(true)}>
            Rename
          </button>
        )}
      </div>
      <div className="inset p-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="swatch" style={{ background: mine.color, width: 14, height: 14 }} />
          <span className="font-semibold">{cname(game.player)}</span>
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            {mine.members.length} parties
          </span>
        </div>
        <ul className="flex flex-col gap-1.5">
          {mine.members.map((p, k) => {
            const mps = game.holderParties.filter((x, i) => x === p && game.holders[i] === game.player).length;
            const sat = game.partySat[p];
            const unhappy = sat !== undefined && sat <= COALITION_RULES.warn;
            return (
              <li key={p} className="grid grid-cols-[12px_1fr_auto] items-center gap-2 text-sm">
                <span className="swatch" style={{ background: partyColor(game, p), width: 10, height: 10 }} />
                <span className="min-w-0">
                  <span className="font-medium">{p}</span>{" "}
                  <span className="text-xs" style={{ color: "var(--muted)" }}>
                    {k === 0 ? game.career.name : PARTIES[p]?.leader}
                    {k === 0 ? " · leads" : ""}
                  </span>
                </span>
                <span className="text-xs tabular-nums" style={{ color: "var(--ink-2)" }}>
                  {mps} MP{mps === 1 ? "" : "s"}
                </span>
                {k > 0 && sat !== undefined && (
                  <div className="col-start-2 col-span-2 flex items-center gap-2" title="Satisfaction with your coalition. Low and they walk out, taking their MPs.">
                    <div className="flex-1 h-1 rounded-full" style={{ background: "var(--surface-2)" }}>
                      <div className="h-full rounded-full" style={{ width: `${sat}%`, background: unhappy ? "var(--bad)" : "var(--ink-2)" }} />
                    </div>
                    <span className="text-[11px] tabular-nums w-16 text-right" style={{ color: unhappy ? "var(--bad)" : "var(--muted)" }}>
                      {unhappy ? "▲ restless" : `goodwill ${Math.round(sat)}`}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="text-[11px]" style={{ color: "var(--muted)" }}>
          Partners grow restless in opposition and when trust is low. Below {COALITION_RULES.leave} goodwill they walk out and their MPs cross the floor.
        </p>
      </div>
      {naming && <NameCoalition onClose={() => setNaming(false)} />}
    </section>
  );
}
