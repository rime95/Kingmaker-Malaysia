"use client";

import { useMemo, useState } from "react";
import { NOMINATION, candidateStrength, eligible, partySeats, yourParty } from "@/game/systems/nominations";
import { ageOf, byId, leaderOfParty } from "@/game/systems/people";
import { winChance } from "@/game/systems/polls";
import { useGame } from "@/store/gameStore";
import { SEATS, STATE_BY_ID, contestingIn } from "@/game/world";
import { ActionCard } from "../ActionCard";
import { pct, useReads } from "../common";

/** Name your party's candidates (as president), or see who the president picked and where you stand. */
export function NominationsPanel() {
  const game = useGame((s) => s.game)!;
  const nominate = useGame((s) => s.nominate);
  const focusSeat = useGame((s) => s.focusSeat);
  const reads = useReads();
  const [filter, setFilter] = useState("");
  const n = game.nominations;
  const president = game.career.rung >= 6;
  const seats = useMemo(() => {
    const list = partySeats(game);
    const chance = (i: number) => (reads.length ? (winChance(reads[i], game.player, game.week) ?? 0) : 0);
    // Battlegrounds first: closest to a coin flip.
    return list.sort((a, b) => Math.abs(chance(a) - 0.5) - Math.abs(chance(b) - 0.5));
  }, [game, reads]);

  if (!n) {
    return (
      <div className="flex flex-col gap-3 text-sm" style={{ color: "var(--ink-2)" }}>
        <p>
          Candidates are named when Parliament is dissolved. The window stays open for {NOMINATION.window} weeks, until nomination day; then the names lock and the
          campaign runs to polling day.
        </p>
        <p>
          {president
            ? "As party president you sign off every candidate your party puts up. Partner parties pick their own."
            : `Your party president, ${leaderOfParty(game, yourParty(game))?.name ?? "the president"}, draws up the list. Your home seat is yours if you are Ketua Bahagian or above and they trust you (loyalty ${NOMINATION.homeLoyalty}+).`}
        </p>
        <p>
          Want to stand where your coalition never has? Open a branch in that seat (seat card) or launch in a whole state (Campaign panel) any time; you will
          field a candidate there at the next election.
        </p>
      </div>
    );
  }

  const shown = seats.filter((i) => !filter || SEATS[i].name.toLowerCase().includes(filter.toLowerCase()));
  const pres = leaderOfParty(game, yourParty(game));
  const home = game.career.homeSeat;
  return (
    <div className="flex flex-col gap-4">
      <section className="inset p-3 text-sm">
        <div className="flex items-baseline justify-between">
          <b>{n.open ? `Nomination day in ${Math.max(0, n.closesWeek - game.week)} week${n.closesWeek - game.week === 1 ? "" : "s"}` : "Names are locked"}</b>
          <span className="text-xs" style={{ color: "var(--ink-2)" }}>
            {Object.keys(n.picks).length} candidates for {yourParty(game)}
          </span>
        </div>
        {!president && (
          <p className="text-xs mt-1" style={{ color: "var(--ink-2)" }}>
            {pres?.name} picks. For {SEATS[home].name}: {n.picks[home] === game.youId ? "you are on the list" : `not you yet (their loyalty ${Math.round(pres?.loyalty ?? 0)}, needs ${NOMINATION.homeLoyalty}; meet them in the People panel)`}.
          </p>
        )}
      </section>

      {president && n.open && (
        <section>
          <h3 className="eyebrow mb-1.5">Stand somewhere new</h3>
          <p className="text-[11px] mb-1.5" style={{ color: "var(--muted)" }}>
            Open branches before nomination day to put up candidates where your coalition never stood. Under 12.5% of the vote loses the RM 10k deposit.
          </p>
          <ActionCard id="launchState" target={{ kind: "state", state: SEATS[home].state }} compact />
        </section>
      )}

      <section>
        <div className="flex items-center gap-2 mb-1.5">
          <h3 className="eyebrow flex-1">Your party&apos;s seats · battlegrounds first</h3>
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find a seat" className="rounded-md px-2 py-1 text-xs w-32" style={{ background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--line)" }} />
        </div>
        <ul className="flex flex-col gap-1">
          {shown.map((i) => {
            const pick = byId(game, n.picks[i]);
            const options = eligible(game, i);
            const chance = reads.length ? winChance(reads[i], game.player, game.week) : null;
            const strength = candidateStrength(game, i, pick);
            const isNew = !contestingIn(SEATS[i]).includes(game.player);
            return (
              <li key={i} className="inset px-2.5 py-2 text-xs grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-2 items-center">
                <button className="text-left min-w-0" onClick={() => focusSeat(i)}>
                  <span className="block font-semibold truncate">
                    {SEATS[i].name}
                    {isNew ? <span style={{ color: "var(--accent)" }}> · new branch</span> : null}
                  </span>
                  <span style={{ color: "var(--muted)" }}>
                    {STATE_BY_ID[SEATS[i].state].name}
                    {chance !== null ? ` · ${pct(chance)} to win` : ""}
                  </span>
                </button>
                <div className="min-w-0">
                  {president && n.open ? (
                    <select
                      value={pick?.id ?? ""}
                      onChange={(e) => nominate(i, e.target.value === "newface" ? "newface" : Number(e.target.value))}
                      className="w-full rounded-md px-1.5 py-1 text-xs"
                      style={{ background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--line)" }}
                    >
                      {pick && !options.some((o) => o.id === pick.id) && <option value={pick.id}>{pick.name}</option>}
                      {options.map((p) => (
                        <option key={p.id} value={p.id} style={{ background: "var(--raised)" }}>
                          {p.seat === i ? "★ " : ""}
                          {p.name} · {p.seat === i ? "sitting MP" : `standing ${Math.round(p.influence)}`} · {ageOf(p, game.week)}
                        </option>
                      ))}
                      <option value="newface" style={{ background: "var(--raised)" }}>
                        + A new face (young local)
                      </option>
                    </select>
                  ) : (
                    <span className="truncate block">{pick?.id === game.youId ? `${pick?.name} (you)` : (pick?.name ?? "—")}</span>
                  )}
                  <span className="text-[10.5px]" style={{ color: strength >= 0 ? "var(--good)" : "var(--bad)" }}>
                    personal vote {strength >= 0 ? "+" : "−"}
                    {Math.abs(strength * 100).toFixed(0)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
          ★ sitting MP. Incumbents and heavyweights pull extra votes; a new face appeals to young voters. Drop a sitting MP and they may run as an independent.
        </p>
      </section>
    </div>
  );
}
