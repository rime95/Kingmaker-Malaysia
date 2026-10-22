// Balance simulator: a greedy bot plays a coalition for three general elections and reports its seats.
// Run with: SIM=1 npx vitest run src/game/sim.test.ts   (skipped in the normal test run)

import { writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import { applyAction, makePact } from "./actions";
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
function botTurn(s: GameState): GameState {
  if (s.night || s.formation) return s;
  if (s.me.funds < 1_500_000) s = tryAct(s, "dinner");
  if (s.me.funds < 800_000 && s.me.risk < 45) s = tryAct(s, "tycoon");
  for (const c of COALITIONS) {
    if (c === s.player || c === "OTHERS" || pactBlocked(s, c)) continue;
    const g = pactGains(s, c);
    if (g.you >= 1 && g.them >= 0) {
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
    .filter((t) => t.gap > -0.06 && t.gap < 0.3)
    .sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap));
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

function playTerms(c: CoalitionId, seed: number) {
  let s = newGame(c, seed);
  const row: Record<string, number | string> = {
    coalition: c,
    start: seatsOf(s, c),
  };
  for (let ge = 1; ge <= 3; ge++) {
    // First term runs to the real deadline; later ones to a mid-term election two years in.
    const turns = ge === 1 ? 32 : 52;
    for (let t = 0; t < turns && !s.night; t++) s = advanceTurn(botTurn(s));
    s = testGeneralElection(s);
    row[`GE${15 + ge}`] = seatsOf(s, c);
    row[`gov${ge}`] = s.formation ? "talks" : s.government.includes(c) ? "yes" : "no";
    s = advanceTurn({ ...s, night: null });
  }
  return row;
}

describe.skipIf(!process.env.SIM)("balance simulator", () => {
  it("plays three elections for each coalition", { timeout: 600_000 }, () => {
    const rows = (["MUDA", "WARISAN", "PN", "PH"] as CoalitionId[]).map((c) => playTerms(c, 7));
    writeFileSync(process.env.SIM_OUT ?? "sim-results.json", JSON.stringify(rows, null, 1));
  });
});
