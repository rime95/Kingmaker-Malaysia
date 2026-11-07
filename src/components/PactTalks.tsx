"use client";

import { useMemo, useState } from "react";
import { projectAllFor } from "@/game/state";
import { TALKS, goodwillWith, talkSeats, talksBlocked } from "@/game/systems/seattalks";
import { useGame } from "@/store/gameStore";
import { SEATS, cshort } from "@/game/world";
import { CoalitionFlag } from "./flags";

/** Who stands where under your pacts: claim a seat from the other coalition, or stand aside for them. */
export function PactTalks() {
  const game = useGame((s) => s.game)!;
  const talkSeat = useGame((s) => s.talkSeat);
  const focusSeat = useGame((s) => s.focusSeat);
  const [side, setSide] = useState<"them" | "you">("them");
  // Claims are judged on each side's own vote, before anyone stands aside.
  const rows = useMemo(() => {
    const proj = projectAllFor({ ...game, pacts: [] });
    return talkSeats(game, (i) => proj[i].shares);
  }, [game]);
  if (!game.pacts.length) return null;
  const blocked = talksBlocked(game);
  const partners = game.pacts.map((p) => {
    const mine = rows.filter((r) => r.partner === p.with);
    return { partner: p.with, gw: goodwillWith(game, p.with), you: mine.filter((r) => r.standing === "you").length, them: mine.filter((r) => r.standing === "them").length };
  });
  // Their seats you could take, easiest first; your seats, weakest claim first.
  const shown = rows
    .filter((r) => r.standing === side)
    .sort((a, b) => (side === "them" ? a.claim - b.claim : b.claim - a.claim))
    .slice(0, 40);

  return (
    <details className="inset px-3 py-2 flex flex-col gap-2">
      <summary className="eyebrow cursor-pointer">Who stands where under your pacts · {partners.map((p) => `${cshort(p.partner)} ${p.you}–${p.them}`).join(" · ")}</summary>
      <div className="flex flex-col gap-2 mt-2">
        <div className="grid gap-1.5">
          {partners.map((p) => (
            <div key={p.partner} className="inset px-2.5 py-2 text-xs flex items-center gap-2">
              <CoalitionFlag game={game} c={p.partner} size={13} />
              <span className="font-semibold">{cshort(p.partner)}</span>
              <span className="ml-auto tabular-nums" style={{ color: "var(--ink-2)" }}>
                you {p.you} · them {p.them}
              </span>
              <span className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }} title={`Goodwill ${Math.round(p.gw)}`}>
                <span className="block h-full" style={{ width: `${p.gw}%`, background: p.gw < 25 ? "var(--bad)" : p.gw < 50 ? "var(--accent)" : "var(--good)" }} />
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Claiming a seat from them costs goodwill (a lot where they hold it). Standing aside for them raises it. Below {TALKS.floor} they refuse. {blocked ?? "This locks on nomination day."}
        </p>
        <div className="flex gap-1">
          <button className="chip text-xs" aria-pressed={side === "them"} onClick={() => setSide("them")}>
            They stand
          </button>
          <button className="chip text-xs" aria-pressed={side === "you"} onClick={() => setSide("you")}>
            You stand
          </button>
        </div>
        <ul className="flex flex-col gap-1 max-h-72 overflow-y-auto scroll-thin">
          {shown.map((r) => (
            <li key={`${r.partner}${r.seat}`} className="inset px-2.5 py-1.5 text-xs flex items-center gap-2">
              <CoalitionFlag game={game} c={r.standing === "you" ? game.player : r.partner} size={10} />
              <button className="text-left min-w-0 flex-1" onClick={() => focusSeat(r.seat)}>
                <span className="font-semibold truncate block">
                  {SEATS[r.seat].name}
                  {r.held ? <span style={{ color: "var(--muted)" }}> · held by {r.held === "you" ? "you" : "them"}</span> : null}
                </span>
                <span style={{ color: "var(--muted)" }}>
                  their claim {Math.round(r.claim * 100)}% · {cshort(r.partner)}
                </span>
              </button>
              <button className="chip !py-1 text-xs" disabled={!!blocked} onClick={() => talkSeat(r, r.standing === "them")}>
                {r.standing === "them" ? "Claim" : `Stand aside for ${cshort(r.partner)}`}
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
