import { describe, expect, it } from "vitest";
import { buyAsset, delegateStaff, headhuntStaff } from "./actions";
import { newGame, projectAllFor, type GameState } from "./state";
import { ASSETS, ASSET_ORDER, assetProfit, newAsset } from "./systems/business";
import { DELEGATE, delegateWeek } from "./systems/delegate";
import { TEAM, type Role, type Staff } from "./systems/team";
import { advanceMonth } from "./month";
import { advanceWeek } from "./week";

const staff = (role: Role, skill = 3, auto = true): Staff => ({ id: 500 + skill, name: "Test Person", role, skill, salary: 10_000, loyalty: 70, weeks: 0, auto });
const strip = (s: GameState) => ({ ...s, report: null });

describe("delegation", () => {
  it("a political secretary collects the bubbles you missed", () => {
    const g = { ...newGame("PH", 1), team: [staff("polsec")] };
    expect(g.bubbles.length).toBeGreaterThan(0);
    const r = delegateWeek(g, projectAllFor(g));
    expect(r.state.bubbles).toHaveLength(0);
    expect(r.lines[0].text).toContain("collected");
  });

  it("an organiser builds machinery in battleground seats from the war chest", () => {
    const g = { ...newGame("PN", 2), team: [staff("organiser", 3)] };
    const r = delegateWeek(g, projectAllFor(g));
    const built = r.state.me.machinery.filter((m, i) => m > g.me.machinery[i]).length;
    expect(built).toBe(3);
    expect(r.state.me.funds).toBe(g.me.funds - 3 * DELEGATE.machinery.cost);
  });

  it("nobody spends the war chest below the reserve", () => {
    const g = { ...newGame("PN", 3), team: [staff("organiser", 5)] };
    const poor = { ...g, me: { ...g.me, funds: DELEGATE.reserve + 10_000 } };
    const r = delegateWeek(poor, projectAllFor(poor));
    expect(r.state.me.funds).toBe(poor.me.funds);
  });

  it("a fundraiser holds a dinner every four weeks", () => {
    const g = { ...newGame("BN", 4), team: [staff("fundraiser", 4)] };
    const r = delegateWeek(g, projectAllFor(g));
    expect(r.state.me.funds).toBeGreaterThan(g.me.funds);
    const off = delegateWeek({ ...g, week: 1 }, projectAllFor(g));
    expect(off.state.me.funds).toBe(g.me.funds);
  });

  it("staff only act when delegated, and delegation runs in the weekly turn", () => {
    const g = { ...newGame("PH", 5), team: [staff("polsec", 3, false)] };
    expect(delegateWeek(g, projectAllFor(g)).state).toBe(g);
    const on = delegateStaff(g, g.team[0].id, true);
    expect(on.ok).toBe(true);
    if (!on.ok) return;
    const next = advanceWeek(on.state);
    expect(next.report!.lines.some((l) => l.text.includes("collected"))).toBe(true);
  });

  it("Skip 1 Month still equals four weeks with delegated staff", () => {
    const base = { ...newGame("PN", 6), team: [staff("organiser", 2), staff("social", 2), staff("strategist", 3)] };
    let w = base;
    for (let i = 0; i < 4; i++) w = advanceWeek(w);
    expect(strip(advanceMonth(base)).me).toEqual(strip(w).me);
  });

  it("a headhunter brings a fresh shortlist of six for a fee", () => {
    const g = newGame("PH", 7);
    expect(g.teamMarket).toHaveLength(TEAM.marketSize);
    const r = headhuntStaff(g);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.teamMarket.map((x) => x.id)).not.toEqual(g.teamMarket.map((x) => x.id));
    expect(r.state.me.funds).toBe(g.me.funds - TEAM.headhuntCost);
  });
});

describe("party businesses", () => {
  it("every business makes a profit after its CEO is paid, with either kind of CEO", () => {
    for (const type of ASSET_ORDER) {
      for (const ceo of ["pro", "crony"] as const) {
        expect(assetProfit(newAsset(type, ceo), true, { commodity: 1 })).toBeGreaterThanOrEqual(0);
        expect(assetProfit(newAsset(type, ceo), false, { commodity: 0.6 })).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("buying a koperasi no longer drains the war chest", () => {
    const g = newGame("PH", 8);
    const r = buyAsset(g, "koperasi", "pro");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const withK = advanceWeek(r.state);
    const without = advanceWeek({ ...r.state, me: { ...r.state.me, assets: [] } });
    expect(withK.me.funds).toBeGreaterThan(without.me.funds);
    expect(ASSETS.koperasi.price).toBeGreaterThan(0);
  });
});
