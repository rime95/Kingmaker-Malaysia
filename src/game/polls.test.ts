import { describe, expect, it } from "vitest";
import { ALLY_BUZZ, allyIn, applyAction, commissionPoll, warRoom } from "./actions";
import { DIFFICULTY } from "./config";
import { advanceMonth } from "./month";
import { newGame, projectAllFor, type GameState } from "./state";
import { POLLS, bestRead, chanceBand, winChance, type SeatRead } from "./systems/polls";
import { resultView } from "./systems/results";
import { advanceWeek } from "./week";
import { SEATS, contestingIn } from "./world";

const seat = (code: string) => SEATS.find((s) => s.code === code)!.index;
const strip = (s: GameState) => ({ ...s, report: null });

describe("latest election results", () => {
  it("shows the real GE15 result until the game holds an election", () => {
    const g = newGame("PH", 1);
    const r = resultView(g.seatResults, seat("P.001"));
    expect(r.label).toBe("GE15");
    expect(r.candidates[0]).toMatchObject({ name: "Rusydan Rusmi", party: "PAS", coalition: "PN", votes: 24267 });
    expect(r.majority).toBe(12514);
    expect(r.candidates).toHaveLength(5);
  });

  it("GE15 winners match the seat holders for every seat", () => {
    const g = newGame("BN", 2);
    SEATS.forEach((s) => {
      const r = resultView(g.seatResults, s.index);
      expect(r.candidates[0].coalition).toBe(s.ge15Coalition === "OTHERS" ? r.candidates[0].coalition : s.ge15Coalition);
      expect(Math.abs(r.majority - s.ge15Majority)).toBeLessThan(Math.max(600, s.ge15Majority * 0.02)); // Wikipedia has small slips in Bachok and Sibu
    });
  });

  it("a general election replaces every seat's result", () => {
    let g = newGame("PN", 3, { scenario: "snap" });
    for (let i = 0; i < 12 && g.geCount === 15; i++) g = advanceWeek(g);
    expect(g.geCount).toBe(16);
    const r = resultView(g.seatResults, 0);
    expect(r.label).toBe("GE16");
    expect(r.candidates[0].coalition).toBe(g.holders[0]);
  });
});

describe("polls and win chance", () => {
  it("a national poll comes out every four weeks, the same for the same seed", () => {
    let a = newGame("PH", 7);
    let b = newGame("PH", 7);
    expect(a.polls.national).toHaveLength(1);
    for (let i = 0; i < 8; i++) {
      a = advanceWeek(a);
      b = advanceWeek(b);
    }
    expect(a.polls.national.map((p) => p.week)).toEqual([8, 4, 0]);
    expect(a.polls).toEqual(b.polls);
    const total = Object.values(a.polls.national[0].seats).reduce((x, y) => x + y, 0);
    expect(total).toBe(SEATS.length);
  });

  it("skip a month still equals four weeks", () => {
    let w = newGame("BN", 11);
    for (let i = 0; i < 4; i++) w = advanceWeek(w);
    const m = advanceMonth(newGame("BN", 11));
    expect(strip(m).polls).toEqual(strip(w).polls);
    expect(strip(m).me).toEqual(strip(w).me);
  });

  it("branch reports appear where your machinery is strong", () => {
    const g = newGame("PH", 4);
    const i = seat("P.105");
    const machinery = [...g.me.machinery];
    machinery[i] = 80;
    const next = advanceWeek({ ...g, me: { ...g.me, machinery } });
    expect(next.polls.seats[i]?.source).toBe("branch");
  });

  it("commissioning a poll costs money, no AP, once per week", () => {
    const g = newGame("PH", 5);
    const i = seat("P.105");
    const r = commissionPoll(g, i);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.me.funds).toBe(g.me.funds - POLLS.seatCost);
    expect(r.state.me.ap).toBe(g.me.ap);
    expect(r.state.polls.seats[i]?.source).toBe("poll");
    expect(commissionPoll(r.state, i).ok).toBe(false);
  });

  it("win chance rises with your polled lead and stale polls are less certain", () => {
    const read = (mine: number, week = 0): SeatRead => ({ week, source: "poll", moe: 0.05, shares: { PH: mine, PN: 1 - mine } });
    const p40 = winChance(read(0.4), "PH", 0)!;
    const p50 = winChance(read(0.5), "PH", 0)!;
    const p60 = winChance(read(0.6), "PH", 0)!;
    expect(p40).toBeLessThan(p50);
    expect(p50).toBeCloseTo(0.5, 2);
    expect(p60).toBeGreaterThan(0.9);
    expect(winChance(read(0.6), "PH", 20)!).toBeLessThan(p60);
    expect(winChance(read(0.6), "BN", 0)).toBeNull();
    expect(chanceBand(p60)).toBe("safe");
  });

  it("every seat has a read, and harder difficulty means fuzzier polls", () => {
    const easy = newGame("PH", 9, { difficulty: "easy" });
    const hard = newGame("PH", 9, { difficulty: "hard" });
    const pe = projectAllFor(easy);
    const ph = projectAllFor(hard);
    const re = bestRead(easy.polls, pe, easy.seed, 0, 0, DIFFICULTY.easy.pollError);
    const rh = bestRead(hard.polls, ph, hard.seed, 0, 0, DIFFICULTY.hard.pollError);
    expect(rh.moe).toBeGreaterThan(re.moe);
    expect(hard.me.unity).toBeLessThan(easy.me.unity);
  });

  it("the war-room simulation costs money and changes no seats", () => {
    const g = newGame("PN", 6);
    const r = warRoom(g);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.lastElection).not.toBeNull();
    expect(r.state.holders).toEqual(g.holders);
    expect(r.state.me.funds).toBeLessThan(g.me.funds);
  });
});

describe("campaigning where you have no candidate", () => {
  it("backs a friendly party in a seat your coalition doesn't contest", () => {
    const g = newGame("GRS", 2);
    const i = SEATS.findIndex((s) => !contestingIn(s).includes("GRS") && allyIn(g, s.index));
    expect(i).toBeGreaterThanOrEqual(0);
    const ally = allyIn(g, i)!;
    const r = applyAction(g, "ally", { kind: "seat", seat: i });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.rivals[ally]!.buzz[i]).toBeCloseTo(Math.min(100, g.rivals[ally]!.buzz[i] + ALLY_BUZZ));
    expect(r.state.me.trust).toBeGreaterThan(g.me.trust);
    // Not where you have your own candidate
    expect(applyAction(g, "ally", { kind: "seat", seat: SEATS.findIndex((s) => contestingIn(s).includes("GRS")) }).ok).toBe(false);
  });
});
