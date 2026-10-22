// Nomination day. When Parliament is dissolved the party leadership names its candidates: the window stays open until
// nomination day, two weeks into the campaign; then names are locked and the campaign runs to polling day.
// - Who picks: your party's president. If that's you, you choose every seat your party fields (defaults are pre-filled,
//   so you only change the ones you care about). If it isn't, the president picks, and your home seat goes to you only
//   if you have earned it (Ketua Bahagian or above) and the president trusts you (loyalty 40+). Lobby them meanwhile.
// - Candidates carry a personal vote: incumbents and party heavyweights pull extra votes; a new face appeals to the young.
// - Dropping a sitting MP hurts: they sulk, and a bitter one may stand as an independent and split your vote.
// - Partner parties and other coalitions pick their own candidates. All numbers TEMPORARY.

import { hash01 } from "../rng";
import type { GameState, ReportLine } from "../state";
import { COALITION_INDEX } from "../voter";
import { SEATS, contestingIn } from "../world";
import { seatCandidate } from "./coalitions";
import { ageOf, leaderOfParty, mpOf, recruitPerson, type Person } from "./people";

export interface Nominations {
  open: boolean;
  /** Nomination day (names lock). */
  closesWeek: number;
  /** Seat → the person your party nominates there. */
  picks: Record<number, number>;
}

export const NOMINATION = {
  /** Weeks from dissolution to nomination day. */
  window: 2,
  incumbent: 0.1,
  /** Personal vote per point of standing above 40. */
  perInfluence: 1 / 400,
  newFace: 0.04,
  newFaceYouth: 0.3,
  /** Loyalty a dropped MP loses, and below which they may run as an independent. */
  snubLoyalty: 30,
  rebelBelow: 20,
  rebelChance: 0.4,
  /** An independent rebel's pull, and what it costs you. */
  rebelBoost: 0.6,
  rebelHit: 0.25,
  /** The president nominates you in your home seat at this loyalty or above. */
  homeLoyalty: 40,
  deposit: 10_000,
  depositShare: 0.125,
};

/** Your party: the one you lead or belong to (your coalition's lead party). */
export const yourParty = (s: Pick<GameState, "coalitions" | "player">) => s.coalitions[s.player].members[0];

/** Seats where your party (not a partner) puts up the candidate. */
export function partySeats(s: GameState): number[] {
  const party = yourParty(s);
  return SEATS.filter((seat) => contestingIn(seat, s.entries).includes(s.player) && seatCandidate(s, seat, s.player) === party).map((seat) => seat.index);
}

/** Who you, the president, can put up in a seat: its sitting MP and members of your party without a seat. */
export function eligible(s: GameState, seat: number): Person[] {
  const party = yourParty(s);
  const taken = new Set(
    Object.entries(s.nominations?.picks ?? {})
      .filter(([k]) => Number(k) !== seat)
      .map(([, v]) => v),
  );
  return s.people
    .filter((p) => p.party === party && !p.retired && !taken.has(p.id) && (p.seat === seat || (p.seat === null && p.rank >= 1)))
    .sort((a, b) => (b.seat === seat ? 1 : 0) - (a.seat === seat ? 1 : 0) || b.rank - a.rank || b.influence - a.influence);
}

/** The default line-up: sitting MPs stand again; elsewhere the most senior members without a seat; then new faces. */
function defaultPicks(s: GameState): { state: GameState; picks: Record<number, number> } {
  const party = yourParty(s);
  const seats = partySeats(s);
  const picks: Record<number, number> = {};
  const used = new Set<number>();
  for (const i of seats) {
    const mp = mpOf(s, i);
    if (mp && mp.party === party && !mp.retired) {
      picks[i] = mp.id;
      used.add(mp.id);
    }
  }
  const pool = s.people.filter((p) => p.party === party && p.seat === null && !p.retired && p.rank >= 1 && p.id !== s.youId).sort((a, b) => b.influence - a.influence);
  let people = s.people;
  let next = s.nextPersonId;
  for (const i of seats) {
    if (picks[i] !== undefined) continue;
    const p = pool.find((x) => !used.has(x.id));
    if (p) {
      picks[i] = p.id;
      used.add(p.id);
      continue;
    }
    const fresh = { ...recruitPerson(next++, party, s.seed, s.week, s), rank: 1 };
    people = [...people, fresh];
    picks[i] = fresh.id;
  }
  return { state: { ...s, people, nextPersonId: next }, picks };
}

/** Career mode: the president decides whether your home seat is yours. */
function presidentsChoiceForYou(s: GameState, picks: Record<number, number>): { picks: Record<number, number>; line: ReportLine | null } {
  const home = s.career.homeSeat;
  if (s.youId === null || s.career.rung >= 6 || picks[home] === undefined) return { picks, line: null };
  const pres = leaderOfParty(s, yourParty(s));
  const sitting = mpOf(s, home)?.id === s.youId;
  const earned = s.career.rung >= 1 && (sitting || (pres?.loyalty ?? 0) >= NOMINATION.homeLoyalty);
  if (earned) {
    const out = { ...picks };
    for (const [k, v] of Object.entries(out)) if (v === s.youId) delete out[Number(k)];
    out[home] = s.youId;
    return { picks: out, line: { text: `${pres?.name ?? "The president"} names you as the candidate for ${SEATS[home].name}.`, tone: "good" } };
  }
  const why = s.career.rung < 1 ? "you are still a branch chief" : `${pres?.name ?? "the president"} doesn't trust you enough (loyalty ${Math.round(pres?.loyalty ?? 0)}, needs ${NOMINATION.homeLoyalty})`;
  return { picks, line: { text: `You are not the candidate in ${SEATS[home].name}: ${why}.`, tone: "bad" } };
}

/** Parliament has just been dissolved: the window opens with default picks. */
export function openNominations(s: GameState): { state: GameState; lines: ReportLine[] } {
  const d = defaultPicks(s);
  const state: GameState = { ...d.state, nominations: { open: true, closesWeek: s.week + NOMINATION.window, picks: d.picks } };
  const text =
    s.career.rung >= 6
      ? `Nominations are open: name your candidates before nomination day in ${NOMINATION.window} weeks (Nominations panel).`
      : `Nominations are open. Your party president is drawing up the list (nomination day in ${NOMINATION.window} weeks).`;
  return { state, lines: [{ text, tone: "info" }] };
}

export function pickBlocked(s: GameState, seat: number, personId: number | "newface"): string | null {
  if (!s.nominations?.open) return "Nominations are closed.";
  if (s.career.rung < 6) return "Your party president names the candidates.";
  if (!partySeats(s).includes(seat)) return "Your party doesn't put up the candidate here.";
  if (personId !== "newface" && !eligible(s, seat).some((p) => p.id === personId)) return "They can't stand here.";
  return null;
}

/** You, as president, put someone up in a seat. */
export function nominate(s: GameState, seat: number, personId: number | "newface"): { state: GameState; message: string } | { error: string } {
  const why = pickBlocked(s, seat, personId);
  if (why) return { error: why };
  let state = s;
  let id: number;
  if (personId === "newface") {
    const fresh = { ...recruitPerson(s.nextPersonId, yourParty(s), s.seed, s.week, s), rank: 1 };
    state = { ...state, people: [...state.people, fresh], nextPersonId: s.nextPersonId + 1 };
    id = fresh.id;
  } else id = personId;
  const picks = { ...s.nominations!.picks, [seat]: id };
  const p = state.people.find((x) => x.id === id)!;
  return { state: { ...state, nominations: { ...s.nominations!, picks } }, message: `${p.name} will stand in ${SEATS[seat].name}.` };
}

/** A candidate's personal vote in a seat (log-odds for your coalition). */
export function candidateStrength(s: Pick<GameState, "week">, seat: number, p: Person | undefined): number {
  if (!p) return 0;
  let v = (p.influence - 40) * NOMINATION.perInfluence;
  if (p.seat === seat) v += NOMINATION.incumbent;
  if (ageOf(p, s.week) < 36 && p.seat === null && SEATS[seat].demo.youth > NOMINATION.newFaceYouth) v += NOMINATION.newFace;
  return v;
}

/** Nomination day: the president's final word, dropped MPs react, names lock. */
export function closeNominations(s: GameState): { state: GameState; lines: ReportLine[] } {
  const n = s.nominations!;
  const lines: ReportLine[] = [];
  const career = presidentsChoiceForYou(s, n.picks);
  if (career.line) lines.push(career.line);
  const picks = career.picks;
  const party = yourParty(s);
  let people = s.people;
  const seatOffsets = s.seatOffsets.map((r) => [...r]);
  let entries = s.entries;
  // Sitting MPs who were dropped.
  for (const i of Object.keys(picks).map(Number)) {
    const mp = mpOf(s, i);
    if (!mp || mp.party !== party || picks[i] === mp.id || mp.retired || mp.id === s.youId) continue;
    const loyalty = Math.max(0, mp.loyalty - NOMINATION.snubLoyalty);
    if (loyalty < NOMINATION.rebelBelow && hash01("rebel", s.seed, s.week, i) < NOMINATION.rebelChance) {
      people = people.map((p) => (p.id === mp.id ? { ...p, party: "IND", rank: 1, loyalty } : p));
      entries = { ...entries, [i]: [...(entries[i] ?? []), "OTHERS"] };
      seatOffsets[i][COALITION_INDEX.OTHERS] += NOMINATION.rebelBoost;
      seatOffsets[i][COALITION_INDEX[s.player]] -= NOMINATION.rebelHit;
      lines.push({ text: `${mp.name}, dropped in ${SEATS[i].name}, stands as an independent and takes votes with them.`, tone: "bad" });
    } else {
      people = people.map((p) => (p.id === mp.id ? { ...p, loyalty } : p));
      lines.push({ text: `${mp.name} is bitter about losing the ticket in ${SEATS[i].name}.`, tone: "bad" });
    }
  }
  lines.push({ text: `Nomination day: ${Object.keys(picks).length} candidates for ${party}. The campaign is on.`, tone: "info" });
  return { state: { ...s, people, seatOffsets, entries, nominations: { ...n, open: false, picks } }, lines };
}

/** Weekly: open the window when Parliament is dissolved, close it on nomination day. */
export function nominationsWeek(s: GameState): { state: GameState; lines: ReportLine[] } {
  if (s.parliament.status === "campaign" && !s.nominations) return openNominations(s);
  if (s.nominations?.open && s.week >= s.nominations.closesWeek) return closeNominations(s);
  return { state: s, lines: [] };
}
