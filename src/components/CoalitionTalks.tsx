"use client";

import { offerBlocked, type OfferKind } from "@/game/actions";
import { BORNEO, OFFERS, deciding, sdCount, willingness } from "@/game/systems/formation";
import { isPresident } from "@/game/systems/career";
import { useGame } from "@/store/gameStore";
import { coalitionLeader } from "@/game/systems/coalitions";
import { cname, COALITIONS, cshort, MAJORITY, type CoalitionId } from "@/game/world";
import { coalColor } from "./common";

const OFFER_LABEL: Record<OfferKind, string> = { dpm: "Offer DPM", ministries: "+ Ministries", ma63: "Promise MA63" };

/** Talks to form a government: gather 112 statutory declarations, then go to the Agong. */
export function CoalitionTalks() {
  const game = useGame((s) => s.game)!;
  const { offer, talksRound, back, agong } = useGame();
  const f = game.formation!;
  const player = game.player;
  const [x, y] = f.candidates;
  const undecided = deciding(f, player);
  const talksOver = f.round > OFFERS.rounds;
  const playerSigned = !!f.committed[player];
  const president = isPresident(game.career);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-4 flex flex-col gap-4">
      <header>
        <div className="text-xs uppercase tracking-widest" style={{ color: "var(--muted)" }}>
          Forming a government · {talksOver ? "talks over" : `round ${f.round} of ${OFFERS.rounds}`}
        </div>
        <h1 className="text-2xl font-bold">Who can command the House?</h1>
        <p className="text-sm" style={{ color: "var(--ink-2)" }}>
          {!president
            ? "Your party leadership is negotiating. You aren't party president yet, so you watch from the sidelines."
            : f.role === "leader"
            ? `You are a prime-minister candidate. Win statutory declarations (SDs) from other coalitions: make offers, then end the round to see who signs. ${MAJORITY} SDs make a majority.`
            : `You are the kingmaker. Neither ${cshort(x)} nor ${cshort(y)} can easily reach ${MAJORITY} without you. Back one of them, and name your price.`}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {f.candidates.map((c) => {
          const sds = sdCount(f, c);
          return (
            <div key={c} className="panel p-4" style={{ borderTop: `4px solid ${coalColor(c)}` }}>
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">
                  {coalitionLeader(game, c)} ({cshort(c)}){c === player ? " · you" : ""}
                </span>
                <span className="text-2xl font-bold tabular-nums">{sds}</span>
              </div>
              <div className="relative h-3 rounded-sm mt-2" style={{ background: "var(--surface-2)" }}>
                <div className="h-full rounded-sm" style={{ width: `${Math.min(100, (sds / 222) * 100)}%`, background: coalColor(c) }} />
                <div className="absolute -top-1 -bottom-1 w-[2px]" style={{ left: `${(MAJORITY / 222) * 100}%`, background: "var(--ink)" }} />
              </div>
              <div className="text-xs mt-1" style={{ color: sds >= MAJORITY ? "var(--good)" : "var(--muted)" }}>
                {sds >= MAJORITY ? "✓ Majority" : `${MAJORITY - sds} short`} · signed:{" "}
                {(Object.entries(f.committed) as [CoalitionId, CoalitionId][])
                  .filter(([, l]) => l === c)
                  .map(([k]) => `${cshort(k)} ${f.seats[k]}`)
                  .join(", ")}
              </div>
              {f.role === "kingmaker" && !playerSigned && president && (
                <div className="flex flex-wrap gap-2 mt-3">
                  <button className="btn" onClick={() => back(c, false)}>
                    Back {cshort(c)}
                  </button>
                  <button className="btn btn-ghost" onClick={() => back(c, true)} title="Granted only if your seats are what takes them past 112.">
                    Back them, ask for DPM
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {undecided.length > 0 && (
        <section className="panel p-4">
          <h2 className="font-semibold mb-2">Still deciding</h2>
          <div className="flex flex-col gap-2">
            {undecided
              .sort((a, b) => f.seats[b] - f.seats[a])
              .map((c) => {
                const wx = willingness(f, c, x, player);
                const wy = willingness(f, c, y, player);
                const lean = wx >= wy ? x : y;
                return (
                  <div key={c} className="card rounded-lg border p-3 flex flex-wrap items-center gap-3" style={{ borderColor: "var(--line)" }}>
                    <span className="swatch" style={{ background: coalColor(c) }} />
                    <span className="font-semibold">{cname(c)}</span>
                    <span className="text-sm tabular-nums" style={{ color: "var(--ink-2)" }}>
                      {f.seats[c]} seats
                    </span>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>
                      Leaning {cshort(lean)} ({Math.abs(wx - wy) < 0.1 ? "barely" : Math.abs(wx - wy) < 0.3 ? "clearly" : "strongly"})
                    </span>
                    {f.role === "leader" && president && (
                      <div className="ml-auto flex flex-wrap gap-1.5">
                        {(["dpm", "ministries", "ma63"] as OfferKind[])
                          .filter((k) => k !== "ma63" || BORNEO.includes(c))
                          .map((k) => {
                            const why = offerBlocked(game, c, k);
                            return (
                              <button key={k} className="chip" disabled={!!why} title={why ?? undefined} style={why ? { opacity: 0.45 } : undefined} onClick={() => offer(c, k)}>
                                {OFFER_LABEL[k]}
                              </button>
                            );
                          })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
          {f.role === "leader" && (
            <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
              DPM: the strongest offer, costs {Math.abs(OFFERS.dpm.capital)} political capital if you form the government. Ministries: unity −
              {Math.abs(OFFERS.ministries.unity)} each. MA63: you will enact full devolution.
            </p>
          )}
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        {f.role === "leader" && president && !talksOver && undecided.length > 0 && (
          <button className="btn btn-ghost" onClick={talksRound}>
            End round {f.round}: see who signs
          </button>
        )}
        <button
          className="btn"
          onClick={() => (president && f.role === "kingmaker" && !playerSigned ? confirm("Stay on the crossbench and back nobody?") && agong() : agong())}
        >
          {!president ? "See what the party decides" : f.role === "kingmaker" && !playerSigned ? "Stay on the crossbench" : "Go to the Agong"}
        </button>
      </div>

      <section className="panel p-4">
        <h2 className="font-semibold mb-2">How the talks went</h2>
        <ul className="text-sm flex flex-col gap-1" style={{ color: "var(--ink-2)" }}>
          {[...f.log].reverse().map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
        <p className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
          Coalitions: {COALITIONS.filter((c) => f.seats[c]).map((c) => `${cshort(c)} ${f.seats[c]}`).join(" · ")}
        </p>
      </section>
    </div>
  );
}
