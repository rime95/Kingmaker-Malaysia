import { describe, expect, it } from "vitest";
import { newGame } from "./state";
import { testSitting } from "./testTools";
import { recentVotes } from "./systems/dewan";
import { holdByElection } from "./systems/events";
import { bigMoment } from "./month";
import type { ReportLine } from "./state";

describe("votes you see", () => {
  it("a Dewan vote just taken is listed with its numbers and your MPs' line", () => {
    const g = newGame("PH", 4);
    expect(recentVotes(g)).toHaveLength(0);
    const { state } = testSitting(g);
    const v = recentVotes(state);
    expect(v).toHaveLength(1);
    const d = v[0];
    if (d.kind !== "division") throw new Error("expected a division");
    expect(d.ayes + d.noes + d.abstain + d.absent).toBe(222);
    expect(d.yours).not.toBeNull();
    // A vote alone no longer stops a skip: it goes in the summary.
    expect(bigMoment({ ...state, cards: [], budgetDue: null })).toBe(false);
  });

  it("a by-election held this turn is listed", () => {
    const g = newGame("PH", 4);
    const lines: ReportLine[] = [];
    const after = holdByElection(g, 10, lines);
    const v = recentVotes(after);
    expect(v.some((x) => x.kind === "byelection" && x.seat === 10)).toBe(true);
  });

  it("votes from turns before don't come back", () => {
    const { state } = testSitting(newGame("PH", 4));
    expect(recentVotes({ ...state, week: state.week + 4 })).toHaveLength(0);
  });
});
