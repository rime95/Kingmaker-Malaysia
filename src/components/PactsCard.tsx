"use client";

import { useMemo } from "react";
import { PACT, pactBlocked, pactGains } from "@/game/systems/pacts";
import { useGame } from "@/store/gameStore";
import { COALITIONS, cshort, type CoalitionId } from "@/game/world";
import { fmtRM } from "@/game/money";
import { coalColor } from "./common";

const signed = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n)}`;

/** Seat pacts: one-on-one fights instead of split votes. */
export function PactsCard() {
  const game = useGame((s) => s.game)!;
  const pact = useGame((s) => s.pact);
  const others = useMemo(
    () =>
      COALITIONS.filter((c) => c !== game.player && c !== "OTHERS").map((c) => {
        const has = game.pacts.find((p) => p.with === c);
        const why = has ? null : pactBlocked(game, c);
        const g = has || why?.includes("same seats") ? null : pactGains(game, c);
        return { c, has, why, g };
      }),
    [game],
  );
  return (
    <section>
      <h3 className="eyebrow mb-1">Seat pacts</h3>
      <p className="text-[11px] mb-2" style={{ color: "var(--muted)" }}>
        Stop splitting the vote. In every seat you both contest, the weaker of you stands aside and most of its voters follow the deal. They sign if it wins
        them seats. Runs until the next general election. {PACT.ap} AP, {fmtRM(PACT.cost)} for the talks.
      </p>
      <div className="flex flex-col gap-1.5">
        {others.map(({ c, has, why, g }) => (
          <div key={c} className="inset px-2.5 py-2 text-xs flex items-center gap-2">
            <span className="swatch" style={{ background: coalColor(c as CoalitionId) }} />
            <span className="font-semibold w-16 truncate">{cshort(c)}</span>
            <span className="flex-1 min-w-0" style={{ color: "var(--ink-2)" }}>
              {has
                ? `Pact: ${Object.values(has.seats).filter((x) => x === game.player).length} you give, ${Object.values(has.seats).filter((x) => x !== game.player).length} they give`
                : g
                  ? `${Object.keys(g.seats).length} shared seats · you ${signed(g.you)}, them ${signed(g.them)}`
                  : (why ?? "")}
            </span>
            {has ? (
              <button className="chip !py-1" onClick={() => pact(c, false)}>
                End
              </button>
            ) : (
              <button className="chip !py-1" disabled={!!why} title={why ?? undefined} onClick={() => pact(c, true)}>
                Propose
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
