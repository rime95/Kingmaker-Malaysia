"use client";

import { PORTFOLIOS } from "@/game/data/people";
import { type Vote } from "@/game/systems/dewan";
import { ageOf, mpOf, postOf } from "@/game/systems/people";
import { resultView } from "@/game/systems/results";
import { useGame } from "@/store/gameStore";
import { cname, SEATS, STATE_BY_ID } from "@/game/world";
import { coalColor } from "./common";

export const VOTE_COLOR: Record<Vote, string> = { aye: "#2fb36d", no: "#e0474c", abstain: "#e8a23a", absent: "#5d6476" };
export const VOTE_LABEL: Record<Vote, string> = { aye: "Aye", no: "No", abstain: "Abstained", absent: "Absent" };

/** Who sits in a seat: the hover card for the hemicycle, 2D and 3D. */
export function SeatHolderCard({ i, x, y, vote }: { i: number; x: number; y: number; vote?: Vote }) {
  const game = useGame((s) => s.game)!;
  const seat = SEATS[i];
  const mp = mpOf(game, i);
  const posts = mp ? postOf(game, mp.id) : [];
  const last = resultView(game.seatResults, i);
  const gov = game.government.includes(game.holders[i]);
  const left = typeof window !== "undefined" && x + 270 > window.innerWidth ? x - 270 : x + 14;
  return (
    <div className="tooltip" style={{ left, top: y + 14, width: 256 }}>
      <div className="font-semibold">{mp?.name ?? last.candidates[0].name}</div>
      <div className="flex items-center gap-1.5">
        <span className="swatch" style={{ background: coalColor(game.holders[i]), width: 8, height: 8 }} />
        {game.holderParties[i]} · {cname(game.holders[i])}
        {mp?.id === game.youId ? " · you" : ""}
      </div>
      <div style={{ color: "var(--muted)" }}>
        MP for {seat.code} {seat.name}, {STATE_BY_ID[seat.state].name}
      </div>
      {mp && (
        <div style={{ color: "var(--muted)" }}>
          Age {ageOf(mp, game.week)} · standing {Math.round(mp.influence)} · loyalty to you {Math.round(mp.loyalty)}
        </div>
      )}
      <div style={{ color: "var(--ink-2)" }}>
        {last.label}: majority {last.majority.toLocaleString("en-MY")} · {gov ? "Government bench" : "Opposition bench"}
      </div>
      {posts.length > 0 && <div style={{ color: "var(--good)" }}>{posts.map((k) => PORTFOLIOS.find((p) => p.id === k)!.name).join(", ")}</div>}
      {vote && (
        <div className="mt-1 font-semibold" style={{ color: VOTE_COLOR[vote] }}>
          Voted: {VOTE_LABEL[vote]}
        </div>
      )}
    </div>
  );
}
