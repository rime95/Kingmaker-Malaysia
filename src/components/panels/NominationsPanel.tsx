"use client";

import { useMemo, useState } from "react";
import {
  NOMINATION,
  STATUS_INFO,
  candidateStrength,
  partySeats,
  pickedFor,
  seatStatus,
  shortlist,
  standable,
  strengthParts,
  yourParty,
  type SeatStatus,
} from "@/game/systems/nominations";
import {
  ageOf,
  byId,
  homeOf,
  leaderOfParty,
  mpOf,
  type Person,
} from "@/game/systems/people";
import { profileOf } from "@/game/systems/profiles";
import { regionName } from "@/game/systems/posts";
import {
  TALKS,
  goodwillWith,
  talkSeats,
  talksBlocked,
  type TalkSeat,
} from "@/game/systems/seattalks";
import { winChance } from "@/game/systems/polls";
import { useGame } from "@/store/gameStore";
import {
  SEATS,
  STATES,
  STATE_BY_ID,
  contestingIn,
  cshort,
  regionOf,
  type CoalitionId,
} from "@/game/world";
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
  const hasPartners =
    game.pacts.length > 0 || game.coalitions[game.player].members.length > 1;

  return (
    <div className="flex flex-col gap-4">
      {hasPartners && <SeatTalks />}
      {!n ? (
        <div
          className="flex flex-col gap-3 text-sm"
          style={{ color: "var(--ink-2)" }}
        >
          <p>
            Candidates are named when Parliament is dissolved. The window stays
            open for {NOMINATION.window} weeks, until nomination day; then the
            names lock and the campaign runs to polling day.
          </p>
          <p>
            {president
              ? "As party president you sign off every candidate your party puts up: each has a profession, traits and a record that play differently seat to seat. Partner parties pick their own."
              : `Your party president, ${leaderOfParty(game, yourParty(game))?.name ?? "the president"}, draws up the list. Your home seat is yours if you are Ketua Bahagian or above and they trust you (loyalty ${NOMINATION.homeLoyalty}+).`}
          </p>
          {hasPartners && (
            <p>
              Agree who stands where with your partners now: seat talks lock on
              nomination day.
            </p>
          )}
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
  const partners = [...new Set(rows.map((r) => `${r.kind}:${r.partner}`))].map(
    (k) => {
      const [kind, partner] = k.split(":") as [TalkSeat["kind"], string];
      const mine = rows.filter((r) => r.kind === kind && r.partner === partner);
      return {
        kind,
        partner,
        gw: goodwillWith(game, kind, partner),
        you: mine.filter((r) => r.standing === "you").length,
        them: mine.filter((r) => r.standing === "them").length,
      };
    },
  );
  // Partner seats you could take, easiest first; your seats, weakest claim first.
  const shown = rows
    .filter((r) => r.standing === side)
    .sort((a, b) => (side === "them" ? a.claim - b.claim : b.claim - a.claim))
    .slice(0, 40);

  return (
    <details className="inset px-3 py-2 flex flex-col gap-2">
      <summary className="eyebrow cursor-pointer">
        Seat talks with partners ·{" "}
        {partners
          .map(
            (p) =>
              `${p.kind === "pact" ? cshort(p.partner as CoalitionId) : p.partner} ${p.you}–${p.them}`,
          )
          .join(" · ")}
      </summary>
      <div className="flex flex-col gap-2 mt-2">
        <div className="grid gap-1.5">
          {partners.map((p) => (
            <div
              key={`${p.kind}${p.partner}`}
              className="inset px-2.5 py-2 text-xs flex items-center gap-2"
            >
              {p.kind === "pact" ? (
                <CoalitionFlag
                  game={game}
                  c={p.partner as CoalitionId}
                  size={13}
                />
              ) : (
                <PartyFlag id={p.partner} size={13} />
              )}
              <span className="font-semibold">
                {p.kind === "pact"
                  ? `${cshort(p.partner as CoalitionId)} (pact)`
                  : `${p.partner} (in your coalition)`}
              </span>
              <span
                className="ml-auto tabular-nums"
                style={{ color: "var(--ink-2)" }}
              >
                you {p.you} · them {p.them}
              </span>
              <span
                className="w-16 h-1.5 rounded-full overflow-hidden"
                style={{ background: "var(--surface-2)" }}
                title={`Goodwill ${Math.round(p.gw)}`}
              >
                <span
                  className="block h-full"
                  style={{
                    width: `${p.gw}%`,
                    background:
                      p.gw < 25
                        ? "var(--bad)"
                        : p.gw < 50
                          ? "var(--accent)"
                          : "var(--good)",
                  }}
                />
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Each side keeps the seats it holds; open seats are shared by vote.
          Claim a seat and goodwill falls (more where their claim is strong, a
          lot where they hold it). Concede one and it rises. Below {TALKS.floor}{" "}
          they refuse. {blocked ?? "Talks lock on nomination day."}
        </p>
        <div className="flex gap-1">
          <button
            className="chip text-xs"
            aria-pressed={side === "them"}
            onClick={() => setSide("them")}
          >
            Their seats
          </button>
          <button
            className="chip text-xs"
            aria-pressed={side === "you"}
            onClick={() => setSide("you")}
          >
            Your seats
          </button>
        </div>
        <ul className="flex flex-col gap-1 max-h-72 overflow-y-auto scroll-thin">
          {shown.map((r) => (
            <li
              key={`${r.kind}${r.partner}${r.seat}`}
              className="inset px-2.5 py-1.5 text-xs flex items-center gap-2"
            >
              {r.kind === "pact" ? (
                <CoalitionFlag
                  game={game}
                  c={
                    (r.standing === "you"
                      ? game.player
                      : r.partner) as CoalitionId
                  }
                  size={10}
                />
              ) : (
                <PartyFlag
                  id={r.standing === "you" ? yourParty(game) : r.partner}
                  size={10}
                />
              )}
              <button
                className="text-left min-w-0 flex-1"
                onClick={() => focusSeat(r.seat)}
              >
                <span className="font-semibold truncate block">
                  {SEATS[r.seat].name}
                  {r.held ? (
                    <span style={{ color: "var(--muted)" }}>
                      {" "}
                      · held by {r.held === "you" ? "you" : "them"}
                    </span>
                  ) : null}
                </span>
                <span style={{ color: "var(--muted)" }}>
                  their claim {Math.round(r.claim * 100)}% ·{" "}
                  {r.kind === "pact"
                    ? cshort(r.partner as CoalitionId)
                    : r.partner}
                </span>
              </button>
              <button
                className="chip !py-1 text-xs"
                disabled={!!blocked}
                onClick={() => talkSeat(r, r.standing === "them")}
              >
                {r.standing === "them" ? "Claim" : "Concede"}
              </button>
            </li>
          ))}
          {!shown.length && (
            <li className="text-xs" style={{ color: "var(--muted)" }}>
              No seats on this side.
            </li>
          )}
        </ul>
      </div>
    </details>
  );
}

const signed = (v: number) =>
  `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(0)}`;

/** One candidate: who they are, and why they pull what they do here. */
function CandidateCard({
  p,
  seat,
  current,
  onPick,
}: {
  p: Person;
  seat: number;
  current?: boolean;
  onPick?: () => void;
}) {
  const game = useGame((s) => s.game)!;
  const prof = profileOf(p);
  const you = p.id === game.youId;
  const v = candidateStrength(game, seat, p);
  const parts = strengthParts(game, seat, p).filter(
    (x) => Math.abs(x.value) >= 0.005,
  );
  const local = homeOf(p) === regionOf(SEATS[seat].state);
  const elsewhere = pickedFor(game, p.id, seat);
  return (
    <div
      className="inset px-2.5 py-2 text-xs flex flex-col gap-1.5"
      style={{ outline: current ? "2px solid var(--gold)" : undefined }}
    >
      <div className="flex items-start gap-2">
        <span
          className="party-avatar !w-8 !h-8 !text-xs"
          style={{ background: "var(--surface-2)" }}
          aria-hidden
        >
          {initials(p.name)}
        </span>
        <div className="min-w-0 flex-1">
          <b className="block truncate">
            {p.name}
            {you && <span style={{ color: "var(--accent)" }}> (you)</span>}
          </b>
          <span style={{ color: "var(--muted)" }}>
            {ageOf(p, game.week)} · {prof.job} ·{" "}
            {local ? "local" : `from ${regionName(homeOf(p))}`}
          </span>
        </div>
        <span
          className="text-base font-black tabular-nums"
          style={{ color: v >= 0 ? "var(--good)" : "var(--bad)" }}
          title="Candidate pull: their personal vote here"
        >
          {signed(v)}
        </span>
      </div>
      <ul className="flex flex-col gap-0.5" aria-label="Why">
        {parts.map((x) => (
          <li
            key={x.label}
            className="flex justify-between gap-2"
            style={{ color: "var(--ink-2)" }}
          >
            <span>{x.label}</span>
            <span
              className="tabular-nums"
              style={{ color: x.value >= 0 ? "var(--good)" : "var(--bad)" }}
            >
              {signed(x.value)}
            </span>
          </li>
        ))}
      </ul>
      {elsewhere !== undefined && (
        <div style={{ color: "var(--muted)" }}>
          Picked for {SEATS[elsewhere].name}: picking them here moves them.
        </div>
      )}
      {current ? (
        <span className="trait-chip self-start">Current pick</span>
      ) : (
        onPick && (
          <button className="btn btn-ghost self-start" onClick={onPick}>
            Pick
          </button>
        )
      )}
    </div>
  );
}

type Filter = "attention" | "battle" | "safe" | "long" | "all";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "attention", label: "Needs attention" },
  { id: "battle", label: "Battlegrounds" },
  { id: "safe", label: "Safe" },
  { id: "long", label: "Long shots" },
  { id: "all", label: "All" },
];

type RowData = {
  i: number;
  chance: number;
  pick: Person | undefined;
  status: SeatStatus;
  isNew: boolean;
  deposit: boolean;
  strength: number;
};

/** The nominations board: every seat your party fights, grouped by state, with what each one needs. */
function Candidates() {
  const game = useGame((s) => s.game)!;
  const autoNominate = useGame((s) => s.autoNominate);
  const reads = useReads();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("attention");
  const [open, setOpen] = useState<number | null>(null);
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const n = game.nominations!;
  const president = game.career.rung >= 6;
  const home = game.career.homeSeat;
  const pres = leaderOfParty(game, yourParty(game));

  const rows: RowData[] = useMemo(
    () =>
      partySeats(game).map((i) => {
        const chance = reads.length
          ? (winChance(reads[i], game.player, game.week) ?? 0)
          : 0;
        const pick = byId(game, game.nominations!.picks[i]);
        const isNew = !contestingIn(SEATS[i]).includes(game.player);
        return {
          i,
          chance,
          pick,
          status: seatStatus(game, i),
          isNew,
          deposit: isNew && chance < 0.1,
          strength: pick ? candidateStrength(game, i, pick) : 0,
        };
      }),
    [game, reads],
  );
  // A weak pick only matters where the seat is winnable.
  const needs = (r: RowData) => (r.status === "weak" ? r.chance >= 0.1 : STATUS_INFO[r.status].attention) || r.deposit;
  const totals = {
    seats: rows.length,
    named: rows.filter((r) => r.pick).length,
    weak: rows.filter((r) => r.status === "weak" && r.chance >= 0.1).length,
    dropped: rows.filter((r) => r.status === "dropped").length,
    deposit: rows.filter((r) => r.deposit).length,
  };
  const youPlaced = rows.some((r) => r.status === "you");
  const match = (r: RowData) => {
    const term = q.toLowerCase();
    if (
      term &&
      !SEATS[r.i].name.toLowerCase().includes(term) &&
      !r.pick?.name.toLowerCase().includes(term)
    )
      return false;
    if (filter === "attention")
      return (
        needs(r) || (r.chance > 0.3 && r.chance < 0.7 && r.strength < 0.03)
      );
    if (filter === "battle") return r.chance > 0.3 && r.chance < 0.7;
    if (filter === "safe") return r.chance >= 0.7;
    if (filter === "long") return r.chance <= 0.3;
    return true;
  };
  const shown = rows.filter((r) => r.i !== home && match(r));
  const groups = STATES.map((st) => ({
    st,
    list: shown
      .filter((r) => SEATS[r.i].state === st.id)
      .sort((a, b) => b.chance - a.chance),
  })).filter((g) => g.list.length);
  const mine = rows.find((r) => r.i === home);

  return (
    <>
      <section className="inset p-3 flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <b className="text-sm">
            {n.open
              ? `Nomination day in ${Math.max(0, n.closesWeek - game.week)} week${n.closesWeek - game.week === 1 ? "" : "s"}`
              : "Names are locked"}
          </b>
          {president && n.open && (
            <button className="btn btn-ghost" onClick={autoNominate}>
              Auto-pick the strongest
            </button>
          )}
        </div>
        <div className="grid grid-cols-5 gap-1 text-center text-xs">
          <Tally n={totals.seats} label="seats" />
          <Tally n={totals.named} label="named" />
          <Tally
            n={totals.weak}
            label="weak"
            tone={totals.weak ? "var(--accent)" : undefined}
          />
          <Tally
            n={totals.dropped}
            label="MPs dropped"
            tone={totals.dropped ? "var(--bad)" : undefined}
          />
          <Tally
            n={totals.deposit}
            label="deposits at risk"
            tone={totals.deposit ? "var(--bad)" : undefined}
          />
        </div>
        {!president && (
          <p className="text-xs" style={{ color: "var(--ink-2)" }}>
            {pres?.name} picks the candidates. For {SEATS[home].name}:{" "}
            {n.picks[home] === game.youId
              ? "you are on the list"
              : `not you yet (their loyalty ${Math.round(pres?.loyalty ?? 0)}, needs ${NOMINATION.homeLoyalty}; meet them in the People panel)`}
            .
          </p>
        )}
        {president && !youPlaced && (
          <p className="text-xs" style={{ color: "var(--accent)" }}>
            You stand only in your own seat, {SEATS[home].name}, and your party
            doesn&apos;t put up the candidate there this time.
          </p>
        )}
      </section>

      {mine && <SeatRow r={mine} onOpen={() => setOpen(mine.i)} pinned />}

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1" role="tablist">
          {FILTERS.map((x) => (
            <button
              key={x.id}
              role="tab"
              className="chip !py-1 text-xs"
              aria-pressed={filter === x.id}
              onClick={() => setFilter(x.id)}
            >
              {x.label}
            </button>
          ))}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a seat or name"
            className="ml-auto rounded-md px-2 py-1 text-xs w-40"
            style={{
              background: "var(--surface-2)",
              color: "var(--ink)",
              border: "1px solid var(--line)",
            }}
          />
        </div>
        {!groups.length && (
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            {filter === "attention"
              ? "Nothing needs you: every seat has a sound candidate."
              : "No seats here."}
          </p>
        )}
        {groups.map(({ st, list }) => {
          const all = rows.filter((r) => SEATS[r.i].state === st.id);
          const fold = folded[st.id];
          const todo = all.filter(needs).length;
          return (
            <div key={st.id} className="flex flex-col gap-0.5">
              <button
                className="flex items-baseline justify-between text-xs px-1 py-1"
                style={{ borderBottom: "1px solid var(--line)" }}
                aria-expanded={!fold}
                onClick={() => setFolded({ ...folded, [st.id]: !fold })}
              >
                <span className="eyebrow">
                  {fold ? "▸" : "▾"} {st.name} · {all.length}
                </span>
                <span style={{ color: "var(--muted)" }}>
                  {all.filter((r) => r.pick).length} named
                  {todo ? ` · ${todo} need you` : ""}
                </span>
              </button>
              {!fold &&
                list.map((r) => (
                  <SeatRow key={r.i} r={r} onOpen={() => setOpen(r.i)} />
                ))}
            </div>
          );
        })}
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Candidate pull is a candidate&apos;s personal vote in that seat:
          standing, being the sitting MP, being local, and traits that suit the
          seat. Click a seat to compare candidates. Under 12.5% of the vote
          loses the RM 10k deposit.
        </p>
      </section>

      {open !== null && <Drawer seat={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function Tally({
  n,
  label,
  tone,
}: {
  n: number;
  label: string;
  tone?: string;
}) {
  return (
    <div>
      <div
        className="text-lg font-black tabular-nums"
        style={tone ? { color: tone } : undefined}
      >
        {n}
      </div>
      <div style={{ color: "var(--muted)" }}>{label}</div>
    </div>
  );
}

/** One seat on one line: status, seat, chance, who stands, their pull. */
function SeatRow({
  r,
  onOpen,
  pinned,
}: {
  r: RowData;
  onOpen: () => void;
  pinned?: boolean;
}) {
  const info = STATUS_INFO[r.status];
  const tone =
    r.status === "dropped" || r.deposit
      ? "var(--bad)"
      : info.attention
        ? "var(--accent)"
        : r.status === "kept" || r.status === "you"
          ? "var(--gold)"
          : "var(--good)";
  const local = r.pick ? homeOf(r.pick) === regionOf(SEATS[r.i].state) : false;
  return (
    <button
      className="inset w-full text-left px-2.5 py-1.5 text-xs grid grid-cols-[16px_minmax(0,1.2fr)_40px_minmax(0,1.4fr)_36px] items-center gap-2"
      onClick={onOpen}
      style={pinned ? { outline: "1px solid var(--gold)" } : undefined}
    >
      <span style={{ color: tone }} title={info.label} aria-label={info.label}>
        {info.icon}
      </span>
      <span className="truncate font-semibold">
        {pinned ? "Your seat: " : ""}
        {SEATS[r.i].name}
        {r.isNew && <span style={{ color: "var(--accent)" }}> · new</span>}
      </span>
      <span className="tabular-nums text-right">{chancePct(r.chance)}</span>
      <span
        className="truncate"
        style={{ color: r.pick ? "var(--ink)" : "var(--muted)" }}
      >
        {r.pick ? r.pick.name : "— no name —"}
        {r.pick && (
          <span style={{ color: "var(--muted)" }}>
            {local ? " · local" : " · outsider"}
          </span>
        )}
        {r.deposit && (
          <span style={{ color: "var(--bad)" }}> · deposit at risk</span>
        )}
        {r.status === "dropped" && (
          <span style={{ color: "var(--bad)" }}> · MP dropped</span>
        )}
      </span>
      <span
        className="tabular-nums text-right font-bold"
        style={{ color: r.strength >= 0 ? "var(--good)" : "var(--bad)" }}
      >
        {r.pick ? signed(r.strength) : ""}
      </span>
    </button>
  );
}

/** One seat in detail: its candidates side by side. */
function Drawer({ seat, onClose }: { seat: number; onClose: () => void }) {
  const game = useGame((s) => s.game)!;
  const nominate = useGame((s) => s.nominate);
  const reads = useReads();
  const n = game.nominations!;
  const president = game.career.rung >= 6;
  const pick = byId(game, n.picks[seat]);
  const mp = mpOf(game, seat);
  const chance = reads.length
    ? winChance(reads[seat], game.player, game.week)
    : null;
  const top = shortlist(game, seat, 3);
  const others = standable(game, seat)
    .filter((p) => p.id !== pick?.id && !top.some((x) => x.id === p.id))
    .map((p) => ({ p, v: candidateStrength(game, seat, p) }))
    .sort((a, b) => b.v - a.v);
  const ownMp =
    mp && mp.party === yourParty(game) && !mp.retired ? mp : undefined;
  const choose = (id: number) => {
    if (
      ownMp &&
      pick?.id === ownMp.id &&
      id !== ownMp.id &&
      !confirm(
        `Drop ${ownMp.name}, the sitting MP? They lose loyalty and may run as an independent against you.`,
      )
    )
      return;
    nominate(seat, id);
  };
  const cards = [
    ...(pick ? [pick] : []),
    ...top.filter((p) => p.id !== pick?.id),
  ].slice(0, 3);
  return (
    <div
      className="fixed inset-y-0 right-0 z-40 w-full max-w-[460px] flex flex-col"
      role="dialog"
      aria-label={`Candidates for ${SEATS[seat].name}`}
      style={{
        background: "var(--surface)",
        borderLeft: "1px solid var(--line)",
        boxShadow: "-12px 0 32px rgba(0,0,0,.35)",
      }}
    >
      <header
        className="p-3 flex items-start gap-2"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <div className="flex-1 min-w-0">
          <div className="eyebrow">{STATE_BY_ID[SEATS[seat].state].name}</div>
          <h3 className="text-lg font-black truncate">
            {SEATS[seat].code} {SEATS[seat].name}
          </h3>
          <div className="text-xs" style={{ color: "var(--ink-2)" }}>
            {chance !== null ? `${chancePct(chance)} to win` : ""}
            {mp ? ` · sitting MP ${mp.name} (${mp.party})` : ""}
          </div>
        </div>
        <button className="btn btn-ghost" onClick={onClose}>
          Close
        </button>
      </header>
      <div className="flex-1 overflow-y-auto scroll-thin p-3 flex flex-col gap-2">
        {cards.map((p) => (
          <CandidateCard
            key={p.id}
            p={p}
            seat={seat}
            current={p.id === pick?.id}
            onPick={president && n.open ? () => choose(p.id) : undefined}
          />
        ))}
        {president && n.open && (
          <>
            <div className="flex flex-wrap gap-1.5">
              <button
                className="btn btn-ghost"
                onClick={() => nominate(seat, "newface")}
              >
                + New face (young local)
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => nominate(seat, "local")}
              >
                + Poach a local figure (RM 500k)
              </button>
            </div>
            {others.length > 0 && (
              <select
                value=""
                onChange={(e) =>
                  e.target.value && choose(Number(e.target.value))
                }
                className="rounded-md px-1.5 py-1.5 text-xs"
                style={{
                  background: "var(--surface-2)",
                  color: "var(--ink)",
                  border: "1px solid var(--line)",
                }}
                aria-label="Someone else"
              >
                <option value="">Someone else ({others.length})…</option>
                {others.slice(0, 60).map(({ p, v }) => {
                  const at = pickedFor(game, p.id, seat);
                  return (
                    <option key={p.id} value={p.id}>
                      {signed(v)} · {p.name} ·{" "}
                      {homeOf(p) === regionOf(SEATS[seat].state)
                        ? "local"
                        : regionName(homeOf(p))}
                      {at !== undefined
                        ? ` · picked for ${SEATS[at].name}`
                        : ""}
                    </option>
                  );
                })}
              </select>
            )}
          </>
        )}
        {ownMp && pick && ownMp.id !== pick.id && (
          <p className="text-xs" style={{ color: "var(--bad)" }}>
            You are dropping the sitting MP, {ownMp.name}. They lose loyalty and
            may stand as an independent.
          </p>
        )}
      </div>
    </div>
  );
}
