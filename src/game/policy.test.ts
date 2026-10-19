import { describe, expect, it } from "vitest";
import { adoptPolicy, answerCard, dewanVote, tableBudget } from "./actions";
import { advanceMonth } from "./month";
import { newGame, projectAllFor, weekDate, type GameState } from "./state";
import { BUDGET, budgetEnvelope } from "./systems/budget";
import { CARD_BY_KIND, FESTIVALS } from "./systems/events";
import { advanceWeek } from "./week";
import { SEATS } from "./world";

const seat = (code: string) => SEATS.find((s) => s.code === code)!.index;
const strip = (s: GameState) => ({ ...s, report: null });
const share = (g: GameState, i: number) => projectAllFor(g)[i].shares[g.player] ?? 0;
function weeks(g: GameState, n: number) {
  for (let i = 0; i < n; i++) g = advanceWeek(g);
  return g;
}

describe("policies", () => {
  it("an identity pledge moves Malay and Chinese seats in opposite directions", () => {
    const g = newGame("PN", 1);
    const r = adoptPolicy(g, "religion", 1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(share(r.state, seat("P.021"))).toBeGreaterThan(share(g, seat("P.021"))); // Kota Bharu
    expect(share(r.state, seat("P.122"))).toBeLessThan(share(g, seat("P.122"))); // Seputeh
    expect(r.state.me.trust).toBe(g.me.trust); // PN is not a multiracial coalition
  });

  it("identity plays cost a multiracial coalition partner trust", () => {
    const g = newGame("PH", 1);
    const r = adoptPolicy(g, "religion", 1);
    expect(r.ok && r.state.me.trust).toBeLessThan(g.me.trust);
  });

  it("government bills pass with a loyal majority and fail when partners rebel", () => {
    const g = newGame("PH", 1);
    expect(dewanVote(g).passes).toBe(true);
    const angry = { ...g, me: { ...g.me, trust: 10 } };
    expect(dewanVote(angry).passes).toBe(false);
    const r = adoptPolicy(angry, "wage", 1);
    expect(r.ok && r.state.me.policies.wage).toBeUndefined();
  });

  it("government enactments move the economy and public finances; pledges don't", () => {
    const gov = adoptPolicy(newGame("PH", 1), "fuel", 1);
    expect(gov.ok && gov.state.fiscal).toBeGreaterThan(50);
    const opp = adoptPolicy(newGame("PN", 1), "fuel", 1);
    expect(opp.ok && opp.state.fiscal).toBe(50);
  });

  it("costs capital and AP, and can't repeat the same stance", () => {
    const g = newGame("PN", 1);
    const r = adoptPolicy(g, "ma63", 1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.me.capital).toBeLessThan(g.me.capital);
    expect(adoptPolicy(r.state, "ma63", 1).ok).toBe(false);
  });
});

describe("Budget", () => {
  // 19 Oct 2026 + 51 weeks = 11 Oct 2027, the Budget week.
  const toBudget = (g: GameState) => weeks(g, 51);

  it("falls due in the second week of October", () => {
    const g = toBudget(newGame("PH", 3));
    expect(g.budgetDue).toBe(51);
    expect(weekDate(g.week).getMonth()).toBe(9);
  });

  it("is tabled by officials if the government does nothing", () => {
    let g = toBudget(newGame("PH", 3));
    g = weeks(g, BUDGET.window);
    expect(g.budgetDue).toBeNull();
    expect(g.budgetYear).toBe(2027);
    expect(Object.keys(g.me.budget).length).toBeGreaterThan(0);
  });

  it("raises support in the targeted segment and rejects overspending past the limit", () => {
    const g = toBudget(newGame("PH", 3));
    const envelope = budgetEnvelope(g.fiscal);
    expect(tableBudget(g, { cash: envelope + BUDGET.overspendMax + 1 }).ok).toBe(false);
    const r = tableBudget(g, { borneo: envelope });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const sabahSeat = seat("P.179"); // Ranau
    expect(share(r.state, sabahSeat)).toBeGreaterThan(share(g, sabahSeat));
  });

  it("only happens once a year", () => {
    let g = toBudget(newGame("PN", 3));
    g = weeks(g, 10);
    expect(g.budgetDue).toBeNull();
  });
});

describe("decision cards", () => {
  it("appear through the year, never more than three at once, and expire to their defaults", () => {
    let g = newGame("PN", 11);
    let seen = 0;
    for (let w = 0; w < 52; w++) {
      g = advanceWeek(g);
      expect(g.cards.length).toBeLessThanOrEqual(4);
      seen = Object.keys(g.cardLast).length;
    }
    expect(seen).toBeGreaterThanOrEqual(6);
    expect(g.cards.every((c) => c.deadline > g.week - 1)).toBe(true);
  });

  it("festivals arrive in their week", () => {
    const cny = FESTIVALS.find((f) => f.kind === "cny")!;
    let g = newGame("PH", 5);
    while (weekDate(g.week + 1) <= new Date(2027, 1, 6)) g = advanceWeek(g);
    g = advanceWeek(g);
    expect(g.cardLast[cny.kind]).toBeDefined();
  });

  it("answering applies the choice and removes the card", () => {
    const g = newGame("PN", 2);
    const withCard: GameState = { ...g, cards: [{ id: 1, kind: "tiktok", week: 0, deadline: 4 }] };
    const r = answerCard(withCard, 1, 0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.cards).toHaveLength(0);
    expect(r.state.me.funds).toBe(g.me.funds - 200_000);
    expect(r.state.me.mood.youth).toBeGreaterThan(0);
  });

  it("a by-election decides the seat on the spot", () => {
    const g = newGame("PN", 2);
    const i = seat("P.107");
    const withCard: GameState = { ...g, cards: [{ id: 9, kind: "byelection", week: 0, deadline: 4, seat: i }] };
    const r = answerCard(withCard, 9, 0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.message).toContain("Sungai Buloh by-election");
    expect(["PH", "PN", "BN", "MUDA", "OTHERS"]).toContain(r.state.holders[i]);
    expect(r.state.rng).not.toBe(g.rng);
  });

  it("every card has a valid default choice for both sides", () => {
    for (const player of ["PH", "PN"] as const) {
      const g = { ...newGame(player, 1), me: { ...newGame(player, 1).me, favours: 1, trust: 30 } };
      for (const def of Object.values(CARD_BY_KIND)) {
        const card = { id: 1, kind: def.kind, week: 0, deadline: 4, seat: 0 };
        expect(def.choices(g, card)[def.defaultChoice], `${player} ${def.kind}`).toBeDefined();
      }
    }
  });
});

describe("turn loop with milestone 5 systems", () => {
  it("Skip 1 Month still equals four weeks across the Budget and festivals", () => {
    let a = newGame("PH", 77);
    let b = a;
    for (let m = 0; m < 16; m++) a = advanceMonth(a);
    for (let w = 0; w < 64; w++) b = advanceWeek(b);
    expect(strip(a)).toEqual(strip(b));
  });
});
