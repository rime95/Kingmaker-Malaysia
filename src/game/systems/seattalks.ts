// Seat talks: before an election, partners agree who stands where. Two kinds of partner share seats with you:
// - Parties inside your own coalition (who carries the coalition's flag in each seat), and
// - Coalitions you have a pact with (who stands aside where).
// The starting split is fair: each side keeps the seats it holds, and the open seats are shared in proportion to each
// side's vote, each taking the seats where it is relatively strongest. You can then claim a seat (it costs goodwill,
// more where their claim is strong, and they refuse if goodwill runs out) or concede one (goodwill, at a small cost to
// your own warlords' patience). Talks lock on nomination day. All numbers TEMPORARY.

import type { GameState } from "../state";
import { COALITION_INDEX } from "../voter";
import { PARTIES, SEATS, contestingIn, cshort, seatRegion, type CoalitionId } from "../world";
import { isPresident } from "./career";
import { COALITION_RULES, seatCandidate } from "./coalitions";
import { partyFit } from "./partners";

export const TALKS = {
  /** Goodwill a pact starts with (0–100). */
  goodwill: 60,
  /** Cost of claiming a seat: base, plus per unit of their claim (their share of the two votes), plus if they hold it. */
  claimBase: 5,
  claimStrength: 20,
  claimHeld: 12,
  /** Goodwill from conceding a seat (base plus per unit of your claim), and the unity it costs you. */
  concedeBase: 4,
  concedeStrength: 8,
  concedeUnity: 1,
  /** Partners refuse once goodwill would fall below this. */
  floor: 5,
};

/** One seat on the table. */
export interface TalkSeat {
  seat: number;
  kind: "pact" | "coalition";
  /** The pact coalition, or the partner party inside your coalition. */
  partner: string;
  /** Who carries the flag here now. */
  standing: "you" | "them";
  /** Who holds the seat today. */
  held: "you" | "them" | null;
  /** Their claim: their share of the two sides' vote here (0–1). */
  claim: number;
}

/**
 * The fair split between you and a pact partner in the seats you both contest: held seats stay with the holder, and the
 * open seats are shared in proportion to each side's vote. Returns seat → who stands aside.
 */
export function fairSplit(s: Pick<GameState, "holders" | "player" | "entries">, c: CoalitionId, shares: (i: number) => Partial<Record<CoalitionId, number>>): Record<number, CoalitionId> {
  const out: Record<number, CoalitionId> = {};
  const open: { i: number; mine: number }[] = [];
  let you = 0;
  let them = 0;
  let youHeld = 0;
  let total = 0;
  for (const seat of SEATS) {
    const list = contestingIn(seat, s.entries);
    if (!list.includes(c) || !list.includes(s.player)) continue;
    const sh = shares(seat.index);
    const a = sh[s.player] ?? 0;
    const b = sh[c] ?? 0;
    you += a;
    them += b;
    total++;
    if (s.holders[seat.index] === s.player) {
      out[seat.index] = c;
      youHeld++;
    } else if (s.holders[seat.index] === c) out[seat.index] = s.player;
    else open.push({ i: seat.index, mine: a / Math.max(1e-6, a + b) });
  }
  // Your fair number of seats overall, less what you already hold; you take the open seats where you are relatively strongest.
  const want = Math.round((total * you) / Math.max(1e-6, you + them)) - youHeld;
  const k = Math.max(0, Math.min(open.length, want));
  open.sort((x, y) => y.mine - x.mine);
  open.forEach((o, n) => (out[o.i] = n < k ? c : s.player));
  return out;
}

/** Goodwill with a pact partner (or a coalition partner party's satisfaction). */
export function goodwillWith(s: GameState, kind: TalkSeat["kind"], partner: string): number {
  if (kind === "pact") return s.pacts.find((p) => p.with === partner)?.goodwill ?? TALKS.goodwill;
  return s.partySat[partner] ?? 50;
}

/** Your coalition's partner party with the best claim on a seat you carry: one from the region, else the biggest. */
function partnerFor(s: GameState, i: number): string | null {
  const [lead, ...rest] = s.coalitions[s.player].members;
  if (!lead || !rest.length) return null;
  const region = seatRegion(SEATS[i]);
  const can = rest.filter((p) => PARTIES[p]?.home === region || PARTIES[p]?.home === "national" || (PARTIES[p]?.home === "peninsula" && region === "peninsula"));
  return can.sort((a, b) => partyFit(s, SEATS[i], b) - partyFit(s, SEATS[i], a))[0] ?? null;
}

/** Every seat on the table, with who stands now. `shares` is the projected vote by seat. */
export function talkSeats(s: GameState, shares: (i: number) => Partial<Record<CoalitionId, number>>): TalkSeat[] {
  const rows: TalkSeat[] = [];
  for (const p of s.pacts) {
    for (const [k, out] of Object.entries(p.seats)) {
      const i = Number(k);
      const sh = shares(i);
      const a = sh[s.player] ?? 0;
      const b = sh[p.with] ?? 0;
      rows.push({ seat: i, kind: "pact", partner: p.with, standing: out === s.player ? "them" : "you", held: s.holders[i] === s.player ? "you" : s.holders[i] === p.with ? "them" : null, claim: b / Math.max(1e-6, a + b) });
    }
  }
  const lead = s.coalitions[s.player].members[0];
  if (s.coalitions[s.player].members.length > 1) {
    for (const seat of SEATS) {
      if (!contestingIn(seat, s.entries).includes(s.player)) continue;
      const cand = seatCandidate(s, seat, s.player);
      const partner = cand !== lead ? cand : partnerFor(s, seat.index);
      if (!partner) continue;
      const hp = s.holders[seat.index] === s.player ? s.holderParties[seat.index] : null;
      const fit = partyFit(s, seat, partner);
      const claim = hp === partner ? 0.75 : hp === lead ? 0.25 : 0.2 + 0.6 * (fit / Math.max(0.01, fit + partyFit(s, seat, lead)));
      rows.push({ seat: seat.index, kind: "coalition", partner, standing: cand === lead ? "you" : "them", held: hp === lead ? "you" : hp === partner ? "them" : null, claim });
    }
  }
  return rows;
}

export function talksBlocked(s: GameState): string | null {
  if (!isPresident(s.career)) return "Only the party president negotiates seats.";
  if (s.nominations && !s.nominations.open && s.parliament.status === "campaign") return "Nomination day has passed: the seats are settled.";
  return null;
}

const setGoodwill = (s: GameState, kind: TalkSeat["kind"], partner: string, v: number): GameState =>
  kind === "pact"
    ? { ...s, pacts: s.pacts.map((p) => (p.with === partner ? { ...p, goodwill: Math.max(0, Math.min(100, v)) } : p)) }
    : { ...s, partySat: { ...s.partySat, [partner]: Math.max(0, Math.min(100, v)) } };

/** Give the seat's flag to a party in your coalition, moving an incumbent's personal vote with it. */
export function carry(s: GameState, i: number, party: string): GameState {
  const ci = COALITION_INDEX[s.player];
  const before = seatCandidate(s, SEATS[i], s.player);
  const seatOffsets = s.seatOffsets.map((r) => [...r]);
  // The sitting MP's own following stays with them, not with whoever replaces them.
  if (s.holderParties[i] === before && before !== party) seatOffsets[i][ci] -= COALITION_RULES.personalVote;
  if (s.holderParties[i] === party && before !== party) seatOffsets[i][ci] += COALITION_RULES.personalVote;
  return { ...s, seatOffsets, seatParty: { ...s.seatParty, [i]: { ...s.seatParty[i], [s.player]: party } } };
}

const label = (r: TalkSeat) => (r.kind === "pact" ? cshort(r.partner as CoalitionId) : r.partner);

/** Claim a seat for your party. */
export function claimSeat(s: GameState, r: TalkSeat): { state: GameState; message: string } | { error: string } {
  const why = talksBlocked(s);
  if (why) return { error: why };
  if (r.standing === "you") return { error: "You already stand there." };
  const cost = TALKS.claimBase + r.claim * TALKS.claimStrength + (r.held === "them" ? TALKS.claimHeld : 0);
  const gw = goodwillWith(s, r.kind, r.partner);
  const name = SEATS[r.seat].name;
  if (gw - cost < TALKS.floor) return { error: `${label(r)} refuses: ${r.held === "them" ? `they hold ${name}` : `their claim on ${name} is strong`} and goodwill is too low (${Math.round(gw)}). Concede a seat elsewhere first.` };
  let state = setGoodwill(s, r.kind, r.partner, gw - cost);
  if (r.kind === "pact") state = { ...state, pacts: state.pacts.map((p) => (p.with === r.partner ? { ...p, seats: { ...p.seats, [r.seat]: r.partner as CoalitionId } } : p)) };
  else state = carry(state, r.seat, s.coalitions[s.player].members[0]);
  return { state, message: `You claim ${name}. ${label(r)} agrees, grudgingly (goodwill −${Math.round(cost)}).` };
}

/** Concede a seat to your partner. */
export function concedeSeat(s: GameState, r: TalkSeat): { state: GameState; message: string } | { error: string } {
  const why = talksBlocked(s);
  if (why) return { error: why };
  if (r.standing === "them") return { error: "They already stand there." };
  if (r.seat === s.career.homeSeat) return { error: "That is your own seat: you stand there." };
  const gain = TALKS.concedeBase + (1 - r.claim) * TALKS.concedeStrength;
  let state = setGoodwill(s, r.kind, r.partner, goodwillWith(s, r.kind, r.partner) + gain);
  if (r.kind === "pact") state = { ...state, pacts: state.pacts.map((p) => (p.with === r.partner ? { ...p, seats: { ...p.seats, [r.seat]: s.player } } : p)) };
  else state = carry(state, r.seat, r.partner);
  state = { ...state, me: { ...state.me, unity: Math.max(0, state.me.unity - TALKS.concedeUnity) } };
  return { state, message: `You give ${SEATS[r.seat].name} to ${label(r)} (goodwill +${Math.round(gain)}). Your division chief there is not pleased.` };
}
