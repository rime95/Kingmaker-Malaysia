import { describe, expect, it } from "vitest";
import { newGame } from "./state";
import { testGeneralElection } from "./testTools";

describe("post-election analysis", () => {
  const before = newGame("PH", 11);
  const g = testGeneralElection(before);
  const a = g.lastAnalysis!;

  it("is built at every general election", () => {
    expect(a).not.toBeNull();
    expect(a.label).toBe("GE16");
    expect(a.week).toBe(g.night!.week);
  });

  it("adds up: seats, gains and losses match the result", () => {
    const won = g.lastElection!.seats.filter((r) => r.winner === "PH").length;
    expect(a.seats.after).toBe(won);
    expect(a.seats.before).toBe(before.holders.filter((h) => h === "PH").length);
    expect(a.seats.before + a.gains.length - a.losses.length).toBe(a.seats.after);
    for (const n of a.gains) expect(g.lastElection!.seats[n.i].winner).toBe("PH");
    for (const n of a.nearMisses) expect(n.margin).toBeGreaterThan(-0.05);
  });

  it("has a swing for every seat you stood in, groups, states and pundit lines", () => {
    const stood = g.lastElection!.seats.filter((r) => r.votes.PH !== undefined).length;
    expect(a.swing.filter((v) => v !== null).length).toBeGreaterThanOrEqual(stood);
    expect(a.vote.after).toBeGreaterThan(0.2);
    expect(a.groups.length).toBeGreaterThan(3);
    expect(a.states.length).toBeGreaterThan(5);
    expect(a.pundits.length).toBeGreaterThan(1);
  });
});
