"use client";

import { useMemo, useState } from "react";
import { NOMINATION, candidateStrength, eligible, partySeats, shortlist, yourParty } from "@/game/systems/nominations";
import { ageOf, byId, leaderOfParty, type Person } from "@/game/systems/people";
import { TRAITS, profileOf } from "@/game/systems/profiles";
import { TALKS, goodwillWith, talkSeats, talksBlocked, type TalkSeat } from "@/game/systems/seattalks";
import { winChance } from "@/game/systems/polls";
import { useGame } from "@/store/gameStore";
import { SEATS, STATE_BY_ID, contestingIn, cshort, type CoalitionId } from "@/game/world";
import { ActionCard } from "../ActionCard";
import { chancePct, useReads } from "../common";
import { projectAllFor } from "@/game/state";
import { CoalitionFlag, PartyFlag } from "../flags";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => w && w[0] === w[0].toUpperCase())
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

/** Name your party's candidates (as president), or see who the president picked and where you stand. */
export function NominationsPanel() {
  const game = useGame((s) => s.game)!;
  const n = game.nominations;
  const president = game.career.rung >= 6;
  const hasPartners = game.pacts.length > 0 || game.coalitions[game.player].members.length > 1;

  return (
    <div className="flex flex-col gap-4">
      {hasPartners && <SeatTalks />}
      {!n ? (
        <div className="flex flex-col gap-3 text-sm" style={{ color: "var(--ink-2)" }}>
          <p>
            Candidates are named when Parliament is dissolved. The window stays open for {NOMINATION.window} weeks, until nomination day; then the names lock and the
            campaign runs to polling day.
          </p>
          <p>
            {president
              ? "As party president you sign off every candidate your party puts up: each has a profession, traits and a record that play differently seat to seat. Partner parties pick their own."
              : `Your party president, ${leaderOfParty(game, yourParty(game))?.name ?? "the president"}, draws up the list. Your home seat is yours if you are Ketua Bahagian or above and they trust you (loyalty ${NOMINATION.homeLoyalty}+).`}
          </p>
          {hasPartners && <p>Agree who stands where with your partners now: seat talks lock on nomination day.</p>}
        </div>
      ) : (
        <Candidates />
      )}
    </div>
  );
}

/** Who stands where: your coalition partners and pact partners. */
function SeatTalks() {
  const game = useGame((s) => s.game)!;
  const talkSeat = useGame((s) => s.talkSeat);
  const focusSeat = useGame((s) => s.focusSeat);
  const [side, setSide] = useState<"them" | "you">("them");
  // Claims are judged on each side's own vote, before anyone stands aside.
  const rows = useMemo(() => {
    const proj = projectAllFor({ ...game, pacts: [] });
    return talkSeats(game, (i) => proj[i].shares);
  }, [game]);
  const blocked = talksBlocked(game);
  const partners = [...new Set(rows.map((r) => `${r.kind}:${r.partner}`))].map((k) => {
    const [kind, partner] = k.split(":") as [TalkSeat["kind"], string];
    const mine = rows.filter((r) => r.kind === kind && r.partner === partner);
    return { kind, partner, gw: goodwillWith(game, kind, partner), you: mine.filter((r) => r.standing === "you").length, them: mine.filter((r) => r.standing === "them").length };
  });
  // Partner seats you could take, easiest first; your seats, weakest claim first.
  const shown = rows
    .filter((r) => r.standing === side)
    .sort((a, b) => (side === "them" ? a.claim - b.claim : b.claim - a.claim))
    .slice(0, 40);

  return (
    <section className="flex flex-col gap-2">
      <h3 className="eyebrow">Seat talks · who stands where</h3>
      <div className="grid gap-1.5">
        {partners.map((p) => (
          <div key={`${p.kind}${p.partner}`} className="inset px-2.5 py-2 text-xs flex items-center gap-2">
            {p.kind === "pact" ? <CoalitionFlag game={game} c={p.partner as CoalitionId} size={13} /> : <PartyFlag id={p.partner} size={13} />}
            <span className="font-semibold">{p.kind === "pact" ? `${cshort(p.partner as CoalitionId)} (pact)` : `${p.partner} (in your coalition)`}</span>
            <span className="ml-auto tabular-nums" style={{ color: "var(--ink-2)" }}>
              you {p.you} · them {p.them}
            </span>
            <span className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }} title={`Goodwill ${Math.round(p.gw)}`}>
              <span className="block h-full" style={{ width: `${p.gw}%`, background: p.gw < 25 ? "var(--bad)" : p.gw < 50 ? "var(--accent)" : "var(--good)" }} />
            </span>
          </div>
        ))}
      </div>
      <p className="text-[11px]" style={{ color: "var(--muted)" }}>
        Each side keeps the seats it holds; open seats are shared by vote. Claim a seat and goodwill falls (more where their claim is strong, a lot where they hold it).
        Concede one and it rises. Below {TALKS.floor} they refuse. {blocked ?? "Talks lock on nomination day."}
      </p>
      <div className="flex gap-1">
        <button className="chip text-xs" aria-pressed={side === "them"} onClick={() => setSide("them")}>
          Their seats
        </button>
        <button className="chip text-xs" aria-pressed={side === "you"} onClick={() => setSide("you")}>
          Your seats
        </button>
      </div>
      <ul className="flex flex-col gap-1 max-h-72 overflow-y-auto scroll-thin">
        {shown.map((r) => (
          <li key={`${r.kind}${r.partner}${r.seat}`} className="inset px-2.5 py-1.5 text-xs flex items-center gap-2">
            {r.kind === "pact" ? <CoalitionFlag game={game} c={(r.standing === "you" ? game.player : r.partner) as CoalitionId} size={10} /> : <PartyFlag id={r.standing === "you" ? yourParty(game) : r.partner} size={10} />}
            <button className="text-left min-w-0 flex-1" onClick={() => focusSeat(r.seat)}>
              <span className="font-semibold truncate block">
                {SEATS[r.seat].name}
                {r.held ? <span style={{ color: "var(--muted)" }}> · held by {r.held === "you" ? "you" : "them"}</span> : null}
              </span>
              <span style={{ color: "var(--muted)" }}>
                their claim {Math.round(r.claim * 100)}% · {r.kind === "pact" ? cshort(r.partner as CoalitionId) : r.partner}
              </span>
            </button>
            <button className="chip !py-1 text-xs" disabled={!!blocked} onClick={() => talkSeat(r, r.standing === "them")}>
              {r.standing === "them" ? "Claim" : "Concede"}
            </button>
          </li>
        ))}
        {!shown.length && <li className="text-xs" style={{ color: "var(--muted)" }}>No seats on this side.</li>}
      </ul>
    </section>
  );
}

/** One candidate: who they are and what they bring here. */
function CandidateCard({ p, seat, picked, onPick, you }: { p: Person; seat: number; picked?: boolean; onPick?: () => void; you?: boolean }) {
  const game = useGame((s) => s.game)!;
  const prof = profileOf(p);
  const v = candidateStrength(game, seat, p);
  return (
    <div className="inset px-2.5 py-2 text-xs flex gap-2 items-start" style={{ outline: picked ? "2px solid var(--accent)" : undefined }}>
      <span className="party-avatar !w-8 !h-8 !text-[10px]" style={{ background: "var(--surface-2)" }} aria-hidden>
        {initials(p.name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <b className="truncate">{p.name}</b>
          {you && <span style={{ color: "var(--accent)" }}>(you)</span>}
          <span style={{ color: "var(--muted)" }}>
            {ageOf(p, game.week)} · {prof.job}
          </span>
        </div>
        <div className="flex flex-wrap gap-1 mt-1">
          {p.seat === seat && <span className="trait-chip">★ Sitting MP</span>}
          {p.chairman && <span className="trait-chip">Party Chairman</span>}
          {prof.traits.map((t) => (
            <span key={t} className={`trait-chip ${TRAITS[t].risk ? "trait-risk" : ""}`} title={TRAITS[t].blurb}>
              {TRAITS[t].name}
            </span>
          ))}
        </div>
        <p className="mt-1 leading-snug" style={{ color: "var(--ink-2)" }}>
          {prof.bio} Standing {Math.round(p.influence)}, integrity {prof.integrity}.
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 flex-none">
        <span className="font-bold tabular-nums" style={{ color: v >= 0 ? "var(--good)" : "var(--bad)" }}>
          {v >= 0 ? "+" : "−"}
          {Math.abs(v * 100).toFixed(0)}
        </span>
        {onPick && !picked && (
          <button className="chip !py-0.5 text-[11px]" onClick={onPick}>
            Pick
          </button>
        )}
      </div>
    </div>
  );
}

function Candidates() {
  const game = useGame((s) => s.game)!;
  const nominate = useGame((s) => s.nominate);
  const autoNominate = useGame((s) => s.autoNominate);
  const focusSeat = useGame((s) => s.focusSeat);
  const reads = useReads();
  const [filter, setFilter] = useState("");
  const [band, setBand] = useState<"all" | "marginal" | "safe" | "uphill">("all");
  const [open, setOpen] = useState<number | null>(null);
  const n = game.nominations!;
  const president = game.career.rung >= 6;
  const chance = (i: number) => (reads.length ? (winChance(reads[i], game.player, game.week) ?? 0) : 0);
  const seats = useMemo(() => {
    const list = partySeats(game);
    return list.sort((a, b) => Math.abs(chance(a) - 0.5) - Math.abs(chance(b) - 0.5));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, reads]);
  const inBand = (i: number) => {
    const c = chance(i);
    return band === "all" || (band === "marginal" ? c > 0.3 && c < 0.7 : band === "safe" ? c >= 0.7 : c <= 0.3);
  };
  const shown = seats.filter((i) => inBand(i) && (!filter || SEATS[i].name.toLowerCase().includes(filter.toLowerCase())));
  const pres = leaderOfParty(game, yourParty(game));
  const home = game.career.homeSeat;

  return (
    <>
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
        {president && n.open && (
          <button className="btn mt-2 text-xs" onClick={autoNominate}>
            Auto-pick the strongest candidates
          </button>
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
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <h3 className="eyebrow flex-1">Your party&apos;s seats · battlegrounds first</h3>
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find a seat" className="rounded-md px-2 py-1 text-xs w-32" style={{ background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--line)" }} />
        </div>
        <div className="flex gap-1 mb-2">
          {(["all", "marginal", "safe", "uphill"] as const).map((b) => (
            <button key={b} className="chip text-xs capitalize" aria-pressed={band === b} onClick={() => setBand(b)}>
              {b}
            </button>
          ))}
        </div>
        <ul className="flex flex-col gap-1.5">
          {shown.map((i) => {
            const pick = byId(game, n.picks[i]);
            const c = reads.length ? winChance(reads[i], game.player, game.week) : null;
            const isNew = !contestingIn(SEATS[i]).includes(game.player);
            const expanded = open === i;
            const list = expanded ? shortlist(game, i, 3).filter((p) => p.id !== pick?.id) : [];
            const more = expanded ? eligible(game, i).filter((p) => p.id !== pick?.id && !list.some((x) => x.id === p.id)) : [];
            return (
              <li key={i} className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-xs">
                  <button className="text-left min-w-0 flex-1" onClick={() => focusSeat(i)}>
                    <span className="font-semibold">
                      {SEATS[i].name}
                      {isNew ? <span style={{ color: "var(--accent)" }}> · new branch</span> : null}
                    </span>
                    <span style={{ color: "var(--muted)" }}>
                      {" "}
                      · {STATE_BY_ID[SEATS[i].state].name}
                      {c !== null ? ` · ${chancePct(c)} to win` : ""}
                    </span>
                  </button>
                  {president && n.open && (
                    <button className="chip !py-0.5 text-[11px]" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : i)}>
                      {expanded ? "Close" : "Shortlist"}
                    </button>
                  )}
                </div>
                {pick ? <CandidateCard p={pick} seat={i} picked you={pick.id === game.youId} /> : <div className="inset px-2.5 py-2 text-xs">No candidate yet.</div>}
                {expanded && (
                  <div className="flex flex-col gap-1 pl-3" style={{ borderLeft: "2px solid var(--line)" }}>
                    {list.map((p) => (
                      <CandidateCard key={p.id} p={p} seat={i} onPick={() => nominate(i, p.id)} you={p.id === game.youId} />
                    ))}
                    <div className="flex flex-wrap gap-1">
                      <button className="chip text-[11px]" onClick={() => nominate(i, "newface")}>
                        + A new face (young local)
                      </button>
                      <button className="chip text-[11px]" onClick={() => nominate(i, "local")}>
                        + Poach a local figure (RM 500k)
                      </button>
                      {more.length > 0 && (
                        <select
                          value=""
                          onChange={(e) => e.target.value && nominate(i, Number(e.target.value))}
                          className="rounded-md px-1.5 py-1 text-[11px]"
                          style={{ background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--line)" }}
                        >
                          <option value="">Everyone else ({more.length})…</option>
                          {more.map((p) => (
                            <option key={p.id} value={p.id} style={{ background: "var(--raised)" }}>
                              {p.name} · standing {Math.round(p.influence)} · {profileOf(p).job}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
          The number on each card is their personal vote here. Traits play differently seat to seat: an ustaz in rural Malay seats, a technocrat in the cities, anak
          tempatan at home. Drop a sitting MP and they may run as an independent.
        </p>
      </section>
    </>
  );
}
