// Balance simulator: a greedy bot plays a coalition for three general elections and reports its seats.
// Run with: SIM=1 npx vitest run src/game/sim.test.ts   (skipped in the normal test run)

import { writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import { adoptPolicy, applyAction, backForPm, deepMove, goToAgong, makeOffer, makePact, previewPolicy, type OfferKind } from "./actions";
import { POLICIES } from "./systems/policies";
import { DEBATE, ENDORSERS, caseBlocked, debateRival, freshness, type CaseMove, type DebateLine, type Endorser } from "./systems/scorecard";
import { deciding } from "./systems/formation";
import { RECRUIT, recruitBlocked, recruitTargets, recruitWillingness } from "./systems/growth";
import { AFFINITY } from "./systems/formation";
import { advanceTurn } from "./month";
import { newGame, projectAllFor, type GameState } from "./state";
import { openIssues } from "./systems/issues";
import { pactBlocked, pactGains } from "./systems/pacts";
import { testGeneralElection } from "./testTools";
import { naturalSupport } from "./voter";
import { COALITIONS, SEATS, STATES, SUPERMAJORITY, contestingIn, type CoalitionId } from "./world";

const tryAct = (s: GameState, id: string, seat?: number) => {
  const r = applyAction(s, id, seat === undefined ? { kind: "none" } : { kind: "seat", seat });
  return r.ok ? r.state : s;
};

/** One turn of a sensible player: money if short, pacts, a few new branches, then ground work where seats are winnable. */
export function botTurn(s: GameState): GameState {
  if (s.night || s.formation) return s;
  // A manifesto: once a year, take any stance that would win seats.
  if (s.week % 52 === 0)
    for (const p of POLICIES) {
      const best = p.options.map((_, k) => ({ k, gain: k === (s.me.policies[p.id] ?? 0) ? 0 : previewPolicy(s, p.id, k) })).sort((a, b) => b.gain - a.gain)[0];
      if (best.gain >= 1) {
        const r = adoptPolicy(s, p.id, best.k);
        if (r.ok) s = r.state;
      }
    }
  // Make the case: answer attacks, cost the plan, launch policies, show delivery, line up endorsements, debate.
  const caseTry = (m: CaseMove) => {
    if (caseBlocked(s, m)) return;
    const r = deepMove(s, { kind: "case", ...m });
    if (r.ok) s = r.state;
  };
  caseTry({ move: "rebut" });
  caseTry({ move: "whitePaper" });
  if (freshness(s, "launch") > 0.6) caseTry({ move: "launch" });
  if (freshness(s, "showcase") > 0.6) caseTry({ move: "showcase" });
  for (const who of Object.keys(ENDORSERS) as Endorser[]) caseTry({ move: "endorse", who });
  if (s.parliament.status === "campaign") {
    const rival = debateRival(s);
    const gap = (l: DebateLine) => DEBATE[l].pillars.reduce((a, p) => a + s.scorecard.now[s.player][p] - s.scorecard.now[rival][p], 0);
    const line = (Object.keys(DEBATE) as DebateLine[]).sort((a, b) => gap(b) - gap(a))[0];
    caseTry({ move: "debate", line });
  }
  // Grow the coalition first: invite anyone who'd say yes.
  for (const party of recruitTargets(s)) {
    if (recruitBlocked(s, party) || recruitWillingness(s, party) < RECRUIT.threshold) continue;
    const r = deepMove(s, { kind: "recruit", party });
    if (r.ok) s = r.state;
  }
  if (s.me.funds < 1_500_000) s = tryAct(s, "dinner");
  if (s.me.funds < 800_000 && s.me.risk < 45) s = tryAct(s, "tycoon");
  for (const c of COALITIONS) {
    if (c === s.player || c === "OTHERS" || pactBlocked(s, c)) continue;
    const g = pactGains(s, c);
    if (g.you >= 1) {
      const r = makePact(s, c);
      if (r.ok) s = r.state;
    }
  }
  // Go national while you're small: launch in every state you can afford.
  if (seatsOf(s, s.player) < 100)
    for (const st of STATES) {
      if (s.me.ap < 2 || s.me.funds < 3_000_000) break;
      const r = applyAction(s, "launchState", { kind: "state", state: st.id });
      if (r.ok) s = r.state;
    }
  // Expand where your voters live.
  const open = SEATS.filter((x) => !contestingIn(x, s.entries).includes(s.player) && naturalSupport(x.index, s.player) >= 0.1).slice(0, 2);
  for (const x of open) if (s.me.funds > 2_000_000) s = tryAct(s, "branch", x.index);
  const proj = projectAllFor(s);
  const targets = SEATS.filter((x) => contestingIn(x, s.entries).includes(s.player) && proj[x.index].shares[s.player] !== undefined)
    .map((x) => {
      const p = proj[x.index];
      const mine = p.shares[s.player] ?? 0;
      const best = Math.max(
        0,
        ...Object.entries(p.shares)
          .filter(([c]) => c !== s.player)
          .map(([, v]) => v ?? 0),
      );
      return { i: x.index, gap: best - mine };
    })
    .sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap))
    .filter((t, k) => (t.gap > -0.06 && t.gap < 0.3) || k < 6);
  for (const t of targets) {
    if (s.me.ap <= 0 || s.me.funds < 400_000) break;
    if (openIssues(s, t.i).length) s = tryAct(s, "issue", t.i);
    if (s.me.ap >= 4) s = tryAct(s, "ground", t.i);
    if (s.me.ap >= 1) s = tryAct(s, "service", t.i);
  }
  if (s.me.ap >= 2 && s.me.funds > 3_000_000) s = tryAct(s, "media");
  return s;
}

const seatsOf = (s: GameState, c: CoalitionId) => s.holders.filter((h) => h === c).length;

/** Coalition talks: as kingmaker, back the friendlier side and ask for DPM; as a candidate, make offers. */
function botTalks(s: GameState): GameState {
  const f = s.formation;
  if (!f) return s;
  if (f.role === "kingmaker" && !f.committed[s.player]) {
    const [x, y] = f.candidates;
    const r = backForPm(s, (AFFINITY[s.player][x] ?? 0) >= (AFFINITY[s.player][y] ?? 0) ? x : y, true);
    if (r.ok) s = r.state;
  }
  if (f.role === "leader") {
    // As a candidate: sweeten the deal for the biggest undecided coalitions.
    const undecided = deciding(f, s.player).sort((a, b) => f.seats[b] - f.seats[a]);
    undecided.forEach((c, k) => {
      for (const kind of (k === 0 ? ["dpm", "ministries", "ma63"] : ["ministries", "ma63"]) as OfferKind[]) {
        const r = makeOffer(s, c, kind);
        if (r.ok) s = r.state;
      }
    });
  }
  const g = goToAgong(s);
  return g.ok ? g.state : s;
}

function playTerms(c: CoalitionId, seed: number) {
  let s = newGame(c, seed);
  const row: Record<string, number | string> = {
    coalition: c,
    start: seatsOf(s, c),
  };
  for (let ge = 1; ge <= TERMS; ge++) {
    // First term runs to the real deadline; later ones to a mid-term election two years in.
    const turns = ge === 1 ? 32 : 52;
    for (let t = 0; t < turns && !s.night; t++) s = advanceTurn(botTurn(s));
    s = testGeneralElection(s);
    row[`GE${15 + ge}`] = seatsOf(s, c);
    if (row.twoThirds === undefined && seatsOf(s, c) >= SUPERMAJORITY) row.twoThirds = `GE${15 + ge}`;
    s = botTalks({ ...s, night: null });
    row[`gov${ge}`] = s.parliament.pm === c ? "PM" : s.government.includes(c) ? "gov" : "opp";
    s = advanceTurn(s);
  }
  return row;
}

const TERMS = Number(process.env.SIM_TERMS ?? 3);

describe.skipIf(!process.env.SIM)("balance simulator", () => {
  it("plays three elections for each coalition", { timeout: 600_000 }, () => {
    const rows = (["MUDA", "BERSAMA", "WARISAN", "PN", "PH"] as CoalitionId[]).map((c) => playTerms(c, 7));
    writeFileSync(process.env.SIM_OUT ?? "sim-results.json", JSON.stringify(rows, null, 1));
  });
});
