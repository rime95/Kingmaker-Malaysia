import { describe, expect, it } from "vitest";
import { advanceMonth } from "./month";
import { newGame, weekDate, type GameState } from "./state";
import { DEWAN, MOTION_BY_ID, division, meetingOf, nextMotion, openMeeting, prepMotion, resolveMotion } from "./systems/dewan";
import { testSitting } from "./testTools";
import { advanceWeek } from "./week";

const strip = (s: GameState) => ({ ...s, report: null });

/** Run weeks until the Dewan has a meeting open. */
function toMeeting(g: GameState): GameState {
  for (let i = 0; i < 40 && !g.dewan.meeting; i++) g = advanceWeek(g);
  return g;
}

describe("Dewan sittings", () => {
  it("sits in Feb–Mar, Jun–Jul and Oct–Nov", () => {
    expect(meetingOf(new Date(2027, 1, 15))).toBe("2027-1");
    expect(meetingOf(new Date(2027, 6, 1))).toBe("2027-2");
    expect(meetingOf(new Date(2027, 10, 30))).toBe("2027-3");
    expect(meetingOf(new Date(2027, 0, 10))).toBeNull();
  });

  it("opens with an Order Paper (the Royal Address first in the year) and votes one item a turn", () => {
    let g = toMeeting(newGame("PH", 1));
    expect(g.dewan.meeting).not.toBeNull();
    expect(g.dewan.motions.length).toBeGreaterThanOrEqual(3);
    if (g.dewan.meeting!.endsWith("-1")) expect(g.dewan.motions[0].def).toBe("royal");
    const first = g.dewan.motions[0];
    while (g.week < first.voteWeek) g = advanceWeek(g);
    expect(g.dewan.motions[0].result).not.toBeNull();
    expect(g.report!.lines.some((l) => l.text.startsWith("Dewan Rakyat:"))).toBe(true);
  });

  it("generates fresh business every year without repeating itself", () => {
    let g = newGame("BN", 2);
    for (let m = 0; m < 26; m++) g = advanceMonth(g);
    const titles = [...g.dewan.history, ...g.dewan.motions].map((m) => m.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("a constitutional amendment needs two-thirds; a whip holds your MPs", () => {
    const g = newGame("PH", 3);
    const base = { ...g, dewan: openMeeting(g, "2027-2", 2027) };
    const m = { ...base.dewan.motions[0], def: "ma63", kind: "constitutional" as const, twoThirds: true };
    const d = division(base, m);
    expect(d.passed).toBe(d.ayes >= DEWAN.twoThirds);
    // A split party: whipping keeps more of your MPs voting the line.
    const split = { ...base, me: { ...base.me, unity: 10 } };
    const loose = division(split, { ...m, def: "ruu355" });
    const whipped = division(split, { ...m, def: "ruu355", prep: { ...m.prep, whip: true } });
    const mine = (dv: typeof loose) => dv.votes.filter((v, i) => split.holders[i] === "PH" && v === "aye").length;
    expect(mine(whipped)).toBeGreaterThanOrEqual(mine(loose));
  });

  it("your moves cost AP and capital, and the vote lands on approval and your voters", () => {
    const g = newGame("PH", 4);
    const s = { ...g, dewan: openMeeting(g, "2027-2", 2027) };
    const m = nextMotion(s)!;
    const r = prepMotion(s, m.id, { kind: "whip" });
    if ("error" in r) throw new Error(r.error);
    expect(r.state.me.ap).toBe(s.me.ap - DEWAN.whip.ap);
    expect(r.state.me.capital).toBe(s.me.capital - DEWAN.whip.capital);
    const after = resolveMotion(r.state, nextMotion(r.state)!);
    expect(after.state.dewan.motions[0].result).not.toBeNull();
    expect(MOTION_BY_ID[m.def]).toBeDefined();
  });

  it("the test tool takes a vote at once, and Skip 1 Month still equals four weeks", () => {
    const g = newGame("PN", 5);
    const r = testSitting(g);
    expect(r.state.dewan.motions.some((m) => m.result)).toBe(true);
    let w = g;
    for (let k = 0; k < 4; k++) w = advanceWeek(w);
    expect(strip(advanceMonth(g)).dewan).toEqual(strip(w).dewan);
    expect(weekDate(0).getFullYear()).toBe(2026);
  });
});
