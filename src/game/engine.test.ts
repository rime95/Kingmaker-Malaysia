import { describe, expect, it } from "vitest";
import { runElection } from "./election";
import { newGame, projectAllFor, seatCounts } from "./state";
import { COALITION_INDEX, projectAll, projectSeat, ZERO_SWING } from "./voter";
import { COALITIONS, MAJORITY, SEATS, STATES, SUPERMAJORITY, TOTAL_SEATS } from "./world";

describe("world", () => {
  it("has 222 seats with unique codes and a 112 majority", () => {
    expect(TOTAL_SEATS).toBe(222);
    expect(new Set(SEATS.map((s) => s.code)).size).toBe(222);
    expect(MAJORITY).toBe(112);
    expect(SUPERMAJORITY).toBe(148);
  });

  it("matches the real seat count per state", () => {
    const expected: Record<string, number> = { PLS: 3, KDH: 15, KTN: 14, TRG: 8, PNG: 13, PRK: 24, PHG: 14, SGR: 22, KUL: 11, PJY: 1, NSN: 8, MLK: 6, JHR: 26, LBN: 1, SBH: 25, SWK: 31 };
    for (const st of STATES) expect(SEATS.filter((s) => s.state === st.id).length, st.id).toBe(expected[st.id]);
  });

  it("has demographics that sum to 1 and enough voters for each GE15 majority", () => {
    for (const s of SEATS) {
      const sum = Object.values(s.demo.ethnic).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 6);
      expect(s.electorate * 0.9).toBeGreaterThan(s.ge15Majority);
    }
  });
});

describe("voter model", () => {
  const game = newGame("PH", 42);

  it("reproduces every GE15 winner before anything changes", () => {
    const proj = projectAllFor(game);
    const wrong = SEATS.filter((s, i) => proj[i].leader !== s.ge15Coalition).map((s) => s.code);
    expect(wrong).toEqual([]);
  });

  it("projected seat totals add to 222", () => {
    const counts = seatCounts(projectAll(game).map((p) => p.leader));
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(222);
  });

  it("vote shares in each seat sum to 1", () => {
    for (const s of SEATS) {
      const sum = Object.values(projectSeat(s, game).shares).reduce((a, b) => a! + b!, 0)!;
      expect(sum).toBeCloseTo(1, 6);
    }
  });

  it("a national swing toward a coalition gains it seats", () => {
    const before = seatCounts(projectAll(game).map((p) => p.leader)).PN;
    const swing = { ...ZERO_SWING(), PN: 0.3 };
    const after = seatCounts(projectAll({ ...game, swing }).map((p) => p.leader)).PN;
    expect(after).toBeGreaterThan(before);
  });

  it("a seat offset only moves that seat", () => {
    const seat = SEATS.find((s) => s.code === "P.105")!; // Petaling Jaya
    const offsets = game.seatOffsets.map((r) => [...r]);
    offsets[seat.index][COALITION_INDEX.PN] = 1;
    const changed = { ...game, seatOffsets: offsets };
    expect(projectSeat(seat, changed).shares.PN!).toBeGreaterThan(projectSeat(seat, game).shares.PN!);
    const other = SEATS.find((s) => s.code === "P.106")!;
    expect(projectSeat(other, changed).shares.PN).toBeCloseTo(projectSeat(other, game).shares.PN!, 10);
  });
});

describe("election", () => {
  const game = newGame("BN", 7);

  it("is reproducible from the same seed", () => {
    const a = runElection(game, 123).result;
    const b = runElection(game, 123).result;
    expect(a.totals).toEqual(b.totals);
  });

  it("assigns every seat once, with a full call order", () => {
    const { result } = runElection(game, 99);
    expect(Object.values(result.totals).reduce((x, y) => x + y, 0)).toBe(222);
    expect(new Set(result.seats.map((s) => s.callOrder)).size).toBe(222);
  });

  it("varies across seeds but stays near the GE15 baseline", () => {
    const totals = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => runElection(game, seed * 7919).result.totals);
    const ph = totals.map((t) => t.PH);
    expect(new Set(ph).size).toBeGreaterThan(1);
    for (const t of totals) for (const c of COALITIONS) expect(Math.abs(t[c] - SEATS.filter((s) => s.ge15Coalition === c).length)).toBeLessThan(35);
  });
});
