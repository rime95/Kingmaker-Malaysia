import { describe, expect, it } from "vitest";
import { edgeOf } from "./config";
import { checkOnPower, newGame, type GameState } from "./state";
import { SEATS } from "./world";

/** A game where you hold the first `n` seats. */
const holding = (n: number): GameState => {
  const g = newGame("MUDA", 1);
  return { ...g, holders: SEATS.map((_, i) => (i < n ? "MUDA" : g.holders[i] === "MUDA" ? "PH" : g.holders[i])) };
};

describe("a protagonist's landslide", () => {
  it("keeps your edge and spares you the voters' check all the way to two-thirds", () => {
    const g = holding(130);
    expect(edgeOf(g)).toBeGreaterThan(1.3);
    expect(checkOnPower(g)).toBe(0);
  });

  it("past two-thirds, the edge fades and voters start checking your power", () => {
    const g = holding(170);
    expect(edgeOf(g)).toBeLessThan(edgeOf(holding(130)));
    expect(edgeOf(holding(200))).toBe(1);
    expect(checkOnPower(g)).toBeGreaterThan(0);
  });

  it("voters react to a landslide in the polls, not only to seats already won", () => {
    const g = holding(100);
    const polled: GameState = { ...g, polls: { ...g.polls, national: [{ ...g.polls.national[0], seats: { ...g.polls.national[0].seats, MUDA: 180 } }] } };
    expect(checkOnPower(polled)).toBeGreaterThan(0);
    expect(edgeOf(polled)).toBeLessThan(edgeOf(g));
  });

  it("is biggest for a one-seat party", () => {
    expect(edgeOf(holding(1))).toBeGreaterThan(edgeOf(holding(100)));
  });
});
