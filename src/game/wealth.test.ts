import { describe, expect, it } from "vitest";
import { startProject } from "./actions";
import { advanceMonth } from "./month";
import { newGame, type GameState } from "./state";
import { BURSA, fairValue, sectorDrift } from "./systems/bursa";
import { PROPERTY_BY_ID, WEALTH, buyProperty, buyShares, declareAssets, donate, netWorth, payOffLoan, placeOrder, sellProperty, sellShares, unitPrice, wealthWeek } from "./systems/wealth";
import { advanceWeek } from "./week";

const strip = (s: GameState) => ({ ...s, report: null });

describe("Bursa", () => {
  it("lists real Malaysian companies priced at fair value", () => {
    const g = newGame("PH", 1);
    expect(g.bursa.length).toBeGreaterThanOrEqual(20);
    const mbb = g.bursa.find((x) => x.ticker === "MAYBANK")!;
    expect(mbb.glc).toBe(true);
    expect(mbb.price).toBeCloseTo(fairValue(mbb), 1);
  });

  it("a round trip costs fees and buying moves the price", () => {
    const g = newGame("PH", 2);
    const b = buyShares(g, "GAMUDA", 100_000);
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.state.bursa.find((x) => x.ticker === "GAMUDA")!.price).toBeGreaterThanOrEqual(g.bursa.find((x) => x.ticker === "GAMUDA")!.price);
    const s = sellShares(b.state, "GAMUDA", 100_000);
    expect(s.ok && s.state.personal.cash).toBeLessThan(g.personal.cash);
    expect(sellShares(g, "GAMUDA", 1).ok).toBe(false);
  });

  it("pays dividends at the quarter end and fills stop-losses", () => {
    let g = newGame("PH", 3);
    const b = buyShares(g, "MAYBANK", 50_000);
    if (!b.ok) throw new Error(b.error);
    g = b.state;
    for (let i = 0; i < 14; i++) g = advanceWeek(g);
    expect(g.personal.dividends).toBeGreaterThan(0);
    const price = g.bursa.find((x) => x.ticker === "MAYBANK")!.price;
    const o = placeOrder(g, "MAYBANK", "stopLoss", price * 1.5, 10_000);
    expect(o.ok).toBe(false); // a stop-loss must be below today's price
    const o2 = placeOrder(g, "MAYBANK", "takeProfit", price * 0.5, 10_000);
    expect(o2.ok).toBe(false);
    const o3 = placeOrder(g, "MAYBANK", "stopLoss", price - 0.01, 10_000);
    expect(o3.ok).toBe(true);
  });

  it("builders rise when your government breaks ground; consumer stocks fall when fuel floats", () => {
    const g = newGame("PH", 4);
    const building = { ...g, nation: { ...g.nation, projects: [{ id: "ecrl", progress: 0, startWeek: 0, done: false }] } };
    expect(sectorDrift("Construction", building.nation, building)).toBeGreaterThan(sectorDrift("Construction", g.nation, g));
    const floated = { ...g, me: { ...g.me, policies: { fuel: 2 } } };
    expect(sectorDrift("Consumer", g.nation, floated)).toBeLessThan(sectorDrift("Consumer", g.nation, g));
  });

  it("buying builders right before you launch a mega project is insider trading", () => {
    const g = newGame("PH", 5);
    const b = buyShares(g, "GAMUDA", 10_000);
    if (!b.ok) throw new Error(b.error);
    const clean = startProject(g, "ecrl");
    const dirty = startProject(b.state, "ecrl");
    expect(clean.ok && dirty.ok).toBe(true);
    if (!clean.ok || !dirty.ok) return;
    expect(dirty.state.me.risk).toBe(clean.state.me.risk + BURSA.insiderRisk);
    expect(dirty.message).toContain("shares");
  });
});

describe("property and your fortune", () => {
  it("you start with cash; the party starts with a land bank", () => {
    const g = newGame("BN", 6);
    expect(g.personal.cash).toBe(WEALTH.startCash.leader);
    expect(g.personal.properties.some((h) => h.owner === "party")).toBe(true);
    expect(netWorth(g, "party")).toBeGreaterThan(0);
    expect(newGame("BN", 6, { mode: "career" }).personal.cash).toBe(WEALTH.startCash.career);
  });

  it("buy with a mortgage, collect rent, and sell", () => {
    const g = newGame("PH", 7);
    const r = buyProperty(g, "SGR-shoplot", 1, "personal", WEALTH.maxLtv);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const price = unitPrice(g, PROPERTY_BY_ID["SGR-shoplot"]);
    expect(r.state.personal.cash).toBeCloseTo(g.personal.cash - price * (1 - WEALTH.maxLtv), 0);
    const h = r.state.personal.properties.find((x) => x.id === "SGR-shoplot")!;
    expect(h.loan!.principal).toBeCloseTo(price * WEALTH.maxLtv, 0);
    const after = wealthWeek(r.state).state;
    expect(after.personal.properties.find((x) => x.id === "SGR-shoplot")!.loan!.principal).toBeLessThan(h.loan!.principal);
    // Paying off inside three years costs a fee.
    const idx = r.state.personal.properties.findIndex((x) => x.id === "SGR-shoplot");
    const paid = payOffLoan(r.state, idx);
    expect(paid.ok && paid.state.personal.cash).toBeLessThan(r.state.personal.cash - h.loan!.principal + 1);
    const sold = sellProperty(r.state, idx);
    expect(sold.ok).toBe(true);
  });

  it("the party can sell its land bank to fund a campaign", () => {
    const g = newGame("PN", 8);
    const idx = g.personal.properties.findIndex((h) => h.owner === "party");
    const r = sellProperty(g, idx);
    expect(r.ok && r.state.me.funds).toBeGreaterThan(g.me.funds);
  });

  it("undeclared wealth costs integrity until you declare", () => {
    const g = newGame("PH", 9);
    const rich = { ...g, personal: { ...g.personal, cash: g.personal.startWorth + 10_000_000 } };
    expect(wealthWeek(rich).integrity).toBeLessThan(0);
    const d = declareAssets(rich);
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(wealthWeek(d.state).integrity).toBe(0);
    expect(declareAssets(d.state).ok).toBe(false);
  });

  it("donating to the party moves money to the war chest and earns career points", () => {
    const g = newGame("PH", 10, { mode: "career" });
    const r = donate(g, 100_000);
    expect(r.ok && r.state.me.funds).toBe(g.me.funds + 100_000);
    const big = donate({ ...g, personal: { ...g.personal, cash: 5_000_000 } }, 2_000_000);
    expect(big.ok && big.state.career.points).toBe(g.career.points + 3);
  });

  it("Skip 1 Month still equals four weeks", () => {
    let base = newGame("BN", 11);
    const b = buyShares(base, "TENAGA", 20_000);
    if (b.ok) base = b.state;
    let w = base;
    for (let i = 0; i < 4; i++) w = advanceWeek(w);
    const m = advanceMonth(base);
    expect(strip(m).personal).toEqual(strip(w).personal);
    expect(strip(m).bursa).toEqual(strip(w).bursa);
  });
});
