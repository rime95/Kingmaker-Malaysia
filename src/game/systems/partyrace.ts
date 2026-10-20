// Party elections as a game. Four weeks before the June AGM the race opens; you court delegates while your rivals do too.
// - Division election (Ketua Cawangan → Ketua Bahagian): your division's branches vote.
// - Vice President (Minister → VP): the party's divisions each send a delegation; the top three candidates win.
// - President (VP → President), or defending the presidency against a challenger.
// Delegates follow their division chief: a chief loyal to you brings their division with them, a hostile one takes it
// to your rival, and the undecided go to whoever worked harder. So the people you met and helped all year matter.
// Money politics buys delegates fast and raises MACC risk. Votes are drawn with hash01 (no game-RNG draws).
// All numbers TEMPORARY.

import { weekDate } from "../bases";
import { hash01 } from "../rng";
import type { GameState, ReportLine } from "../state";
import { SEATS } from "../world";
import { CONTEST_POINTS, MP, PRESIDENT, RUNGS, addPoints, factionSize, promote } from "./career";
import { makeName, recruitBloc } from "./names";
import { PRESIDENT_RANK, promoteTo, type Person } from "./people";

export type RaceKind = "division" | "vp" | "president" | "defend";

export interface RaceRival {
  /** Person id, or null for a local rival who isn't in the national roster. */
  id: number | null;
  name: string;
  effort: number;
}

export interface Tally {
  label: string;
  /** -1 = you, otherwise the rival's index. */
  to: number;
}

export interface PartyRace {
  kind: RaceKind;
  /** The post at stake. */
  post: string;
  startWeek: number;
  voteWeek: number;
  rivals: RaceRival[];
  /** Your campaigning. */
  effort: number;
  /** Money spent on "gifts" to delegates. */
  money: number;
  result: { tally: Tally[]; votes: number[]; you: number; won: boolean } | null;
}

export const RACE = {
  weeks: 4,
  /** Division elections: branches in your division. */
  branches: 24,
  /** National elections: at least this many divisions vote. */
  minDivisions: 60,
  court: { ap: 1, cost: 150_000, effort: 8 },
  posts: { ap: 1, capital: 10, effort: 10, unity: -2 },
  money: { ap: 0, cost: 1_000_000, effort: 18, risk: 12, integrity: -4 },
  faction: { ap: 1, perMp: 0.6 },
  /** Rivals' weekly campaigning: their standing ÷ this, plus a little luck. */
  rivalDivisor: 10,
  vpSeats: 3,
};

const KIND_FOR_RUNG: Partial<Record<number, RaceKind>> = { 0: "division", 4: "vp", 5: "president" };

/** Is this the week the race opens (mid-May, four weeks before the June AGM)? */
export function raceOpens(week: number): boolean {
  const d = weekDate(week);
  return d.getMonth() === 4 && d.getDate() >= 11 && d.getDate() <= 17;
}

/** What you could stand for this year, if anything. */
export function raceOnOffer(s: GameState): RaceKind | null {
  const c = s.career;
  if (c.rung >= PRESIDENT) return c.challenge ? "defend" : null;
  const kind = KIND_FOR_RUNG[c.rung];
  if (!kind || c.rung === MP - 1) return null;
  return c.points >= CONTEST_POINTS[c.rung] ? kind : null;
}

const lead = (s: GameState) => s.coalitions[s.player].members[0];

/** Opens a race: who you face depends on the post. */
export function startRace(s: GameState, kind: RaceKind): PartyRace {
  const party = lead(s);
  const ppl = s.people.filter((p) => p.party === party && p.id !== s.youId && !p.retired);
  let rivals: RaceRival[];
  if (kind === "division") {
    const seat = SEATS[s.career.homeSeat];
    rivals = [{ id: null, name: makeName(recruitBloc(party, seat.demo.ethnic, s.seed, "div", s.week), s.seed, "divrival", s.week), effort: 10 }];
  } else if (kind === "vp") {
    rivals = ppl
      .filter((p) => p.rank === 3 || p.rank === 2)
      .sort((a, b) => b.rank - a.rank || b.influence - a.influence)
      .slice(0, 4)
      .map((p) => ({ id: p.id, name: p.name, effort: p.influence / 4 }));
  } else if (kind === "president") {
    const pres = ppl.find((p) => p.rank === PRESIDENT_RANK);
    rivals = pres ? [{ id: pres.id, name: pres.name, effort: pres.influence / 3 }] : [];
  } else {
    const challenger = [...ppl.filter((p) => p.rank === 4 || p.rank === 3)].sort((a, b) => b.ambition + b.influence - (a.ambition + a.influence))[0];
    rivals = challenger ? [{ id: challenger.id, name: challenger.name, effort: challenger.influence / 3 }] : [];
  }
  const post = kind === "defend" ? RUNGS[PRESIDENT] : RUNGS[s.career.rung + 1];
  return { kind, post, startWeek: s.week, voteWeek: s.week + RACE.weeks, rivals, effort: 0, money: 0, result: null };
}

/** The delegations that vote: your division's branches, or the party's divisions led by its chiefs. */
function delegations(s: GameState, race: PartyRace): { label: string; chief: Person | null }[] {
  if (race.kind === "division") return Array.from({ length: RACE.branches }, (_, i) => ({ label: `Cawangan ${i + 1}`, chief: null }));
  const party = lead(s);
  const chiefs = s.people.filter((p) => p.party === party && p.id !== s.youId && p.rank >= 1 && !race.rivals.some((r) => r.id === p.id));
  const out = chiefs.map((p) => ({ label: p.seat !== null ? `Bahagian ${SEATS[p.seat].name}` : `${p.name}'s division`, chief: p as Person | null }));
  for (let i = 0; out.length < RACE.minDivisions; i++) {
    const seat = SEATS[Math.floor(hash01("div", s.seed, party, i) * SEATS.length)];
    out.push({ label: `Bahagian ${seat.name}`, chief: null });
  }
  return out;
}

/** Your chance with one delegation. */
function leanToYou(s: GameState, race: PartyRace, chief: Person | null): number {
  const rivalEffort = race.rivals.reduce((m, r) => Math.max(m, r.effort), 0);
  let p = 0.5 + (race.effort - rivalEffort) / 120;
  const need = race.kind === "defend" ? 0 : (CONTEST_POINTS[s.career.rung] ?? 0);
  p += Math.max(-0.15, Math.min(0.15, (s.career.points - need) / 200));
  p += (s.me.unity - 60) / 400;
  if (chief) p += chief.loyalty >= 60 ? 0.3 : chief.loyalty <= 30 ? -0.3 : 0;
  if (race.kind === "defend") p += 0.05; // incumbency
  return Math.max(0.03, Math.min(0.97, p));
}

/** Expected share of delegations leaning your way today (shown while you campaign). */
export function raceOutlook(s: GameState, race: PartyRace): number {
  const d = delegations(s, race);
  return d.reduce((sum, x) => sum + leanToYou(s, race, x.chief), 0) / Math.max(1, d.length);
}

/** Weekly while the race is on: rivals campaign; on AGM week the delegates vote. */
export function raceWeek(s: GameState): { state: GameState; lines: ReportLine[] } {
  const race = s.race;
  const lines: ReportLine[] = [];
  if (!race || race.result) return { state: s, lines };
  const rivals = race.rivals.map((r, i) => {
    const p = r.id !== null ? s.people.find((x) => x.id === r.id) : undefined;
    return { ...r, effort: r.effort + (p ? p.influence : 30) / RACE.rivalDivisor + hash01("rival", s.seed, s.week, i) * 3 };
  });
  let state: GameState = { ...s, race: { ...race, rivals } };
  if (s.week >= race.voteWeek) state = countVotes(state, lines);
  return { state, lines };
}

function countVotes(s: GameState, lines: ReportLine[]): GameState {
  const race = s.race!;
  const d = delegations(s, race);
  const tally: Tally[] = d.map((x, i) => {
    const you = hash01("vote", s.seed, s.week, i) < leanToYou(s, race, x.chief);
    if (you) return { label: x.label, to: -1 };
    // Among rivals, each delegation leans to the one who worked hardest (with some luck).
    let best = 0;
    let bestV = -1;
    race.rivals.forEach((r, k) => {
      const v = r.effort * (0.6 + hash01("rv", s.seed, s.week, i, k) * 0.8);
      if (v > bestV) {
        bestV = v;
        best = k;
      }
    });
    return { label: x.label, to: best };
  });
  const votes = race.rivals.map((_, k) => tally.filter((t) => t.to === k).length);
  const you = tally.filter((t) => t.to === -1).length;
  // VP: three seats, and every delegation has three votes. You win with a top-three finish.
  let won: boolean;
  if (race.kind === "vp") {
    const totals = race.rivals.map((r, k) => votes[k] * 2 + Math.round((d.length - you) * 0.35 * (r.effort / Math.max(1, race.rivals.reduce((m, x) => m + x.effort, 0)))));
    const yourTotal = you * 3;
    won = totals.filter((t) => t > yourTotal).length < RACE.vpSeats;
  } else won = you > Math.max(0, ...votes);
  let state: GameState = { ...s, race: { ...race, result: { tally, votes, you, won } } };
  let c = state.career;
  let me = state.me;
  if (race.kind === "defend") {
    if (won) {
      c = { ...c, challenge: false, log: [{ week: s.week, text: `${c.name} survives a leadership challenge from ${race.rivals[0]?.name}.` }, ...c.log].slice(0, 30) };
      me = { ...me, unity: Math.min(100, me.unity + 10) };
      lines.push({ text: `You beat ${race.rivals[0]?.name} by ${you} delegations to ${votes[0]}. The party closes ranks.`, tone: "good" });
    } else {
      c = { ...c, rung: PRESIDENT - 1, challenge: false, log: [{ week: s.week, text: `${c.name} is ousted by ${race.rivals[0]?.name}.` }, ...c.log].slice(0, 30) };
      // The winner takes over at the top.
      const winner = race.rivals[0]?.id;
      if (winner != null) state = promoteTo(state, winner, PRESIDENT_RANK, lines);
      lines.push({ text: `${race.rivals[0]?.name} wins the party vote (${votes[0]} to ${you}). You drop back to Vice President.`, tone: "bad" });
    }
  } else if (won) {
    c = promote(c, s.week, `${c.name} wins the party vote: now ${race.post}.`);
    lines.push({ text: `You win the party vote and become ${race.post}${race.kind === "vp" ? "" : ` (${you} to ${Math.max(0, ...votes)})`}.`, tone: "good" });
  } else {
    c = addPoints(c, s.week, -Math.round(c.points * 0.2), `lost the contest for ${race.post}`);
    me = { ...me, unity: Math.max(0, me.unity - 6) };
    lines.push({ text: `You lose the party vote for ${race.post}. Try again next year.`, tone: "bad" });
  }
  // Money politics leaves a trail.
  if (race.money >= 2_000_000) me = { ...me, scandal: Math.min(100, me.scandal + 8) };
  return { ...state, career: c, me };
}

export type RaceMove = "court" | "posts" | "money" | "faction";

export function raceMoveBlocked(s: GameState, move: RaceMove): string | null {
  const race = s.race;
  if (!race || race.result) return "No party election is under way.";
  if (move === "court") return s.me.ap < RACE.court.ap ? "Needs 1 AP." : s.me.funds < RACE.court.cost ? "Not enough money." : null;
  if (move === "posts") return s.me.ap < RACE.posts.ap ? "Needs 1 AP." : s.me.capital < RACE.posts.capital ? "Not enough political capital." : null;
  if (move === "money") return s.me.funds < RACE.money.cost ? "Not enough money." : null;
  return s.me.ap < RACE.faction.ap ? "Needs 1 AP." : null;
}

/** One campaign move in a party election. */
export function raceMove(s: GameState, move: RaceMove): { state: GameState; message: string } | { error: string } {
  const why = raceMoveBlocked(s, move);
  if (why) return { error: why };
  const race = s.race!;
  let me = { ...s.me };
  let effort = race.effort;
  let money = race.money;
  let message = "";
  if (move === "court") {
    me = { ...me, ap: me.ap - 1, funds: me.funds - RACE.court.cost };
    effort += RACE.court.effort;
    message = "You tour the divisions, meeting delegates over teh tarik.";
  } else if (move === "posts") {
    me = { ...me, ap: me.ap - 1, capital: me.capital - RACE.posts.capital, unity: Math.max(0, me.unity + RACE.posts.unity) };
    effort += RACE.posts.effort;
    message = "You promise posts to division chiefs who back you.";
  } else if (move === "money") {
    me = { ...me, funds: me.funds - RACE.money.cost, risk: Math.min(100, me.risk + RACE.money.risk), integrity: Math.max(0, me.integrity + RACE.money.integrity) };
    effort += RACE.money.effort;
    money += RACE.money.cost;
    message = "Envelopes change hands. Delegates are suddenly very friendly.";
  } else {
    const faction = factionSize(s.career, s.holders, s.player);
    me = { ...me, ap: me.ap - 1 };
    effort += Math.round(4 + faction * RACE.faction.perMp);
    message = `Your faction of ${faction} MPs works the phones for you.`;
  }
  return { state: { ...s, me, race: { ...race, effort, money } }, message };
}
