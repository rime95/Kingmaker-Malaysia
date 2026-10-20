// Forming a government after a general election (hung parliaments are the norm since 2018).
// Two prime-minister candidates gather statutory declarations (SDs) from coalitions. Each coalition leans toward a
// candidate by ideology (affinity), old partnerships, momentum (who already has more SDs) and what it has been
// offered. Talks run for up to three rounds; then the Agong appoints whoever can command the House.
// You are either one of the two candidates (you make offers) or the kingmaker (you choose a side and name a price).

import { DIFFICULTY } from "../config";
import type { GameState } from "../state";
import { COALITIONS, cshort, MAJORITY, SUPERMAJORITY, type CoalitionId } from "../world";
import { stateRulers } from "./assemblies";

/** How willing one coalition is to serve under another's prime minister (−1 to 1). Row = joiner, column = leader. */
export const AFFINITY: Record<CoalitionId, Partial<Record<CoalitionId, number>>> = {
  PH: { BN: 0.5, PN: -0.8, GPS: 0.4, GRS: 0.4, WARISAN: 0.4, MUDA: 0.5, OTHERS: 0.2 },
  BN: { PH: 0.45, PN: 0.3, GPS: 0.5, GRS: 0.4, WARISAN: 0.1, MUDA: -0.3, OTHERS: 0.2 },
  PN: { PH: -0.8, BN: 0.35, GPS: 0.2, GRS: 0.1, WARISAN: -0.3, MUDA: -0.6, OTHERS: 0.1 },
  GPS: { PH: 0.35, BN: 0.5, PN: 0.25, GRS: 0.3, WARISAN: 0.1, MUDA: -0.2, OTHERS: 0.1 },
  GRS: { PH: 0.35, BN: 0.4, PN: 0.2, GPS: 0.3, WARISAN: -0.4, MUDA: -0.2, OTHERS: 0.1 },
  WARISAN: { PH: 0.4, BN: 0.1, PN: -0.3, GPS: 0.1, GRS: -0.4, MUDA: 0.3, OTHERS: 0.1 },
  MUDA: { PH: 0.4, BN: -0.4, PN: -0.6, GPS: -0.2, GRS: -0.1, WARISAN: 0.3, OTHERS: 0 },
  OTHERS: { PH: 0.25, BN: 0.25, PN: 0.2, GPS: 0.25, GRS: 0.25, WARISAN: 0.2, MUDA: 0.1 },
};

export const BORNEO: CoalitionId[] = ["GPS", "GRS", "WARISAN"];

export const OFFERS = {
  dpm: { willingness: 0.5, capital: -20 },
  ministries: { willingness: 0.15, unity: -4, max: 2 },
  ma63: { willingness: 0.35 },
  /** Committing needs this much willingness, dropping each round. */
  threshold: [0.55, 0.45, 0.3],
  rounds: 3,
  /** Momentum: share of a majority already gathered, times this. */
  bandwagon: 0.4,
  /** Partners from the outgoing government stay together. */
  oldPartners: 0.15,
  /** Rival candidate's offers per round to the biggest coalition still deciding. */
  aiOffer: 0.2,
};

export interface Offer {
  dpm?: boolean;
  ministries?: number;
  ma63?: boolean;
}

export interface Formation {
  week: number;
  seats: Record<CoalitionId, number>;
  candidates: [CoalitionId, CoalitionId];
  role: "leader" | "kingmaker";
  /** Which candidate each coalition has signed SDs for. */
  committed: Partial<Record<CoalitionId, CoalitionId>>;
  /** Your offers (as a candidate). */
  offers: Partial<Record<CoalitionId, Offer>>;
  /** The rival candidate's sweeteners. */
  rivalOffers: Partial<Record<CoalitionId, number>>;
  round: number;
  /** The government before the election (old partners stick together). */
  oldGovernment: CoalitionId[];
  seatsBefore: number;
  log: string[];
  /** Kingmaker: the price you asked for. */
  askedDpm?: boolean;
  /** Difficulty: extra willingness partners need before backing you. */
  greed?: number;
}

export interface WinTier {
  week: number;
  tier: "none" | "bronze" | "silver" | "gold" | "platinum" | "diamond";
  seats: number;
  govSeats: number;
}

export const TIER_TEXT: Record<WinTier["tier"], { name: string; text: string }> = {
  none: { name: "Defeat", text: "A night to forget. Rebuild for the next one." },
  bronze: { name: "Bronze", text: "You gained seats on the night." },
  silver: { name: "Silver", text: "You hold at least one state government." },
  gold: { name: "Gold", text: "You are part of the new government." },
  platinum: { name: "Platinum", text: "Your leader is Prime Minister." },
  diamond: { name: "Diamond", text: "A two-thirds supermajority: you can amend the Constitution." },
};

const aff = (joiner: CoalitionId, leader: CoalitionId) => (joiner === leader ? 1 : AFFINITY[joiner][leader] ?? 0);

/** The two prime-minister candidates: the biggest coalition, and the biggest one that isn't its natural partner. */
export function pickCandidates(seats: Record<CoalitionId, number>): [CoalitionId, CoalitionId] {
  const ranked = COALITIONS.filter((c) => c !== "OTHERS").sort((a, b) => seats[b] - seats[a]);
  const a = ranked[0];
  const b = ranked.find((c) => c !== a && aff(c, a) < 0.3) ?? ranked[1];
  return [a, b];
}

export function sdCount(f: Formation, leader: CoalitionId): number {
  return (Object.entries(f.committed) as [CoalitionId, CoalitionId][]).filter(([, l]) => l === leader).reduce((s, [c]) => s + f.seats[c], 0);
}

export function willingness(f: Formation, joiner: CoalitionId, leader: CoalitionId, player: CoalitionId): number {
  let w = aff(joiner, leader);
  if (f.oldGovernment.includes(joiner) === f.oldGovernment.includes(leader)) w += OFFERS.oldPartners;
  w += (sdCount(f, leader) / MAJORITY) * OFFERS.bandwagon;
  if (leader === player) {
    const o = f.offers[joiner];
    if (o?.dpm) w += OFFERS.dpm.willingness;
    w += (o?.ministries ?? 0) * OFFERS.ministries.willingness;
    if (o?.ma63) w += OFFERS.ma63.willingness;
    w -= f.greed ?? 0;
  } else w += f.rivalOffers[joiner] ?? 0;
  return w;
}

export function startFormation(s: GameState, seats: Record<CoalitionId, number>, seatsBefore: number): Formation {
  const candidates = pickCandidates(seats);
  const role = candidates.includes(s.player) ? "leader" : "kingmaker";
  const f: Formation = {
    week: s.week,
    seats,
    candidates,
    role,
    committed: { [candidates[0]]: candidates[0], [candidates[1]]: candidates[1] },
    offers: {},
    rivalOffers: {},
    round: 1,
    oldGovernment: s.government,
    seatsBefore,
    greed: DIFFICULTY[s.settings.difficulty].greed,
    log: [`${cshort(candidates[0])} (${seats[candidates[0]]} seats) and ${cshort(candidates[1])} (${seats[candidates[1]]}) are racing to ${MAJORITY}.`],
  };
  // Natural partners sign straight away for the candidate they like most (never on your behalf).
  for (const c of COALITIONS) {
    if (f.committed[c] || c === s.player || !seats[c]) continue;
    const [x, y] = candidates;
    const best = aff(c, x) >= aff(c, y) ? x : y;
    if (aff(c, best) >= 0.45 && f.oldGovernment.includes(c) === f.oldGovernment.includes(best)) {
      f.committed[c] = best;
      f.log.push(`${cshort(c)} (${seats[c]}) signs SDs for ${cshort(best)} at once.`);
    }
  }
  return f;
}

/** Is a coalition still deciding (and can receive offers)? */
export function deciding(f: Formation, player: CoalitionId): CoalitionId[] {
  return COALITIONS.filter((c) => !f.committed[c] && c !== player && f.seats[c] > 0);
}

/** Ends a round: the rival candidate sweetens its offer, then undecided coalitions choose. */
export function endRound(f: Formation, player: CoalitionId): Formation {
  const next: Formation = { ...f, committed: { ...f.committed }, rivalOffers: { ...f.rivalOffers }, log: [...f.log] };
  const rival = f.role === "leader" ? f.candidates.find((c) => c !== player)! : null;
  const undecided = deciding(next, player).sort((a, b) => f.seats[b] - f.seats[a]);
  if (rival && undecided.length) {
    const target = undecided[0];
    next.rivalOffers[target] = (next.rivalOffers[target] ?? 0) + OFFERS.aiOffer * f.round;
    next.log.push(`${cshort(rival)} makes a new offer to ${cshort(target)}.`);
  }
  const last = f.round >= OFFERS.rounds;
  const threshold = OFFERS.threshold[Math.min(f.round, OFFERS.rounds) - 1];
  for (const c of undecided) {
    const [x, y] = f.candidates;
    const wx = willingness(next, c, x, player);
    const wy = willingness(next, c, y, player);
    const best = wx >= wy ? x : y;
    const w = Math.max(wx, wy);
    if (w >= threshold || (last && w > 0)) {
      next.committed[c] = best;
      next.log.push(`${cshort(c)} (${f.seats[c]}) signs SDs for ${cshort(best)}.`);
    } else if (last) next.log.push(`${cshort(c)} stays on the crossbench.`);
  }
  next.round = f.round + 1;
  return next;
}

/** Kingmaker: back a candidate, optionally asking for Deputy Prime Minister. */
export function backCandidate(f: Formation, player: CoalitionId, leader: CoalitionId, askDpm: boolean): Formation {
  const next: Formation = { ...f, committed: { ...f.committed, [player]: leader }, log: [...f.log], askedDpm: askDpm };
  next.log.push(`You sign SDs for ${cshort(leader)}${askDpm ? ", asking for Deputy Prime Minister" : ""}.`);
  return next;
}

export interface FormationOutcome {
  pm: CoalitionId;
  government: CoalitionId[];
  sds: number;
  majority: boolean;
  /** Kingmaker: whether the DPM ask was granted. */
  dpmGranted: boolean;
}

/** The Agong appoints the candidate with the most SDs (a minority government if nobody reaches 112). */
export function agongDecides(f: Formation, player: CoalitionId): FormationOutcome {
  const [x, y] = f.candidates;
  const sx = sdCount(f, x);
  const sy = sdCount(f, y);
  const pm = sx >= sy ? x : y;
  const government = (Object.entries(f.committed) as [CoalitionId, CoalitionId][]).filter(([, l]) => l === pm).map(([c]) => c);
  // A DPM ask is granted when your seats are what takes them past 112.
  const sds = Math.max(sx, sy);
  const dpmGranted = !!f.askedDpm && f.committed[player] === pm && sds >= MAJORITY && sds - f.seats[player] < MAJORITY;
  return { pm, government, sds, majority: sds >= MAJORITY, dpmGranted };
}

/** The win tier for this election, from your seats, states and place in government. */
export function winTier(s: GameState, f: Formation, o: FormationOutcome): WinTier {
  const seats = f.seats[s.player];
  let tier: WinTier["tier"] = "none";
  if (seats > f.seatsBefore) tier = "bronze";
  if (Object.values(stateRulers(s.dunHolders, o.government)).includes(s.player)) tier = "silver";
  if (o.government.includes(s.player)) tier = "gold";
  if (o.pm === s.player) tier = o.sds >= SUPERMAJORITY ? "diamond" : "platinum";
  return { week: f.week, tier, seats, govSeats: o.sds };
}
