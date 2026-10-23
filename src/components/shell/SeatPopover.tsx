"use client";

import { useEffect, useState } from "react";
import { allyIn, saturation } from "@/game/actions";
import { BUBBLE_INFO } from "@/game/systems/bubbles";
import { asideFor } from "@/game/systems/pacts";
import { mpOf } from "@/game/systems/people";
import { CHANCE_LABEL, POLLS, chanceBand, winChance } from "@/game/systems/polls";
import { resultView } from "@/game/systems/results";
import { useGame } from "@/store/gameStore";
import { contestingIn, cshort, SEATS, STATE_BY_ID, type CoalitionId } from "@/game/world";
import { ActionCard } from "../ActionCard";
import { chancePct, fmtRM, pct, useReads } from "../common";
import { coalColor } from "../map/lenses";
import { SeatIssues } from "./SeatBits";
import { Icon } from "./icons";

export const SEAT_MOVES = ["ground", "ceramah", "walkabout", "issue", "service", "machinery", "handout"];

/** Click a seat: your moves there, right where you clicked. "Full details" opens the Seat tab. */
export function SeatPopover() {
  const game = useGame((s) => s.game)!;
  const { selected, select, popAt, claim, poll, showPanel, panel } = useGame();
  const reads = useReads();
  const [size, setSize] = useState({ w: 1280, h: 800 });
  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && select(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [select]);
  if (selected === null || !reads.length) return null;
  // No room beside an open panel: the Seat tab has it all.
  if (panel && size.w < 1000) return null;
  const i = selected;
  const seat = SEATS[i];
  const holder = game.holders[i];
  const contests = contestingIn(seat, game.entries).includes(game.player);
  const last = resultView(game.seatResults, i);
  const read = reads[i];
  const chance = contests ? winChance(read, game.player, game.week) : null;
  const shares = (Object.entries(read.shares) as [CoalitionId, number][]).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const bubble = game.bubbles.find((b) => b.seat === i);
  const aside = asideFor(game)[i]?.[0];
  const ally = contests ? null : allyIn(game, i);
  const polled = game.polls.seats[i]?.source === "poll" && game.polls.seats[i]?.week === game.week;

  // Where it sits: next to the click on desktop, docked top-right when opened from a list, a sheet on phones.
  const W = 340;
  const phone = size.w < 768;
  const style: React.CSSProperties = phone
    ? { left: 12, right: 12, bottom: 128, maxHeight: "60vh" }
    : popAt
      ? { left: popAt.x + 18 + W > size.w - 12 ? Math.max(12, popAt.x - 18 - W) : popAt.x + 18, top: Math.max(88, Math.min(popAt.y - 60, size.h - 600)), width: W, maxHeight: size.h - 160 }
      : { right: 12, top: 88, width: W, maxHeight: size.h - 160 };

  return (
    <div className="panel pop-in fixed z-30 flex flex-col overflow-hidden" style={style} role="dialog" aria-label={`${seat.name}: your moves`}>
      <div className="flex items-start gap-2 px-3.5 pt-3 pb-2.5" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="flex-1 min-w-0">
          <div className="text-[11px]" style={{ color: "var(--muted)" }}>
            {seat.code} · {STATE_BY_ID[seat.state].name}
          </div>
          <div className="font-bold leading-tight truncate">{seat.name}</div>
          <div className="flex items-center gap-1.5 text-[11px] mt-0.5" style={{ color: "var(--ink-2)" }}>
            <span className="swatch" style={{ background: coalColor(holder), width: 8, height: 8 }} />
            <span className="truncate">
              {mpOf(game, i)?.name ?? last.candidates[0].name} · {game.holderParties[i]} ({cshort(holder)})
            </span>
          </div>
        </div>
        {chance !== null && (
          <div className="text-right flex-none">
            <div className="text-xl font-black tabular-nums leading-none" style={{ color: chance >= 0.56 ? "var(--good)" : chance > 0.44 ? "var(--accent)" : "var(--bad)" }}>
              {chancePct(chance)}
            </div>
            <div className="text-[10px]" style={{ color: "var(--muted)" }}>
              {CHANCE_LABEL[chanceBand(chance)]}
            </div>
          </div>
        )}
        <button className="chip !p-1.5 flex-none" onClick={() => select(null)} aria-label="Close">
          <Icon name="close" className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scroll-thin px-3.5 py-2.5 flex flex-col gap-2.5 text-sm @container">
        <div className="flex flex-wrap gap-x-3 text-[11px]" style={{ color: "var(--ink-2)" }}>
          {shares.map(([c, v]) => (
            <span key={c} className="inline-flex items-center gap-1">
              <span className="swatch" style={{ background: coalColor(c), width: 8, height: 8 }} />
              {cshort(c)} {pct(v)}
            </span>
          ))}
          <span style={{ color: "var(--muted)" }}>{read.source === "estimate" ? "rough" : read.source === "poll" ? "polled" : "branch report"}</span>
        </div>

        {bubble && (
          <button className="inset p-2 text-left text-xs flex items-center gap-2" style={{ outline: "1px solid var(--accent)" }} onClick={() => claim(bubble.id)}>
            <span className="text-base">{BUBBLE_INFO[bubble.kind].icon}</span>
            <span>
              <b>{BUBBLE_INFO[bubble.kind].title}</b>: {BUBBLE_INFO[bubble.kind].reward(bubble.value)} (free)
            </span>
          </button>
        )}

        {aside && (
          <p className="text-[11px]" style={{ color: "var(--ink-2)" }}>
            Pact: <b>{cshort(aside.out)}</b> stands aside here for <b>{cshort(aside.to)}</b>.
          </p>
        )}

        <SeatIssues seat={i} compact />

        {game.battlegrounds?.[i] && (
          <p className="text-[11px]" style={{ color: "var(--bad)" }}>
            Battleground: <b>{cshort(game.battlegrounds[i].by)}</b> is counter-campaigning here.
          </p>
        )}

        {contests ? (
          <>
            <div className="text-[11px]" style={{ color: "var(--muted)" }}>
              Service {Math.round(game.me.service[i])} · machinery {Math.round(game.me.machinery[i])} · buzz {Math.round(game.me.buzz[i])} · {game.me.ap} AP left
              {saturation(game, i) < 0.8 && <span style={{ color: "var(--bad)" }}> · visits here land at {Math.round(saturation(game, i) * 100)}%</span>}
            </div>
            <div className="grid gap-1">
              {SEAT_MOVES.map((id) => (
                <ActionCard key={id} id={id} target={{ kind: "seat", seat: i }} dense />
              ))}
            </div>
            <button className="chip justify-center text-xs" disabled={polled || game.me.funds < POLLS.seatCost} onClick={() => poll(i)}>
              {polled ? "Polled this turn" : `Commission a poll · ${fmtRM(POLLS.seatCost)}`}
            </button>
          </>
        ) : (
          <>
            <p className="text-xs" style={{ color: "var(--ink-2)" }}>
              No {cshort(game.player)} candidate here yet. Open a branch and every move unlocks.
            </p>
            <ActionCard id="branch" target={{ kind: "seat", seat: i }} dense />
            {ally && <ActionCard id="ally" target={{ kind: "seat", seat: i }} dense />}
          </>
        )}
      </div>

      <button className="text-xs font-semibold px-3.5 py-2 text-left hover:brightness-125" style={{ borderTop: "1px solid var(--line)", color: "var(--primary-a)" }} onClick={() => showPanel("seat")}>
        Full details: result, rivals, who lives here →
      </button>
    </div>
  );
}
