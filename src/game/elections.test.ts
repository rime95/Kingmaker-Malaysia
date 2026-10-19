import { describe, expect, it } from "vitest";
import { callGeneralElection, callStateElection, setSyncWithGE } from "./actions";
import { advanceMonth } from "./month";
import { newGame, type GameState } from "./state";
import { ASSEMBLY_STATES, stateRule, weekOf, weeksToElection } from "./systems/assemblies";
import { DUNS, DUNS_BY_STATE } from "./systems/dun";
import { advanceWeek } from "./week";
import { STATES, TOTAL_SEATS } from "./world";

function weeks(g: GameState, n: number) {
  for (let i = 0; i < n; i++) g = advanceWeek(g);
  return g;
}
const strip = (s: GameState) => ({ ...s, report: null });

describe("state assemblies", () => {
  it("have 600 seats split as in real life", () => {
    expect(DUNS).toHaveLength(600);
    for (const st of STATES) expect(DUNS_BY_STATE[st.id].length, st.id).toBe(st.dunSeats);
  });

  it("start with each state's real government", () => {
    const g = newGame("PH", 1);
    const rulers = Object.fromEntries(ASSEMBLY_STATES.map((id) => [id, stateRule(g.dunHolders, id, g.government).ruler]));
    expect(rulers).toMatchObject({ SGR: "PH", PNG: "PH", TRG: "PN", KTN: "PN", KDH: "PN", JHR: "BN", MLK: "BN", SWK: "GPS", SBH: "GRS", PRK: "PH" });
  });

  it("Melaka dissolves at the end of its term and votes four weeks later", () => {
    const deadline = weekOf("2026-12-20");
    let g = weeks(newGame("PN", 3), deadline + 1);
    expect(g.assemblies.MLK.status).toBe("campaign");
    g = weeks(g, 4);
    expect(g.assemblies.MLK.status).toBe("sitting");
    expect(g.assemblies.MLK.lastAfter).not.toBeNull();
    expect(Object.values(g.assemblies.MLK.lastAfter!).reduce((a, b) => a! + b!, 0)).toBe(28);
  });

  it("the ruling coalition can call an early state election; others can't", () => {
    const g = newGame("PH", 2);
    expect(callStateElection(g, "TRG").ok).toBe(false);
    const r = callStateElection(g, "SGR");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const after = weeks(r.state, 4);
    expect(after.assemblies.SGR.lastPollWeek).toBe(4);
    expect(after.report!.lines.some((l) => l.text.startsWith("Selangor state election"))).toBe(true);
  });
});

describe("Parliament", () => {
  it("only the Prime Minister's coalition can dissolve it", () => {
    expect(callGeneralElection(newGame("PN", 1)).ok).toBe(false);
    expect(callGeneralElection(newGame("PH", 1)).ok).toBe(true);
  });

  it("a general election replaces the seat holders and syncs Perak, Pahang and Perlis", () => {
    const r = callGeneralElection(newGame("PH", 6));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.assemblies.PRK.status).toBe("campaign");
    expect(r.state.assemblies.SGR.status).toBe("sitting");
    const g = weeks(r.state, 5);
    expect(g.parliament.status).toBe("sitting");
    expect(g.lastElection).not.toBeNull();
    expect(g.holders).toEqual(g.lastElection!.seats.map((s) => s.winner));
    expect(g.holders).toHaveLength(TOTAL_SEATS);
    expect(g.assemblies.PRK.lastPollWeek).toBe(5);
    expect(g.parliament.deadlineWeek).toBe(5 + 260);
  });

  it("a state you govern can be taken off the GE schedule", () => {
    const g = newGame("PH", 6);
    const r = setSyncWithGE(g, "PRK", false);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ge = callGeneralElection(r.state);
    expect(ge.ok && ge.state.assemblies.PRK.status).toBe("sitting");
  });

  it("dissolves itself at the end of its term if nobody calls the election", () => {
    let g = newGame("PN", 4);
    const deadline = g.parliament.deadlineWeek;
    g = weeks(g, deadline + 6);
    expect(g.parliament.lastPollWeek).not.toBeNull();
    expect(g.parliament.lastPollWeek!).toBeLessThanOrEqual(deadline + 5);
  });

  it("counts down to the next polling day", () => {
    const g = newGame("PH", 1);
    expect(weeksToElection(g)).toBe(g.parliament.deadlineWeek + 5);
    const r = callGeneralElection(g);
    expect(r.ok && weeksToElection(r.state)).toBe(5);
  });

  it("Skip 1 Month still equals four weeks through state and general elections", () => {
    let a = newGame("PH", 31);
    let b = a;
    for (let m = 0; m < 17; m++) a = advanceMonth(a);
    for (let w = 0; w < 68; w++) b = advanceWeek(b);
    expect(strip(a)).toEqual(strip(b));
  });
});

describe("AI prime minister", () => {
  it("never calls a second election straight after the first", () => {
    let g = newGame("PN", 12);
    const polls: number[] = [];
    for (let w = 0; w < 120; w++) {
      g = advanceWeek(g);
      if (g.parliament.lastPollWeek !== null && polls.at(-1) !== g.parliament.lastPollWeek) polls.push(g.parliament.lastPollWeek);
    }
    expect(polls).toHaveLength(1);
  });
});
