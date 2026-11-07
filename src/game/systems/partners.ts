// Your hand over your coalition's minor parties. You lead the coalition, so you allocate its seats, and a partner that
// needs you can be leaned on.
// - Dependence: what a partner would win with you against on its own. It knows the numbers too, so a partner that can't
//   survive alone stays however unhappy it is.
// - Bullying is free. Each move works only on a dependent partner and only once every 26 weeks for each partner.
// - Pressure builds with every move. When it fills, the partner's president apologises; forgive them and the party is
//   obedient until the next general election: it votes with you, takes what it's given and never threatens to leave.
// - Allocation: fair shares, the "best for the coalition" fill, and friendly contests between two partners in a seat.
// All numbers TEMPORARY.

import { hash01 } from "../rng";
import { projectAllFor, type GameState, type ReportLine } from "../state";
import { COALITIONS, PARTIES, SEATS, contestingIn, cshort, seatRegion, type CoalitionId, type Seat } from "../world";
import { AFFINITY } from "./formation";
import { byId, type Person } from "./people";
import { isPresident } from "./career";
import { bestHome, moveParty, seatCandidate } from "./coalitions";
import { yourParty } from "./nominations";
import { standsAside } from "./pacts";
import { carry, talksBlocked } from "./seattalks";

export const BULLY = {
  /** A partner keeps enough seats to leave if it wins this share of its seats with you, on its own or in its best home. */
  surviveShare: 0.6,
  /** Heavily dependent (can be forced to merge): under this share. */
  heavyShare: 0.3,
  /** Weeks before the same move works on the same partner again; how long a warning lasts. */
  cooldown: 26,
  /** Pressure from each move; the apology comes at full pressure, no sooner than `apologyAfter` weeks after the first move. */
  pressure: { warn: 20, strip: 25, cut: 20, poach: 20, rebel: 30, ros: 30 },
  full: 100,
  apologyAfter: 12,
  /** Log-odds lost in a partner's seats when you pull the machinery, and by a party you throw out. */
  cutEffect: 0.3,
  expelEffect: 0.4,
  /** Weeks for a rebel you back to take over a party. */
  rebelWeeks: 12,
  /** MPs and other members taken by one poach. */
  poachMps: 2,
  poachOthers: 2,
  /** "Best for the coalition" moves a seat only if the better party suits it by this much. */
  bestMargin: 0.3,
  /** An open contest costs the coalition this share of its vote in the seat. */
  openVote: 0.08,
  /** Satisfaction per seat under and over fair share when nominations close, and the caps. */
  under: -2,
  underCap: -15,
  over: 1.5,
  overCap: 10,
  /** Pressure per seat under fair share. */
  underPressure: 3,
};

export type BullyMove = "warn" | "expel" | "strip" | "cut" | "poach" | "rebel" | "merge" | "ros";

export const BULLY_MOVES: { id: BullyMove; name: string; blurb: string }[] = [
  { id: "warn", name: "Warn them", blurb: `They stop rebelling and their MPs stop voting against you for ${BULLY.cooldown} weeks.` },
  { id: "strip", name: "Strip their posts", blurb: "Their ministers go, and your party takes the portfolios." },
  { id: "cut", name: "Cut their machinery", blurb: "Coalition money and campaigners leave their seats. Their candidates lose votes." },
  { id: "poach", name: "Poach their people", blurb: `Up to ${BULLY.poachMps} MPs and ${BULLY.poachOthers} other members join your party.` },
  { id: "rebel", name: "Back a rebel", blurb: `A challenger you fund takes over their party within ${BULLY.rebelWeeks} weeks.` },
  { id: "ros", name: "Registrar of Societies", blurb: "Their registration is held up. On nomination day your party takes their seats." },
  { id: "merge", name: "Force a merger", blurb: "A heavily dependent party is absorbed into yours, MPs and seats." },
  { id: "expel", name: "Expel and contest", blurb: "They leave, you stand against them, and they could lose every seat. Their MPs leave your side." },
];

export interface PartnerCtl {
  /** 0–100; an apology comes when it fills. */
  pressure: number;
  /** Week of the first move since the last forgiveness. */
  since?: number;
  /** Week each move was last used. */
  used: Partial<Record<BullyMove, number>>;
  warnedUntil: number;
  /** Coalition machinery has been pulled from their seats. */
  cut: boolean;
  /** Their registration is being held up. */
  ros: boolean;
  /** The week a rebel you back takes over. */
  rebelWeek?: number;
  /** They have apologised: forgive them for their obedience. */
  apology: boolean;
  /** Obedient until the next general election. */
  obedient: boolean;
}

const fresh = (): PartnerCtl => ({ pressure: 0, used: {}, warnedUntil: 0, cut: false, ros: false, apology: false, obedient: false });

export const ctlOf = (s: Pick<GameState, "partnerCtl">, party: string): PartnerCtl => s.partnerCtl?.[party] ?? fresh();

const withCtl = (s: GameState, party: string, ch: Partial<PartnerCtl>): GameState => ({ ...s, partnerCtl: { ...s.partnerCtl, [party]: { ...ctlOf(s, party), ...ch } } });

/** A partner that does as it's told just now: obedient, or under a warning. */
export const tame = (s: Pick<GameState, "partnerCtl" | "week">, party: string) => {
  const c = s.partnerCtl?.[party];
  return !!c && (c.obedient || c.warnedUntil > s.week);
};

export const partnersOf = (s: Pick<GameState, "coalitions" | "player">) => s.coalitions[s.player].members.slice(1);

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

// --- Dependence ----------------------------------------------------------------------------------

export interface Dependence {
  /** Seats it would win with you, and on its own or in its best home. */
  withYou: number;
  alone: number;
  home: CoalitionId;
  dependent: boolean;
  heavy: boolean;
}

const depCache = new WeakMap<GameState, Map<string, Dependence>>();

/** Tests only: fix a party's numbers instead of projecting them. */
let depOverride: ((party: string) => Partial<Dependence> | null) | null = null;
export const overrideDependence = (fn: typeof depOverride) => {
  depOverride = fn;
};

/** What a partner stands to lose: the numbers it weighs before it rebels. */
export function dependence(s: GameState, party: string): Dependence {
  const fixed = depOverride?.(party);
  if (fixed) return { withYou: 3, alone: 0, home: "OTHERS", dependent: true, heavy: false, ...fixed };
  const cached = depCache.get(s)?.get(party);
  if (cached) return cached;
  const proj = projectAllFor(s);
  const withYou = SEATS.filter((seat) => proj[seat.index].leader === s.player && seatCandidate(s, seat, s.player) === party).length;
  const home = bestHome(s, party) ?? "OTHERS";
  const out = moveParty(s, party, home);
  const after = projectAllFor(out);
  const alone = SEATS.filter((seat) => after[seat.index].leader === home && seatCandidate(out, seat, home) === party).length;
  const d: Dependence = { withYou, alone, home, dependent: alone < Math.max(1, withYou * BULLY.surviveShare), heavy: alone < Math.max(1, withYou * BULLY.heavyShare) };
  if (!depCache.has(s)) depCache.set(s, new Map());
  depCache.get(s)!.set(party, d);
  return d;
}

/** Whether an unhappy partner dares to walk out or threaten to. */
export const dares = (s: GameState, party: string) => !tame(s, party) && !dependence(s, party).dependent;

// --- Allocation ----------------------------------------------------------------------------------

const CHINESE = ["DAP", "MCA", "SUPP", "GERAKAN", "PBK"];
const INDIAN = ["MIC", "PPP"];

const sizes = new WeakMap<string[], Map<string, number>>();

/** A party's MPs as a share of the biggest party's (0–1): bigger parties have the name and machinery to stand anywhere. */
function strength(holderParties: string[], party: string): number {
  let m = sizes.get(holderParties);
  if (!m) {
    m = new Map();
    for (const p of holderParties) m.set(p, (m.get(p) ?? 0) + 1);
    sizes.set(holderParties, m);
  }
  return (m.get(party) ?? 0) / Math.max(1, ...m.values());
}

/** How well a party suits a seat: its voters, its region, its size, and whether it holds the seat. */
export function partyFit(s: Pick<GameState, "holderParties">, seat: Seat, party: string): number {
  const e = seat.demo.ethnic;
  const voters = CHINESE.includes(party) ? e.chinese + 0.1 : INDIAN.includes(party) ? e.indian * 2 + 0.05 : party === "PKR" ? 0.5 + Math.min(e.chinese + e.indian, 0.3) : e.malay + (e.sabah ?? 0) + (e.sarawak ?? 0);
  const home = PARTIES[party]?.home;
  const region = seatRegion(seat);
  const local = home === region ? 0.3 : home === "national" || (home === "peninsula" && region === "peninsula") ? 0 : -0.5;
  return Math.max(0, voters + local + strength(s.holderParties, party) * 0.5 + (s.holderParties[seat.index] === party ? 1 : 0));
}

/** Seats your coalition fields a candidate in (not those you've given up in a pact). */
export function coalitionSeats(s: GameState): Seat[] {
  return SEATS.filter((seat) => contestingIn(seat, s.entries).includes(s.player) && !standsAside(s, seat.index, s.player));
}

export interface PartnerShare {
  party: string;
  held: number;
  given: number;
  fair: number;
}

/** Each party's seats against its fair share: the seats it would normally stand in, sitting MPs included. */
export function shares(s: GameState): PartnerShare[] {
  const members = s.coalitions[s.player].members;
  const seats = coalitionSeats(s);
  const usual = (seat: Seat) => (s.holders[seat.index] === s.player ? s.holderParties[seat.index] : seatCandidate({ coalitions: s.coalitions, seatParty: {} }, seat, s.player));
  return members.map((party) => ({
    party,
    held: seats.filter((seat) => s.holders[seat.index] === s.player && s.holderParties[seat.index] === party).length,
    given: seats.filter((seat) => seatCandidate(s, seat, s.player) === party || s.openSeats?.[seat.index]?.includes(party)).length,
    fair: seats.filter((seat) => usual(seat) === party).length,
  }));
}

export function assignBlocked(s: GameState): string | null {
  if (!isPresident(s.career)) return "Only the coalition's leader allocates its seats.";
  return talksBlocked(s);
}

/** Give a coalition seat to any party in the coalition. */
export function assignSeat(s: GameState, seat: number, party: string): { state: GameState; message: string } | { error: string } {
  const why = assignBlocked(s);
  if (why) return { error: why };
  if (!s.coalitions[s.player].members.includes(party)) return { error: "That party isn't in your coalition." };
  if (seat === s.career.homeSeat && party !== yourParty(s)) return { error: "That is your own seat: you stand there." };
  if (standsAside(s, seat, s.player)) return { error: `You stand aside in ${SEATS[seat].name} under a pact.` };
  const rest = { ...s.openSeats };
  delete rest[seat];
  return { state: carry({ ...s, openSeats: rest }, seat, party), message: `${party} stands in ${SEATS[seat].name}.` };
}

/** The coalition's clear mismatches put right: sitting MPs stay, and a seat moves only to a party that plainly suits it better. */
export function bestAllocation(s: GameState): { state: GameState; message: string } | { error: string } {
  const why = assignBlocked(s);
  if (why) return { error: why };
  const members = s.coalitions[s.player].members;
  let state = s;
  let moved = 0;
  for (const seat of coalitionSeats(s)) {
    if (seat.index === s.career.homeSeat) continue;
    const best = [...members].sort((a, b) => partyFit(s, seat, b) - partyFit(s, seat, a))[0];
    const cur = seatCandidate(state, seat, s.player);
    // Only a clear mismatch moves: the usual line-up stands where it fits well enough.
    if (best === cur || partyFit(s, seat, best) - partyFit(s, seat, cur) < BULLY.bestMargin) continue;
    state = carry(state, seat.index, best);
    moved++;
  }
  return moved ? { state, message: `${moved} seat${moved === 1 ? "" : "s"} reallocated to the party that suits each best.` } : { error: "Every seat already suits its party." };
}

/** Let two partners fight it out in a seat (`other` null ends the contest). The stronger of the two carries the flag. */
export function setOpenContest(s: GameState, seat: number, other: string | null): { state: GameState; message: string } | { error: string } {
  const why = assignBlocked(s);
  if (why) return { error: why };
  if (standsAside(s, seat, s.player)) return { error: `You stand aside in ${SEATS[seat].name} under a pact.` };
  const rest = { ...s.openSeats };
  delete rest[seat];
  if (!other) return { state: { ...s, openSeats: rest }, message: `The contest in ${SEATS[seat].name} is off.` };
  const cur = seatCandidate(s, SEATS[seat], s.player);
  if (other === cur || !s.coalitions[s.player].members.includes(other)) return { error: "Pick another party in your coalition." };
  const lead = partyFit(s, SEATS[seat], other) > partyFit(s, SEATS[seat], cur) ? other : cur;
  return { state: carry({ ...s, openSeats: { ...rest, [seat]: [cur, other] } }, seat, lead), message: `${cur} and ${other} fight it out in ${SEATS[seat].name}. The coalition's vote there takes a small hit.` };
}

/** Log-odds per seat for your coalition from pulled machinery and open contests. */
export function partnerSeatEffects(s: GameState): Map<number, number> {
  const out = new Map<number, number>();
  const hit = Math.log(1 - BULLY.openVote);
  for (const k of Object.keys(s.openSeats ?? {})) out.set(Number(k), hit);
  const cut = Object.entries(s.partnerCtl ?? {}).filter(([, c]) => c.cut).map(([p]) => p);
  if (cut.length) for (const seat of SEATS) if (cut.includes(seatCandidate(s, seat, s.player))) out.set(seat.index, (out.get(seat.index) ?? 0) - BULLY.cutEffect);
  return out;
}

/** Nominations close: the registrar's holds take effect, and partners react to what they got. */
export function settleAllocation(s: GameState): { state: GameState; lines: ReportLine[] } {
  const lines: ReportLine[] = [];
  if (!isPresident(s.career) || !partnersOf(s).length) return { state: s, lines };
  let state = s;
  const lead = yourParty(s);
  for (const party of partnersOf(s).filter((p) => ctlOf(s, p).ros)) {
    for (const seat of coalitionSeats(state)) if (seatCandidate(state, seat, s.player) === party) state = carry(state, seat.index, lead);
    lines.push({ text: `${party} can't stand under its own name: its registration is held up, and ${lead} takes its seats.`, tone: "good" });
  }
  for (const row of shares(state)) {
    if (row.party === lead || ctlOf(state, row.party).obedient) continue;
    const d = row.given - row.fair;
    if (!d) continue;
    const change = d < 0 ? Math.max(BULLY.underCap, -d * BULLY.under) : Math.min(BULLY.overCap, d * BULLY.over);
    state = { ...state, partySat: { ...state.partySat, [row.party]: clamp((state.partySat[row.party] ?? 55) + change) } };
    if (d < 0) state = addPressure(state, row.party, -d * BULLY.underPressure);
  }
  return { state, lines };
}

// --- Bullying ------------------------------------------------------------------------------------

function addPressure(s: GameState, party: string, n: number): GameState {
  const c = ctlOf(s, party);
  return withCtl(s, party, { pressure: clamp(c.pressure + n), since: c.since ?? s.week });
}

const postsHeld = (s: GameState, party: string) => (Object.entries(s.cabinet) as [keyof GameState["cabinet"], number][]).filter(([k, id]) => k !== "pm" && byId(s, id)?.party === party);
const poachable = (s: GameState, party: string): Person[] => s.people.filter((p) => p.party === party && !p.retired && p.rank < 5 && !p.chairman);

export function bullyBlocked(s: GameState, party: string, move: BullyMove): string | null {
  if (!isPresident(s.career)) return "Only the coalition's leader can do this.";
  if (!partnersOf(s).includes(party)) return "They aren't in your coalition.";
  const c = ctlOf(s, party);
  const last = c.used[move];
  if (last !== undefined && last > s.week - BULLY.cooldown) return `Used on them recently: ${last + BULLY.cooldown - s.week} weeks to go.`;
  const d = dependence(s, party);
  if (move === "merge") {
    if (!d.heavy) return `${party} isn't dependent enough: it would win ${d.alone} of its ${d.withYou} seats without you.`;
    return null;
  }
  if (!d.dependent) return `${party} doesn't need you: it would win ${d.alone} of its ${d.withYou} seats without you.`;
  if (move === "expel") return null;
  if (c.obedient) return "They're already obedient.";
  if (move === "strip" && !postsHeld(s, party).length) return "They hold no posts.";
  if (move === "cut" && c.cut) return "Their machinery is already cut.";
  if (move === "ros") {
    if (s.parliament.pm !== s.player) return "Only the Prime Minister can lean on the Registrar.";
    if (c.ros) return "Their registration is already held up.";
  }
  if (move === "poach" && !poachable(s, party).length) return "They have no one to take.";
  if (move === "rebel") {
    if (c.rebelWeek !== undefined) return "Your rebel is already at work.";
    if (!poachable(s, party).length) return "They have no one to back.";
  }
  return null;
}

/** Their ministers go; the strongest of your MPs without a post take over. */
function stripPosts(s: GameState, party: string): { state: GameState; n: number } {
  const held = postsHeld(s, party);
  const inCabinet = new Set(Object.values(s.cabinet));
  const mine = s.people.filter((p) => p.party === yourParty(s) && p.seat !== null && !p.retired && !inCabinet.has(p.id) && p.id !== s.youId).sort((a, b) => b.competence - a.competence);
  const cabinet = { ...s.cabinet };
  held.forEach(([k], i) => {
    if (mine[i]) cabinet[k] = mine[i].id;
    else delete cabinet[k];
  });
  return { state: { ...s, cabinet }, n: held.length };
}

/** Under the anti-hopping law an expelled MP keeps the seat, so a partner sacks them and they join you. */
function poach(s: GameState, party: string): { state: GameState; names: string[] } {
  const lead = yourParty(s);
  const pool = poachable(s, party).sort((a, b) => b.influence - a.influence);
  const taken = [...pool.filter((p) => p.seat !== null).slice(0, BULLY.poachMps), ...pool.filter((p) => p.seat === null).slice(0, BULLY.poachOthers)];
  const ids = new Set(taken.map((p) => p.id));
  const holderParties = [...s.holderParties];
  const seatParty = { ...s.seatParty };
  for (const p of taken) {
    if (p.seat === null) continue;
    holderParties[p.seat] = lead;
    seatParty[p.seat] = { ...seatParty[p.seat], [s.player]: lead };
  }
  return { state: { ...s, holderParties, seatParty, people: s.people.map((p) => (ids.has(p.id) ? { ...p, party: lead, rank: Math.min(p.rank, 1), council: undefined, loyalty: clamp(p.loyalty + 25), since: s.week } : p)) }, names: taken.map((p) => p.name) };
}

function clearParty(s: GameState, party: string): GameState {
  const partnerCtl = { ...s.partnerCtl };
  delete partnerCtl[party];
  const openSeats = Object.fromEntries(Object.entries(s.openSeats ?? {}).filter(([, v]) => !v.includes(party)));
  return { ...s, partnerCtl, openSeats };
}

/** A party is absorbed into yours: its people, MPs and seats. */
function merge(s: GameState, party: string): GameState {
  const lead = yourParty(s);
  const holderParties = s.holderParties.map((p) => (p === party ? lead : p));
  const seatParty = Object.fromEntries(Object.entries(s.seatParty).map(([k, v]) => [k, Object.fromEntries(Object.entries(v ?? {}).map(([c, p]) => [c, p === party ? lead : p]))])) as GameState["seatParty"];
  const partySat = { ...s.partySat };
  delete partySat[party];
  const people = s.people.map((p) => (p.party === party ? { ...p, party: lead, rank: Math.min(p.rank, 3), council: undefined, since: s.week } : p));
  const coalitions = { ...s.coalitions, [s.player]: { ...s.coalitions[s.player], members: s.coalitions[s.player].members.filter((p) => p !== party) } };
  return clearParty({ ...s, holderParties, seatParty, partySat, people, coalitions }, party);
}

/** Lean on a partner. Free: the only limits are in `bullyBlocked`. */
export function bully(s: GameState, party: string, move: BullyMove): { state: GameState; message: string } | { error: string } {
  const why = bullyBlocked(s, party, move);
  if (why) return { error: why };
  const name = PARTIES[party]?.name ?? party;
  const stamp = (x: GameState) => withCtl(x, party, { used: { ...ctlOf(x, party).used, [move]: s.week } });
  switch (move) {
    case "warn":
      return { state: addPressure(stamp(withCtl(s, party, { warnedUntil: s.week + BULLY.cooldown })), party, BULLY.pressure.warn), message: `${name} is warned. It falls into line for ${BULLY.cooldown} weeks.` };
    case "strip": {
      const r = stripPosts(s, party);
      return { state: addPressure(stamp(r.state), party, BULLY.pressure.strip), message: `${name} loses ${r.n} post${r.n === 1 ? "" : "s"}. Your party takes the portfolios.` };
    }
    case "cut":
      return { state: addPressure(stamp(withCtl(s, party, { cut: true })), party, BULLY.pressure.cut), message: `The coalition's money and campaigners leave ${name}'s seats.` };
    case "poach": {
      const r = poach(s, party);
      return { state: addPressure(stamp(r.state), party, BULLY.pressure.poach), message: `${r.names.join(", ")} leave${r.names.length === 1 ? "s" : ""} ${name} and join${r.names.length === 1 ? "s" : ""} your party.` };
    }
    case "rebel":
      return { state: addPressure(stamp(withCtl(s, party, { rebelWeek: s.week + BULLY.rebelWeeks })), party, BULLY.pressure.rebel), message: `You back a challenger inside ${name}. Give it ${BULLY.rebelWeeks} weeks.` };
    case "ros":
      return { state: addPressure(stamp(withCtl(s, party, { ros: true })), party, BULLY.pressure.ros), message: `${name}'s registration is held up at the Registrar of Societies.` };
    case "merge": {
      const mps = s.holderParties.filter((p) => p === party).length;
      return { state: merge(s, party), message: `${name} is absorbed into your party with ${mps} MP${mps === 1 ? "" : "s"}.` };
    }
    case "expel": {
      const { home } = dependence(s, party);
      const posts = stripPosts(s, party).state;
      const moved = moveParty(posts, party, home);
      const ti = COALITIONS.indexOf(home);
      const seatOffsets = moved.seatOffsets.map((r) => [...r]);
      for (const seat of SEATS) if (s.holderParties[seat.index] === party || seatCandidate(s, seat, s.player) === party) seatOffsets[seat.index][ti] -= BULLY.expelEffect;
      return { state: clearParty({ ...moved, seatOffsets }, party), message: `${name} is thrown out of the coalition${home === "OTHERS" ? " and stands alone" : ` and goes to ${cshort(home)}`}. You'll fight it in every seat.` };
    }
  }
}

/** Forgive a partner that has apologised: it is obedient until the next general election. */
export function forgive(s: GameState, party: string): { state: GameState; message: string } | { error: string } {
  if (!ctlOf(s, party).apology) return { error: "They haven't come to you yet." };
  const state = withCtl({ ...s, partySat: { ...s.partySat, [party]: Math.max(60, s.partySat[party] ?? 55) } }, party, { apology: false, obedient: true, pressure: 0, since: undefined, cut: false, ros: false, rebelWeek: undefined });
  return { state, message: `You forgive ${PARTIES[party]?.name ?? party}. It will do as it's told until the next general election.` };
}

/** Weekly: a rebel you backed takes over; a party under full pressure comes to apologise. */
export function partnersWeek(s: GameState): { state: GameState; lines: ReportLine[] } {
  const lines: ReportLine[] = [];
  let state = s;
  for (const party of partnersOf(s)) {
    const c = ctlOf(state, party);
    if (c.rebelWeek !== undefined && c.rebelWeek <= s.week) {
      state = withCtl(state, party, { rebelWeek: undefined });
      const old = state.people.find((p) => p.party === party && p.rank === 5 && !p.retired);
      const next = poachable(state, party).sort((a, b) => b.loyalty - a.loyalty || b.influence - a.influence)[0];
      if (next) {
        state = { ...state, people: state.people.map((p) => (p.id === next.id ? { ...p, rank: 5, council: undefined, loyalty: clamp(p.loyalty + 25), since: s.week } : p.id === old?.id ? { ...p, rank: next.rank, since: s.week } : p)) };
        lines.push({ text: `${next.name}, the challenger you backed, takes the presidency of ${party}${old ? ` from ${old.name}` : ""}.`, tone: "good" });
      }
    }
    if (!c.apology && !c.obedient && c.pressure >= BULLY.full && s.week - (c.since ?? s.week) >= BULLY.apologyAfter) {
      state = withCtl(state, party, { apology: true });
      const who = state.people.find((p) => p.party === party && p.rank === 5 && !p.retired);
      lines.push({ text: `${who?.name ?? `${party}'s president`} comes to Seri Perdana to apologise and asks for ${party}'s place back. Forgive them on the coalition board.`, tone: "good" });
    }
  }
  return { state, lines };
}

/** The general election is over: obedience, cuts, holds and contests end. */
export function partnersAfterElection(s: GameState): Pick<GameState, "partnerCtl" | "openSeats" | "rivalPacts"> {
  const partnerCtl = Object.fromEntries(Object.entries(s.partnerCtl ?? {}).map(([p, c]) => [p, { ...c, obedient: false, cut: false, ros: false, apology: false, pressure: 0, since: undefined }]));
  return { partnerCtl, openSeats: {}, rivalPacts: [] };
}

// --- Rival coalitions' pacts ---------------------------------------------------------------------

export interface RivalPact {
  a: CoalitionId;
  b: CoalitionId;
  since: number;
  /** Seat → the coalition that stands aside there. */
  seats: Record<number, CoalitionId>;
}

const RIVAL_PACT = {
  /** Both sides must like each other this much, and this share of friendly pairs sign. */
  affinity: 0.3,
  chance: 0.7,
};

/** Before a general election, friendly rivals on the same side agree not to split the vote. */
export function signRivalPacts(s: GameState): { state: GameState; lines: ReportLine[] } {
  const lines: ReportLine[] = [];
  const rivals = COALITIONS.filter((c) => c !== s.player && c !== "OTHERS" && s.coalitions[c].members.length);
  const pairs: [number, CoalitionId, CoalitionId][] = [];
  for (const a of rivals)
    for (const b of rivals) {
      if (a >= b) continue;
      const x = AFFINITY[a]?.[b] ?? 0;
      const y = AFFINITY[b]?.[a] ?? 0;
      if (x >= RIVAL_PACT.affinity && y >= RIVAL_PACT.affinity && s.government.includes(a) === s.government.includes(b)) pairs.push([x + y, a, b]);
    }
  pairs.sort((p, q) => q[0] - p[0]);
  const proj = projectAllFor(s);
  const taken = new Set<CoalitionId>();
  const rivalPacts: RivalPact[] = [];
  for (const [, a, b] of pairs) {
    if (taken.has(a) || taken.has(b) || hash01("rivalpact", s.seed, s.week, a, b) > RIVAL_PACT.chance) continue;
    const seats: Record<number, CoalitionId> = {};
    for (const seat of SEATS) {
      const list = contestingIn(seat, s.entries);
      if (!list.includes(a) || !list.includes(b)) continue;
      const h = s.holders[seat.index];
      const sh = proj[seat.index].shares;
      seats[seat.index] = h === a ? b : h === b ? a : (sh[a] ?? 0) >= (sh[b] ?? 0) ? b : a;
    }
    if (!Object.keys(seats).length) continue;
    taken.add(a).add(b);
    rivalPacts.push({ a, b, since: s.week, seats });
    lines.push({ text: `${cshort(a)} and ${cshort(b)} sign a seat pact: one candidate against you in ${Object.keys(seats).length} seats.`, tone: "bad" });
  }
  return { state: { ...s, rivalPacts }, lines };
}

/** Pacts with a coalition that has no parties left are over. */
/** A party changed coalition, bringing these seats: its new side no longer stands aside against its own MPs. */
export function pactsAfterMove<T extends Pick<GameState, "pacts" | "rivalPacts">>(s: T, seats: number[], to: CoalitionId): T {
  const keep = <P extends { seats: Record<number, CoalitionId> }>(p: P): P => ({ ...p, seats: Object.fromEntries(Object.entries(p.seats).filter(([k, out]) => !(out === to && seats.includes(Number(k))))) as Record<number, CoalitionId> });
  return { ...s, pacts: s.pacts.map(keep), rivalPacts: (s.rivalPacts ?? []).map(keep) };
}

export function dropDeadPacts<T extends Pick<GameState, "pacts" | "rivalPacts" | "coalitions">>(s: T): T {
  const alive = (c: CoalitionId) => s.coalitions[c].members.length > 0;
  return { ...s, pacts: s.pacts.filter((p) => alive(p.with)), rivalPacts: (s.rivalPacts ?? []).filter((p) => alive(p.a) && alive(p.b)) };
}
