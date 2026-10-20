import { describe, expect, it } from "vitest";
import { claimBubble } from "./actions";
import { advanceMonth } from "./month";
import { newGame, type GameState } from "./state";
import { newBubbles } from "./systems/bubbles";
import { advanceWeek } from "./week";
import { contestingIn, SEATS } from "./world";

const strip = (s: GameState) => ({ ...s, report: null });

describe("opportunity bubbles", () => {
  it("1–3 appear each week on seats you contest, the same for the same seed", () => {
    for (let w = 0; w < 10; w++) {
      const g = { ...newGame("PN", 5), week: w };
      const b = newBubbles(g);
      expect(b.length).toBeGreaterThanOrEqual(1);
      expect(b.length).toBeLessThanOrEqual(3);
      for (const x of b) expect(contestingIn(SEATS[x.seat])).toContain("PN");
      expect(newBubbles(g)).toEqual(b);
    }
  });

  it("can be claimed once, for free", () => {
    const g = newGame("PH", 3);
    const b = g.bubbles[0];
    const r = claimBubble(g, b.id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.me.ap).toBe(g.me.ap);
    expect(r.state.bubbles.some((x) => x.id === b.id)).toBe(false);
    expect(claimBubble(r.state, b.id).ok).toBe(false);
  });

  it("a donor bubble adds money", () => {
    const g = newGame("PH", 3);
    const withDonor: GameState = { ...g, bubbles: [{ id: 1, seat: 0, kind: "donor", value: 200_000 }] };
    const r = claimBubble(withDonor, 1);
    expect(r.ok && r.state.me.funds).toBe(g.me.funds + 200_000);
  });

  it("expire at the end of the week, replaced by new ones", () => {
    const g = newGame("BN", 2);
    const n = advanceWeek(g);
    expect(n.bubbles.every((b) => b.id >= 10)).toBe(true);
  });

  it("don't break Skip 1 Month = four weeks", () => {
    const a = advanceMonth(newGame("GRS", 9));
    let b = newGame("GRS", 9);
    for (let i = 0; i < 4; i++) b = advanceWeek(b);
    expect(strip(a)).toEqual(strip(b));
  });
});
