"use client";

import { CARD_BY_KIND, describeEffect } from "@/game/systems/events";
import { isGovernment } from "@/game/state";
import { MOTION_BY_ID, byElectionLine, recentVotes, type RecentVote } from "@/game/systems/dewan";
import { TURN_WEEKS } from "@/game/config";
import { VOTE_LABEL } from "../SeatHolderCard";
import { useGame } from "@/store/gameStore";

/** GE16-style "breaking news" alerts: one decision at a time, as it arrives. "Decide later" parks it in the top bar. */
export function AlertModal() {
  const game = useGame((s) => s.game)!;
  const { snoozed, budgetSnoozed, answer, snooze, snoozeBudget, showPanel, voteSeen, seeVote, resultSeen, seeResults, setDewanColor } = useGame();
  if (game.night || game.formation) return null;

  if (game.budgetDue !== null && !budgetSnoozed) {
    const gov = isGovernment(game);
    return (
      <Shell tag="Budget">
        <h2 className="text-2xl font-black text-center">{gov ? "The Budget is due" : "The Budget is being tabled"}</h2>
        <p className="text-sm text-center" style={{ color: "var(--ink-2)" }}>
          {gov
            ? "Allocate this year's spending and take it to the Dewan. If you don't, officials will table an even split."
            : "Answer the government with a shadow budget of your own."}
        </p>
        <div className="flex gap-2 justify-center">
          <button className="btn-ghost btn" onClick={snoozeBudget}>
            Decide later
          </button>
          <button
            className="btn"
            onClick={() => {
              snoozeBudget();
              showPanel("policy");
            }}
          >
            Open the Budget
          </button>
        </div>
      </Shell>
    );
  }

  // Every vote due before the turn ends (a turn is TURN_WEEKS weeks), one at a time.
  const due = game.dewan.motions.filter((m) => !m.result && !m.withdrawn && m.voteWeek <= game.week + TURN_WEEKS);
  const vote = due.find((m) => !voteSeen.includes(m.id));
  if (vote) {
    const k = due.indexOf(vote);
    const when = vote.voteWeek <= game.week + 1 ? "this week" : "next week";
    return (
      <Shell tag="Dewan Rakyat" sub={due.length > 1 ? `vote ${k + 1} of ${due.length} this turn` : undefined}>
        <h2 className="text-2xl font-black text-center leading-tight">{vote.title}</h2>
        <p className="text-sm text-center" style={{ color: "var(--ink-2)" }}>
          {MOTION_BY_ID[vote.def].blurb} The House votes {when}{vote.twoThirds ? " (it needs two-thirds)" : ""}. Whip your MPs, court another party, amend it or speak first.
        </p>
        <div className="flex gap-2 justify-center">
          <button className="btn-ghost btn" onClick={() => seeVote(vote.id)}>
            Let it run
          </button>
          <button
            className="btn"
            onClick={() => {
              seeVote(vote.id);
              showPanel("orderpaper");
            }}
          >
            Open the Order Paper
          </button>
        </div>
      </Shell>
    );
  }

  // The results of the turn just played.
  const results = recentVotes(game).filter((v) => !resultSeen.includes(v.key));
  if (results.length) {
    const keys = results.map((v) => v.key);
    const division = results.some((v) => v.kind === "division");
    return (
      <Shell tag="Results" sub={results.length > 1 ? `${results.length} votes` : undefined}>
        <h2 className="text-2xl font-black text-center leading-tight">{division ? "The House has voted" : "The people have voted"}</h2>
        <div className="flex flex-col gap-2">
          {results.map((v) => (
            <ResultRow key={v.key} v={v} />
          ))}
        </div>
        <div className="flex gap-2 justify-center">
          <button className="btn-ghost btn" onClick={() => seeResults(keys)}>
            Noted
          </button>
          {division && (
            <button
              className="btn"
              onClick={() => {
                seeResults(keys);
                setDewanColor("vote");
                showPanel("parliament");
              }}
            >
              See the chamber
            </button>
          )}
        </div>
      </Shell>
    );
  }

  const card = game.cards.find((c) => !snoozed.includes(c.id));
  if (!card) return null;
  const def = CARD_BY_KIND[card.kind];
  const choices = def.choices(game, card);
  const left = card.deadline - game.week;
  const queued = game.cards.filter((c) => !snoozed.includes(c.id)).length;

  return (
    <Shell tag={card.kind === "agm" ? "Party AGM" : card.kind === "byelection" ? "By-election" : "Breaking news"} sub={queued > 1 ? `1 of ${queued}` : undefined}>
      <h2 className="text-2xl font-black text-center leading-tight">{def.title}</h2>
      <p className="text-sm text-center" style={{ color: "var(--ink-2)" }}>
        {def.text(game, card)}
      </p>
      <div className="flex flex-col gap-2">
        {choices.map((c, i) => (
          <button key={i} onClick={() => answer(card.id, i)} className="inset text-left px-3.5 py-3 hover:brightness-125 transition" style={{ border: "1px solid var(--line)" }}>
            <div className="font-semibold text-sm">
              {c.label}
              {i === def.defaultChoice && (
                <span className="ml-2 text-[11px] font-normal" style={{ color: "var(--muted)" }}>
                  default if you don&apos;t decide
                </span>
              )}
            </div>
            <div className="text-xs mt-0.5" style={{ color: "var(--ink-2)" }}>
              {describeEffect(c.effect)}
            </div>
            {c.note && (
              <div className="text-[11px] mt-0.5 italic" style={{ color: "var(--muted)" }}>
                {c.note}
              </div>
            )}
          </button>
        ))}
      </div>
      <button className="text-xs self-center underline-offset-2 hover:underline" style={{ color: "var(--muted)" }} onClick={() => snooze(card.id)}>
        Decide later ({left <= 1 ? "default applies at the end of this week" : `${left} weeks left`})
      </button>
    </Shell>
  );
}

/** One result: the verdict, the numbers, and where your side stood. */
function ResultRow({ v }: { v: RecentVote }) {
  if (v.kind === "byelection")
    return (
      <div className="inset px-3.5 py-2.5 text-sm" style={{ borderLeft: `3px solid ${v.yoursWon ? "var(--good)" : "var(--ink-2)"}` }}>
        <div className="font-semibold">{byElectionLine(v)}</div>
        <div className="text-xs" style={{ color: "var(--muted)" }}>
          {v.yoursWon ? "Your candidate wins." : "Not your candidate."}
        </div>
      </div>
    );
  return (
    <div className="inset px-3.5 py-2.5 text-sm" style={{ borderLeft: `3px solid ${v.passed ? "var(--good)" : "var(--bad)"}` }}>
      <div className="flex items-baseline gap-2">
        <span className="font-bold text-xs uppercase tracking-wider" style={{ color: v.passed ? "var(--good)" : "var(--bad)" }}>
          {v.passed ? "Passed" : "Defeated"}
        </span>
        <span className="font-semibold leading-tight">{v.title}</span>
      </div>
      <div className="text-xs mt-0.5 tabular-nums" style={{ color: "var(--ink-2)" }}>
        {v.ayes} ayes · {v.noes} noes{v.abstain ? ` · ${v.abstain} abstained` : ""}
        {v.absent ? ` · ${v.absent} absent` : ""}
        {v.twoThirds ? " · needed 148" : ""}
      </div>
      {v.yours && (
        <div className="text-xs" style={{ color: "var(--muted)" }}>
          Your MPs: {VOTE_LABEL[v.yours].toLowerCase()}
          {v.rebels ? `, ${v.rebels} broke ranks` : ", as one"}
        </div>
      )}
    </div>
  );
}

function Shell({ tag, sub, children }: { tag: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-label={tag}>
      <div className="panel pop-in w-full max-w-md p-6 flex flex-col gap-4">
        <div className="flex justify-center items-center gap-2">
          <span className="eyebrow rounded-full px-3 py-1" style={{ background: "rgb(242 85 90 / 0.12)", color: "var(--bad)", border: "1px solid rgb(242 85 90 / 0.3)" }}>
            📣 {tag}
          </span>
          {sub && (
            <span className="text-[11px]" style={{ color: "var(--muted)" }}>
              {sub}
            </span>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
