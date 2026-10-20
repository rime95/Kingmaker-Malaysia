import { describe, expect, it } from "vitest";
import { answerCard, applyAction, changeGovernmentMidTerm, govSeats, launchStimulus, noConfidenceChance, setCivilPay, startProject } from "./actions";
import { advanceMonth } from "./month";
import { newGame, playerNationalEffect, type GameState } from "./state";
import { NATION, PROJECT_BY_ID, economyScore, ministerEffect, nationWeek } from "./systems/nation";
import { advanceWeek } from "./week";

const strip = (s: GameState) => ({ ...s, report: null });

describe("the nation", () => {
  it("starts near today's numbers and stays in sensible ranges for years", () => {
    let g = newGame("PH", 1);
    expect(g.nation.gdp).toBeCloseTo(4.4);
    for (let i = 0; i < 156; i++) g = advanceWeek(g);
    const n = g.nation;
    expect(n.gdp).toBeGreaterThan(-3);
    expect(n.gdp).toBeLessThan(9);
    expect(n.inflation).toBeGreaterThan(-1);
    expect(n.inflation).toBeLessThan(8);
    expect(n.history.length).toBeGreaterThan(30);
    expect(g.economy).toBeCloseTo(economyScore(n), 5);
  });

  it("Skip 1 Month still equals four weeks", () => {
    let w = newGame("BN", 2);
    for (let i = 0; i < 4; i++) w = advanceWeek(w);
    expect(strip(advanceMonth(newGame("BN", 2))).nation).toEqual(strip(w).nation);
  });

  it("government approval feeds your swing: up in government, down in opposition", () => {
    const gov = newGame("PH", 3);
    const opp = newGame("PN", 3);
    const high = (s: GameState) => ({ ...s, nation: { ...s.nation, approval: 70 } });
    expect(playerNationalEffect(high(gov))).toBeGreaterThan(playerNationalEffect(gov));
    expect(playerNationalEffect(high(opp))).toBeLessThan(playerNationalEffect(opp));
  });

  it("good ministers help and empty ministries hurt", () => {
    const g = newGame("PH", 4);
    const best = { ...g, people: g.people.map((p) => (p.id === g.cabinet.economy ? { ...p, competence: 100 } : p)) };
    expect(ministerEffect(best, "economy")).toBe(1);
    const empty = { ...g, cabinet: { ...g.cabinet, economy: undefined } };
    expect(ministerEffect(empty, "economy")).toBeLessThan(0);
    // Over a year the better economy minister grows the economy faster.
    let a = best;
    let b = empty;
    for (let i = 0; i < 52; i++) {
      a = { ...a, nation: nationWeek(a).nation, week: a.week + 1 };
      b = { ...b, nation: nationWeek(b).nation, week: b.week + 1 };
    }
    expect(a.nation.gdp).toBeGreaterThan(b.nation.gdp);
  });

  it("floating fuel prices pushes inflation and the cost of living up", () => {
    let base = newGame("PH", 5);
    let floated: GameState = { ...base, me: { ...base.me, policies: { fuel: 2 } } };
    for (let i = 0; i < 40; i++) {
      base = { ...base, nation: nationWeek(base).nation, week: base.week + 1 };
      floated = { ...floated, nation: nationWeek(floated).nation, week: floated.week + 1 };
    }
    expect(floated.nation.inflation).toBeGreaterThan(base.nation.inflation + 0.3);
    expect(floated.nation.col).toBeGreaterThan(base.nation.col + 5);
  });

  it("Bank Negara raises the OPR when inflation runs hot", () => {
    const g = newGame("PH", 6);
    const hot = { ...g, week: 4, nation: { ...g.nation, inflation: 4.5 } };
    expect(nationWeek(hot).nation.opr).toBe(3);
  });
});

describe("levers", () => {
  it("only the Prime Minister pulls them", () => {
    expect(startProject(newGame("PN", 7), "ecrl").ok).toBe(false);
    expect(setCivilPay(newGame("BN", 7), "raise").ok).toBe(false); // BN is in government, but Anwar is PM
  });

  it("a mega project costs money while built and opens years later", () => {
    let g = newGame("PH", 8);
    const r = startProject(g, "datacentre");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    g = { ...r.state, fiscal: 80 };
    expect(startProject(g, "datacentre").ok).toBe(false);
    const def = PROJECT_BY_ID.datacentre;
    let fiscalCost = 0;
    let opened = false;
    for (let i = 0; i < def.weeks + 40 && !opened; i++) {
      const w = nationWeek(g);
      fiscalCost += w.fiscal;
      opened = w.opened.length > 0;
      g = { ...g, nation: w.nation, week: g.week + 1 };
    }
    expect(opened).toBe(true);
    expect(fiscalCost).toBeLessThan(0);
    expect(g.nation.projects[0].done).toBe(true);
  });

  it("a stimulus spends fiscal space and lifts growth for six months", () => {
    const g = newGame("PH", 9);
    const r = launchStimulus(g);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.fiscal).toBe(g.fiscal + NATION.stimulusFiscal);
    expect(r.state.nation.stimulus).toBe(NATION.stimulusWeeks);
    expect(launchStimulus(r.state).ok).toBe(false);
  });
});

describe("crises and the fall of governments", () => {
  it("a crisis brings a decision card; the response changes how hard it bites", () => {
    const g = newGame("PH", 10);
    const inCrisis: GameState = { ...g, nation: { ...g.nation, crisis: { kind: "recession", startWeek: 0, weeksLeft: 20, severity: 1 } }, cards: [{ id: 1, kind: "crisis", week: 0, deadline: 2 }] };
    const r = answerCard(inCrisis, 1, 0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.nation.crisis!.severity).toBeLessThan(1);
    expect(r.state.nation.stimulus).toBe(NATION.stimulusWeeks);
  });

  it("a no-confidence motion needs a thin majority; when the government falls the Agong appoints a new one", () => {
    const g = newGame("PN", 11);
    expect(govSeats(g)).toBeGreaterThan(140);
    expect(applyAction({ ...g, me: { ...g.me, capital: 100 } }, "noConfidence", { kind: "none" }).ok).toBe(false);
    // Strip the government of its partners: PH alone is far from 112.
    const thin: GameState = { ...g, government: ["PH"], nation: { ...g.nation, approval: 30 } };
    expect(noConfidenceChance(thin)).toBeGreaterThan(noConfidenceChance(g));
    const fallen = changeGovernmentMidTerm(thin);
    expect(fallen.formation).toBeNull();
    expect(fallen.tiers).toHaveLength(0);
    expect(fallen.government.length).toBeGreaterThan(1);
  });
});
