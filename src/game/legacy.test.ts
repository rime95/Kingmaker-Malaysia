import { describe, expect, it } from "vitest";
import { newGame, type GameState } from "./state";
import { advanceWeek } from "./week";
import { continueAfterEnding, legacyOf, retireNow } from "./systems/legacy";
import { makeRoom } from "./systems/events";
import { careerWeek } from "./progress";

describe("the end of the road", () => {
  it("retiring shows your legacy, then your protégé takes over", () => {
    const g = newGame("MUDA", 5, { name: "Adam Rahman" });
    const r = retireNow(g);
    if ("error" in r) throw new Error(r.error);
    expect(r.state.ending?.reason).toBe("chose");
    const l = legacyOf(r.state);
    expect(l.name).toBe("Adam Rahman");
    expect(l.headline.length).toBeGreaterThan(10);
    const next = continueAfterEnding(r.state);
    expect(next.ending).toBeNull();
    expect(next.career.name).toBe(g.career.protege);
    expect(next.career.generation).toBe(2);
  });

  it("reaching retirement age pauses on the legacy screen instead of handing over silently", () => {
    const g = newGame("PH", 5, { name: "Adam Rahman" });
    const old: GameState = { ...g, career: { ...g.career, age: g.career.retireAge } };
    const r = careerWeek(old);
    expect(r.state.ending?.reason).toBe("retired");
    expect(r.state.career.name).toBe("Adam Rahman");
  });

  it("an ousted leader can fight on", () => {
    const g = newGame("PH", 5, { name: "Adam Rahman" });
    const next = continueAfterEnding({ ...g, ending: { reason: "ousted", week: 0 } });
    expect(next.ending).toBeNull();
    expect(next.career.name).toBe("Adam Rahman");
  });

  it("time moving on with the legacy screen up carries the dynasty forward", () => {
    const g = newGame("PH", 5, { name: "Adam Rahman" });
    const next = advanceWeek({ ...g, ending: { reason: "chose", week: 0 } });
    expect(next.ending).toBeNull();
    expect(next.career.name).toBe(g.career.protege);
  });
});

describe("decision cards", () => {
  it("never more than three wait at once", () => {
    for (const seed of [1, 2, 3]) {
      let g = newGame("PN", seed);
      for (let w = 0; w < 120; w++) {
        g = advanceWeek(g);
        expect(g.cards.length).toBeLessThanOrEqual(3);
      }
    }
  }, 120_000);

  it("a crisis pushes out a festival, but a festival waits behind a crisis", () => {
    const card = (id: number, kind: string) => ({ id, kind, week: 0, deadline: 4 });
    const full = [card(1, "deepavali"), card(2, "council"), card(3, "nominations")];
    expect(makeRoom(full, "crisis")?.map((c) => c.kind)).toEqual(["council", "nominations"]);
    expect(makeRoom([card(1, "crisis"), card(2, "council"), card(3, "nominations")], "deepavali")).toBeNull();
  });
});
