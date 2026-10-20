"use client";

import { serviceBase } from "@/game/bases";
import { allyIn } from "@/game/actions";
import { fortressLevel, weekLabel } from "@/game/state";
import { BUBBLE_INFO } from "@/game/systems/bubbles";
import { DUNS } from "@/game/systems/dun";
import { CHANCE_LABEL, POLLS, chanceBand, effectiveMoe, winChance, type SeatRead } from "@/game/systems/polls";
import { resultView, type ResultView } from "@/game/systems/results";
import { mpOf } from "@/game/systems/people";
import { isHostile, type Rival } from "@/game/systems/rivals";
import { useGame } from "@/store/gameStore";
import { BLOC_LABEL, BLOCS, contestingIn, cshort, SEATS, STATE_BY_ID, type CoalitionId } from "@/game/world";
import { ActionCard } from "../ActionCard";
import { fmt, fmtRM, pct, useReads } from "../common";
import { coalColor } from "../map/lenses";
import { Icon } from "./icons";

const SEAT_ACTIONS = ["ceramah", "walkabout", "service", "machinery", "handout"];

/** The clicked seat: the latest result, your chances, your moves, then the detail folded away. */
export function SeatCard() {
  const game = useGame((s) => s.game)!;
  const { selected, select, claim } = useGame();
  const reads = useReads();
  if (selected === null || !reads.length) return null;
  const i = selected;
  const seat = SEATS[i];
  const holder = game.holders[i];
  const contests = contestingIn(seat).includes(game.player);
  const last = resultView(game.seatResults, i);
  const ally = contests ? null : allyIn(game, i);
  const bubble = game.bubbles.find((b) => b.seat === i);
  const duns = DUNS.filter((d) => d.parent === i);
  const rivals = (Object.entries(game.rivals) as [CoalitionId, Rival][])
    .map(([c, r]) => ({ c, buzz: r.buzz[i], service: r.service[i] - serviceBase(c, i), hostile: isHostile(c, game.player, game.me.trust, game.government) }))
    .filter((x) => x.buzz >= 1 || x.service >= 1)
    .sort((a, b) => b.buzz + b.service - (a.buzz + a.service));

  return (
    <aside className="panel pop-in flex flex-col max-h-full w-full md:w-[340px]" aria-label={`${seat.name} seat`}>
      <div className="flex items-start gap-2 px-4 pt-3.5 pb-3" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="flex-1 min-w-0">
          <div className="text-[11px]" style={{ color: "var(--muted)" }}>
            {seat.code} · {STATE_BY_ID[seat.state].name}
          </div>
          <div className="text-lg font-bold leading-tight truncate">{seat.name}</div>
          <div className="flex items-center gap-1.5 text-xs mt-1" style={{ color: "var(--ink-2)" }}>
            <span className="swatch" style={{ background: coalColor(holder) }} />
            <span className="truncate">
              {mpOf(game, i)?.name ?? last.candidates[0].name} · {game.holderParties[i]} ({cshort(holder)})
            </span>
          </div>
        </div>
        <button className="chip !p-2" onClick={() => select(null)} aria-label="Close">
          <Icon name="close" className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scroll-thin px-4 py-3 flex flex-col gap-4 text-sm @container">
        {bubble && (
          <button className="inset p-2.5 text-left flex items-center gap-2" style={{ outline: "1px solid var(--accent)" }} onClick={() => claim(bubble.id)}>
            <span className="text-lg">{BUBBLE_INFO[bubble.kind].icon}</span>
            <span className="flex-1">
              <b>{BUBBLE_INFO[bubble.kind].title}</b>
              <span className="block text-xs" style={{ color: "var(--ink-2)" }}>
                Collect: {BUBBLE_INFO[bubble.kind].reward(bubble.value)} (free, this week only)
              </span>
            </span>
          </button>
        )}

        <LatestResult r={last} />

        {contests && <Chances read={reads[i]} seat={i} />}

        {contests ? (
          <section>
            <div className="mb-1.5">
              <h3 className="eyebrow">Your moves here</h3>
              <span className="text-[11px] block" style={{ color: "var(--ink-2)" }}>
                {fortressLevel(game.me.service[i])} · service {Math.round(game.me.service[i])} · machinery {Math.round(game.me.machinery[i])} · buzz {Math.round(game.me.buzz[i])}
              </span>
            </div>
            <div className="grid gap-1.5">
              {SEAT_ACTIONS.map((id) => (
                <ActionCard key={id} id={id} target={{ kind: "seat", seat: i }} compact />
              ))}
            </div>
          </section>
        ) : (
          <section>
            <h3 className="eyebrow mb-1.5">No {cshort(game.player)} candidate here</h3>
            {ally ? (
              <>
                <p className="text-xs mb-1.5" style={{ color: "var(--ink-2)" }}>
                  You can still help the friendliest party standing here, {cshort(ally)}. It raises their vote and their trust in you.
                </p>
                <ActionCard id="ally" target={{ kind: "seat", seat: i }} compact />
              </>
            ) : (
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                No friendly party stands here either.
              </p>
            )}
          </section>
        )}

        {rivals.length > 0 && (
          <section>
            <h3 className="eyebrow mb-1.5">Rivals working this seat</h3>
            {rivals.map((x) => (
              <div key={x.c} className="flex items-center gap-2 text-xs py-0.5">
                <span className="swatch" style={{ background: coalColor(x.c) }} />
                {cshort(x.c)}
                {x.hostile && <span style={{ color: "var(--bad)" }}>▲ hostile</span>}
                <span className="ml-auto tabular-nums" style={{ color: "var(--ink-2)" }}>
                  buzz {Math.round(x.buzz)} · service +{Math.round(Math.max(0, x.service))}
                </span>
              </div>
            ))}
          </section>
        )}

        <details className="inset px-3 py-2">
          <summary className="text-xs font-semibold cursor-pointer" style={{ color: "var(--ink-2)" }}>
            Who lives here, and its state seats
          </summary>
          <div className="mt-2 flex flex-col gap-1">
            {BLOCS.filter((b) => seat.demo.ethnic[b] >= 0.01).map((b) => (
              <div key={b} className="grid grid-cols-[110px_1fr_36px] items-center gap-2 text-xs">
                <span>{BLOC_LABEL[b]}</span>
                <div className="h-1.5 rounded-full" style={{ background: "var(--surface-2)" }}>
                  <div className="h-full rounded-full" style={{ width: `${seat.demo.ethnic[b] * 100}%`, background: "var(--ink-2)" }} />
                </div>
                <span className="tabular-nums text-right">{pct(seat.demo.ethnic[b])}</span>
              </div>
            ))}
            <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
              Urban {pct(seat.demo.urbanity)} · aged 18–29 {pct(seat.demo.youth)} · B40 {pct(seat.demo.b40)} (estimates)
            </div>
            {duns.length > 0 && (
              <div className="text-[11px] mt-1" style={{ color: "var(--ink-2)" }}>
                State seats:{" "}
                {duns.map((d) => (
                  <span key={d.index} className="inline-flex items-center gap-1 mr-2">
                    <span className="swatch" style={{ background: coalColor(game.dunHolders[d.index]), width: 8, height: 8 }} />
                    {d.code} {d.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </details>
      </div>
    </aside>
  );
}

function LatestResult({ r }: { r: ResultView }) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-1.5">
        <h3 className="eyebrow">Latest result · {r.label}</h3>
        <span className="text-[11px]" style={{ color: "var(--ink-2)" }}>
          {r.week === null ? "19 Nov 2022" : weekLabel(r.week)}
        </span>
      </div>
      {r.candidates.slice(0, 4).map((c, k) => (
        <div key={k} className="grid grid-cols-[1fr_auto] gap-x-2 py-0.5">
          <span className="text-xs truncate" style={{ fontWeight: k === 0 ? 650 : 400 }}>
            {k === 0 ? "✓ " : ""}
            {c.name} <span style={{ color: "var(--muted)", fontWeight: 400 }}>{c.coalition === "OTHERS" ? c.party : `${c.party} · ${cshort(c.coalition)}`}</span>
          </span>
          <span className="text-xs tabular-nums text-right" style={{ color: "var(--ink-2)" }}>
            {fmt(c.votes)} · {pct(c.share, 1)}
          </span>
          <div className="col-span-2 h-1.5 rounded-full mt-0.5" style={{ background: "var(--surface-2)" }}>
            <div className="h-full rounded-full" style={{ width: `${c.share * 100}%`, background: coalColor(c.coalition) }} />
          </div>
        </div>
      ))}
      {r.candidates.length > 4 && (
        <div className="text-[11px]" style={{ color: "var(--muted)" }}>
          +{r.candidates.length - 4} more candidate{r.candidates.length - 4 === 1 ? "" : "s"}
        </div>
      )}
      <div className="text-[11px] mt-1" style={{ color: "var(--ink-2)" }}>
        Majority {fmt(r.majority)} · turnout {pct(r.turnout)} · {fmt(r.electors)} voters
      </div>
    </section>
  );
}

const SOURCE_TEXT: Record<SeatRead["source"], string> = { poll: "Constituency poll", branch: "Branch report", estimate: "Rough estimate from the national poll" };

function Chances({ read, seat }: { read: SeatRead; seat: number }) {
  const game = useGame((s) => s.game)!;
  const poll = useGame((s) => s.poll);
  const chance = winChance(read, game.player, game.week);
  if (chance === null) return null;
  const band = chanceBand(chance);
  const age = game.week - read.week;
  const shares = (Object.entries(read.shares) as [CoalitionId, number][]).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const tone = chance >= 0.56 ? "var(--good)" : chance > 0.44 ? "var(--accent)" : "var(--bad)";
  const polledThisWeek = game.polls.seats[seat]?.source === "poll" && game.polls.seats[seat]?.week === game.week;
  return (
    <section>
      <div className="flex items-baseline justify-between mb-1.5">
        <h3 className="eyebrow">Your chances here</h3>
        <span className="text-[11px] font-semibold" style={{ color: tone }}>
          {CHANCE_LABEL[band]}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-2xl font-black tabular-nums" style={{ color: tone }}>
          {pct(chance)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="relative h-2 rounded-full" style={{ background: "var(--surface-2)" }}>
            <div className="h-full rounded-full" style={{ width: `${chance * 100}%`, background: tone }} />
            <div className="absolute -top-0.5 -bottom-0.5 w-px" style={{ left: "50%", background: "var(--ink-2)" }} />
          </div>
          <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
            {SOURCE_TEXT[read.source]}
            {read.pollster ? ` (${read.pollster})` : ""} · {age === 0 ? "this week" : `${age} wk${age === 1 ? "" : "s"} old`} · ±{Math.round(effectiveMoe(read, game.week) * 100)}%
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-3 text-[11px] mt-1.5" style={{ color: "var(--ink-2)" }}>
        {shares.map(([c, v]) => (
          <span key={c} className="inline-flex items-center gap-1">
            <span className="swatch" style={{ background: coalColor(c), width: 8, height: 8 }} />
            {cshort(c)} {pct(v)}
          </span>
        ))}
      </div>
      <button className="chip mt-2 w-full justify-center" disabled={polledThisWeek || game.me.funds < POLLS.seatCost} onClick={() => poll(seat)}>
        {polledThisWeek ? "Polled this week" : `Commission a poll · ${fmtRM(POLLS.seatCost)}`}
      </button>
      {read.source === "estimate" && (
        <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
          Build machinery to {POLLS.branchMachinery}+ here and your branch reports every week for free.
        </p>
      )}
    </section>
  );
}
