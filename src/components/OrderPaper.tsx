"use client";

import { useMemo, useState } from "react";
import { DEWAN, MOTION_BY_ID, division, prepBlocked, yourStance, type Motion, type PrepMove } from "@/game/systems/dewan";
import { SEGMENT_LABEL, type Segment } from "@/game/systems/segments";
import { useGame } from "@/store/gameStore";
import { COALITIONS, cshort, type CoalitionId } from "@/game/world";
import { fmtRM } from "./common";
import { VOTE_COLOR } from "./SeatHolderCard";

const KIND: Record<Motion["kind"], string> = { bill: "Government bill", constitutional: "Constitutional amendment (two-thirds)", royal: "Royal Address", oppMotion: "Opposition motion" };

/** This meeting's Order Paper: the next vote with everything you can do before it, then what's coming and what happened. */
export function OrderPaper() {
  const game = useGame((s) => s.game)!;
  const tableMotion = useGame((s) => s.tableMotion);
  const d = game.dewan;
  const open = d.motions.filter((m) => !m.result && !m.withdrawn);
  const done = [...d.motions.filter((m) => m.result || m.withdrawn).reverse(), ...d.history.filter((m) => m.result)].slice(0, 8);
  const gov = game.government.includes(game.player);
  return (
    <div className="flex flex-col gap-5">
      <section className="inset p-3 text-sm">
        <b>
          {!d.meeting
            ? "The Dewan is in recess"
            : /^d$/.test(d.meeting.split("-")[1])
              ? `Meeting ${d.meeting.split("-")[1]} of ${d.meeting.split("-")[0]} is sitting`
              : "A special sitting"}
        </b>
        <p className="text-xs mt-0.5" style={{ color: "var(--ink-2)" }}>
          The House sits Feb–Mar, Jun–Jul and Oct–Nov. One item comes to a vote each turn. Simple majority for bills; {DEWAN.twoThirds} votes for a constitutional
          amendment.
        </p>
        {!gov && d.meeting && (
          <button className="chip mt-2" onClick={tableMotion} title={`${DEWAN.table.ap} AP, ${DEWAN.table.capital} political capital`}>
            Table a motion of your own · {DEWAN.table.ap} AP
          </button>
        )}
      </section>

      {open.length > 0 && <NextVote m={open[0]} />}

      {open.length > 1 && (
        <section>
          <h3 className="eyebrow mb-1.5">Later this meeting</h3>
          <ul className="flex flex-col gap-1">
            {open.slice(1).map((m) => (
              <li key={m.id} className="inset px-2.5 py-2 text-xs">
                <div className="font-semibold">{m.title}</div>
                <div style={{ color: "var(--muted)" }}>
                  {KIND[m.kind]} · tabled by {cshort(m.by)} · vote in {Math.max(0, m.voteWeek - game.week)} weeks
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {done.length > 0 && (
        <section>
          <h3 className="eyebrow mb-1.5">Decided</h3>
          <ul className="flex flex-col gap-1">
            {done.map((m) => (
              <li key={m.id} className="inset px-2.5 py-2 text-xs flex items-center gap-2">
                <span className="flex-1 min-w-0 truncate">{m.title}</span>
                <span className="font-semibold whitespace-nowrap" style={{ color: m.withdrawn ? "var(--muted)" : m.result!.passed ? "var(--good)" : "var(--bad)" }}>
                  {m.withdrawn ? "Withdrawn" : `${m.result!.passed ? "Passed" : "Defeated"} ${m.result!.ayes}–${m.result!.noes}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** The next vote: what it does, how the House is leaning, and your moves. */
function NextVote({ m }: { m: Motion }) {
  const game = useGame((s) => s.game)!;
  const act = useGame((s) => s.dewan);
  const [court, setCourt] = useState<CoalitionId>(COALITIONS.find((c) => c !== game.player && c !== "OTHERS")!);
  const def = MOTION_BY_ID[m.def];
  const projected = useMemo(() => division(game, m), [game, m]);
  const stance = yourStance(game, m);
  const due = m.voteWeek - game.week;
  const move = (mv: PrepMove, label: string, cost: string) => {
    const why = prepBlocked(game, m, mv);
    return (
      <button className="card card-action inset px-2.5 py-2 text-left text-xs disabled:opacity-50" disabled={!!why} title={why ?? undefined} onClick={() => act(m.id, mv)}>
        <span className="block font-semibold text-[13px]">{label}</span>
        <span style={{ color: why ? "var(--muted)" : "var(--ink-2)" }}>{why ?? cost}</span>
      </button>
    );
  };
  const segs = (Object.entries(def.seg) as [Segment, number][]).sort((a, b) => b[1] - a[1]);
  const need = m.twoThirds ? DEWAN.twoThirds : Math.floor((projected.ayes + projected.noes) / 2) + 1;
  return (
    <section className="panel p-4 flex flex-col gap-3" style={{ outline: "1px solid var(--accent)" }}>
      <div>
        <div className="eyebrow" style={{ color: "var(--accent)" }}>
          {due <= 1 ? "Votes this turn" : `Votes in ${due} weeks`} · {KIND[m.kind]} · tabled by {cshort(m.by)}
        </div>
        <h3 className="font-bold text-base leading-snug mt-0.5">{m.title}</h3>
        <p className="text-sm mt-1" style={{ color: "var(--ink-2)" }}>
          {def.blurb}
        </p>
        <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
          Voters: {segs.map(([k, v]) => `${SEGMENT_LABEL[k]} ${v > 0 ? "▲" : "▼"}`).join(" · ")}
          {def.approval ? ` · government approval ${def.approval > 0 ? "+" : ""}${def.approval} if it passes` : ""}
        </p>
      </div>

      <div>
        <div className="flex justify-between text-xs mb-1">
          <span>
            <b style={{ color: VOTE_COLOR.aye }}>{projected.ayes} ayes</b> · <b style={{ color: VOTE_COLOR.no }}>{projected.noes} noes</b> · {projected.abstain + projected.absent} not voting
          </span>
          <b style={{ color: projected.passed ? "var(--good)" : "var(--bad)" }}>{projected.passed ? "Would pass" : "Would fail"}</b>
        </div>
        <div className="relative h-2.5 rounded-full overflow-hidden flex" style={{ background: "var(--surface-2)" }}>
          <div style={{ width: `${(projected.ayes / 222) * 100}%`, background: VOTE_COLOR.aye }} />
          <div style={{ width: `${((projected.abstain + projected.absent) / 222) * 100}%`, background: VOTE_COLOR.abstain, opacity: 0.6 }} />
          <div style={{ width: `${(projected.noes / 222) * 100}%`, background: VOTE_COLOR.no }} />
          <div className="absolute -top-0.5 -bottom-0.5 w-0.5" style={{ left: `${(need / 222) * 100}%`, background: "var(--ink)" }} />
        </div>
        <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
          Projection if the vote were now (whips hold most MPs; leanings and low trust break some away). Needs {need}.
        </p>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-xs" style={{ color: "var(--ink-2)" }}>
          {cshort(game.player)} votes
        </span>
        <button className="chip" aria-pressed={stance === "for"} onClick={() => act(m.id, { kind: "stance", stance: "for" })}>
          For
        </button>
        <button className="chip" aria-pressed={stance === "against"} onClick={() => act(m.id, { kind: "stance", stance: "against" })}>
          Against
        </button>
      </div>

      <div className="grid gap-1.5 @md:grid-cols-2">
        {move({ kind: "whip" }, m.prep.whip ? "Whipped ✓" : "Three-line whip", `${DEWAN.whip.ap} AP · ${DEWAN.whip.capital} capital: your MPs toe the line`)}
        {move({ kind: "speak" }, m.prep.spoke ? "Spoken ✓" : "Speak in the debate", `${DEWAN.speak.ap} AP: national buzz, sways a few`)}
        {move({ kind: "amend" }, m.prep.amended ? "Amended ✓" : "Propose an amendment", `${DEWAN.amend.ap} AP · ${DEWAN.amend.capital} capital: softens it; fewer dig in`)}
        {stance === "against" && move({ kind: "walkout" }, m.prep.walkout ? "Walking out ✓" : "Stage a walkout", "Free: your MPs leave the chamber in protest")}
        {m.by === game.player && game.parliament.pm === game.player && move({ kind: "withdraw" }, "Withdraw the bill", `${DEWAN.withdraw.capital} capital: no defeat, but a U-turn`)}
      </div>

      <div className="flex gap-1.5 items-stretch">
        <select value={court} onChange={(e) => setCourt(e.target.value as CoalitionId)} className="rounded-lg px-2 text-xs" style={{ background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--line)" }}>
          {COALITIONS.filter((c) => c !== game.player).map((c) => (
            <option key={c} value={c} style={{ background: "var(--raised)" }}>
              {cshort(c)}
              {m.prep.courted.includes(c) ? " ✓" : ""}
            </option>
          ))}
        </select>
        <div className="flex-1">{move({ kind: "court", c: court }, `Court ${cshort(court)}'s MPs`, `${DEWAN.court.ap} AP · ${fmtRM(DEWAN.court.cost)} in allocations: some cross over`)}</div>
      </div>
    </section>
  );
}
