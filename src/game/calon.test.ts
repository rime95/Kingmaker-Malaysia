import { describe, expect, it } from "vitest";
import { newGame, type GameState } from "./state";
import { candidateStrength, clearCandidate, lineup, nameCandidate, nominationsWeek, partySeats, syncCalon, yourParty } from "./systems/nominations";
import { divisionChief } from "./systems/camps";
import { bench, suggestPlacements } from "./systems/lineup";
import { projectAllFor } from "./state";
import { bestRead } from "./systems/polls";
import { SEATS } from "./world";

const ok = (r: { state: GameState; message: string } | { error: string }) => {
  if ("error" in r) throw new Error(r.error);
  return r.state;
};
const rich = (g: GameState) => ({ ...g, me: { ...g.me, capital: 100 } });
const mpSeat = (g: GameState) => partySeats(g).find((i) => g.people.some((p) => p.seat === i && p.party === yourParty(g) && p.id !== g.youId))!;
const mpOf = (g: GameState, i: number) => g.people.find((p) => p.seat === i && p.party === yourParty(g))!;

describe("naming candidates before the election", () => {
  it("a named calon is the pick when nominations open, ahead of the sitting MP, who notices at once", () => {
    const g = rich(newGame("PH", 4));
    const seat = mpSeat(g);
    const mp = mpOf(g, seat);
    const vp = g.people.find((p) => p.party === yourParty(g) && p.rank === 3 && p.seat === null && !p.chairman)!;
    expect(vp).toBeTruthy();
    const s = ok(nameCandidate(g, seat, vp.id));
    expect(lineup(s)[seat]).toBe(vp.id);
    expect(s.people.find((p) => p.id === mp.id)!.loyalty).toBeLessThan(mp.loyalty);
    // Dissolve: the window opens with the calon as the pick.
    const open = nominationsWeek({ ...s, parliament: { ...s.parliament, status: "campaign" } }).state;
    expect(open.nominations!.picks[seat]).toBe(vp.id);
    // Taking it back restores the MP.
    expect(lineup(ok(clearCandidate(s, seat)))[seat]).toBe(mp.id);
  });

  it("moving a sitting MP leaves their old seat to its division chief, and they lose incumbency", () => {
    const g = rich(newGame("PH", 4));
    const from = mpSeat(g);
    const mp = mpOf(g, from);
    const to = partySeats(g).find((i) => i !== from && !g.people.some((p) => p.seat === i && p.party === yourParty(g)))!;
    const s = ok(nameCandidate(g, to, mp.id));
    expect(lineup(s)[to]).toBe(mp.id);
    const chief = divisionChief(s, from);
    const fallback = lineup(s)[from];
    expect(fallback).not.toBe(mp.id);
    if (chief && chief.seat === null) expect(fallback).toBe(chief.id);
    expect(candidateStrength(s, to, mp)).toBeLessThan(candidateStrength(s, from, mp));
  });

  it("you, as president, can stand anywhere your party fights", () => {
    const g = rich(newGame("PH", 4));
    const seat = partySeats(g).find((i) => i !== g.career.homeSeat)!;
    const s = ok(nameCandidate(g, seat, g.youId!));
    expect(lineup(s)[seat]).toBe(g.youId);
  });

  it("a calon who leaves the party is dropped", () => {
    const g = rich(newGame("PH", 4));
    const seat = mpSeat(g);
    const vp = g.people.find((p) => p.party === yourParty(g) && p.rank === 3 && p.seat === null && !p.chairman)!;
    const s = ok(nameCandidate(g, seat, vp.id));
    const left = { ...s, people: s.people.map((p) => (p.id === vp.id ? { ...p, party: "IND" } : p)) };
    const r = syncCalon(left);
    expect(r.state.calon[seat]).toBeUndefined();
    expect(r.lines.length).toBe(1);
  });

  it("the bench lists your big names, and suggestions only ever help", () => {
    const g = newGame("PH", 4);
    const b = bench(g);
    expect(b[0].id).toBe(g.youId);
    expect(b.every((p) => p.party === yourParty(g))).toBe(true);
    const proj = projectAllFor(g);
    const reads = SEATS.map((_, i) => bestRead(g.polls, proj, g.seed, i, g.week, 1));
    for (const m of suggestPlacements(g, reads)) expect(m.gain).toBeGreaterThan(0);
  });
});
