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
    expect(edgeOf(g)).toBe(1);
    expect(checkOnPower(g)).toBeGreaterThan(0);
  });

  it("is biggest for a one-seat party", () => {
    expect(edgeOf(holding(1))).toBeGreaterThan(edgeOf(holding(100)));
  });
});
