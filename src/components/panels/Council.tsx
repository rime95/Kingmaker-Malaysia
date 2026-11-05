"use client";

import { useState } from "react";
import { COUNCIL, appointBlocked, councilOf, councilTally, dropBlocked } from "@/game/systems/council";
import { POLLS, pollYear, slateMoveBlocked, type PollResult, type SlateMove } from "@/game/systems/partypolls";
import { FIRST_POLLS } from "@/game/data/structures";
import { POST_INFO } from "@/game/systems/posts";
import { divisionOf } from "@/game/systems/camps";
import { structure, type Person } from "@/game/systems/people";
import { weekDate } from "@/game/state";
import { useGame } from "@/store/gameStore";
import { SEATS } from "@/game/world";
import { campColorOf, campColors } from "../campColors";
import { fmtRM } from "../common";

const SLATE_MOVES: { id: SlateMove; name: string; cost: string }[] = [
  { id: "tour", name: "Tour the divisions", cost: `1 AP · ${fmtRM(POLLS.tour.cost)}` },
  { id: "posts", name: "Promise posts", cost: `1 AP · ${POLLS.posts.capital} capital` },
  { id: "money", name: "Money politics", cost: fmtRM(POLLS.money.cost) },
];

/** "Vice Presidents", but Malay titles as they are ("Naib Presiden"). */
const plural = (title: string) => (/^Naib /.test(title) ? title : `${title}s`);

/** The next party polls year from now. */
function nextPolls(year: number): number {
  for (let y = Math.max(year, FIRST_POLLS); y < year + 4; y++) if (pollYear(y)) return y;
  return year + 3;
}

/**
 * A party's supreme council, seat by seat: the elected (deputy, vice presidents, elected members), the appointed (yours
 * to fill and drop, as president) and the post-holders who sit by virtue of their post. In a poll year your slate is
 * run from here.
 */
export function CouncilSection({ party, yours }: { party: string; yours: boolean }) {
  const game = useGame((s) => s.game)!;
  const deep = useGame((s) => s.deep);
  const st = structure(party);
  const c = councilOf(game, party);
  const colors = campColors(game, party);
  const tally = yours ? councilTally(game, party) : null;
  const president = game.career.rung >= 6 && yours;
  const pp = yours ? game.partyPolls : null;
  const running = !!pp && !pp.result;
  const slate = new Set(pp ? [pp.slate.deputy, ...pp.slate.vps, ...pp.slate.council].filter((x): x is number => x !== undefined) : []);
  const [pick, setPick] = useState("");
  const [drop, setDrop] = useState("");
  const candidates = game.people
    .filter((p) => p.party === party && !p.retired && !p.chairman && p.rank < 2 && p.id !== game.youId)
    .sort((a, b) => b.influence - a.influence)
    .slice(0, 80);
  const appointWhy = pick ? appointBlocked(game, Number(pick), drop ? Number(drop) : undefined) : "Pick someone";

  const ctx = { colors, slate, president, running, councilName: st.council };

  const year = weekDate(game.week).getFullYear();
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="eyebrow">
          {st.council} · {c.size} seats
        </h3>
        {tally && (
          <span className="text-[11px]" style={{ color: tally.carries ? "var(--good)" : "var(--bad)" }}>
            With you {tally.yours} · against {tally.against} · undecided {tally.undecided} · {tally.carries ? "you carry a council vote" : "you'd lose a council vote"}
          </span>
        )}
      </div>
      <p className="text-[11px]" style={{ color: "var(--muted)" }}>
        Deputy, {st.vps} {plural(st.vpTitle)} and {st.elected} members are elected at the party polls (every {st.termYears} years; next June {running ? pp!.year : nextPolls(year)}). Up to {st.appointed} more are appointed by the president. Wing chiefs and the national post-holders sit by virtue of their post.
      </p>

      {president && running && (
        <div className="inset p-2.5 flex flex-col gap-1.5" style={{ outline: "1px solid var(--accent)" }}>
          <b className="text-xs" style={{ color: "var(--accent)" }}>
            Party polls in {Math.max(0, pp!.voteWeek - game.week)} weeks: back your slate
          </b>
          <span className="text-[11px]" style={{ color: "var(--ink-2)" }}>
            On your slate: {pp!.slate.deputy !== undefined ? "a deputy, " : ""}
            {pp!.slate.vps.length} of {st.vps} {plural(st.vpTitle)}, {pp!.slate.council.length} of {st.elected} members. Your effort {pp!.effort}. Division chiefs in your camp vote your slate; rival camps run their own.
          </span>
          <div className="flex flex-wrap gap-1.5">
            {SLATE_MOVES.map((m) => {
              const why = slateMoveBlocked(game, m.id);
              return (
                <button key={m.id} className="chip !py-1 text-xs" disabled={!!why} title={why ?? undefined} onClick={() => deep({ kind: "slateMove", move: m.id })}>
                  {m.name} · {m.cost}
                </button>
              );
            })}
          </div>
          <SlateAdd party={party} />
        </div>
      )}

      <ul className="flex flex-col gap-1">
        {c.president && <Row {...ctx} p={c.president} role="President" />}
        {c.deputy && <Row {...ctx} p={c.deputy} role="Deputy President · elected" post="deputy" />}
        {c.vps.map((p) => (
          <Row {...ctx} key={p.id} p={p} role={`${st.vpTitle} · elected`} post="vp" />
        ))}
      </ul>
      <details open={yours}>
        <summary className="text-xs cursor-pointer" style={{ color: "var(--ink-2)" }}>
          Elected members ({c.elected.length} of {st.elected})
        </summary>
        <ul className="flex flex-col gap-1 mt-1">
          {c.elected.map((p) => (
            <Row {...ctx} key={p.id} p={p} role="Elected member" post="council" />
          ))}
        </ul>
      </details>
      <details open={yours}>
        <summary className="text-xs cursor-pointer" style={{ color: "var(--ink-2)" }}>
          Appointed by the president ({c.appointed.length} of {st.appointed})
        </summary>
        <ul className="flex flex-col gap-1 mt-1">
          {c.appointed.map((p) => (
            <Row {...ctx} key={p.id} p={p} role="Appointed member" post="council" />
          ))}
        </ul>
        {president && (
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-xs">
            <select value={pick} onChange={(e) => setPick(e.target.value)} className="rounded-md px-1.5 py-1 text-xs min-w-0 flex-1" aria-label="Appoint to the council">
              <option value="">Appoint someone…</option>
              {candidates.map((p) => (
                <option key={p.id} value={p.id}>
                  {Math.round(p.influence)} · {p.name}
                  {p.seat !== null ? ` · MP ${SEATS[p.seat].name}` : ""}
                  {p.tokoh ? " · tokoh" : ""} · ♥ {Math.round(p.loyalty)}
                </option>
              ))}
            </select>
            {!c.openAppointed && (
              <select value={drop} onChange={(e) => setDrop(e.target.value)} className="rounded-md px-1.5 py-1 text-xs min-w-0" aria-label="Making room by dropping">
                <option value="">…in place of</option>
                {c.appointed.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
            <button
              className="btn btn-ghost"
              disabled={!!appointWhy}
              title={appointWhy ?? `${COUNCIL.appoint.capital} capital${drop ? ` + ${COUNCIL.drop.capital} to drop` : ""}`}
              onClick={() => {
                deep({ kind: "appointCouncil", id: Number(pick), drop: drop ? Number(drop) : undefined });
                setPick("");
                setDrop("");
              }}
            >
              Appoint
            </button>
          </div>
        )}
      </details>
      {c.exOfficio.length > 0 && (
        <details>
          <summary className="text-xs cursor-pointer" style={{ color: "var(--ink-2)" }}>
            By virtue of their post ({c.exOfficio.length})
          </summary>
          <ul className="flex flex-col gap-1 mt-1">
            {c.exOfficio.map(({ post, p }) => (
              <Row {...ctx} key={p.id} p={p} role={POST_INFO[post as keyof typeof POST_INFO]?.name ?? post} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/** One seat on the council: who holds it, their camp, standing and loyalty, and your moves on it. */
function Row({ p, role, post, colors, slate, president, running, councilName }: { p: Person; role: string; post?: "deputy" | "vp" | "council"; colors: Map<number, string>; slate: Set<number>; president: boolean; running: boolean; councilName: string }) {
  const game = useGame((s) => s.game)!;
  const deep = useGame((s) => s.deep);
  const div = divisionOf(game, p.id);
  const onSlate = slate.has(p.id);
  return (
    <li className="inset px-2.5 py-1.5 text-xs flex items-center gap-2">
      <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: campColorOf(colors, p) }} title="Camp" />
      <span className="flex-1 min-w-0">
        <span className="block font-semibold truncate">
          {p.id === game.youId ? "You" : p.name}
          {p.tokoh && <span style={{ color: "var(--brass-hi)" }}> · tokoh</span>}
        </span>
        <span className="block truncate" style={{ color: "var(--muted)" }}>
          {role}
          {p.seat !== null ? ` · MP ${SEATS[p.seat].name}` : div !== undefined ? ` · division chief ${SEATS[div].name}` : ""}
        </span>
      </span>
      <span className="tabular-nums" style={{ color: "var(--ink-2)" }} title="Standing">
        {Math.round(p.influence)}
      </span>
      {p.id !== game.youId && (
        <span className="tabular-nums w-9 text-right" style={{ color: p.loyalty >= 60 ? "var(--good)" : p.loyalty < 35 ? "var(--bad)" : "var(--ink-2)" }} title="Loyalty to you">
          ♥ {Math.round(p.loyalty)}
        </span>
      )}
      {president && running && post && (
        <button className="chip !py-0.5 !px-2 !text-[11px]" aria-pressed={onSlate} onClick={() => deep({ kind: "slate", post, id: p.id, on: !onSlate })} title="On your slate at the party polls">
          {onSlate ? "On slate" : "Back"}
        </button>
      )}
      {president && p.council === "appointed" && p.rank === 2 && (
        <button
          className="chip !py-0.5 !px-2 !text-[11px]"
          style={{ color: "var(--bad)" }}
          disabled={!!dropBlocked(game, p.id)}
          title={dropBlocked(game, p.id) ?? `${COUNCIL.drop.capital} capital. They sulk (loyalty ${COUNCIL.drop.loyalty}) and drift to a rival camp.`}
          onClick={() => confirm(`Drop ${p.name} from the ${councilName}?`) && deep({ kind: "dropCouncil", id: p.id })}
        >
          Drop
        </button>
      )}
    </li>
  );
}

/** Put someone new on your slate (a rising MP, a division chief, a tokoh) for a post. */
function SlateAdd({ party }: { party: string }) {
  const game = useGame((s) => s.game)!;
  const deep = useGame((s) => s.deep);
  const [id, setId] = useState("");
  const [post, setPost] = useState<"deputy" | "vp" | "council">("council");
  const pp = game.partyPolls!;
  const on = new Set([pp.slate.deputy, ...pp.slate.vps, ...pp.slate.council]);
  const people = game.people
    .filter((p) => p.party === party && !p.retired && !p.chairman && p.id !== game.youId && p.rank < 5 && !on.has(p.id))
    .sort((a, b) => b.influence - a.influence)
    .slice(0, 80);
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <select value={id} onChange={(e) => setId(e.target.value)} className="rounded-md px-1.5 py-1 text-xs min-w-0 flex-1" aria-label="Add to your slate">
        <option value="">Add someone to your slate…</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {Math.round(p.influence)} · {p.name} · ♥ {Math.round(p.loyalty)}
          </option>
        ))}
      </select>
      <select value={post} onChange={(e) => setPost(e.target.value as typeof post)} className="rounded-md px-1.5 py-1 text-xs" aria-label="For">
        <option value="deputy">for Deputy</option>
        <option value="vp">for Vice President</option>
        <option value="council">for the council</option>
      </select>
      <button
        className="btn btn-ghost"
        disabled={!id}
        onClick={() => {
          deep({ kind: "slate", post, id: Number(id), on: true });
          setId("");
        }}
      >
        Add
      </button>
    </div>
  );
}

const POST_NAME: Record<PollResult["post"], string> = { deputy: "Deputy President", vp: "Vice Presidents", council: "Elected council" };

/** After the AGM: who won each post, your slate's results, and who lost their seat. */
export function PartyPollsResult() {
  const game = useGame((s) => s.game)!;
  const deep = useGame((s) => s.deep);
  const res = game.partyPolls?.result ?? [];
  const name = (id: number) => game.people.find((p) => p.id === id)?.name ?? "—";
  const party = game.coalitions[game.player].members[0];
  const wins = res.filter((r) => r.won && r.slate).length;
  const total = res.filter((r) => r.slate).length;
  return (
    <div className="modal-backdrop" role="dialog" aria-label="Party polls">
      <div className="modal-card pop-in w-full max-w-lg flex flex-col gap-3 max-h-[90vh] overflow-y-auto scroll-thin">
        <div>
          <div className="eyebrow">{structure(party).council} · party polls {game.partyPolls?.year}</div>
          <h2 className="text-2xl">
            Your slate wins {wins} of {total}
          </h2>
        </div>
        {(["deputy", "vp", "council"] as PollResult["post"][]).map((post) => {
          const list = res.filter((r) => r.post === post);
          if (!list.length) return null;
          const lost = list.filter((r) => !r.won && (r.slate || r.incumbent) && !res.some((x) => x.won && x.id === r.id)).slice(0, 6);
          return (
            <section key={post} className="flex flex-col gap-1 text-xs">
              <h3 className="eyebrow">{POST_NAME[post]}</h3>
              <div className="flex flex-wrap gap-1">
                {list
                  .filter((r) => r.won)
                  .map((r) => (
                    <span key={r.id} className="chip !py-0.5 !px-2 !text-[11px]" style={r.slate ? { borderColor: "var(--brass-hi)", color: "var(--brass-hi)" } : undefined}>
                      {r.slate ? "★ " : ""}
                      {name(r.id)} · {r.votes}
                    </span>
                  ))}
              </div>
              {lost.length > 0 && (
                <div style={{ color: "var(--muted)" }}>
                  Lost: {lost.map((r) => `${name(r.id)}${r.slate ? " (your slate)" : r.incumbent ? " (out)" : ""}`).join(", ")}
                </div>
              )}
            </section>
          );
        })}
        <div className="flex justify-end">
          <button className="btn" onClick={() => deep({ kind: "pollsSeen" })} autoFocus>
            The new leadership takes office
          </button>
        </div>
      </div>
    </div>
  );
}
