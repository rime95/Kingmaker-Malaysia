import { describe, expect, it } from "vitest";
import { newGame, type GameState } from "./state";
import { advanceTurn, bigMoment, fastForward, mergeReports } from "./month";
import { CARD_PRIORITY } from "./systems/events";

/** A game moved to a stretch with nothing on: no cards, no budget, the Dewan in recess, no election near. */
function calm(): GameState {
  const g = newGame("PH", 4);
  return {
    ...g,
    cards: [],
    budgetDue: null,
    dewan: { ...g.dewan, meeting: null, motions: [] } as GameState["dewan"],
    parliament: { ...g.parliament, deadlineWeek: g.week + 200 },
    report: { week: g.week, income: [], expenses: [], seatsBefore: 0, seatsAfter: 0, movers: [], lines: [] },
  };
}

describe("fast forward", () => {
  it("runs through routine cards and votes to the end of the skip, leaving none behind", () => {
    const g = calm();
    const next = fastForward(g, 26, g.week + 1);
    expect(next.week - g.week).toBeGreaterThanOrEqual(2);
    expect(next.cards.filter((c) => (CARD_PRIORITY[c.kind] ?? 3) >= 2)).toHaveLength(0);
    expect(next.report!.weeks).toBe(next.week - g.week);
  });

  it("skips well past a fortnight in a normal game, and reports what it decided", () => {
    let weeks = 0;
    let g = { ...calm(), parliament: { ...calm().parliament, deadlineWeek: 500 } };
    let handled = 0;
    for (let i = 0; i < 5; i++) {
      // State election nights are big moments too: clear them to see how far a normal stretch runs.
      const next = fastForward({ ...g, cards: [], stateNight: null, stateTalks: null, stateTerms: [] }, 26, g.week + 1);
      weeks = Math.max(weeks, next.week - g.week);
      handled += next.report!.handled?.length ?? 0;
      g = next;
    }
    expect(weeks).toBeGreaterThan(8);
    expect(handled).toBeGreaterThan(0);
  });

  it("stops for your Budget as PM and for Election Night", () => {
    const g = { ...calm(), career: { ...calm().career, rung: 7 } };
    const b = fastForward(g, 60, g.week + 1);
    expect(b.week - g.week).toBeLessThan(60);
    const start = newGame("PH", 4);
    let s: GameState = { ...start, parliament: { ...start.parliament, deadlineWeek: start.week + 2 } };
    for (let i = 0; i < 30 && !s.night; i++) s = fastForward({ ...s, cards: [], budgetDue: null }, 26, s.week + 1);
    expect(s.night).toBeTruthy();
  }, 30000);
});

describe("quiet weeks", () => {
  it("a turn with nothing for you is quiet", () => {
    const g = calm();
    expect(bigMoment(g)).toBe(false);
    // A party vote due within the turn needs you.
    expect(bigMoment({ ...g, race: { voteWeek: g.week + 1 } as unknown as GameState["race"] })).toBe(true);
  });

  it("a big card, your Budget as PM, a campaign or talks stop time; routine things don't", () => {
    const g = { ...calm(), career: { ...calm().career, rung: 7 } };
    expect(bigMoment({ ...g, budgetDue: g.week })).toBe(true);
    expect(bigMoment({ ...g, budgetDue: g.week, parliament: { ...g.parliament, pm: "PN" } })).toBe(false);
    expect(bigMoment({ ...g, parliament: { ...g.parliament, status: "campaign" } })).toBe(true);
    const card = (kind: string) => [{ id: 1, kind, week: g.week, deadline: g.week + 4 }] as GameState["cards"];
    expect(bigMoment({ ...g, cards: card("crisis") })).toBe(true);
    expect(bigMoment({ ...g, cards: card("crisis") }, g.week + 1)).toBe(false); // One you put off doesn't stop a long skip.
    expect(bigMoment({ ...g, cards: card("council") })).toBe(false);
    expect(bigMoment({ ...g, namePending: true })).toBe(true);
    expect(bigMoment({ ...g, report: { ...g.report!, lines: [{ text: "MACC raid at your offices.", tone: "bad" }] } })).toBe(true);
    expect(bigMoment({ ...g, report: { ...g.report!, lines: [{ text: "Achievement: Selamat Datang.", tone: "good" }] } })).toBe(false);
  });

  it("merged reports cover every week", () => {
    const a = advanceTurn(newGame("PH", 4));
    const b = advanceTurn(a);
    const m = mergeReports([a.report!, b.report!]);
    expect(m.weeks).toBe((a.report!.weeks ?? 1) + (b.report!.weeks ?? 1));
    expect(m.seatsBefore).toBe(a.report!.seatsBefore);
    expect(new Set(m.lines.map((l) => l.text)).size).toBe(m.lines.length);
  });
});
