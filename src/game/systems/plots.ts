// Plots: the biggest rival camp in your party works against you, on a meter you can watch and break. The worst it can do
// is capped: it takes one of your council seats, then has to start again. Rival parties have plots too, and theirs spill
// into feuds that weaken them and leave their people open to you.
// All randomness is hash01. All numbers TEMPORARY.

import { hash01 } from "../rng";
import type { GameState, ReportLine } from "../state";
import { COALITIONS, cshort } from "../world";
import { campsOf, patrons } from "./camps";
import { councilOf } from "./council";
import { leadParty } from "./coalitions";
import { remember } from "./people";
import { yourParty } from "./nominations";

export const PLOT = {
  /** A month: rise from the rival camp's share of the party, and from unity below `unity`. */
  perShare: 20,
  unity: 60,
  perUnity: 0.3,
  /** It falls this much a month when your camp is the bigger one. */
  calm: 6,
  warn: 60,
  /** Where it restarts after it lands. */
  after: 30,
  /** Breaking it. */
  breakAp: 1,
  breakCapital: 5,
  breakBy: 40,
  /** Rival parties: chance of a feud a month, votes it costs them (log-odds), and loyalty to you of the one who falls out. */
  feudChance: 0.08,
  feudSwing: 0.015,
  feudLoyalty: 25,
};

export interface Plot {
  strength: number;
  warned: boolean;
}

export const plotOf = (s: Pick<GameState, "plot">): Plot => s.plot ?? { strength: 0, warned: false };

/** Who is plotting: the patron of the biggest camp that isn't yours. */
export function plotter(s: GameState) {
  const party = yourParty(s);
  const c = campsOf(s, party);
  const top = c.camps.filter((x) => !x.yours).sort((a, b) => b.share - a.share)[0];
  const mine = c.camps.find((x) => x.yours);
  return top ? { patron: patrons(s, party).find((p) => p.id === top.patron) ?? null, share: top.share, mine: mine?.share ?? 0, name: top.name } : null;
}

export function breakBlocked(s: GameState): string | null {
  if (s.career.rung < 6) return "Only the party president can do this.";
  if (plotOf(s).strength <= 0) return "There's nothing to break.";
  if (s.me.ap < PLOT.breakAp) return `Needs ${PLOT.breakAp} AP.`;
  if (s.me.capital < PLOT.breakCapital) return `Needs ${PLOT.breakCapital} capital.`;
  return null;
}

/** Break up the plot: talk to the waverers before it lands. */
export function breakPlot(s: GameState): { state: GameState; message: string } | { error: string } {
  const why = breakBlocked(s);
  if (why) return { error: why };
  const p = plotOf(s);
  return {
    state: { ...s, plot: { strength: Math.max(0, p.strength - PLOT.breakBy), warned: false }, me: { ...s.me, ap: s.me.ap - PLOT.breakAp, capital: s.me.capital - PLOT.breakCapital } },
    message: "You work the phones and peel the waverers away.",
  };
}

/** Monthly: the plot in your party grows or fades and may land; a rival party may fall out with itself. */
export function plotsMonth(s: GameState): { state: GameState; lines: ReportLine[] } {
  const lines: ReportLine[] = [];
  if (s.week % 4 !== 2) return { state: s, lines };
  let state = s;
  if (s.career.rung >= 6) {
    const who = plotter(s);
    const p = plotOf(s);
    if (who) {
      const leading = who.mine >= who.share;
      const rise = leading ? -PLOT.calm : who.share * PLOT.perShare + Math.max(0, PLOT.unity - s.me.unity) * PLOT.perUnity;
      let strength = Math.max(0, p.strength + rise);
      let warned = p.warned;
      if (strength >= PLOT.warn && !warned) {
        warned = true;
        lines.push({ text: `Loyalists warn you: ${who.name} is counting heads against you. Break it up in Leadership before it lands.`, tone: "bad" });
      }
      if (strength >= 100) {
        // The worst it can do: one of your appointees is pushed off the council.
        const seat = councilOf(state, yourParty(s)).appointed.sort((a, b) => a.loyalty - b.loyalty)[0];
        if (seat) {
          state = { ...state, people: state.people.map((x) => (x.id === seat.id ? { ...x, rank: 1, council: undefined, since: s.week } : x)) };
          lines.push({ text: `${who.name} forces ${seat.name} off the council. The plot has spent itself for now.`, tone: "bad" });
        } else lines.push({ text: `${who.name} tries its strength on the council and comes up short.`, tone: "info" });
        strength = PLOT.after;
        warned = false;
      }
      state = { ...state, plot: { strength, warned } };
    }
  }
  // Rival parties' own feuds: they lose votes, and whoever fell out with the leader warms to you.
  for (const c of COALITIONS) {
    if (c === s.player || c === "OTHERS") continue;
    const party = leadParty(state, c);
    if (!party || hash01("feud", s.seed, s.week, c) >= PLOT.feudChance) continue;
    const pool = state.people.filter((p) => p.party === party && !p.retired && !p.chairman && p.rank >= 2 && p.rank < 5);
    if (!pool.length) continue;
    const who = pool[Math.floor(hash01("feudwho", s.seed, s.week, c) * pool.length)];
    const leader = state.people.find((p) => p.party === party && p.rank === 5);
    state = {
      ...state,
      swing: { ...state.swing, [c]: state.swing[c] - PLOT.feudSwing },
      people: state.people.map((p) => (p.id === who.id ? remember(p, PLOT.feudLoyalty, `Fell out with ${leader?.name ?? "my party's leader"}`, s.week) : p)),
    };
    lines.push({ text: `${party} in open dispute: ${who.name} breaks ranks with ${leader?.name ?? "the party leader"}. ${cshort(c)} loses ground, and ${who.name} takes your calls now.`, tone: "good" });
  }
  return { state, lines };
}
