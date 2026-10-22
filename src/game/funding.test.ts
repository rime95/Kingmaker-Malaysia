import { describe, expect, it } from "vitest";
import { applyAction, deepMove } from "./actions";
import { newGame, type GameState } from "./state";
import { COLLECT, PAY, collection, yourPay } from "./systems/funding";
import { advanceWeek, weeklyCashFlow } from "./week";
import { SEATS } from "./world";

const seat = (code: string) => SEATS.find((x) => x.code === code)!.index;
const rich = (s: GameState): GameState => ({ ...s, me: { ...s.me, ap: 40, funds: 50_000_000, capital: 150 } });

describe("Malaysian money", () => {
  it("you are paid as an MP and as Prime Minister, into your own pocket", () => {
    const g = newGame("PH", 1);
    const pay = yourPay(g);
    expect(pay.some((r) => r.monthly === PAY.mp)).toBe(true);
    expect(pay.some((r) => r.monthly === PAY.pm)).toBe(true);
    expect(advanceWeek(g).personal.cash).toBeGreaterThan(g.personal.cash);
  });

  it("a ceramah passes the collection tin, more for PN and PH machines", () => {
    const g = rich(newGame("PN", 2));
    const i = seat("P.021");
    const r = applyAction(g, "ceramah", { kind: "seat", seat: i });
    if (!r.ok) throw new Error(r.error);
    expect(r.state.me.funds).toBeGreaterThan(g.me.funds - 30_000);
    const bn = rich(newGame("BN", 2));
    expect(collection(g, i)).toBeGreaterThan(collection(bn, i));
    expect(COLLECT.strong).toContain("PN");
  });

  it("the opposition's MoU brings full allocations but rules out no-confidence", () => {
    const g = rich(newGame("PN", 3));
    const r = deepMove(g, { kind: "mou" });
    if (!r.ok) throw new Error(r.error);
    expect(r.state.funding.mou).toBe(true);
    const nc = applyAction(r.state, "noConfidence", { kind: "none" });
    expect(nc.ok).toBe(false);
    const held = SEATS.findIndex((_, i) => g.holders[i] === "PN");
    expect(advanceWeek(r.state).me.service[held]).toBeGreaterThan(advanceWeek(g).me.service[held]);
    expect(deepMove(rich(newGame("PH", 3)), { kind: "mou" }).ok).toBe(false);
  });

  it("dark money is quick and raises MACC risk; donors and merchandise show in the cash flow", () => {
    const g = rich(newGame("PH", 4));
    const k = applyAction(g, "kickback", { kind: "none" });
    if (!k.ok) throw new Error(k.error);
    expect(k.state.me.funds).toBe(g.me.funds + 3_000_000);
    expect(k.state.me.risk).toBeGreaterThan(g.me.risk);
    expect(applyAction(rich(newGame("PN", 4)), "kickback", { kind: "none" }).ok).toBe(false);
    const loud = { ...g, me: { ...g.me, nationalBuzz: 80 } };
    expect(weeklyCashFlow(loud).income.some((l) => l.label.startsWith("Merchandise"))).toBe(true);
    const season = { ...loud, parliament: { ...loud.parliament, deadlineWeek: loud.week + 4 } };
    expect(weeklyCashFlow(season).income.some((l) => l.label.startsWith("Corporate donors"))).toBe(true);
  });
});
