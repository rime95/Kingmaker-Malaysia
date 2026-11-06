import { describe, expect, it } from "vitest";
import { migrateGame, newGame, SAVE_VERSION, type GameState } from "./state";
import { profileOf } from "./systems/realProfiles";
import { wz } from "./systems/wawasan";
import { advanceWeek } from "./week";

const playOn = (g: GameState, n: number) => {
  for (let i = 0; i < n; i++) g = advanceWeek({ ...g, cards: [] });
  return g;
};

/** A save as the game wrote it before these updates: none of the newer fields. */
function oldSave(version: number): GameState {
  const g = JSON.parse(JSON.stringify(playOn(newGame("PH", 3), 30)));
  for (const k of ["rivalPacts", "partnerCtl", "openSeats", "plot", "news", "ambitionsSeeded", "craft"]) delete g[k];
  delete g.nation.wawasan;
  for (const h of g.nation.history) {
    delete h.income;
    delete h.qol;
  }
  for (const p of g.people) for (const k of ["memory", "owed", "want", "wantDone"]) delete p[k];
  return { ...g, version };
}

describe("old saves", () => {
  for (const version of [24, 25, 26]) {
    it(`a version ${version} save keeps its game and plays on`, () => {
      const old = oldSave(version);
      const m = migrateGame(JSON.parse(JSON.stringify(old)));
      expect(m.version).toBe(SAVE_VERSION);
      expect(m.week).toBe(old.week);
      expect(m.player).toBe(old.player);
      expect(m.holders).toEqual(old.holders);
      expect(m.holderParties).toEqual(old.holderParties);
      expect(m.me.funds).toBe(old.me.funds);
      expect(m.me.capital).toBe(old.me.capital);
      expect(m.people.slice(0, old.people.length).map((p) => p.party)).toEqual(old.people.map((p) => p.party));
      expect(m.people.slice(0, old.people.length).map((p) => p.loyalty)).toEqual(old.people.map((p) => p.loyalty));
      const later = playOn(m, 60);
      expect(later.week).toBe(old.week + 60);
      expect(wz(later).real).toBeGreaterThan(0);
      expect(later.news!.length).toBeGreaterThan(0);
    });
  }

  it("an old save gains the new names as free tokoh, and everyone stays unique", () => {
    const old = oldSave(27);
    const trimmed = { ...old, people: old.people.filter((p) => p.name !== "Shahril Hamdan") };
    const m = migrateGame(JSON.parse(JSON.stringify(trimmed)));
    const added = m.people.find((p) => p.name === "Shahril Hamdan");
    expect(added?.tokoh).toBe(true);
    expect(added?.party).toBe("IND");
    const real = m.people.filter((p) => p.real).map((p) => p.name);
    expect(new Set(real).size).toBe(real.length);
  });

  it("nobody is thanked by surprise when an old save first runs", () => {
    const m = migrateGame(oldSave(26));
    const later = playOn(m, 8);
    expect(later.people.filter((p) => p.memory?.some((x) => x.reason === "You gave me what I wanted"))).toHaveLength(0);
  });
});

describe("the research stays in profiles", () => {
  it("a new game's roster and parties are as they were, whatever real life says", () => {
    const g = newGame("PH", 1);
    const moved = g.people.filter((p) => p.real && profileOf(p.name)?.party && profileOf(p.name)!.party !== p.party);
    expect(moved.length).toBeGreaterThan(0); // Real life has moved on...
    expect(g.people.find((p) => p.name === "Rafizi Ramli")).toBeDefined();
  });
});

describe("save size", () => {
  it("a long game still fits the browser's storage", () => {
    const g = playOn(newGame("PH", 2), 520);
    const kb = JSON.stringify(g).length / 1024;
    expect(kb).toBeLessThan(2500);
  }, 30000);
});
