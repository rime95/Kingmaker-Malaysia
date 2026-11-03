import { describe, expect, it } from "vitest";
import { newGame, type GameState } from "./state";
import { deepMove } from "./actions";
import { crossFloor, hoppingLaw, lawPassed, poachBlocked, poachMp } from "./systems/laws";
import { DEWAN } from "./systems/dewan";

/** Sack an MP from your party (the People panel's button). */
function applyDeep(g: GameState, id: number): GameState {
  const r = deepMove(g, { kind: "sack", id });
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

describe("the anti-hopping law", () => {
  it("is in force from the start, and changing it needs two-thirds", () => {
    const g = newGame("PH", 3);
    expect(hoppingLaw(g)).toBe("2022");
    expect(hoppingLaw(newGame("PH", 3, { hopping: "none" }))).toBe("none");
    expect(DEWAN.twoThirds).toBe(148);
  });

  it("passing the bills changes the law: tighten, repeal, restore", () => {
    const g = newGame("PH", 3);
    const strict = lawPassed(g, "hopping", []);
    expect(hoppingLaw(strict)).toBe("strict");
    const none = lawPassed(g, "hoppingRepeal", []);
    expect(hoppingLaw(none)).toBe("none");
    expect(hoppingLaw(lawPassed(none, "hopping", []))).toBe("2022");
  });

  it("with no law, an MP who crosses keeps the seat for their new side", () => {
    const g = newGame("PH", 3, { hopping: "none" });
    const mp = g.people.find((p) => p.seat !== null && g.holders[p.seat] === "PN")!;
    const s = crossFloor(g, mp.id, "PH", []);
    expect(s.holders[mp.seat!]).toBe("PH");
    expect(s.people.find((p) => p.id === mp.id)!.seat).toBe(mp.seat);
  });

  it("you can only poach when there is no law", () => {
    const g: GameState = { ...newGame("PH", 3), me: { ...newGame("PH", 3).me, funds: 50_000_000, capital: 100 } };
    const mp = g.people.find((p) => p.seat !== null && g.holders[p.seat] === "PN" && p.rank < 4)!;
    expect(poachBlocked(g, mp.id)).not.toBeNull();
    const free: GameState = { ...g, laws: { hopping: "none" } };
    expect(poachBlocked(free, mp.id)).toBeNull();
    const r = poachMp(free, mp.id);
    expect("state" in r).toBe(true);
  });

  it("under the 2022 law a sacked MP keeps the seat; tightened, it falls vacant", () => {
    const base = newGame("PH", 3);
    const g: GameState = { ...base, me: { ...base.me, capital: 100, ap: 50 } };
    const party = g.coalitions.PH.members[0];
    const mp = g.people.find((p) => p.party === party && p.seat !== null && p.rank < 4 && p.id !== g.youId)!;
    const kept = applyDeep(g, mp.id);
    expect(kept.people.find((p) => p.id === mp.id)!.seat).toBe(mp.seat);
    const strict = applyDeep({ ...g, laws: { hopping: "strict" } }, mp.id);
    expect(strict.people.find((p) => p.id === mp.id)?.seat ?? null).not.toBe(mp.seat);
  });
});
