"use client";

import { useState } from "react";
import { useGame } from "@/store/gameStore";
import { COALITIONS, cshort, type CoalitionId } from "@/game/world";
import {
  DEBATE,
  ENDORSERS,
  MOVES,
  PILLARS,
  PILLAR_INFO,
  caseBlocked,
  debateRival,
  latestHit,
  unfunded,
  type CaseMove,
  type DebateLine,
  type Endorser,
  type Pillar,
} from "@/game/systems/scorecard";
import { coalColor, fmtRM } from "../common";

/** Your case to the voters: how they rate you against your rivals, and the moves that change it. */
export function CasePanel() {
  const game = useGame((s) => s.game)!;
  const deep = useGame((s) => s.deep);
  const showPanel = useGame((s) => s.showPanel);
  const sc = game.scorecard;
  const seats = (c: CoalitionId) => game.holders.filter((h) => h === c).length;
  const rivals = COALITIONS.filter((c) => c !== game.player && c !== "OTHERS" && seats(c) > 0).sort((a, b) => seats(b) - seats(a));
  const shown = [game.player, ...rivals.slice(0, 2)];
  const [target, setTarget] = useState<CoalitionId>(rivals[0]);
  const hit = latestHit(game);
  const run = (m: CaseMove) => deep({ kind: "case", ...m });
  const move = (m: CaseMove, label: string, sub: string) => {
    const why = caseBlocked(game, m);
    return (
      <button key={label} className="card card-action inset px-2.5 py-2 text-left text-xs" disabled={!!why} title={why ?? undefined} onClick={() => run(m)}>
        <span className="block font-semibold text-[13px]">{label}</span>
        <span className="block" style={{ color: why ? "var(--muted)" : "var(--ink-2)" }}>
          {why ?? sub}
        </span>
      </button>
    );
  };
  const delta = (c: CoalitionId, p: Pillar) => Math.round(sc.now[c][p] - sc.start[c][p]);

  return (
    <div className="flex flex-col gap-5">
      <section>
        <h3 className="eyebrow mb-1">What voters think</h3>
        <p className="text-[11px] mb-2" style={{ color: "var(--muted)" }}>
          Voters pick the party they believe has the best plans, means what it says, gets things done and could run the country. Urban and young voters weigh
          principle most; rural and B40 voters weigh delivery. Your ground work carries your case into each seat.
        </p>
        <div className="flex flex-col gap-2">
          {PILLARS.map((p) => (
            <div key={p} className="inset p-2.5 text-xs">
              <div className="flex justify-between mb-1">
                <b className="text-[13px]">{PILLAR_INFO[p].name}</b>
                <span style={{ color: "var(--muted)" }}>“{PILLAR_INFO[p].voter}”</span>
              </div>
              {shown.map((c) => {
                const d = delta(c, p);
                return (
                  <div key={c} className="flex items-center gap-2">
                    <span className="w-16 truncate" style={{ fontWeight: c === game.player ? 700 : 400 }}>
                      {c === game.player ? "You" : cshort(c)}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full" style={{ background: "var(--surface-2)" }}>
                      <div className="h-full rounded-full" style={{ width: `${sc.now[c][p]}%`, background: coalColor(c) }} />
                    </div>
                    <span className="w-14 text-right tabular-nums">
                      {Math.round(sc.now[c][p])}
                      {d !== 0 && <span style={{ color: d > 0 ? "var(--good)" : "var(--bad)" }}> {d > 0 ? `+${d}` : d}</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
          Only change since the start moves votes (+/− shown). Your manifesto is your stance on each policy:{" "}
          <button className="underline" onClick={() => showPanel("policy")}>
            edit it in Policy
          </button>
          . {unfunded(game) > 0 && sc.costedWeek === null ? "Your pledges are uncosted: Credibility suffers until you publish costings." : ""}
        </p>
      </section>

      {hit && (
        <section className="inset p-2.5 text-xs" style={{ outline: "1px solid var(--bad)" }}>
          <b>Under attack:</b> {hit.by || "a rival"} cost you {Math.round(hit.amount)} {PILLAR_INFO[hit.pillar].name}. Rebut it within{" "}
          {Math.max(1, hit.week + 3 - game.week)} week(s) to win most of it back.
        </section>
      )}

      <section>
        <h3 className="eyebrow mb-2">Make your case</h3>
        <div className="grid gap-1.5 @md:grid-cols-2">
          {move({ move: "launch" }, `${MOVES.launch.name} · ${MOVES.launch.ap} AP · ${fmtRM(MOVES.launch.cost)}`, MOVES.launch.blurb)}
          {move({ move: "whitePaper" }, `${MOVES.whitePaper.name} · ${MOVES.whitePaper.ap} AP · ${fmtRM(MOVES.whitePaper.cost)}`, MOVES.whitePaper.blurb)}
          {move({ move: "showcase" }, `${MOVES.showcase.name} · ${MOVES.showcase.ap} AP · ${fmtRM(MOVES.showcase.cost)}`, MOVES.showcase.blurb)}
          {move({ move: "rebut" }, `${MOVES.rebut.name} · ${MOVES.rebut.ap} AP · ${fmtRM(MOVES.rebut.cost)}`, MOVES.rebut.blurb)}
        </div>
      </section>

      <section>
        <h3 className="eyebrow mb-1">Go after a rival</h3>
        <p className="text-[11px] mb-2" style={{ color: "var(--muted)" }}>
          {MOVES.expose.blurb} {MOVES.expose.ap} AP, {fmtRM(MOVES.expose.cost)}, {MOVES.expose.capital} capital. They will hit back.
        </p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {rivals.slice(0, 6).map((c) => (
            <button key={c} className="chip !py-1" style={target === c ? { outline: "2px solid var(--accent)" } : undefined} onClick={() => setTarget(c)}>
              {cshort(c)} · P {Math.round(sc.now[c].principle)} · E {Math.round(sc.now[c].execution)}
            </button>
          ))}
        </div>
        <div className="grid gap-1.5 grid-cols-2">
          {move({ move: "expose", target, pillar: "principle" }, `Expose ${cshort(target)}'s principle`, "Corruption, U-turns, broken promises.")}
          {move({ move: "expose", target, pillar: "execution" }, `Expose ${cshort(target)}'s record`, "What they failed to deliver.")}
        </div>
      </section>

      <section>
        <h3 className="eyebrow mb-2">Endorsements</h3>
        <div className="grid gap-1.5 @md:grid-cols-2">
          {(Object.keys(ENDORSERS) as Endorser[]).map((who) =>
            move(
              { move: "endorse", who },
              `${ENDORSERS[who].name} · ${MOVES.endorse.ap} AP · ${fmtRM(ENDORSERS[who].cost)}`,
              `${ENDORSERS[who].blurb} (+${PILLAR_INFO[ENDORSERS[who].pillar].name})`,
            ),
          )}
        </div>
      </section>

      <section>
        <h3 className="eyebrow mb-1">Leaders&apos; debate</h3>
        <p className="text-[11px] mb-2" style={{ color: "var(--muted)" }}>
          Once a campaign, against {cshort(debateRival(game))}. Pick your line: what wins depends on where you lead and where they&apos;re weak. A loss hurts.
        </p>
        <div className="grid gap-1.5 @md:grid-cols-3">
          {(Object.keys(DEBATE) as DebateLine[]).map((line) => move({ move: "debate", line }, DEBATE[line].name, DEBATE[line].blurb))}
        </div>
      </section>
    </div>
  );
}
