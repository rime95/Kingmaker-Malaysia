// Seat pacts: two coalitions agree not to split the vote. In every seat where both stand, the weaker one stands aside
// for the stronger, and most of its voters follow the deal. This is how Malaysian oppositions win: one-on-one fights.
// A pact runs until the next general election is over. AI coalitions sign when it wins them seats.

import { hash01 } from "../rng";
import { isGovernment, projectAllFor, type GameState } from "../state";
import type { StandAside } from "../voter";
import { SEATS, contestingIn, cshort, type CoalitionId } from "../world";
import { isPresident } from "./career";
import { AFFINITY } from "./formation";

export interface Pact {
  with: CoalitionId;
  since: number;
  /** Seat → the coalition that stands aside there. */
  seats: Record<number, CoalitionId>;
}

export const PACT = {
  ap: 2,
  cost: 300_000,
  /** Share of a withdrawn vote that follows the pact: coalitions on the same side, and across the aisle. */
  transferSameSide: 0.65,
  transferAcross: 0.35,
  /** AI coalitions on the other side of the government sign less often. */
  acrossChance: 0.35,
  /** Weeks before you can ask the same coalition again after a no. */
  cooldown: 8,
  /** The junior partner gets to stand in this share of the shared seats (where the senior partner can't win alone). */
  quota: 0.15,
  quotaMax: 4,
  /** A friendly senior partner will give up this many of its own seats for an unsplit vote. */
  friendTolerance: 2,
  transferBase: 0.45,
  transferAffinity: 0.35,
};

const sameSide = (s: GameState, c: CoalitionId) => isGovernment(s, c) === isGovernment(s);

/** In each seat you both contest, the weaker of you (by today's projection) stands aside. */
export function pactSeats(s: GameState, c: CoalitionId): Record<number, CoalitionId> {
  const proj = projectAllFor({
    ...s,
    pacts: s.pacts.filter((p) => p.with !== c),
  });
  const out: Record<number, CoalitionId> = {};
  for (const seat of SEATS) {
    const list = contestingIn(seat, s.entries);
    if (!list.includes(c) || !list.includes(s.player)) continue;
    const sh = proj[seat.index].shares;
    out[seat.index] = (sh[c] ?? 0) >= (sh[s.player] ?? 0) ? s.player : c;
  }
  // The junior partner's share of the deal: seats the senior partner can't win alone but the two could win together.
  const aside = Object.keys(out).map(Number).filter((i) => out[i] === s.player);
  const quota = aside.length >= 3 ? Math.min(PACT.quotaMax, Math.ceil(aside.length * PACT.quota)) : 0;
  const given = Object.values(out).filter((x) => x === c).length;
  if (given < quota) {
    // The senior partner keeps its fortresses (its safest third) and lends the junior partner the next-best seats.
    const ranked = aside.sort((a, b) => (proj[b].shares[c] ?? 0) - (proj[a].shares[c] ?? 0));
    const picks = ranked.slice(Math.floor(ranked.length / 3)).slice(0, quota - given);
    for (const i of picks) out[i] = c;
  }
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
  const pact: Pact = { with: c, since: s.week, seats: g.seats };
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
export function asideFor(s: Pick<GameState, "pacts" | "player" | "government">): Record<number, StandAside[]> {
  const out: Record<number, StandAside[]> = {};
  for (const p of s.pacts) {
    for (const [k, out_] of Object.entries(p.seats)) {
      const to = out_ === s.player ? p.with : s.player;
      // How much of a withdrawn vote follows the deal depends on how much its voters like the other side.
      const transfer = Math.max(PACT.transferAcross, Math.min(0.75, PACT.transferBase + (AFFINITY[out_]?.[to] ?? 0) * PACT.transferAffinity));
      (out[Number(k)] ??= []).push({ out: out_, to, transfer });
    }
  }
  return out;
}

/** Whether a coalition stands aside in a seat under a pact. */
export const standsAside = (s: Pick<GameState, "pacts">, seat: number, c: CoalitionId) => s.pacts.some((p) => p.seats[seat] === c);
