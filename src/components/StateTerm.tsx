"use client";

import { useEffect, useMemo, useState } from "react";
import { STATEGOV, excoFairness, inviteChance, mbShortlist, mbTitle, stateGovPool, stateSeats, talksOptions, talksSeats } from "@/game/systems/stategov";
import { DUNS_BY_STATE } from "@/game/systems/dun";
import { chiefKey, holderOf, homeOf, missionBlocked, regionOf } from "@/game/systems/posts";
import type { Person } from "@/game/systems/people";
import { useGame } from "@/store/gameStore";
import { PARTIES, STATE_BY_ID, cshort } from "@/game/world";
import { sfx } from "./audio";
import { CoalitionFlag, JalurGemilang, PartyFlag } from "./flags";
import { Term } from "./Term";

/** After you win a state: name its Menteri Besar (or Ketua Menteri) and exco. */
export function StateTerm() {
  const game = useGame((s) => s.game)!;
  const { draftState, swearInState } = useGame();
  const t = game.stateTerms[0];
  const g = game.stateGov[t.state];
  const pool = useMemo(() => stateGovPool(game, t.state, [g.ruler, ...g.partners]), [game, t.state, g]);
  const shortlist = useMemo(() => mbShortlist(game, t.state), [game, t.state]);
  const [adding, setAdding] = useState("");
  useEffect(() => {
    sfx("fanfare");
  }, [t.state]);
  const byId = (id: number | null) => game.people.find((p) => p.id === id);
  const mb = byId(t.mb);
  const fair = excoFairness(game, t);
  const name = STATE_BY_ID[t.state].name;
  const title = mbTitle(t.state);
  const free = pool.filter((p) => p.id !== t.mb && !t.exco.includes(p.id));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto tv" role="dialog" aria-modal="true" aria-label={`Form the ${name} government`}>
      <div className="mx-auto max-w-[1000px] px-4 py-6 flex flex-col gap-4">
        <header className="panel songket-bg p-5 text-center flex flex-col items-center gap-2 relative">
          <span className="seal absolute right-4 top-4 hidden sm:inline-grid">Angkat sumpah</span>
          <div className="flex items-center gap-2">
            <JalurGemilang height={26} wave />
            <CoalitionFlag game={game} c={game.player} size={22} />
          </div>
          <div className="text-xs font-bold tracking-[0.3em] tv-gold">ISTANA · {name.toUpperCase()}</div>
          <h2 className="text-2xl md:text-3xl font-black">Form the {name} government</h2>
          <p className="text-sm max-w-xl" style={{ color: "var(--ink-2)" }}>
            Name the <Term word={title} /> and an exco of {STATEGOV.exco}. Partners judge their share of the
            exco; your state chief expects the top job.
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1fr_260px] items-start">
          <div className="flex flex-col gap-3">
            <section className="panel p-3 flex flex-col gap-2">
              <h3 className="eyebrow">{title}</h3>
              <div className="grid gap-2 sm:grid-cols-3">
                {shortlist.map((p) => (
                  <button key={p.id} className="inset text-left px-2.5 py-2" style={t.mb === p.id ? { boxShadow: "0 0 0 2px var(--gold)" } : undefined} onClick={() => draftState(t.state, { mb: p.id })}>
                    <Who p={p} region={regionOf(t.state)} />
                  </button>
                ))}
              </div>
              {mb && !shortlist.some((p) => p.id === mb.id) && (
                <div className="text-xs">
                  Now: <Who p={mb} region={regionOf(t.state)} />
                </div>
              )}
            </section>

            <section className="panel p-3 flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <h3 className="eyebrow">
                  Exco · {t.exco.length} of {STATEGOV.exco}
                </h3>
              </div>
              {t.exco.map((id) => {
                const p = byId(id);
                return p ? (
                  <div key={id} className="inset px-2.5 py-1.5 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <Who p={p} region={regionOf(t.state)} />
                    </div>
                    <button className="btn btn-ghost" onClick={() => draftState(t.state, { remove: id })}>
                      Drop
                    </button>
                  </div>
                ) : null;
              })}
              {t.exco.length < STATEGOV.exco && (
                <div className="flex gap-2 items-center">
                  <select
                    value={adding}
                    onChange={(e) => setAdding(e.target.value)}
                    className="rounded-md px-1.5 py-1 text-xs min-w-0 flex-1"
                    style={{ background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--line)" }}
                    aria-label="Add to the exco"
                  >
                    <option value="">Add someone to the exco…</option>
                    {free.slice(0, 40).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.party} · {p.name} · competence {Math.round(p.competence)}
                        {homeOf(p) === regionOf(t.state) ? " · local" : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn btn-ghost"
                    disabled={!adding}
                    onClick={() => {
                      draftState(t.state, { add: Number(adding) });
                      setAdding("");
                    }}
                  >
                    Add
                  </button>
                </div>
              )}
            </section>
          </div>

          <aside className="flex flex-col gap-3 lg:sticky lg:top-4">
            {Object.keys(fair).length > 1 && (
              <section className="panel p-3 flex flex-col gap-2">
                <h3 className="eyebrow">Fair shares</h3>
                {Object.entries(fair).map(([party, f]) => (
                  <div key={party} className="text-xs flex items-center gap-2">
                    <PartyFlag id={party} size={11} />
                    <span className="w-16 truncate font-semibold" title={PARTIES[party]?.name}>
                      {party}
                    </span>
                    <span className="relative flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                      <span className="absolute inset-y-0 left-0" style={{ width: `${Math.min(100, (f / 1.6) * 100)}%`, background: f >= 0.9 ? "var(--good)" : f >= 0.6 ? "var(--accent)" : "var(--bad)" }} />
                    </span>
                    <span className="w-10 text-right tabular-nums">{Math.round(f * 100)}%</span>
                  </div>
                ))}
              </section>
            )}
            <button
              className="btn hero-cta"
              disabled={!t.mb}
              onClick={() => {
                sfx("majority");
                swearInState(t.state);
              }}
            >
              Angkat sumpah · Swear them in
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Who({ p, region }: { p: Person; region: string }) {
  const local = homeOf(p) === region;
  return (
    <span className="flex items-center gap-2 text-xs min-w-0">
      <PartyFlag id={p.party} size={11} />
      <span className="font-semibold truncate">{p.name}</span>
      <span className="whitespace-nowrap" style={{ color: "var(--muted)" }}>
        comp {Math.round(p.competence)} · trust {Math.round(p.loyalty)}
        {local ? " · local" : " · outsider"}
      </span>
    </span>
  );
}

/** A hung assembly: you have two weeks to win over enough members to govern. */
export function StateTalksScreen() {
  const game = useGame((s) => s.game)!;
  const { inviteStateParty, closeStateTalks, sendMission } = useGame();
  const t = game.stateTalks!;
  const [offer, setOffer] = useState<Record<string, number>>({});
  const name = STATE_BY_ID[t.state].name;
  const total = DUNS_BY_STATE[t.state].length;
  const seats = stateSeats(game, t.state);
  const mine = talksSeats(game, [game.player, ...t.joined]);
  const rival = talksSeats(game, [t.rival, ...t.rivalJoined]);
  const need = Math.floor(total / 2) + 1;
  const options = talksOptions(game);
  const chief = holderOf(game, game.coalitions[game.player].members[0], chiefKey(regionOf(t.state)));
  const chiefBlocked = chief ? missionBlocked(game, chief.id) : "Your party has no chief here.";

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Hung assembly in ${name}`}>
      <div className="modal-card max-w-2xl w-full flex flex-col gap-3">
        <div>
          <div className="eyebrow">Hung assembly · {name}</div>
          <h2 className="text-xl font-black">Find {need} seats to govern</h2>
          <p className="text-sm" style={{ color: "var(--ink-2)" }}>
            Nobody has a majority. Offer exco seats to win partners; your state chief can work the assembly on a mission. Talks close in{" "}
            {Math.max(0, t.deadline - game.week)} week(s).
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="inset p-2">
            <div className="text-xs" style={{ color: "var(--muted)" }}>
              Your side
            </div>
            <div className="text-2xl font-black tabular-nums">
              {mine} / {need}
            </div>
            <div className="text-xs">{[game.player, ...t.joined].map(cshort).join(" + ")}</div>
          </div>
          <div className="inset p-2">
            <div className="text-xs" style={{ color: "var(--muted)" }}>
              {cshort(t.rival)}&apos;s side
            </div>
            <div className="text-2xl font-black tabular-nums">{rival}</div>
            <div className="text-xs">{[t.rival, ...t.rivalJoined].map(cshort).join(" + ")}</div>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          {options.length === 0 && <p className="text-sm">Nobody left to ask.</p>}
          {options.map((c) => {
            const posts = offer[c] ?? 1;
            return (
              <div key={c} className="inset px-2.5 py-2 flex flex-wrap items-center gap-2">
                <CoalitionFlag game={game} c={c} size={14} />
                <span className="font-semibold">{cshort(c)}</span>
                <span className="text-xs tabular-nums" style={{ color: "var(--muted)" }}>
                  {seats[c] ?? 0} seats · chance {Math.round(inviteChance(game, c, posts) * 100)}%
                </span>
                <label className="text-xs ml-auto flex items-center gap-1">
                  Exco seats
                  <select value={posts} onChange={(e) => setOffer({ ...offer, [c]: Number(e.target.value) })} className="rounded px-1 py-0.5" style={{ background: "var(--surface-2)", color: "var(--ink)" }}>
                    {[0, 1, 2, 3].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="btn" onClick={() => inviteStateParty(c, posts)}>
                  Invite
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <button className="btn btn-ghost" disabled={!!chiefBlocked} title={chiefBlocked ?? undefined} onClick={() => chief && sendMission(chief.id)}>
            {chief ? `Send ${chief.name} to work the assembly` : "No state chief"} · 1 AP{t.bonus ? ` (+${Math.round(t.bonus * 100)}% so far)` : ""}
          </button>
          <button className="btn btn-ghost" onClick={closeStateTalks}>
            End the talks now
          </button>
        </div>
      </div>
    </div>
  );
}
