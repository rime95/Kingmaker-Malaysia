// Balance simulator: a greedy bot plays a coalition for three general elections and reports its seats.
// Run with: SIM=1 npx vitest run src/game/sim.test.ts   (skipped in the normal test run)

import { writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import { applyAction, backForPm, deepMove, goToAgong, makeOffer, makePact, type OfferKind } from "./actions";
import { deciding } from "./systems/formation";
import { RECRUIT, compromiseOdds, recruitBlocked, recruitTargets, recruitWillingness } from "./systems/growth";
import { AFFINITY } from "./systems/formation";
import { advanceTurn } from "./month";
import { newGame, projectAllFor, type GameState } from "./state";
import { openIssues } from "./systems/issues";
import { pactBlocked, pactGains } from "./systems/pacts";
import { testGeneralElection } from "./testTools";
import { naturalSupport } from "./voter";
import { COALITIONS, SEATS, contestingIn, type CoalitionId } from "./world";

const tryAct = (s: GameState, id: string, seat?: number) => {
  const r = applyAction(s, id, seat === undefined ? { kind: "none" } : { kind: "seat", seat });
  return r.ok ? r.state : s;
};

/** One turn of a sensible player: money if short, pacts, a few new branches, then ground work where seats are winnable. */
export function botTurn(s: GameState): GameState {
  if (s.night || s.formation) return s;
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

/** Coalition talks: as kingmaker, bargain for the premiership when the odds are decent, else back the friendlier side. */
function botTalks(s: GameState): GameState {
  const f = s.formation;
  if (!f) return s;
  if (f.role === "kingmaker" && !f.committed[s.player]) {
    const [x, y] = f.candidates;
    const ox = compromiseOdds(s, f.seats, f.committed, x);
    const oy = compromiseOdds(s, f.seats, f.committed, y);
    const best = ox >= oy ? x : y;
    const r = Math.max(ox, oy) >= 0.3 ? backForPm(s, best, "pm") : backForPm(s, (AFFINITY[s.player][x] ?? 0) >= (AFFINITY[s.player][y] ?? 0) ? x : y, true);
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
    s = botTalks({ ...s, night: null });
    row[`gov${ge}`] = s.parliament.pm === c ? "PM" : s.government.includes(c) ? "gov" : "opp";
    s = advanceTurn(s);
  }
  return row;
}

const TERMS = Number(process.env.SIM_TERMS ?? 3);

describe.skipIf(!process.env.SIM)("balance simulator", () => {
  it("plays three elections for each coalition", { timeout: 600_000 }, () => {
    const rows = (["MUDA", "WARISAN", "PN", "PH"] as CoalitionId[]).map((c) => playTerms(c, 7));
    writeFileSync(process.env.SIM_OUT ?? "sim-results.json", JSON.stringify(rows, null, 1));
  });
});
