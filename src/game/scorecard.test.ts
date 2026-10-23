import { describe, expect, it } from "vitest";
import { adoptPolicy, applyAction, deepMove } from "./actions";
import { newGame, playerSeatEffect, type GameState } from "./state";
import { POLICY_BY_ID } from "./systems/policies";
import { BATTLE, pillarEffect, unfunded } from "./systems/scorecard";
import { advanceWeek } from "./week";
import { SEATS, contestingIn } from "./world";

const rich = (s: GameState): GameState => ({ ...s, me: { ...s.me, ap: 60, funds: 80_000_000, capital: 200 } });
const opt = (policy: string, id: string) => POLICY_BY_ID[policy].options.findIndex((o) => o.id === id);
const mySeat = (s: GameState) => SEATS.findIndex((x) => contestingIn(x, s.entries).includes(s.player));

describe("what voters judge you on", () => {
  it("a new game starts level: pillars only move votes once they change", () => {
    const g = newGame("PH", 1);
    expect(SEATS.every((_, i) => pillarEffect(g, "PH", i) === 0 && pillarEffect(g, "PN", i) === 0)).toBe(true);
  });

  it("a policy launch raises Policies and lifts you in every seat", () => {
    const g = rich(newGame("MUDA", 2));
    const i = mySeat(g);
    const r = deepMove(g, { kind: "case", move: "launch" });
    if (!r.ok) throw new Error(r.error);
    expect(r.state.scorecard.now.MUDA.policies).toBeGreaterThan(g.scorecard.now.MUDA.policies);
    expect(playerSeatEffect(r.state, i)).toBeGreaterThan(playerSeatEffect(g, i));
    // Repeating it gives less.
    const r2 = deepMove(r.state, { kind: "case", move: "launch" });
    if (!r2.ok) throw new Error(r2.error);
    expect(r2.state.scorecard.now.MUDA.policies - r.state.scorecard.now.MUDA.policies).toBeLessThan(
      r.state.scorecard.now.MUDA.policies - g.scorecard.now.MUDA.policies,
    );
  });

  it("a pledge helps some groups and costs others; uncosted spending hurts credibility until costed", () => {
    const g = rich(newGame("PN", 3));
    const r = adoptPolicy(g, "cashaid", opt("cashaid", "expand"));
    if (!r.ok) throw new Error(r.error);
    expect(unfunded(r.state)).toBeGreaterThan(0);
    expect(r.state.scorecard.costedWeek).toBeNull();
    let s = r.state;
    for (let w = 0; w < 6; w++) s = advanceWeek(s);
    expect(s.scorecard.now.PN.credibility).toBeLessThan(g.scorecard.now.PN.credibility);
    const paper = deepMove(rich(s), { kind: "case", move: "whitePaper" });
    if (!paper.ok) throw new Error(paper.error);
    expect(paper.state.scorecard.costedWeek).toBe(s.week);
    expect(paper.state.scorecard.now.PN.credibility).toBeGreaterThan(s.scorecard.now.PN.credibility);
  });

  it("dirty money and U-turns cost Principle", () => {
    const g = rich(newGame("PH", 4));
    const k = applyAction(g, "kickback", { kind: "none" });
    if (!k.ok) throw new Error(k.error);
    expect(k.state.scorecard.now.PH.principle).toBeLessThan(g.scorecard.now.PH.principle);
    const a = adoptPolicy(g, "fuel", opt("fuel", "targeted"));
    if (!a.ok) throw new Error(a.error);
    const b = adoptPolicy(rich(a.state), "fuel", opt("fuel", "float"));
    if (!b.ok) throw new Error(b.error);
    expect(b.state.scorecard.now.PH.principle).toBeLessThan(a.state.scorecard.now.PH.principle);
  });

  it("a government that delivers gains Execution; showcasing it adds more", () => {
    const g = rich(newGame("PH", 5));
    const good = { ...g, economy: 75 };
    let s = good;
    for (let w = 0; w < 8; w++) s = advanceWeek(s);
    expect(s.scorecard.now.PH.execution).toBeGreaterThan(g.scorecard.now.PH.execution);
    const r = deepMove(rich(s), { kind: "case", move: "showcase" });
    if (!r.ok) throw new Error(r.error);
    expect(r.state.scorecard.now.PH.execution).toBeGreaterThan(s.scorecard.now.PH.execution);
    // The opposition with no state to run has no record to show.
    expect(deepMove(rich(newGame("MUDA", 5)), { kind: "case", move: "showcase" }).ok).toBe(false);
  });

  it("visiting the same seat again gives less, and hammering a rival seat makes it a battleground", () => {
    const g = rich(newGame("PN", 6));
    const i = SEATS.findIndex((x, k) => contestingIn(x, g.entries).includes("PN") && g.holders[k] === "PH");
    const one = applyAction(g, "ceramah", { kind: "seat", seat: i });
    if (!one.ok) throw new Error(one.error);
    const two = applyAction(one.state, "ceramah", { kind: "seat", seat: i });
    if (!two.ok) throw new Error(two.error);
    const three = applyAction(two.state, "ceramah", { kind: "seat", seat: i });
    if (!three.ok) throw new Error(three.error);
    const firstGain = one.state.me.buzz[i] - g.me.buzz[i];
    const thirdGain = three.state.me.buzz[i] - two.state.me.buzz[i];
    expect(thirdGain).toBeLessThan(firstGain * 0.8);
    expect(three.state.seatWork[i]).toBeGreaterThanOrEqual(BATTLE.pressure);
    const n = advanceWeek(three.state);
    expect(n.battlegrounds[i]?.by).toBe("PH");
  });
});
