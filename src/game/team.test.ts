import { describe, expect, it } from "vitest";
import { fireStaff, hireStaff, raiseStaff } from "./actions";
import { DIFFICULTY, TURN_WEEKS } from "./config";
import { advanceMonth } from "./month";
import { newGame, type GameState } from "./state";
import { TEAM, freshMarket, pollError, teamSlots, type Role, type Staff } from "./systems/team";
import { advanceWeek, weeklyCashFlow } from "./week";

const strip = (s: GameState) => ({ ...s, report: null });
const staff = (role: Role, skill: number, extra: Partial<Staff> = {}): Staff => ({ id: 900 + skill, name: "Test Person", role, skill, salary: skill * 6000, loyalty: 60, weeks: 0, ...extra });
const withMarket = (g: GameState, x: Staff): GameState => ({ ...g, teamMarket: [x] });

describe("your team", () => {
  it("three candidates a month, the same for the same seed", () => {
    const g = newGame("PH", 1);
    expect(g.teamMarket).toHaveLength(TEAM.marketSize);
    expect(freshMarket(1, 0, 1).market).toEqual(newGame("PH", 1).teamMarket);
    let n = g;
    for (let i = 0; i < 4; i++) n = advanceWeek(n);
    expect(n.teamMarket.map((x) => x.id)).not.toEqual(g.teamMarket.map((x) => x.id));
  });

  it("hiring costs a signing fee, and the team size depends on your rank", () => {
    const g = newGame("PH", 2, { mode: "career" });
    expect(teamSlots(g)).toBe(2);
    const x = staff("fundraiser", 2);
    const r = hireStaff(withMarket(g, x), x.id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.me.funds).toBe(g.me.funds - x.salary * TEAM.signingWeeks);
    const full = { ...r.state, team: [staff("press", 1), staff("legal", 2)], teamMarket: [staff("social", 3)] };
    expect(hireStaff(full, 903).ok).toBe(false);
  });

  it("a political secretary adds an action point straight away and every week", () => {
    const g = newGame("PH", 3);
    const x = staff("polsec", 2);
    const r = hireStaff(withMarket(g, x), x.id);
    expect(r.ok && r.state.me.apMax).toBe(g.me.apMax + TURN_WEEKS);
    if (!r.ok) return;
    expect(advanceWeek(r.state).me.apMax).toBe(advanceWeek(g).me.apMax + TURN_WEEKS);
    const f = fireStaff(r.state, x.id);
    expect(f.ok && f.state.me.apMax).toBe(g.me.apMax);
  });

  it("salaries are a weekly cost and a fundraiser brings in donations", () => {
    const g = { ...newGame("BN", 4), team: [staff("fundraiser", 3)] };
    const flow = weeklyCashFlow(g);
    expect(flow.expenses.find((l) => l.label === "Your team")?.amount).toBe(18000);
    expect(flow.income.some((l) => l.label.startsWith("Donors") && l.amount === 90_000)).toBe(true);
  });

  it("a strategist sharpens polls; an organiser cuts machinery upkeep", () => {
    const g = newGame("PN", 5);
    expect(pollError({ ...g, team: [staff("strategist", 5)] })).toBeLessThan(DIFFICULTY.normal.pollError);
    expect(weeklyCashFlow({ ...g, team: [staff("organiser", 4)] }).upkeep).toBeLessThan(weeklyCashFlow(g).upkeep);
  });

  it("staff grow more skilled over time and ask for more", () => {
    let g: GameState = { ...newGame("PH", 6), team: [staff("press", 1, { weeks: 25 })] };
    const before = g.team[0].salary;
    g = advanceWeek(g);
    expect(g.team[0].skill).toBe(2);
    expect(g.team[0].salary).toBeGreaterThan(before);
  });

  it("unhappy staff get poached; a raise keeps them", () => {
    let g: GameState = { ...newGame("PH", 7), team: [staff("legal", 2, { loyalty: 5 })] };
    let gone = false;
    for (let i = 0; i < 52 && !gone; i++) {
      g = advanceWeek(g);
      gone = g.team.length === 0;
    }
    expect(gone).toBe(true);
    const r = raiseStaff({ ...g, team: [staff("legal", 2, { loyalty: 30 })] }, 902);
    expect(r.ok && r.state.team[0].loyalty).toBe(30 + TEAM.raiseLoyalty);
  });

  it("Skip 1 Month still equals four weeks with a team", () => {
    const base = { ...newGame("BN", 8), team: [staff("social", 2), staff("press", 3)] };
    let w = base;
    for (let i = 0; i < 4; i++) w = advanceWeek(w);
    expect(strip(advanceMonth(base)).team).toEqual(strip(w).team);
    expect(strip(advanceMonth(base)).me).toEqual(strip(w).me);
  });
});
