import { expect, it } from "vitest";
import { newGame, type GameState } from "./state";
import { advanceWeek } from "./week";
import { finishTalks } from "./systems/stategov";
import { homeOf } from "./systems/people";
import { ROSTER_HOME } from "./data/people";
import { SEATS, regionOf, type CoalitionId } from "./world";

function audit(g: GameState) {
  const by = new Map(g.people.map((p) => [p.id, p]));
  const bad: string[] = [];
  for (const [party, posts] of Object.entries(g.posts)) for (const [k, id] of Object.entries(posts)) if (k.startsWith("chief:")) { const p = by.get(id!)!; if (homeOf(p) !== k.slice(6)) bad.push(`chief ${party} ${k.slice(6)}: ${p.name} from ${homeOf(p)}`); }
  for (const p of g.people) {
    if (p.seat !== null && homeOf(p) !== regionOf(SEATS[p.seat].state) && p.id !== g.youId) bad.push(`MP ${p.party} ${SEATS[p.seat].name} (${SEATS[p.seat].state}): ${p.name} from ${homeOf(p)}${p.real ? " (real)" : ""}`);
    if (ROSTER_HOME[p.name] && homeOf(p) !== ROSTER_HOME[p.name] && p.seat === null) bad.push(`roster ${p.name}: ${homeOf(p)} not ${ROSTER_HOME[p.name]}`);
    if (!p.home) bad.push(`no home: ${p.name}`);
  }
  return bad;
}

// Every state chief is from their state, every MP from their seat's state (you excepted), every real figure where they
// really come from, at the start and through a year of play with a general election in it.
it("everyone is from where they should be", () => {
  const out: Record<string, string[]> = {};
  for (const c of ["PH", "MUDA"] as CoalitionId[]) {
    let g = newGame(c, 7, { scenario: "snap" });
    out[`${c} start`] = audit(g);
    for (let w = 0; w < 40; w++) {
      g = advanceWeek(g);
      if (g.stateTalks) g = finishTalks(g);
      g = { ...g, stateTerms: [], stateNight: null, newTerm: null };
    }
    out[`${c} after`] = audit(g).slice(0, 8);
  }
  expect(out).toEqual({ "PH start": [], "PH after": [], "MUDA start": [], "MUDA after": [] });
}, 120_000);
