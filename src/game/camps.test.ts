import { describe, expect, it } from "vitest";
import { newGame, type GameState } from "./state";
import { CAMPS, bringIntoCamp, campsMonth, campsOf, divisionChief, divisionSeats, patrons, replaceChief, syncDivisions } from "./systems/camps";
import { homeOf } from "./systems/people";
import { regionOf, SEATS } from "./world";

const party = (g: GameState) => g.coalitions[g.player].members[0];

describe("divisions", () => {
  it("every seat your party stands in has a local division chief; MPs lead their own", () => {
    const g = newGame("PH", 4);
    const seats = divisionSeats(g);
    expect(Object.keys(g.divisions)).toHaveLength(seats.length);
    const ids = Object.values(g.divisions);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of seats) {
      const p = divisionChief(g, i)!;
      expect(p.party).toBe(party(g));
      expect(homeOf(p)).toBe(regionOf(SEATS[i].state));
      const mp = g.people.find((x) => x.seat === i);
      if (mp && mp.party === party(g)) expect(p.id).toBe(mp.id);
    }
  });

  it("a chief who leaves the party is replaced", () => {
    const g = newGame("PH", 4);
    const seat = Number(Object.keys(g.divisions).find((k) => g.people.find((p) => p.id === g.divisions[Number(k)])!.seat === null)!);
    const id = g.divisions[seat]!;
    const left = { ...g, people: g.people.map((p) => (p.id === id ? { ...p, party: "IND" } : p)) };
    const n = syncDivisions(left);
    expect(n.divisions[seat]).not.toBe(id);
    expect(divisionChief(n, seat)!.party).toBe(party(g));
  });
});

describe("camps", () => {
  it("every party has its leader's camp and rival camps; shares add up", () => {
    const g = newGame("PH", 4);
    for (const p of ["PKR", "UMNO", "PAS"]) {
      const c = campsOf(g, p);
      expect(c.camps.length).toBeGreaterThanOrEqual(1);
      expect(c.camps.length).toBeLessThanOrEqual(1 + CAMPS.maxRivals + 1);
      const sum = c.camps.reduce((a, x) => a + x.divisions, 0) + c.unaligned;
      expect(sum).toBe(c.total);
    }
    expect(campsOf(g, "PKR").camps[0].yours).toBe(true);
  });

  it("you can bring a loyal chief into your camp, and replace a hostile one", () => {
    let g = newGame("PH", 4);
    const seat = Number(Object.keys(g.divisions).find((k) => g.people.find((p) => p.id === g.divisions[Number(k)])!.camp !== g.youId)!);
    const id = g.divisions[seat]!;
    g = { ...g, me: { ...g.me, ap: 10, capital: 50 }, people: g.people.map((p) => (p.id === id ? { ...p, loyalty: 70 } : p)) };
    const r = bringIntoCamp(g, id);
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.state.people.find((p) => p.id === id)!.camp).toBe(g.youId);
    const r2 = replaceChief(r.state, seat);
    expect("error" in r2).toBe(false);
    if ("error" in r2) return;
    expect(r2.state.divisions[seat]).not.toBe(id);
    expect(r2.state.people.find((p) => p.id === r2.state.divisions[seat])!.camp).toBe(g.youId);
  });

  it("a rival camp with most of the divisions forces a challenge", () => {
    const g = newGame("PH", 4);
    const rival = patrons(g, party(g)).find((p) => p.id !== g.youId)!;
    const chiefs = new Set(Object.values(g.divisions));
    const takeover = { ...g, week: 3, people: g.people.map((p) => (chiefs.has(p.id) && p.id !== g.youId ? { ...p, camp: rival.id } : p)) };
    const r = campsMonth(takeover);
    expect(r.state.career.challenge).toBe(true);
    expect(r.lines.some((l) => l.text.includes("challenge"))).toBe(true);
  });
});
