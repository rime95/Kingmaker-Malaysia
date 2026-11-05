import { describe, expect, it } from "vitest";
import { setTax, tableBudget } from "./actions";
import { migrateGame, newGame, type GameState } from "./state";
import { budgetEnvelope } from "./systems/budget";
import { nationWeek } from "./systems/nation";
import { MILESTONES, QOL_START, incomeUsd, initWawasan, pillarAvg, qualityOfLife, taxTargets, worldRank, wz } from "./systems/wawasan";
import { advanceWeek } from "./week";

/** A focused nation-building Budget. */
const FOCUS = { youth: 4, health: 3, urban: 3, rural: 1, borneo: 1, rnd: 4, civil: 1 };

/** The economy alone, week after week (no elections or AI): a calm test of the nation-building pace. */
function run(g: GameState, weeks: number, opts: { tax?: number; alloc?: Record<string, number>; aiGoverns?: boolean } = {}) {
  let s: GameState = { ...g, me: { ...g.me, integrity: 75 }, nation: { ...g.nation, crisis: null, wawasan: { ...initWawasan(), tax: opts.tax ?? 12, alloc: opts.alloc ?? {} } } };
  if (opts.aiGoverns) s = { ...s, parliament: { ...s.parliament, pm: "PN" } };
  const at: Record<string, number> = {};
  for (let i = 0; i < weeks; i++) {
    const nw = nationWeek(s);
    s = { ...s, week: s.week + 1, nation: { ...nw.nation, crisis: null }, fiscal: Math.max(0, Math.min(100, s.fiscal + (50 - s.fiscal) * 0.01 + nw.fiscal)) };
    for (const m of nw.reached) at[m.id] = s.week;
  }
  return { s, at };
}

describe("wawasan", () => {
  it("a focused player government builds a developed nation in about two to three terms and a superpower in about three", () => {
    const g = newGame("PH", 1);
    expect(g.parliament.pm).toBe(g.player);
    const { s, at } = run(g, 52 * 16, { tax: 16, alloc: FOCUS });
    const years = (id: string) => (at[id] ?? Infinity) / 52;
    expect(years("highincome")).toBeLessThan(5);
    expect(years("developed")).toBeGreaterThan(7);
    expect(years("developed")).toBeLessThan(14);
    expect(years("superpower")).toBeGreaterThan(11);
    expect(years("superpower")).toBeLessThan(16);
  });

  it("under another government the pillars slip and income barely moves", () => {
    const g = newGame("PH", 1);
    const { s } = run(g, 52 * 5, { aiGoverns: true, alloc: FOCUS });
    const w = wz(s);
    expect(w.human).toBeLessThan(initWawasan().human);
    expect(w.innov).toBeLessThan(initWawasan().innov);
    expect(w.real).toBeLessThan(initWawasan().real * 1.11);
    expect(w.reached).toEqual([]);
  });

  it("a higher tax take means a bigger Budget and more fiscal space but slower growth, and institutions soften the bite", () => {
    const g = newGame("PH", 1);
    const at = (tax: number, inst = 45) => ({ ...g, nation: { ...g.nation, wawasan: { ...initWawasan(), tax, inst } } });
    const hi = taxTargets(at(18));
    expect(hi.envelope).toBeGreaterThan(0);
    expect(hi.fiscal).toBeGreaterThan(0);
    expect(hi.growth).toBeLessThan(0);
    expect(budgetEnvelope(g.fiscal, hi.envelope)).toBeGreaterThan(budgetEnvelope(g.fiscal));
    expect(Math.abs(taxTargets(at(18, 85)).growth)).toBeLessThan(Math.abs(hi.growth));
    const low = taxTargets(at(10));
    expect(low.growth).toBeGreaterThan(0);
    expect(low.envelope).toBeLessThan(0);
  });

  it("setting the tax costs capital and only the PM can; a passed Budget builds the nation", () => {
    const g = newGame("PH", 1);
    const r = setTax(g, 15);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(wz(r.state).tax).toBe(15);
    expect(r.state.me.capital).toBe(g.me.capital - 5);
    expect(setTax(r.state, 15).ok).toBe(false);
    expect(setTax({ ...g, parliament: { ...g.parliament, pm: "PN" } }, 15).ok).toBe(false);
    const b = tableBudget({ ...g, budgetDue: g.week }, FOCUS);
    expect(b.ok).toBe(true);
    if (b.ok) expect(wz(b.state).alloc).toEqual(FOCUS);
  });

  it("milestones fire once, pay out, and stay", () => {
    const g = newGame("PH", 1);
    const rich = { ...g, nation: { ...g.nation, wawasan: { ...initWawasan(), real: 15500 } } };
    const a = advanceWeek(rich);
    expect(wz(a).reached).toContain("highincome");
    expect(a.report?.lines.some((l) => l.text.includes("High-income"))).toBe(true);
    const poor = { ...a, nation: { ...a.nation, wawasan: { ...wz(a), real: 9000 } } };
    const b = advanceWeek(poor);
    expect(wz(b).reached.filter((x) => x === "highincome")).toHaveLength(1);
  });

  it("old saves start Wawasan fresh, and Quality of Life starts where approval is measured from", () => {
    const g = newGame("PH", 1);
    const old = JSON.parse(JSON.stringify({ ...g, nation: { ...g.nation, wawasan: undefined } }));
    const m = migrateGame(old)!;
    expect(wz(m)).toEqual(initWawasan());
    expect(Math.abs(qualityOfLife(g) - QOL_START)).toBeLessThan(3);
    expect(worldRank(g)).toBeGreaterThan(25);
  });
});
