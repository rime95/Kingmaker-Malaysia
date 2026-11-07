"use client";

import { useMemo, useState } from "react";
import { isPresident } from "@/game/systems/career";
import { seatCandidate } from "@/game/systems/coalitions";
import { yourParty } from "@/game/systems/nominations";
import { standsAside } from "@/game/systems/pacts";
import { BULLY, assignBlocked, coalitionSeats, shares } from "@/game/systems/partners";
import { useGame } from "@/store/gameStore";
import { SEATS, STATE_BY_ID, contestingIn, cshort, type Seat } from "@/game/world";

const LEVELS = [
  { name: "No deal", text: "Every coalition stands and the vote splits." },
  { name: "Seat pact", text: "With another coalition: one side stands aside in agreed seats." },
  { name: "Coalition", text: "Inside your own side: one candidate a seat, and you choose the party." },
];

/** How many rows the list draws at once; search reaches the rest. */
const SHOWN = 80;

/** Inside your coalition: who carries its flag in each seat. */
export function CoalitionSeats() {
  const game = useGame((s) => s.game)!;
  const deep = useGame((s) => s.deep);
  const members = game.coalitions[game.player].members;
  const lead = yourParty(game);
  const rows = useMemo(() => shares(game), [game]);
  const seats = useMemo(() => coalitionSeats(game), [game]);
  const [filter, setFilter] = useState<string>(lead);
  const [q, setQ] = useState("");
  const blocked = assignBlocked(game);
  const needle = q.trim().toLowerCase();
  const found = seats.filter((s) => {
    if (needle) return `${s.name} ${s.code} ${STATE_BY_ID[s.state].name}`.toLowerCase().includes(needle);
    return filter === "All" || seatCandidate(game, s, game.player) === filter || game.openSeats[s.index]?.includes(filter);
  });

  return (
    <section className="flex flex-col gap-2">
      <div>
        <h3 className="eyebrow mb-1">How seats are shared</h3>
        <ul className="grid gap-1.5 @md:grid-cols-3">
          {LEVELS.map((l) => (
            <li key={l.name} className="rounded-lg px-2.5 py-1.5 text-xs" style={{ background: "var(--surface-2)" }}>
              <div className="font-semibold">{l.name}</div>
              <div style={{ color: "var(--ink-2)" }}>{l.text}</div>
            </li>
          ))}
        </ul>
      </div>

      <h3 className="eyebrow">Inside your coalition</h3>
      {!isPresident(game.career) ? (
        <p className="text-xs" style={{ color: "var(--ink-2)" }}>
          The coalition&apos;s leader decides which party stands in each seat.
        </p>
      ) : members.length < 2 ? (
        <p className="text-xs" style={{ color: "var(--ink-2)" }}>
          No other parties in your coalition yet. Invite some under Party → Overview, and you can give them seats here.
        </p>
      ) : (
        <>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            You lead the coalition, so you pick the party in each seat. It&apos;s free. To give away one of your seats, find it and choose a partner. You can do the same by clicking a seat on the map.
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex gap-1 flex-wrap">
              {["All", ...members].map((p) => (
                <button key={p} className="chip !py-0.5 text-xs" aria-pressed={!needle && filter === p} onClick={() => { setFilter(p); setQ(""); }}>
                  {p} {p === "All" ? seats.length : (rows.find((r) => r.party === p)?.given ?? 0)}
                </button>
              ))}
            </div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a seat or state" aria-label="Find a seat" className="rounded-md px-2 py-1 text-xs w-36 min-w-0" style={{ background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--line)" }} />
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
            {found.slice(0, SHOWN).map((s) => (
              <SeatRow key={s.index} seat={s} disabled={!!blocked} />
            ))}
            {!found.length && (
              <li className="text-xs" style={{ color: "var(--muted)" }}>
                No seats match. Seats you stand aside in under a pact are listed under pacts.
              </li>
            )}
          </ul>
          {found.length > SHOWN && (
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              Showing {SHOWN} of {found.length}. Search to find the rest.
            </p>
          )}
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            A change applies at the next election: a sitting MP stays until then, and their personal following doesn&apos;t pass to the new candidate. When nominations close, a partner below its fair share loses {Math.abs(BULLY.under)} satisfaction a seat (at most {Math.abs(BULLY.underCap)}); above it, it gains. An open contest costs the coalition {Math.round(BULLY.openVote * 100)}% of its vote in the seat.
          </p>
        </>
      )}
    </section>
  );
}

function SeatRow({ seat, disabled }: { seat: Seat; disabled: boolean }) {
  const game = useGame((s) => s.game)!;
  const deep = useGame((s) => s.deep);
  const members = game.coalitions[game.player].members;
  const cur = seatCandidate(game, seat, game.player);
  const open = game.openSeats[seat.index];
  const held = game.holders[seat.index] === game.player ? game.holderParties[seat.index] : null;
  const home = seat.index === game.career.homeSeat;
  return (
    <li className="inset px-2.5 py-1.5 text-xs flex flex-wrap items-center gap-2">
      <span className="flex-1 min-w-[120px] truncate">
        <b>{seat.name}</b>{" "}
        <span style={{ color: "var(--muted)" }}>
          {seat.code}
          {home ? " · your seat" : held ? ` · held by ${held}` : " · open"}
        </span>
      </span>
      <select className="chip !py-0.5 text-xs" value={cur} disabled={disabled || home} aria-label={`Who stands in ${seat.name}`} onChange={(e) => deep({ kind: "assignSeat", seat: seat.index, party: e.target.value })}>
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

/** On a seat's card: pick the party that stands here, or see the pact that decides it. */
export function WhoStands({ seat }: { seat: number }) {
  const game = useGame((s) => s.game)!;
  const deep = useGame((s) => s.deep);
  const openPanel = useGame((s) => s.openPanel);
  const members = game.coalitions[game.player].members;
  const s = SEATS[seat];
  if (!isPresident(game.career) || members.length < 2 || !contestingIn(s, game.entries).includes(game.player)) return null;
  if (standsAside(game, seat, game.player)) {
    const to = game.pacts.find((p) => p.seats[seat] === game.player)?.with;
    return (
      <p className="inset px-3 py-2 text-xs" style={{ color: "var(--ink-2)" }}>
        You stand aside here{to ? ` for ${cshort(to)}` : ""} under a pact, so this seat is settled in your{" "}
        <button className="underline" onClick={() => openPanel("battle")}>
          seat pacts
        </button>
        .
      </p>
    );
  }
  const blocked = assignBlocked(game);
  const home = seat === game.career.homeSeat;
  return (
    <label className="inset px-3 py-2 text-xs flex items-center gap-2" title={home ? "That is your own seat: you stand there." : (blocked ?? undefined)}>
      <span className="flex-1 font-semibold">Who stands here</span>
      <select className="chip !py-0.5 text-xs" value={seatCandidate(game, s, game.player)} disabled={home || !!blocked} onChange={(e) => deep({ kind: "assignSeat", seat, party: e.target.value })}>
        {members.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    </label>
  );
}
