// Seat pacts: two separate coalitions agree not to split the vote. Pacts decide which coalition stands aside, never which
// party in your own coalition stands (that is yours to set: partners.ts). In the seats both contest, each side keeps what
// it holds and the open seats are shared fairly by vote (see seattalks.ts, where you can then claim seats or stand aside); most of the
// withdrawn side's voters follow the deal. This is how Malaysian oppositions win: one-on-one fights.
// A pact runs until the next general election is over. AI coalitions sign when it wins them seats.

import { hash01 } from "../rng";
import { isGovernment, projectAllFor, type GameState } from "../state";
import type { StandAside } from "../voter";
import { SEATS, cshort, type CoalitionId } from "../world";
import { isPresident } from "./career";
import { AFFINITY } from "./formation";
import { TALKS, fairSplit } from "./seattalks";

export interface Pact {
  with: CoalitionId;
  since: number;
  /** Seat → the coalition that stands aside there. */
  seats: Record<number, CoalitionId>;
  /** Goodwill in seat talks (0–100). */
  goodwill?: number;
  /** Weeks of joint campaigning you have done in their seats (raises how many of your voters follow the deal). */
  joint?: number;
}

export const PACT = {
  ap: 2,
  cost: 300_000,
  /** At least this share of a withdrawn vote follows the pact. */
  transferAcross: 0.35,
  /** AI coalitions on the other side of the government sign less often. */
  acrossChance: 0.35,
  /** Weeks before you can ask the same coalition again after a no. */
  cooldown: 8,
  /** A friendly senior partner will give up this many of its own seats for an unsplit vote. */
  friendTolerance: 2,
  transferBase: 0.45,
  transferAffinity: 0.35,
  /** Each joint ceramah in their seats moves more of your voters behind their candidate, up to this much. */
  jointPer: 0.01,
  jointMax: 0.1,
};

const sameSide = (s: GameState, c: CoalitionId) => isGovernment(s, c) === isGovernment(s);

/** The fair starting split of the seats you both contest (who stands aside where). */
export function pactSeats(s: GameState, c: CoalitionId): Record<number, CoalitionId> {
  // Seats where you already stand aside for another partner are not yours to trade.
  const proj = projectAllFor({
    ...s,
    pacts: s.pacts.filter((p) => p.with !== c),
  });
  const other = s.pacts.filter((p) => p.with !== c);
  const entries = { ...s.entries };
  const out = fairSplit({ ...s, entries }, c, (i) => proj[i].shares);
  for (const k of Object.keys(out)) if (other.some((p) => p.seats[Number(k)] === s.player)) delete out[Number(k)];
  // You never stand aside in your own seat.
  if (out[s.career.homeSeat] === s.player) out[s.career.homeSeat] = c;
  return out;
}

/** Projected seats for you and for them, with the pact and without. */
export function pactGains(s: GameState, c: CoalitionId): { you: number; them: number; seats: Record<number, CoalitionId> } {
  const seats = pactSeats(s, c);
  const without = projectAllFor({
    ...s,
    pacts: s.pacts.filter((p) => p.with !== c),
  });
  const withIt = projectAllFor({
    ...s,
    pacts: [...s.pacts.filter((p) => p.with !== c), { with: c, since: s.week, seats }],
  });
  const count = (proj: typeof without, k: CoalitionId) => proj.filter((p) => p.leader === k).length;
  return {
    you: count(withIt, s.player) - count(without, s.player),
    them: count(withIt, c) - count(without, c),
    seats,
  };
}

export function pactBlocked(s: GameState, c: CoalitionId): string | null {
  if (!isPresident(s.career)) return "Only the party president makes seat deals.";
  if (c === s.player || c === "OTHERS") return "Pick another coalition.";
  if (s.pacts.some((p) => p.with === c)) return `You already have a pact with ${cshort(c)}.`;
  if (s.parliament.status === "campaign" && s.nominations && !s.nominations.open) return "Too late: nominations have closed.";
  if (s.me.ap < PACT.ap) return `Needs ${PACT.ap} AP.`;
  if (s.me.funds < PACT.cost) return "Not enough money for the talks.";
  if ((s.cardLast[`pact:${c}`] ?? -99) > s.week - PACT.cooldown) return `${cshort(c)} said no recently. Try again in a few weeks.`;
  if (!Object.keys(pactSeats(s, c)).length) return `You and ${cshort(c)} don't stand in the same seats.`;
  return null;
}

/** Ask a coalition for a seat pact. They sign if it wins them seats (and, across the aisle, if they're willing). */
export function proposePact(s: GameState, c: CoalitionId): { state: GameState; message: string } | { error: string } {
  const why = pactBlocked(s, c);
  if (why) return { error: why };
  const g = pactGains(s, c);
  const paid: GameState = {
    ...s,
    me: { ...s.me, ap: s.me.ap - PACT.ap, funds: s.me.funds - PACT.cost },
    cardLast: { ...s.cardLast, [`pact:${c}`]: s.week },
  };
  const willing = sameSide(s, c) || hash01("pact", s.seed, s.week, c) < PACT.acrossChance;
  const aside = Object.values(g.seats).filter((x) => x === s.player).length;
  // Seats an ally wins still count for half to them (they're in the same camp).
  const value = g.them + Math.max(0, g.you) * 0.5;
  const friendly = (AFFINITY[c]?.[s.player] ?? 0) >= 0.3;
  if (value < (friendly ? -PACT.friendTolerance : 0) || !willing) {
    const why2 = !willing ? "they won't be seen dealing with your side" : g.them < 0 ? `it would cost them ${-g.them} seats` : "it helps you, not them";
    return {
      state: paid,
      message: `${cshort(c)} turns the pact down: ${why2}.`,
    };
  }
  const pact: Pact = { with: c, since: s.week, seats: g.seats, goodwill: TALKS.goodwill, joint: 0 };
  return {
    state: { ...paid, pacts: [...s.pacts, pact] },
    message: `Pact signed with ${cshort(c)}: you stand aside in ${aside} seats, they stand aside in ${Object.keys(g.seats).length - aside}. Projected: you ${g.you >= 0 ? "+" : "−"}${Math.abs(g.you)} seats, them ${g.them >= 0 ? "+" : "−"}${Math.abs(g.them)}.`,
  };
}

export function endPact(s: GameState, c: CoalitionId): { state: GameState; message: string } {
  return {
    state: {
      ...s,
      pacts: s.pacts.filter((p) => p.with !== c),
      me: { ...s.me, trust: Math.max(0, s.me.trust - 5) },
    },
    message: `You walk away from the pact with ${cshort(c)}.`,
  };
}

/** Who stands aside where, for the voter model. */
export function asideFor(s: Pick<GameState, "pacts" | "player" | "government" | "rivalPacts">): Record<number, StandAside[]> {
  const out: Record<number, StandAside[]> = {};
  for (const p of s.rivalPacts ?? []) {
    for (const [k, out_] of Object.entries(p.seats)) {
      const to = out_ === p.a ? p.b : p.a;
      const transfer = Math.max(PACT.transferAcross, Math.min(0.75, PACT.transferBase + (AFFINITY[out_]?.[to] ?? 0) * PACT.transferAffinity));
      (out[Number(k)] ??= []).push({ out: out_, to, transfer });
    }
  }
  for (const p of s.pacts) {
    for (const [k, out_] of Object.entries(p.seats)) {
      const to = out_ === s.player ? p.with : s.player;
      // How much of a withdrawn vote follows the deal depends on how much its voters like the other side.
      const joint = out_ === s.player ? Math.min(PACT.jointMax, (p.joint ?? 0) * PACT.jointPer) : 0;
      const transfer = Math.max(PACT.transferAcross, Math.min(0.75 + joint, PACT.transferBase + (AFFINITY[out_]?.[to] ?? 0) * PACT.transferAffinity + joint));
      (out[Number(k)] ??= []).push({ out: out_, to, transfer });
    }
  }
  return out;
}

export const ALLIES = {
  /** Goodwill needed before a partner campaigns for you, seats a week, buzz per visit (×goodwill/100), and its cost to them. */
  goodwill: 40,
  seats: 2,
  buzz: 9,
  cost: 40_000,
};

/**
 * Weekly, during the campaign: pact partners return the favour. In the agreed seats where they stand aside for you,
 * their machinery campaigns for your candidate in your closest races (more of it the more goodwill there is).
 */
export function alliesWeek(s: GameState, projections: { leader: CoalitionId; margin: number }[]): { state: GameState; lines: { text: string; tone: "good" }[] } {
  const lines: { text: string; tone: "good" }[] = [];
  if (s.parliament.status !== "campaign" || !s.pacts.length) return { state: s, lines };
  const buzz = [...s.me.buzz];
  let rivals = s.rivals;
  for (const p of s.pacts) {
    const gw = p.goodwill ?? TALKS.goodwill;
    const r = rivals[p.with];
    if (gw < ALLIES.goodwill || !r || r.funds < ALLIES.cost) continue;
    // Your closest races among the seats they gave you.
    const seats = Object.entries(p.seats)
      .filter(([, out]) => out === p.with)
      .map(([k]) => Number(k))
      .map((i) => ({ i, m: projections[i].leader === s.player ? projections[i].margin : -projections[i].margin }))
      .filter((x) => x.m < 0.12 && x.m > -0.15)
      .sort((a, b) => Math.abs(a.m) - Math.abs(b.m))
      .slice(0, ALLIES.seats);
    if (!seats.length) continue;
    for (const { i } of seats) buzz[i] = Math.min(100, buzz[i] + ALLIES.buzz * (gw / 100) * (1 - buzz[i] / 120));
    rivals = { ...rivals, [p.with]: { ...r, funds: r.funds - ALLIES.cost * seats.length } };
    lines.push({ text: `${cshort(p.with)} machinery campaigns for your candidate in ${seats.map((x) => SEATS[x.i].name).join(" and ")}.`, tone: "good" });
  }
  return { state: { ...s, rivals, me: { ...s.me, buzz } }, lines };
}

/** Whether a coalition stands aside in a seat under a pact. */
export const standsAside = (s: Pick<GameState, "pacts">, seat: number, c: CoalitionId) => s.pacts.some((p) => p.seats[seat] === c);
