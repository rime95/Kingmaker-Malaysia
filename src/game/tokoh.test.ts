import { describe, expect, it } from "vitest";
import { newGame, type GameState } from "./state";
import { TOKOH } from "./data/tokoh";
import { courtBlocked, courtPerson, tokohMonth } from "./systems/tokoh";
import { ageOf } from "./systems/people";
import { canStand, partySeats, yourParty } from "./systems/nominations";

const rich = (g: GameState): GameState => ({ ...g, me: { ...g.me, ap: 50, funds: 50_000_000, capital: 200 } });

describe("tokoh", () => {
  it("every tokoh starts free, with their real age and home", () => {
    const g = newGame("PH", 4);
    for (const t of TOKOH) {
      const p = g.people.find((x) => x.name === t.name)!;
      expect(p, t.name).toBeTruthy();
      expect(p.party).toBe("IND");
      expect(p.tokoh).toBe(true);
      expect(p.home).toBe(t.home);
      expect(p.retireAge).toBeGreaterThan(ageOf(p, g.week));
    }
  });

  it("courting warms them; a good fit signs, joins your council in your camp, and can stand anywhere", () => {
    let g = rich(newGame("PH", 4));
    const p = g.people.find((x) => x.name === "Tony Pua")!;
    let joined = false;
    for (let k = 0; k < 12 && !joined; k++) {
      const r = courtPerson(g, p.id);
      expect("error" in r).toBe(false);
      if ("error" in r) return;
      g = { ...rich(r.state), week: r.state.week + 8 };
      joined = g.people.find((x) => x.id === p.id)!.party === yourParty(g);
    }
    expect(joined).toBe(true);
    const now = g.people.find((x) => x.id === p.id)!;
    expect(now.rank).toBe(2);
    expect(now.camp).toBe(g.youId);
    expect(canStand(g, partySeats(g)[0], now)).toBe(true);
  });

  it("you can't court them again straight away, or court an MP this way", () => {
    const g = rich(newGame("PH", 4));
    const p = g.people.find((x) => x.name === "Khairy Jamaluddin")!;
    const r = courtPerson(g, p.id);
    if ("error" in r) throw new Error(r.error);
    const still = r.state.people.find((x) => x.id === p.id)!;
    if (still.party === "IND") expect(courtBlocked(r.state, p.id)).toMatch(/recently/);
    const mp = g.people.find((x) => x.party === "PAS" && x.seat !== null)!;
    expect(courtBlocked(g, mp.id)).toMatch(/MP/);
  });

  it("rival parties sign only a few a year", () => {
    let g = newGame("PH", 4);
    let signed = 0;
    for (let w = 0; w < 104; w++) {
      const before = g.people.filter((p) => p.tokoh && p.party === "IND").length;
      g = tokohMonth({ ...g, week: w }).state;
      signed += before - g.people.filter((p) => p.tokoh && p.party === "IND").length;
    }
    expect(signed).toBeLessThanOrEqual(6);
  });
});

describe("real politicians stay on", () => {
  it("real people retire well into their eighties or at least five years on; generated people as before", () => {
    const g = newGame("PH", 4);
    for (const p of g.people.filter((x) => x.real && !x.tokoh)) {
      const age = ageOf(p, g.week);
      expect(p.retireAge, p.name).toBeGreaterThanOrEqual(age >= 85 ? age + 3 : Math.max(age + 5, 82));
    }
    for (const p of g.people.filter((x) => !x.real)) expect(p.retireAge).toBeLessThanOrEqual(86);
  });
});
