// The party below the top table: its divisions and the camps that fight over them.
// - Divisions (Bahagian): your party has one in every seat it stands in, each run by a division chief. The sitting MP
//   usually leads their own division; elsewhere a local organiser does. Division chiefs are the delegates who elect
//   the leadership, the machine on the ground (a loyal, able chief builds your machinery; a hostile one lets it rot),
//   and first in line for the seat at nomination time.
// - Camps (kem): every party has the leader's camp and up to two rival camps around ambitious deputies and vice
//   presidents. Everyone with a post or a division is in a camp or unaligned, and drifts with their loyalty. A rival
//   camp that holds enough divisions has the numbers to challenge you at the AGM.
// All numbers TEMPORARY.

import { hash01 } from "../rng";
import { remember } from "./people";
import type { GameState, ReportLine } from "../state";
import { SEATS, regionOf } from "../world";
import { HIERARCHY_PARTIES, PRESIDENT_RANK, homeOf, recruitPerson, type Person } from "./people";
import { partySeats, yourParty } from "./nominations";

export const CAMPS = {
  /** Rivals need this much ambition to lead a camp. */
  patronAmbition: 55,
  maxRivals: 2,
  /** Your party: loyal enough to be yours, or hostile enough to be a rival's. */
  joinYou: 62,
  joinRival: 38,
  /** A rival camp with this share of the divisions (and more than yours) forces a challenge. */
  challengeShare: 0.4,
  bring: { ap: 1, capital: 5, minLoyalty: 55 },
  replace: { capital: 8, ousted: -15, mpOusted: -25, fresh: 10, unity: -1 },
  /** Passed over for your own division's seat. */
  snub: -10,
  /** Monthly machinery change in a division, per point of a loyal chief's competence above 50 (and a hostile chief's drag). */
  machineryPerPoint: 0.00006,
  machineryDrag: 0.008,
};

/** Seat → division chief (person id), for your party. */
export type Divisions = Partial<Record<number, number>>;

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
const active = (p: Person, party: string) => p.party === party && !p.retired;

// --- Divisions -----------------------------------------------------------------------------------

/** The seats where your party has a division: where it puts up the candidate, and where it holds the seat. */
export function divisionSeats(s: GameState): number[] {
  const party = yourParty(s);
  const set = new Set(partySeats(s));
  s.holderParties.forEach((p, i) => p === party && set.add(i));
  return [...set].sort((a, b) => a - b);
}

export const divisionChief = (s: Pick<GameState, "divisions" | "people">, seat: number) => {
  const id = s.divisions?.[seat];
  return id === undefined ? undefined : s.people.find((p) => p.id === id);
};

/** The division someone leads, if any. */
export function divisionOf(s: Pick<GameState, "divisions">, id: number): number | undefined {
  const e = Object.entries(s.divisions ?? {}).find(([, v]) => v === id);
  return e ? Number(e[0]) : undefined;
}

/**
 * Every division has a chief: the one it has while they stay in the party, else your MP for the seat (you, in your own
 * seat), else a local member without a division, else a new local organiser.
 */
export function syncDivisions(s: GameState): GameState {
  const party = yourParty(s);
  const byId = new Map(s.people.map((p) => [p.id, p]));
  const seats = divisionSeats(s);
  const out: Divisions = {};
  const used = new Set<number>();
  for (const i of seats) {
    const id = s.divisions?.[i];
    const p = id !== undefined ? byId.get(id) : undefined;
    if (p && active(p, party) && !used.has(p.id)) {
      out[i] = p.id;
      used.add(p.id);
    }
  }
  // MPs lead their own divisions.
  for (const p of s.people)
    if (p.seat !== null && active(p, party) && seats.includes(p.seat) && out[p.seat] === undefined && !used.has(p.id)) {
      out[p.seat] = p.id;
      used.add(p.id);
    }
  let people = s.people;
  let next = s.nextPersonId;
  const free = s.people.filter((p) => active(p, party) && p.seat === null && p.rank >= 1 && p.rank <= 2 && p.id !== s.youId && !p.chairman).sort((a, b) => b.influence - a.influence);
  for (const i of seats) {
    if (out[i] !== undefined) continue;
    const region = regionOf(SEATS[i].state);
    let p = free.find((x) => !used.has(x.id) && homeOf(x) === region);
    if (!p) {
      p = { ...recruitPerson(next++, party, s.seed, s.week, s, i), rank: 1 };
      people = [...people, p];
    }
    out[i] = p.id;
    used.add(p.id);
  }
  return { ...s, divisions: out, people, nextPersonId: next };
}

// --- Camps ---------------------------------------------------------------------------------------

export interface Camp {
  /** The patron's person id. */
  patron: number;
  name: string;
  /** You lead it. */
  yours: boolean;
  /** The party's leader leads it. */
  leader: boolean;
  /** Divisions (delegates) whose chiefs follow this camp. */
  divisions: number;
  /** Supreme Council and above. */
  council: number;
  members: number;
  /** Share of the delegates (0–1). */
  share: number;
}

const leaderOf = (s: Pick<GameState, "people">, party: string) => s.people.find((p) => active(p, party) && p.rank === PRESIDENT_RANK && !p.chairman);

/** Who leads a camp in a party: its leader (or you), and up to two ambitious deputies or vice presidents. */
export function patrons(s: Pick<GameState, "people" | "youId">, party: string): Person[] {
  const lead = leaderOf(s, party);
  const you = s.youId !== null ? s.people.find((p) => p.id === s.youId && active(p, party)) : undefined;
  const top = [lead, you && you.rank >= 3 && you.id !== lead?.id ? you : undefined].filter((p): p is Person => !!p);
  const rivals = s.people
    .filter((p) => active(p, party) && (p.rank === 3 || p.rank === 4) && !p.chairman && !top.some((t) => t.id === p.id) && p.ambition >= CAMPS.patronAmbition)
    .sort((a, b) => b.influence + b.ambition - (a.influence + a.ambition))
    .slice(0, CAMPS.maxRivals);
  return [...top, ...rivals];
}

/** "Kem Zahid": a camp is known by its patron's best-known name. */
export function campName(p: Person): string {
  const w = p.name.replace(/@.*$/, "").split(/\s+/).filter((x) => !/^(bin|binti|anak|a\/l|a\/p)$/i.test(x));
  const skip = new Set(["Mohd", "Muhammad", "Muhamad", "Mohamad", "Mohammad", "Mohamed", "Mohammed", "Ahmad", "Abdul", "Ab", "Abd", "Wan", "Nik", "Syed", "Tuan", "Datuk", "Dr", "Haji", "Hj", "Tan", "Sri"]);
  const given = w.find((x) => !skip.has(x)) ?? w[0];
  return `Kem ${given}`;
}

/** Your party's camp members' footprint: the people who count (posts, MPs, division chiefs). */
function counted(s: GameState, party: string): Person[] {
  const chiefs = new Set(party === yourParty(s) ? Object.values(s.divisions ?? {}) : []);
  return s.people.filter((p) => active(p, party) && (p.rank >= 1 || chiefs.has(p.id)));
}

/** Gives everyone who counts a camp (or none), from their loyalty to you and old ties to each patron. */
export function initCamps(s: GameState): GameState {
  const updates = new Map<number, number | null>();
  for (const party of HIERARCHY_PARTIES) {
    const ps = patrons(s, party);
    if (!ps.length) continue;
    const mine = party === yourParty(s);
    const youPatron = mine && ps.some((p) => p.id === s.youId);
    const lead = ps[0];
    const rivals = ps.filter((p) => p.id !== lead.id && p.id !== s.youId);
    for (const p of counted(s, party)) {
      if (ps.some((x) => x.id === p.id)) {
        updates.set(p.id, p.id);
        continue;
      }
      const h = hash01("camp", s.seed, p.id);
      const rival = rivals.length ? rivals[Math.floor(hash01("camprival", s.seed, p.id) * rivals.length)] : undefined;
      let camp: number | null;
      if (mine) {
        // In your party: the loyal are yours, the hostile a rival's; the rest by old ties (a third yours, a quarter a rival's).
        const yourCamp = youPatron ? s.youId! : lead.id;
        camp = p.loyalty >= CAMPS.joinYou ? yourCamp : p.loyalty <= CAMPS.joinRival && rival ? rival.id : h < 0.35 ? yourCamp : h < 0.6 && rival ? rival.id : null;
      } else camp = h < 0.5 ? lead.id : h < 0.8 && rival ? rival.id : null;
      updates.set(p.id, camp);
    }
  }
  return { ...s, people: s.people.map((p) => (updates.has(p.id) ? { ...p, camp: updates.get(p.id) } : p)) };
}

/** The camps of a party and their strength: delegates (your party's divisions) and seats on the Supreme Council. */
export function campsOf(s: GameState, party: string): { camps: Camp[]; unaligned: number; total: number } {
  const ps = patrons(s, party);
  const mine = party === yourParty(s);
  const chiefs = mine ? new Set(Object.values(s.divisions ?? {})) : null;
  const people = counted(s, party);
  // A delegate is a division chief (your party) or any member who counts (elsewhere).
  const delegate = (p: Person) => (chiefs ? chiefs.has(p.id) : p.rank >= 1);
  const total = people.filter(delegate).length || 1;
  const camps: Camp[] = ps.map((pt) => {
    const m = people.filter((p) => p.camp === pt.id);
    const divisions = m.filter(delegate).length;
    return { patron: pt.id, name: campName(pt), yours: pt.id === s.youId, leader: pt.rank === PRESIDENT_RANK, divisions, council: m.filter((p) => p.rank >= 2).length, members: m.length, share: divisions / total };
  });
  const aligned = new Set(ps.map((p) => p.id));
  const unaligned = people.filter((p) => delegate(p) && (p.camp == null || !aligned.has(p.camp))).length;
  return { camps, unaligned, total };
}

/** Monthly: camps lose members whose patron has gone; your party's people drift with their loyalty; rivals recruit. */
export function campsMonth(s: GameState): { state: GameState; lines: ReportLine[] } {
  const lines: ReportLine[] = [];
  if (s.week % 4 !== 3) return { state: s, lines };
  const party = yourParty(s);
  const ps = patrons(s, party);
  const alive = new Set(HIERARCHY_PARTIES.flatMap((pa) => patrons(s, pa).map((p) => p.id)));
  const youPatron = ps.some((p) => p.id === s.youId);
  const yourCamp = youPatron ? s.youId : (ps[0]?.id ?? null);
  // Everyone else's camp is a rival's (the leader's too, when you lead a camp of your own below them).
  const rivals = ps.filter((p) => p.id !== yourCamp);
  let moved = 0;
  let lost = 0;
  const people = s.people.map((p) => {
    let camp = p.camp ?? null;
    if (camp !== null && !alive.has(camp)) camp = null;
    // New patrons lead their own camp.
    if (alive.has(p.id)) camp = p.id;
    else if (p.party === party && !p.retired && yourCamp !== null) {
      const h = hash01("drift", s.seed, s.week, p.id);
      const to = rivals.length ? rivals[Math.floor(hash01("driftto", s.seed, s.week, p.id) * rivals.length)] : undefined;
      // Rivals recruit harder in a divided party, and more so the bigger their patron.
      const pull = to ? (to.influence / 100) * (0.04 + Math.max(0, 70 - s.me.unity) / 400) : 0;
      if (camp !== yourCamp && p.loyalty >= CAMPS.joinYou && h < (camp === null ? 0.3 : 0.12)) {
        camp = yourCamp;
        moved++;
      } else if (camp === yourCamp && p.loyalty < CAMPS.joinRival && to && h < 0.4) {
        camp = to.id;
        lost++;
      } else if (camp === null && p.loyalty < 55 && to && h < pull) camp = to.id;
    }
    return camp === (p.camp ?? null) ? p : { ...p, camp };
  });
  let state: GameState = { ...s, people };
  if (moved) lines.push({ text: `${moved} division chief${moved === 1 ? " joins" : "s join"} your camp.`, tone: "good" });
  if (lost) lines.push({ text: `${lost} of your camp drift${lost === 1 ? "s" : ""} to your rivals.`, tone: "bad" });
  // A rival camp with the numbers: a challenge at the next AGM.
  if (s.career.rung >= 6 && !s.career.challenge) {
    const c = campsOf(state, party);
    const you = c.camps.find((x) => x.patron === yourCamp);
    const top = c.camps.filter((x) => x.patron !== yourCamp).sort((a, b) => b.share - a.share)[0];
    if (top && top.share >= CAMPS.challengeShare && top.share > (you?.share ?? 0)) {
      state = { ...state, career: { ...state.career, challenge: true } };
      lines.push({ text: `${top.name} has the divisions to challenge you: expect a contest at the AGM.`, tone: "bad" });
    }
  }
  return { state, lines };
}

/** How a division chief's camp sways their delegates in a race against `rivals` (added to your chance). */
export function campLean(s: Pick<GameState, "youId">, chief: Person, rivals: (number | null)[]): number {
  if (chief.camp == null) return 0;
  if (chief.camp === s.youId) return 0.25;
  if (rivals.includes(chief.camp)) return -0.35;
  return 0;
}

/** Monthly: each division chief works the ground in their seat, for you or against you. */
export function divisionMachinery(s: GameState): GameState {
  if (s.week % 4 !== 3 || !s.divisions) return s;
  const machinery = [...s.me.machinery];
  for (const [k, id] of Object.entries(s.divisions)) {
    const p = s.people.find((x) => x.id === id);
    if (!p || p.id === s.youId) continue;
    const i = Number(k);
    if (p.loyalty >= 60) machinery[i] *= 1 + Math.max(0, p.competence - 50) * CAMPS.machineryPerPoint;
    else if (p.loyalty < 30) machinery[i] *= 1 - CAMPS.machineryDrag;
  }
  return { ...s, me: { ...s.me, machinery } };
}

// --- Your moves ----------------------------------------------------------------------------------

export function bringBlocked(s: GameState, id: number): string | null {
  const party = yourParty(s);
  const p = s.people.find((x) => x.id === id);
  if (!p || !active(p, party)) return "Only members of your party.";
  if (p.id === s.youId) return "That's you.";
  if (!patrons(s, party).some((x) => x.id === s.youId)) return "You need a camp of your own: Vice President or higher.";
  if (p.camp === s.youId) return "Already in your camp.";
  if (patrons(s, party).some((x) => x.id === p.id)) return "They lead a camp of their own.";
  if (p.loyalty < CAMPS.bring.minLoyalty) return `Needs loyalty ${CAMPS.bring.minLoyalty} (now ${Math.round(p.loyalty)}). Meet them first.`;
  if (s.me.ap < CAMPS.bring.ap) return "Needs 1 AP.";
  if (s.me.capital < CAMPS.bring.capital) return `Needs ${CAMPS.bring.capital} political capital.`;
  return null;
}

/** Bring someone into your camp: they'll deliver their division's delegates to you. Their old patron notices. */
export function bringIntoCamp(s: GameState, id: number): { state: GameState; message: string } | { error: string } {
  const why = bringBlocked(s, id);
  if (why) return { error: why };
  const p = s.people.find((x) => x.id === id)!;
  const old = p.camp != null ? s.people.find((x) => x.id === p.camp) : undefined;
  const people = s.people.map((x) => (x.id === id ? { ...x, camp: s.youId } : old && x.id === old.id ? remember(x, -5, "You took one of my people", s.week) : x));
  return {
    state: { ...s, people, me: { ...s.me, ap: s.me.ap - CAMPS.bring.ap, capital: s.me.capital - CAMPS.bring.capital } },
    message: `${p.name} joins your camp${old ? `, leaving ${campName(old)}` : ""}.`,
  };
}

export function replaceBlocked(s: GameState, seat: number): string | null {
  if (s.career.rung < 6) return "Only the party president can replace a division chief.";
  const p = divisionChief(s, seat);
  if (!p) return "No division here.";
  if (p.id === s.youId) return "That's your own division.";
  if (s.me.capital < CAMPS.replace.capital) return `Needs ${CAMPS.replace.capital} political capital.`;
  return null;
}

/** Replace a division chief with someone from your camp (or a fresh local organiser). The ousted chief goes to your rivals. */
export function replaceChief(s: GameState, seat: number): { state: GameState; message: string } | { error: string } {
  const why = replaceBlocked(s, seat);
  if (why) return { error: why };
  const party = yourParty(s);
  const old = divisionChief(s, seat)!;
  const region = regionOf(SEATS[seat].state);
  const taken = new Set(Object.values(s.divisions ?? {}));
  const rival = patrons(s, party).find((p) => p.id !== s.youId && p.rank !== PRESIDENT_RANK) ?? patrons(s, party).find((p) => p.id !== s.youId);
  let people = s.people;
  let next = s.nextPersonId;
  let pick = s.people
    .filter((p) => active(p, party) && p.seat === null && p.rank >= 1 && p.rank <= 2 && !taken.has(p.id) && p.id !== s.youId && homeOf(p) === region)
    .sort((a, b) => Number(b.camp === s.youId) - Number(a.camp === s.youId) || b.loyalty - a.loyalty)[0];
  if (!pick) {
    pick = { ...recruitPerson(next++, party, s.seed, s.week, s, seat), rank: 1 };
    people = [...people, pick];
  }
  const newId = pick.id;
  people = people.map((p) =>
    p.id === newId
      ? { ...remember(p, CAMPS.replace.fresh, "You made me division chief", s.week), camp: patrons(s, party).some((x) => x.id === s.youId) ? s.youId : p.camp }
      : p.id === old.id
        ? { ...remember(p, old.seat === seat ? CAMPS.replace.mpOusted : CAMPS.replace.ousted, "You took my division from me", s.week), camp: rival?.id ?? null }
        : p,
  );
  return {
    state: { ...s, people, nextPersonId: next, divisions: { ...s.divisions, [seat]: newId }, me: { ...s.me, capital: s.me.capital - CAMPS.replace.capital, unity: clamp(s.me.unity + CAMPS.replace.unity) } },
    message: `${pick.name} takes over the ${SEATS[seat].name} division from ${old.name}${rival ? `, who goes over to ${campName(rival)}` : ""}.`,
  };
}
