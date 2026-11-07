"use client";

import { useMemo } from "react";
import { COALITION_RULES } from "@/game/systems/coalitions";
import { BULLY, BULLY_MOVES, bullyBlocked, ctlOf, dependence, partnersOf, shares } from "@/game/systems/partners";
import { useGame } from "@/store/gameStore";
import { PARTIES } from "@/game/world";
import { PartyFlag } from "../flags";

/** Your coalition's partners and your hold over them. */
export function CoalitionBoard() {
  const game = useGame((s) => s.game)!;
  const deep = useGame((s) => s.deep);
  const partners = useMemo(() => partnersOf(game).map((party) => ({ party, dep: dependence(game, party), ctl: ctlOf(game, party), sat: game.partySat[party] ?? COALITION_RULES.rest })), [game]);
  const rows = useMemo(() => shares(game), [game]);

  return (
    <section className="inset p-3 flex flex-col gap-3">
      <div>
        <h3 className="eyebrow">Your coalition</h3>
        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
          You can lean on any partner that needs you. It&apos;s free, once every {BULLY.cooldown} weeks a move. To choose who stands where, go to Campaign → Seats.
        </p>
      </div>

      {partners.length === 0 && (
        <p className="text-sm" style={{ color: "var(--ink-2)" }}>
          No other parties in your coalition yet. Invite some under Party → Overview.
        </p>
      )}

      {partners.map(({ party, dep, ctl, sat }) => {
        const share = rows.find((r) => r.party === party);
        const status = [ctl.obedient && "Obedient", !ctl.obedient && ctl.warnedUntil > game.week && `Warned for ${ctl.warnedUntil - game.week} wks`, ctl.cut && "Machinery cut", ctl.ros && "Registration held", ctl.rebelWeek !== undefined && "Your rebel at work"].filter(Boolean);
        return (
          <div key={party} className="rounded-lg p-2.5 flex flex-col gap-1.5" style={{ background: "var(--surface-2)", outline: ctl.apology ? "1px solid var(--good)" : undefined }}>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <PartyFlag id={party} size={13} />
              <span className="font-semibold">{party}</span>
              <span className="text-xs" style={{ color: "var(--ink-2)" }}>
                {PARTIES[party]?.name}
              </span>
              {status.map((x) => (
                <span key={String(x)} className="text-xs font-semibold" style={{ color: "var(--brass-hi)" }}>
                  {x}
                </span>
              ))}
              {ctl.apology && (
                <button className="btn !py-1 text-xs ml-auto" onClick={() => deep({ kind: "forgive", party })}>
                  Forgive them
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 @md:grid-cols-4 gap-2 text-xs">
              <Stat label="Seats given" value={`${share?.given ?? 0} of ${share?.fair ?? 0} fair`} />
              <Stat label="Without you" value={`${dep.withYou} with you, ${dep.alone} alone`} tone={dep.dependent ? "var(--good)" : "var(--bad)"} />
              <Stat label="Satisfaction" value={String(Math.round(sat))} />
              <Stat label="Pressure" value={`${Math.round(ctl.pressure)} / ${BULLY.full}`} />
            </div>
            <div className="h-1.5 rounded-full" style={{ background: "var(--line)" }}>
              <div className="h-1.5 rounded-full" style={{ width: `${ctl.pressure}%`, background: "var(--brass)" }} />
            </div>
            <div className="flex flex-wrap gap-1">
              {BULLY_MOVES.map((m) => {
                const why = bullyBlocked(game, party, m.id);
                return (
                  <button key={m.id} className="chip !py-0.5 text-xs" disabled={!!why} title={why ?? m.blurb} onClick={() => deep({ kind: "bully", party, move: m.id })}>
                    {m.name}
                  </button>
                );
              })}
            </div>
            {!dep.dependent && (
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                {party} could survive without you, so it won&apos;t be pushed around and can walk out if it&apos;s unhappy.
              </p>
            )}
          </div>
        );
      })}

    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div style={{ color: "var(--muted)" }}>{label}</div>
      <div className="font-semibold tabular-nums" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
    </div>
  );
}
