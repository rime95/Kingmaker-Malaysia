import { describe, expect, it } from "vitest";
import { newGame } from "./state";
import { marginOf, partyStats } from "./systems/partyStats";
import { leaderOfParty } from "./systems/people";
import { SEATS, TOTAL_SEATS } from "./world";

describe("party stats", () => {
  it("every seat belongs to one party, and the numbers add up", () => {
    const g = newGame("PH", 4);
    const parties = [...new Set(g.holderParties)];
    const all = parties.map((p) => partyStats(g, p));
    expect(all.reduce((a, s) => a + s.seats, 0)).toBe(TOTAL_SEATS);
    // Before any election, a party has what it won at GE15.
    for (const s of all) expect(s.seats).toBe(s.seatsAtGE);
    const dap = partyStats(g, "DAP");
    expect(dap.side).toBe("government");
    expect(dap.leader).toBe(leaderOfParty(g, "DAP")?.name);
    expect(dap.women).toBeGreaterThan(0);
  });

  it("tallies a division by party", () => {
    const g = newGame("PH", 4);
    const votes = SEATS.map((s) => (g.government.includes(g.holders[s.index]) ? "aye" : "no") as "aye" | "no");
    const s = partyStats(g, "PAS", votes);
    expect(s.votes?.no).toBe(s.seats);
  });

  it("margins are shares of the vote", () => {
    const g = newGame("PH", 4);
    for (const s of SEATS) {
      const m = marginOf(g, s.index);
      expect(m).toBeGreaterThanOrEqual(0);
      expect(m).toBeLessThanOrEqual(1);
    }
  });
});
