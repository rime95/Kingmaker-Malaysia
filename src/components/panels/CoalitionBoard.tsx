"use client";

import { useMemo, useState } from "react";
import { COALITION_RULES, seatCandidate } from "@/game/systems/coalitions";
import { BULLY, BULLY_MOVES, assignBlocked, bullyBlocked, coalitionSeats, ctlOf, dependence, partnersOf, shares } from "@/game/systems/partners";
import { useGame } from "@/store/gameStore";
import { PARTIES, type Seat } from "@/game/world";
import { PartyFlag } from "../flags";

const LEVELS = [
  { name: "No deal", text: "Every coalition stands and the vote splits." },
  { name: "Seat pact", text: "Separate coalitions; one stands aside in agreed seats (Seats & pacts tab)." },
  { name: "Coalition", text: "One candidate a seat, set by you, with open contests where you allow them." },
];

/** Your coalition's seats and your hold over its minor parties. */
export function CoalitionBoard() {
  const game = useGame((s) => s.game)!;
  const deep = useGame((s) => s.deep);
  const members = game.coalitions[game.player].members;
  const partners = useMemo(() => partnersOf(game).map((party) => ({ party, dep: dependence(game, party), ctl: ctlOf(game, party), sat: game.partySat[party] ?? COALITION_RULES.rest })), [game]);
  const rows = useMemo(() => shares(game), [game]);
  const [filter, setFilter] = useState<string>(members[1] ?? members[0]);
  const blocked = assignBlocked(game);
  const seats = useMemo(() => coalitionSeats(game), [game]);
  const shown = seats.filter((s) => seatCandidate(game, s, game.player) === filter || game.openSeats[s.index]?.includes(filter)).slice(0, 60);

  return (
    <section className="inset p-3 flex flex-col gap-3">
      <div>
        <h3 className="eyebrow">Your coalition</h3>
        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
          You lead it, so you decide who stands where and you can lean on any partner that needs you. Leaning on them is free, once every {BULLY.cooldown} weeks a move.
        </p>
        <ul className="grid gap-1.5 @md:grid-cols-3 mt-2">
          {LEVELS.map((l) => (
            <li key={l.name} className="rounded-lg px-2.5 py-1.5 text-xs" style={{ background: "var(--surface-2)" }}>
              <div className="font-semibold">{l.name}</div>
              <div style={{ color: "var(--ink-2)" }}>{l.text}</div>
            </li>
          ))}
        </ul>
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

      {members.length > 1 && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="eyebrow">Seats</h3>
            <div className="flex gap-1 flex-wrap">
              {members.map((p) => (
                <button key={p} className="chip !py-0.5 text-xs" aria-pressed={filter === p} onClick={() => setFilter(p)}>
                  {p} {rows.find((r) => r.party === p)?.given ?? 0}
                </button>
              ))}
            </div>
            <button className="chip !py-0.5 text-xs ml-auto" disabled={!!blocked} title={blocked ?? "Incumbents stay; the rest go to the party that suits each seat."} onClick={() => deep({ kind: "bestAllocation" })}>
              Best for the coalition
            </button>
          </div>
          {blocked && (
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {blocked}
            </p>
          )}
          <ul className="flex flex-col gap-1 max-h-72 overflow-y-auto scroll-thin">
            {shown.map((s) => (
              <SeatRow key={s.index} seat={s} disabled={!!blocked} />
            ))}
          </ul>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            When nominations close, a partner below its fair share loses {Math.abs(BULLY.under)} satisfaction a seat (at most {Math.abs(BULLY.underCap)}) and feels the pressure; above it, it gains. An open contest costs the
            coalition {Math.round(BULLY.openVote * 100)}% of its vote in the seat, and neither party counts it as shortchanged.
          </p>
        </div>
      )}
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

function SeatRow({ seat, disabled }: { seat: Seat; disabled: boolean }) {
  const game = useGame((s) => s.game)!;
  const deep = useGame((s) => s.deep);
  const members = game.coalitions[game.player].members;
  const cur = seatCandidate(game, seat, game.player);
  const open = game.openSeats[seat.index];
  const held = game.holders[seat.index] === game.player ? game.holderParties[seat.index] : null;
  return (
    <li className="inset px-2.5 py-1.5 text-xs flex flex-wrap items-center gap-2">
      <span className="flex-1 min-w-[120px] truncate">
        <b>{seat.name}</b>{" "}
        <span style={{ color: "var(--muted)" }}>
          {seat.code}
          {held ? ` · held by ${held}` : " · open"}
        </span>
      </span>
      <select className="chip !py-0.5 text-xs" value={cur} disabled={disabled} aria-label={`Who stands in ${seat.name}`} onChange={(e) => deep({ kind: "assignSeat", seat: seat.index, party: e.target.value })}>
        {members.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <select className="chip !py-0.5 text-xs" value={open ? (open.find((p) => p !== cur) ?? open[1]) : ""} disabled={disabled} aria-label={`Open contest in ${seat.name}`} onChange={(e) => deep({ kind: "openContest", seat: seat.index, other: e.target.value || null })}>
        <option value="">No contest</option>
        {members
          .filter((p) => p !== cur)
          .map((p) => (
            <option key={p} value={p}>
              vs {p}
            </option>
          ))}
      </select>
    </li>
  );
}
