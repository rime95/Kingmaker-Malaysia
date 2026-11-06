import { describe, expect, it } from "vitest";
import { migrateGame, newGame, type GameState } from "./state";
import { coalitionOf } from "./systems/coalitions";
import { RECRUIT, recruitBlocked, recruitCost, recruitParty, recruitTargets, recruitWillingness, talksToWin } from "./systems/growth";

/** Bersama grown to about 60 seats. */
function bersama(): GameState {
  const g = newGame("BERSAMA", 1);
  let n = 0;
  const holders = g.holders.map((h) => (h === "PN" && n++ < 58 ? ("BERSAMA" as const) : h));
  return { ...g, holders, career: { ...g.career, rung: 7 }, me: { ...g.me, ap: 16, capital: 100, funds: 50_000_000 } };
}

describe("inviting parties", () => {
  it("every party outside your coalition can be invited, Others included", () => {
    const g = bersama();
    const t = recruitTargets(g);
    for (const p of ["DAP", "AMANAH", "MCA", "MIC", "KDM", "PBM", "PKR", "UMNO", "PAS"]) expect(t).toContain(p);
    expect(t).not.toContain("IND");
    expect(t).not.toContain("BERSAMA");
  });

  it("talks don't need the money up front, and the fee is capped", () => {
    const g = { ...bersama(), me: { ...bersama().me, funds: 0, capital: 0 } };
    expect(recruitBlocked(g, "DAP")).toBeNull();
    expect(recruitCost(g, "DAP")).toBeLessThanOrEqual(RECRUIT.maxCost);
  });

  it("a 60-seat coalition wins Warisan within a few talks, and DAP in the end", () => {
    let g = bersama();
    expect(talksToWin(g, "WARISAN")).toBeLessThanOrEqual(3);
    const talks = (party: string) => {
      let n = 0;
      while (coalitionOf(g, party) !== "BERSAMA" && n < 12) {
        const r = recruitParty({ ...g, cardLast: {}, me: { ...g.me, ap: 16 } }, party);
        if (!("state" in r)) throw new Error(r.error);
        g = r.state;
        n++;
      }
      return n;
    };
    expect(talks("WARISAN")).toBeLessThanOrEqual(4);
    const dap = talks("DAP");
    expect(coalitionOf(g, "DAP")).toBe("BERSAMA");
    expect(dap).toBeGreaterThan(1);
  });

  it("a refusal makes the next try likelier and costs only the AP", () => {
    const g = bersama();
    const r = recruitParty(g, "PAS");
    if (!("state" in r)) throw new Error(r.error);
    expect(recruitWillingness(r.state, "PAS")).toBeCloseTo(recruitWillingness(g, "PAS") + RECRUIT.talkWarmth);
    expect(r.state.me.capital).toBe(g.me.capital);
    expect(r.state.me.funds).toBe(g.me.funds);
  });

  it("a party from Others joins with its MPs", () => {
    const g = bersama();
    const warm = { ...g, partyWarmth: { KDM: 2 } };
    const r = recruitParty(warm, "KDM");
    if (!("state" in r)) throw new Error(r.error);
    expect(coalitionOf(r.state, "KDM")).toBe("BERSAMA");
    expect(coalitionOf(r.state, "PBM")).toBe("OTHERS");
  });

  it("if they'd say yes but you can't pay, they wait", () => {
    const g = { ...bersama(), me: { ...bersama().me, funds: 0 }, partyWarmth: { KDM: 2 } };
    const r = recruitParty(g, "KDM");
    if (!("state" in r)) throw new Error(r.error);
    expect(coalitionOf(r.state, "KDM")).toBe("OTHERS");
    expect(r.message).toMatch(/ready to join/);
  });

  it("an old save has no talks yet, and loads", () => {
    const g = JSON.parse(JSON.stringify(newGame("BERSAMA", 1)));
    delete g.partyWarmth;
    const m = migrateGame({ ...g, version: 29 });
    expect(recruitWillingness(m, "DAP")).toBeTypeOf("number");
  });
});
