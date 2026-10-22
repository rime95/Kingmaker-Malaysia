import { describe, expect, it } from "vitest";
import { AI } from "./config";
import { START_GOVERNMENT, newGame, projectAllFor, type GameState } from "./state";
import { campaignStates, stateRulers, weeksToElection } from "./systems/assemblies";
import { isHostile, rivalIds, rivalsWeek } from "./systems/rivals";
import { advanceWeek } from "./week";
import { SEATS } from "./world";

const seat = (code: string) => SEATS.find((s) => s.code === code)!.index;
function weeks(g: GameState, n: number) {
  for (let i = 0; i < n; i++) g = advanceWeek(g);
  return g;
}
const step = (g: GameState) =>
  rivalsWeek({
    rivals: g.rivals,
    player: g.player,
    playerTrust: g.me.trust,
    playerBuzz: g.me.buzz,
    holders: g.holders,
    week: g.week,
    seed: g.seed,
    projections: projectAllFor(g),
    weeksToElection: weeksToElection(g),
    campaignStates: campaignStates(g),
    rulers: stateRulers(g.dunHolders, g.government),
    government: g.government,
  });

describe("rival parties", () => {
  it("every coalition except yours and the independents has an AI", () => {
    const g = newGame("PN", 1);
    expect(Object.keys(g.rivals).sort()).toEqual(rivalIds("PN").sort());
    expect(g.rivals.PN).toBeUndefined();
    expect(g.rivals.OTHERS).toBeUndefined();
  });

  it("spend money to build presence in the seats they target", () => {
    const g = weeks(newGame("PN", 4), 8);
    const ph = g.rivals.PH!;
    expect(ph.targets.length).toBeGreaterThan(0);
    const start = newGame("PN", 4).rivals.PH!;
    expect(ph.service.some((v, i) => v > start.service[i])).toBe(true);
  });

  it("go after your seats when they are hostile", () => {
    let g = newGame("PN", 9);
    let hits = 0;
    for (let w = 0; w < 30; w++) {
      g = advanceWeek(g);
      for (const c of ["PH", "BN"] as const) hits += g.rivals[c]!.targets.filter((i) => g.holders[i] === "PN").length;
    }
    expect(hits).toBeGreaterThan(0);
  });

  it("allies stay friendly until coalition trust collapses", () => {
    expect(isHostile("BN", "PH", 60, START_GOVERNMENT)).toBe(false);
    expect(isHostile("BN", "PH", AI.allyTrustFloor - 1, START_GOVERNMENT)).toBe(true);
    expect(isHostile("PN", "PH", 100, START_GOVERNMENT)).toBe(true);
  });

  it("defend a seat where you are campaigning hard", () => {
    const g = newGame("PN", 3);
    const i = seat("P.107"); // Sungai Buloh: narrow PKR seat, PN runner-up
    const buzz = [...g.me.buzz];
    buzz[i] = 12; // Enough to threaten the seat (with your edge, much more would simply take it).
    const r = step({ ...g, me: { ...g.me, buzz } });
    expect(r.rivals.PH!.targets).toContain(i);
  });

  it("keep a cash reserve", () => {
    const g = weeks(newGame("PH", 5), 40);
    for (const c of rivalIds("PH")) {
      const r = g.rivals[c]!;
      // Below the reserve only through running costs, never by spending.
      if (r.funds < AI.reserve) expect(r.targets.length).toBe(0);
    }
  });

  it("are deterministic for a seed", () => {
    expect(weeks(newGame("BN", 8), 12).rivals).toEqual(weeks(newGame("BN", 8), 12).rivals);
  });

  it("run attack ads only against their head-to-head rival", () => {
    let g = newGame("GPS", 2);
    let attacks = 0;
    for (let w = 0; w < 60; w++) {
      g = advanceWeek(g);
      attacks += g.report!.lines.filter((l) => l.text.includes("attack ads")).length;
    }
    // GPS rarely meets peninsula rivals head to head, so it is seldom attacked.
    expect(attacks).toBeLessThan(5);
  });
});
