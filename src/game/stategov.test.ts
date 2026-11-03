import { describe, expect, it } from "vitest";
import { newGame, type GameState } from "./state";
import { advanceWeek } from "./week";
import { advanceTurn } from "./month";
import { DUNS_BY_STATE } from "./systems/dun";
import { stateRulers } from "./systems/assemblies";
import { afterStatePolls, confirmStateTerm, finishTalks, inviteToState, mbTitle, resolveStatePending, syncStateGov } from "./systems/stategov";
import { cabinetPool } from "./systems/newterm";
import type { CoalitionId } from "./world";

/** A state assembly with the given seats per coalition. */
function withSeats(g: GameState, id: string, seats: Partial<Record<CoalitionId, number>>): GameState {
  const ids = DUNS_BY_STATE[id];
  const dunHolders = [...g.dunHolders];
  let k = 0;
  for (const [c, n] of Object.entries(seats) as [CoalitionId, number][]) for (let j = 0; j < n; j++) dunHolders[ids[k++]] = c;
  return { ...g, dunHolders };
}

describe("state governments", () => {
  it("every state has an MB from its ruling coalition", () => {
    const g = newGame("PH", 2);
    for (const [id, gov] of Object.entries(g.stateGov)) {
      const mb = g.people.find((p) => p.id === gov.mb);
      expect(mb, id).toBeDefined();
      expect(g.coalitions[gov.ruler].members).toContain(mb!.party);
      expect(gov.exco.length).toBeGreaterThan(0);
    }
  });

  it("titles follow the constitution", () => {
    expect(mbTitle("SGR")).toBe("Menteri Besar");
    expect(mbTitle("PNG")).toBe("Ketua Menteri");
    expect(mbTitle("SBH")).toBe("Ketua Menteri");
    expect(mbTitle("SWK")).toBe("Premier");
  });

  it("an MB can't sit in the federal cabinet", () => {
    const g = newGame("PH", 2);
    const mbs = new Set(Object.values(g.stateGov).map((x) => x.mb));
    expect(cabinetPool(g).some((p) => mbs.has(p.id))).toBe(false);
  });

  it("winning a state outright opens your MB and exco screen, which is sworn in if left open", () => {
    const g0 = newGame("PH", 2);
    const total = DUNS_BY_STATE.KDH.length;
    const g = withSeats(g0, "KDH", { PH: total - 5, PN: 5 });
    const r = afterStatePolls(g, ["KDH"], g0.dunHolders);
    expect(r.state.stateGov.KDH.ruler).toBe("PH");
    expect(r.state.stateTerms.map((t) => t.state)).toContain("KDH");
    expect(r.state.stateNight?.states).toEqual(["KDH"]);
    const done = resolveStatePending(r.state).state;
    expect(done.stateTerms).toHaveLength(0);
    expect(done.stateGov.KDH.mb).not.toBeNull();
  });

  it("a hung assembly opens talks; the result stands until the next election", () => {
    const g0 = newGame("PH", 2);
    const total = DUNS_BY_STATE.SGR.length;
    const half = Math.floor(total / 2);
    // Neither PH nor PN has a majority; BN holds the balance.
    const g = withSeats(g0, "SGR", { PH: half - 4, PN: half - 4, BN: total - 2 * (half - 4) });
    const r = afterStatePolls(g, ["SGR"], g0.dunHolders);
    expect(r.state.stateTalks?.state).toBe("SGR");
    // BN joins (generous offer and a good affinity with PH); with BN, PH has a majority.
    let s = r.state;
    for (let k = 0; k < 3 && s.stateTalks; k++) {
      const res = inviteToState({ ...s, seed: s.seed + k }, "BN", 3);
      if ("error" in res) break;
      s = res.state;
    }
    if (s.stateTalks) s = finishTalks(s);
    expect(s.stateTalks).toBeNull();
    const ruler = s.stateGov.SGR.ruler;
    expect(s.stateGov.SGR.settled).toBe(true);
    // A change of federal government doesn't overturn a settled state government.
    const flipped = syncStateGov({ ...s, government: ["PN"] });
    expect(flipped.stateGov.SGR.ruler).toBe(ruler);
    expect(stateRulers(flipped.dunHolders, flipped.government, flipped.stateGov).SGR).toBe(ruler);
  });

  it("a turn stops on the week of a state election, so you see the results", () => {
    const g0 = newGame("PH", 2);
    const g = { ...g0, assemblies: { ...g0.assemblies, PNG: { ...g0.assemblies.PNG, status: "campaign" as const, pollWeek: 1 } } };
    const t = advanceTurn(g);
    expect(t.week).toBe(1);
    expect(t.stateNight?.states).toContain("PNG");
  });

  it("swearing in judges partners' share of the exco", () => {
    const g0 = newGame("PH", 2);
    const total = DUNS_BY_STATE.PRK.length;
    const g = withSeats(g0, "PRK", { PH: total - 3, BN: 3 });
    const r = afterStatePolls(g, ["PRK"], g0.dunHolders);
    const c = confirmStateTerm(r.state, "PRK");
    expect(c.lines.some((l) => l.text.includes("sworn in"))).toBe(true);
  });

  it("state governments survive a year of play", () => {
    let g = newGame("PN", 6);
    for (let w = 0; w < 52; w++) {
      g = advanceWeek(g);
      if (g.stateTalks) g = finishTalks(g);
      g = { ...g, stateTerms: [], stateNight: null };
    }
    for (const id of Object.keys(g.stateGov)) expect(g.stateGov[id].mb, id).not.toBeNull();
  }, 60_000);
});
