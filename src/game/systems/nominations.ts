// Nomination day. When Parliament is dissolved the party leadership names its candidates: the window stays open until
// nomination day, two weeks into the campaign; then names are locked and the campaign runs to polling day.
// - Who picks: your party's president. If that's you, you choose every seat your party fields (defaults are pre-filled,
//   so you only change the ones you care about). If it isn't, the president picks, and your home seat goes to you only
//   if you have earned it (Ketua Bahagian or above) and the president trusts you (loyalty 40+). Lobby them meanwhile.
// - Candidates carry a personal vote: incumbents and party heavyweights pull extra votes; a new face appeals to the young.
// - Dropping a sitting MP hurts: they sulk, and a bitter one may stand as an independent and split your vote.
// - Partner parties and other coalitions pick their own candidates. All numbers TEMPORARY.

import { hash01 } from "../rng";
import { CAMPS, divisionChief } from "./camps";
import type { GameState, ReportLine } from "../state";
import { COALITION_INDEX } from "../voter";
import { SEATS, contestingIn, regionOf } from "../world";
import { seatCandidate } from "./coalitions";
import { standsAside } from "./pacts";
import { TRAITS, traitVote, traitVotes } from "./profiles";
import { ageOf, homeOf, leaderOfParty, mpOf, recruitPerson, type Person } from "./people";

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
  /** A candidate from another state ("parachuted"), standing outside their own seat. */
  outsider: 0.03,
  /** Naming a candidate before Parliament is dissolved (calon), and what it costs the people it passes over. */
  name: { capital: 2, mpLoyalty: -8, otherLoyalty: -3 },
  /** Personal vote per point of standing above 40. */
  perInfluence: 1 / 250,
  /** Poaching a popular local figure (a doctor, a headman, a footballer) to stand for you. */
  local: { cost: 500_000, influence: 78 },
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
  // Seats where you stand aside for a pact partner have no candidate of yours.
  return SEATS.filter((seat) => contestingIn(seat, s.entries).includes(s.player) && !standsAside(s, seat.index, s.player) && seatCandidate(s, seat, s.player) === party).map((seat) => seat.index);
}

/**
 * Whether someone could stand in a seat: any member of your party who has made division chief (sitting MPs included:
 * they can move seat). As party president you can stand anywhere too; below that, only in your home seat. One person,
 * one seat: naming someone elsewhere moves them.
 */
export function canStand(s: GameState, seat: number, p: Person): boolean {
  if (p.party !== yourParty(s) || p.retired) return false;
  if (p.id === s.youId) return s.career.rung >= 6 || seat === s.career.homeSeat;
  return p.seat === seat || p.rank >= 1;
}

/** The seat someone is already picked for (other than this one). */
export function pickedFor(s: GameState, id: number, except?: number): number | undefined {
  const e = Object.entries(s.nominations?.picks ?? lineup(s)).find(([k, v]) => v === id && Number(k) !== except);
  return e ? Number(e[0]) : undefined;
}

/** Who you, the president, can put up in a seat and who is still free: its sitting MP and members of your party without a seat. */
export function eligible(s: GameState, seat: number): Person[] {
  const taken = new Set(
    Object.entries(s.nominations?.picks ?? lineup(s))
      .filter(([k]) => Number(k) !== seat)
      .map(([, v]) => v),
  );
  return s.people
    .filter((p) => !taken.has(p.id) && canStand(s, seat, p))
    .sort((a, b) => (b.seat === seat ? 1 : 0) - (a.seat === seat ? 1 : 0) || b.rank - a.rank || b.influence - a.influence);
}

/** Everyone who could stand in a seat, including people picked elsewhere (picking them moves them here). */
export function standable(s: GameState, seat: number): Person[] {
  return s.people.filter((p) => canStand(s, seat, p));
}

/**
 * The default line-up: your named calon first; then sitting MPs stand again; then the division chief; elsewhere the
 * most senior local members without a seat; then new faces (only when `recruit`, otherwise the seat is left open).
 */
function defaultPicks(s: GameState, recruit = true): { state: GameState; picks: Record<number, number> } {
  const party = yourParty(s);
  const seats = partySeats(s);
  const picks: Record<number, number> = {};
  const used = new Set<number>();
  for (const [k, id] of Object.entries(s.calon ?? {})) {
    const i = Number(k);
    const p = id !== undefined ? s.people.find((x) => x.id === id) : undefined;
    if (p && seats.includes(i) && canStand(s, i, p) && !used.has(p.id)) {
      picks[i] = p.id;
      used.add(p.id);
    }
  }
  for (const i of seats) {
    if (picks[i] !== undefined) continue;
    const mp = mpOf(s, i);
    if (mp && mp.party === party && !mp.retired && !used.has(mp.id)) {
      picks[i] = mp.id;
      used.add(mp.id);
    }
  }
  // A party leader always stands in their own home seat.
  const home = s.career.homeSeat;
  if (s.youId !== null && s.career.rung >= 6 && seats.includes(home) && picks[home] === undefined && !used.has(s.youId)) {
    picks[home] = s.youId;
    used.add(s.youId);
  }
  const pool = s.people.filter((p) => p.party === party && p.seat === null && !p.retired && p.rank >= 1 && p.id !== s.youId).sort((a, b) => b.influence - a.influence);
  let people = s.people;
  let next = s.nextPersonId;
  // Where you have no MP, the division chief is first in line.
  for (const i of seats) {
    if (picks[i] !== undefined) continue;
    const chief = divisionChief(s, i);
    if (chief && chief.seat === null && chief.party === party && !chief.retired && chief.id !== s.youId && chief.rank >= 1 && !used.has(chief.id)) {
      picks[i] = chief.id;
      used.add(chief.id);
    }
  }
  for (const i of seats) {
    if (picks[i] !== undefined) continue;
    // Someone from the state first; an outsider only if nobody local is free.
    const local = regionOf(SEATS[i].state);
    const p = pool.find((x) => !used.has(x.id) && homeOf(x) === local) ?? pool.find((x) => !used.has(x.id));
    if (p) {
      picks[i] = p.id;
      used.add(p.id);
      continue;
    }
    if (!recruit) continue;
    const fresh = { ...recruitPerson(next++, party, s.seed, s.week, s, i), rank: 1 };
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

/** Your line-up today: the nominations once the window is open; before that, your named calon and the defaults. */
export function lineup(s: GameState): Record<number, number> {
  return s.nominations ? s.nominations.picks : defaultPicks(s, false).picks;
}

/** Why you can't name this person for this seat (null when you can). */
export function nameBlocked(s: GameState, seat: number, id: number): string | null {
  if (s.nominations?.open) return pickBlocked(s, seat, id);
  if (s.nominations) return "Names are locked until the next election.";
  if (s.career.rung < 6) return "Your party president names the candidates.";
  if (!partySeats(s).includes(seat)) return "Your party doesn't put up the candidate here.";
  const p = s.people.find((x) => x.id === id);
  if (!p || !canStand(s, seat, p)) return "They can't stand here.";
  if (lineup(s)[seat] === id) return "They're already your pick here.";
  if (s.me.capital < NOMINATION.name.capital) return `Needs ${NOMINATION.name.capital} political capital.`;
  return null;
}

/**
 * Name a candidate for a seat: before dissolution it sets your calon (they become the pick when nominations open); in
 * the window it nominates them. Anyone passed over notices now: a sitting MP most of all.
 */
export function nameCandidate(s: GameState, seat: number, id: number): { state: GameState; message: string } | { error: string } {
  if (s.nominations?.open) return nominate(s, seat, id);
  const why = nameBlocked(s, seat, id);
  if (why) return { error: why };
  const before = lineup(s);
  const calon = { ...(s.calon ?? {}) };
  for (const [k, v] of Object.entries(calon)) if (v === id) delete calon[Number(k)];
  calon[seat] = id;
  let state: GameState = { ...s, calon, me: { ...s.me, capital: s.me.capital - NOMINATION.name.capital } };
  const after = lineup(state);
  const standing = new Set(Object.values(after));
  // Whoever was standing and now isn't.
  const lost = Object.values(before).filter((x) => !standing.has(x) && x !== s.youId);
  const byIdMap = new Map(s.people.map((p) => [p.id, p]));
  state = {
    ...state,
    people: state.people.map((p) => (lost.includes(p.id) ? { ...p, loyalty: Math.max(0, p.loyalty + (p.seat !== null ? NOMINATION.name.mpLoyalty : divisionChief(s, Object.keys(before).map(Number).find((k) => before[k] === p.id) ?? -1)?.id === p.id ? CAMPS.snub : NOMINATION.name.otherLoyalty)) } : p)),
  };
  const p = byIdMap.get(id)!;
  const from = Object.keys(before).map(Number).find((k) => before[k] === id && k !== seat);
  const parts = [`${p.id === s.youId ? "You" : p.name} will stand in ${SEATS[seat].name}.`];
  if (from !== undefined) {
    const next = after[from] !== undefined ? byIdMap.get(after[from]) : undefined;
    parts.push(`${SEATS[from].name} falls to ${next ? next.name : "a new face"}.`);
  }
  const hurt = lost.map((x) => byIdMap.get(x)).filter((x): x is Person => !!x);
  if (hurt.length) parts.push(`${hurt.map((x) => x.name).join(" and ")} ${hurt.length === 1 ? "is" : "are"} passed over${hurt.some((x) => x.seat !== null) ? ": a dropped MP may stand as an independent" : ""}.`);
  return { state, message: parts.join(" ") };
}

/** Take back a calon you named: the seat goes back to its default. */
export function clearCandidate(s: GameState, seat: number): { state: GameState; message: string } | { error: string } {
  if (s.calon?.[seat] === undefined) return { error: "You haven't named anyone here." };
  const calon = { ...s.calon };
  delete calon[seat];
  const state = { ...s, calon };
  const next = lineup(state)[seat];
  const p = next !== undefined ? state.people.find((x) => x.id === next) : undefined;
  return { state, message: `${SEATS[seat].name} goes back to its default: ${p ? p.name : "a new face"}.` };
}

/** Weekly: a calon who has left the party, retired, or can no longer stand there is dropped. */
export function syncCalon(s: GameState): { state: GameState; lines: ReportLine[] } {
  const lines: ReportLine[] = [];
  if (!s.calon || !Object.keys(s.calon).length) return { state: s, lines };
  const seats = new Set(partySeats(s));
  const calon: Partial<Record<number, number>> = {};
  for (const [k, id] of Object.entries(s.calon)) {
    const i = Number(k);
    const p = id !== undefined ? s.people.find((x) => x.id === id) : undefined;
    if (p && seats.has(i) && canStand(s, i, p)) calon[i] = id;
    else lines.push({ text: `${p?.name ?? "Your candidate"} is no longer your candidate for ${SEATS[i].name}.`, tone: "info" });
  }
  return { state: lines.length ? { ...s, calon } : s, lines };
}

export function pickBlocked(s: GameState, seat: number, personId: number | "newface" | "local"): string | null {
  if (!s.nominations?.open) return "Nominations are closed.";
  if (s.career.rung < 6) return "Your party president names the candidates.";
  if (!partySeats(s).includes(seat)) return "Your party doesn't put up the candidate here.";
  if (personId === "local" && s.me.funds < NOMINATION.local.cost) return "Not enough money to bring them over.";
  if (typeof personId === "number") {
    const p = s.people.find((x) => x.id === personId);
    if (!p || !canStand(s, seat, p)) return personId === s.youId ? "You stand only in your own seat." : "They can't stand here.";
  }
  return null;
}

/** You, as president, put someone up in a seat. */
export function nominate(s: GameState, seat: number, personId: number | "newface" | "local"): { state: GameState; message: string } | { error: string } {
  const why = pickBlocked(s, seat, personId);
  if (why) return { error: why };
  let state = s;
  let id: number;
  if (personId === "newface" || personId === "local") {
    const local = personId === "local";
    const fresh = { ...recruitPerson(s.nextPersonId, yourParty(s), s.seed, s.week + (local ? 7 : 0), s, seat), rank: 1, ...(local ? { influence: NOMINATION.local.influence } : {}) };
    state = { ...state, people: [...state.people, fresh], nextPersonId: s.nextPersonId + 1, me: local ? { ...state.me, funds: state.me.funds - NOMINATION.local.cost } : state.me };
    id = fresh.id;
  } else id = personId;
  const picks = { ...s.nominations!.picks, [seat]: id };
  const p = state.people.find((x) => x.id === id)!;
  // Already picked elsewhere: they move here, and their old seat gets the best free local (or a new face).
  const from = pickedFor(s, id, seat);
  let moved = "";
  if (from !== undefined) {
    delete picks[from];
    state = { ...state, nominations: { ...s.nominations!, picks } };
    const next = eligible(state, from).find((x) => homeOf(x) === regionOf(SEATS[from].state)) ?? eligible(state, from)[0];
    if (next) picks[from] = next.id;
    else {
      const fresh = { ...recruitPerson(state.nextPersonId, yourParty(s), s.seed, s.week, s, from), rank: 1 };
      state = { ...state, people: [...state.people, fresh], nextPersonId: state.nextPersonId + 1 };
      picks[from] = fresh.id;
    }
    moved = ` ${state.people.find((x) => x.id === picks[from])!.name} takes their place in ${SEATS[from].name}.`;
  }
  return { state: { ...state, nominations: { ...s.nominations!, picks } }, message: `${p.name} will stand in ${SEATS[seat].name}.${moved}` };
}

/** A candidate's personal vote in a seat (log-odds for your coalition). */
export function candidateStrength(s: Pick<GameState, "week" | "youId">, seat: number, p: Person | undefined): number {
  if (!p) return 0;
  // A heavyweight pulls votes; an unknown costs a little, not much (voters mostly vote for the party).
  let v = (p.influence - 40) * NOMINATION.perInfluence;
  if (v < 0) v *= 0.4;
  if (p.seat === seat) v += NOMINATION.incumbent;
  else if (homeOf(p) !== regionOf(SEATS[seat].state)) v -= NOMINATION.outsider;
  if (ageOf(p, s.week) < 36 && p.seat === null && SEATS[seat].demo.youth > NOMINATION.newFaceYouth) v += NOMINATION.newFace;
  // Who they are: an ustaz in a rural Malay seat, a technocrat in the city, a local son or daughter at home.
  if (p.id !== s.youId) v += traitVote(p, seat);
  return v;
}

/** Why a candidate pulls what they do here: the parts candidateStrength adds up. */
export function strengthParts(s: Pick<GameState, "week" | "youId">, seat: number, p: Person): { label: string; value: number }[] {
  let standing = (p.influence - 40) * NOMINATION.perInfluence;
  if (standing < 0) standing *= 0.4;
  const rows = [{ label: `Standing ${Math.round(p.influence)}`, value: standing }];
  if (p.seat === seat) rows.push({ label: "Sitting MP", value: NOMINATION.incumbent });
  else if (homeOf(p) !== regionOf(SEATS[seat].state)) rows.push({ label: "From another state", value: -NOMINATION.outsider });
  if (ageOf(p, s.week) < 36 && p.seat === null && SEATS[seat].demo.youth > NOMINATION.newFaceYouth) rows.push({ label: "A fresh young face", value: NOMINATION.newFace });
  if (p.id !== s.youId) for (const t of traitVotes(p, seat)) rows.push({ label: TRAITS[t.trait].name, value: t.v });
  return rows;
}

export type SeatStatus = "you" | "kept" | "dropped" | "none" | "weak" | "named";

export const STATUS_INFO: Record<SeatStatus, { icon: string; label: string; attention: boolean }> = {
  you: { icon: "◆", label: "You", attention: false },
  kept: { icon: "★", label: "Sitting MP", attention: false },
  dropped: { icon: "✕", label: "MP dropped", attention: true },
  none: { icon: "○", label: "Needs a name", attention: true },
  weak: { icon: "⚠", label: "Weak pick", attention: true },
  named: { icon: "✓", label: "Named", attention: false },
};

/** Where a seat's nomination stands. A weak pick pulls votes away (negative personal vote). */
export function seatStatus(s: GameState, seat: number): SeatStatus {
  const id = s.nominations?.picks[seat];
  const pick = id === undefined ? undefined : s.people.find((p) => p.id === id);
  const mp = mpOf(s, seat);
  if (pick?.id === s.youId) return "you";
  if (mp && mp.party === yourParty(s) && !mp.retired && mp.id !== pick?.id && mp.id !== s.youId && !Object.values(s.nominations?.picks ?? {}).includes(mp.id)) return "dropped";
  if (!pick) return "none";
  if (pick.seat === seat) return "kept";
  return candidateStrength(s, seat, pick) < 0 ? "weak" : "named";
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
    // An MP standing somewhere else moved; only one left off the list was dropped.
    if (!mp || mp.party !== party || picks[i] === mp.id || mp.retired || mp.id === s.youId || Object.values(picks).includes(mp.id)) continue;
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
  // Division chiefs passed over for their own seat sulk.
  const snubbed = Object.keys(picks)
    .map(Number)
    .map((i) => ({ i, chief: divisionChief(s, i) }))
    .filter(({ i, chief }) => chief && chief.seat === null && chief.id !== s.youId && picks[i] !== chief.id && pickedFor({ ...s, nominations: { ...n, picks } }, chief.id) === undefined);
  if (snubbed.length) {
    const ids = new Set(snubbed.map((x) => x.chief!.id));
    people = people.map((p) => (ids.has(p.id) ? { ...p, loyalty: Math.max(0, p.loyalty + CAMPS.snub) } : p));
    const first = snubbed[0];
    lines.push({ text: snubbed.length === 1 ? `${first.chief!.name}, who runs the ${SEATS[first.i].name} division, wanted the seat and is sulking.` : `${snubbed.length} division chiefs passed over for their own seats are sulking.`, tone: "bad" });
  }
  lines.push({ text: `Nomination day: ${Object.keys(picks).length} candidates for ${party}. The campaign is on.`, tone: "info" });
  const yourSeat = s.career.rung >= 6 ? Object.keys(picks).map(Number).find((k) => picks[k] === s.youId) : undefined;
  const nextCareer = yourSeat !== undefined && yourSeat !== s.career.homeSeat ? { ...s.career, homeSeat: yourSeat } : s.career;
  if (nextCareer !== s.career) lines.push({ text: `You stand in ${SEATS[yourSeat!].name} this time.`, tone: "info" });
  return { state: { ...s, people, seatOffsets, entries, career: nextCareer, calon: {}, nominations: { ...n, open: false, picks } }, lines };
}

/** Weekly: open the window when Parliament is dissolved, close it on nomination day. */
export function nominationsWeek(s: GameState): { state: GameState; lines: ReportLine[] } {
  if (s.parliament.status === "campaign" && !s.nominations) return openNominations(syncCalon(s).state);
  if (s.nominations?.open && s.week >= s.nominations.closesWeek) return closeNominations(s);
  return { state: s, lines: [] };
}

/** The strongest candidates you could put up in a seat (your shortlist), best first. */
export function shortlist(s: GameState, seat: number, n = 3): Person[] {
  return eligible(s, seat)
    .map((p) => ({ p, v: candidateStrength(s, seat, p) }))
    .sort((a, b) => b.v - a.v)
    .slice(0, n)
    .map((x) => x.p);
}

/** Put the strongest available candidate up in every seat where they beat the current pick. */
export function autoPick(s: GameState): { state: GameState; message: string } | { error: string } {
  if (!s.nominations?.open) return { error: "Nominations are closed." };
  if (s.career.rung < 6) return { error: "Your party president names the candidates." };
  let state = s;
  let changed = 0;
  for (const seat of partySeats(s)) {
    const cur = state.people.find((p) => p.id === state.nominations!.picks[seat]);
    // Never drop a sitting MP or yourself: that is a choice you make by hand.
    if (cur && (cur.seat === seat || cur.id === s.youId)) continue;
    const best = shortlist(state, seat, 4).find((p) => p.seat === null || p.seat === seat);
    if (!best || best.id === cur?.id || candidateStrength(state, seat, best) <= candidateStrength(state, seat, cur)) continue;
    const r = nominate(state, seat, best.id);
    if ("state" in r) {
      state = r.state;
      changed++;
    }
  }
  return { state, message: changed ? `Your strongest candidates go up in ${changed} seat${changed === 1 ? "" : "s"}.` : "Your list is already the strongest you can field." };
}
