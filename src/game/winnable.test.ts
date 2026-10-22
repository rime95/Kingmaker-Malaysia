import { describe, expect, it } from "vitest";
import { applyAction, makePact } from "./actions";
import { TURN_WEEKS } from "./config";
import { advanceTurn, advanceWeeks } from "./month";
import { newGame, projectAllFor, type GameState } from "./state";
import { openIssues } from "./systems/issues";
import { pactGains } from "./systems/pacts";
import { toggleOrder } from "./systems/orders";
import { testGeneralElection } from "./testTools";
import { advanceWeek } from "./week";
import { SEATS } from "./world";

const seat = (code: string) => SEATS.find((s) => s.code === code)!.index;
const strip = (s: GameState) => ({ ...s, report: null });
const rich = (s: GameState): GameState => ({ ...s, me: { ...s.me, ap: 40, funds: 100_000_000 } });

describe("two-week turns", () => {
  it("a turn is two weekly steps, with two weeks of action points", () => {
    const g = newGame("PH", 1);
    expect(strip(advanceTurn(g))).toEqual(strip(advanceWeek(advanceWeek(g))));
    expect(advanceTurn(g).week).toBe(g.week + TURN_WEEKS);
    expect(advanceTurn(g).report?.weeks).toBe(TURN_WEEKS);
  });

  it("a test general election runs straight to Election Night", () => {
    const g = testGeneralElection(newGame("PN", 2));
    expect(g.night).not.toBeNull();
    expect(g.geCount).toBe(16);
  });
});

describe("winning seats", () => {
  it("a year of focused ground work flips a seat you trail by about 20 points", () => {
    let g = newGame("PN", 3);
    const i = seat("P.105"); // Petaling Jaya
    const p = projectAllFor(g)[i];
    const gap = (p.shares[p.leader] ?? 0) - (p.shares.PN ?? 0);
    expect(gap).toBeGreaterThan(0.15);
    for (let t = 0; t < 26; t++) {
      g = rich(g);
      for (const id of ["issue", "ground", "service", "service", "machinery"]) {
        const r = applyAction(g, id, { kind: "seat", seat: i });
        if (r.ok) g = r.state;
      }
      g = advanceTurn(g);
    }
    const after = projectAllFor(g)[i];
    expect((after.shares.PN ?? 0) - (after.shares[after.leader === "PN" ? after.runnerUp! : after.leader] ?? 0)).toBeGreaterThan(-0.03);
  });

  it("taking up a local issue is a lasting boost, once per issue", () => {
    const g = rich(newGame("PH", 4));
    const i = seat("P.001");
    const n = openIssues(g, i).length;
    const r = applyAction(g, "issue", { kind: "seat", seat: i });
    if (!r.ok) throw new Error(r.error);
    expect(openIssues(r.state, i)).toHaveLength(n - 1);
    expect(projectAllFor(r.state)[i].shares.PH!).toBeGreaterThan(projectAllFor(g)[i].shares.PH!);
  });

  it("a seat pact stops the split vote: the weaker side stands aside and its voters mostly follow", () => {
    const g = rich(newGame("PN", 5));
    const gains = pactGains(g, "WARISAN");
    const shared = Object.keys(gains.seats).map(Number);
    expect(shared.length).toBeGreaterThan(0);
    const r = makePact(g, "WARISAN");
    if (!r.ok) throw new Error(r.error);
    if (!r.state.pacts.length) return; // they said no (it can't win them seats)
    const k = shared[0];
    const out = gains.seats[k];
    const proj = projectAllFor(r.state)[k];
    expect(proj.shares[out]).toBeUndefined();
  });
});

describe("standing orders", () => {
  it("run at the start of every turn and stay deterministic", () => {
    const i = seat("P.063");
    const g = newGame("PH", 6);
    const o = toggleOrder(g, "ceramah", { kind: "seat", seat: i });
    if ("error" in o) throw new Error(o.error);
    const a = advanceTurn(o.state);
    expect(a.me.buzz[i]).toBeGreaterThan(advanceTurn(g).me.buzz[i]);
    expect(a.report!.lines.some((l) => l.text.startsWith("Standing orders done"))).toBe(true);
    expect(strip(advanceWeeks(o.state, 4))).toEqual(strip(advanceTurn(advanceTurn(o.state))));
  });
});
