// AI rival parties. Each rival coalition earns money, picks the seats worth fighting for (close ones it could win
// or lose), campaigns there with the same tools as the player, saves its buzz for the run-up to the election, and
// reacts to you: it defends seats where you are campaigning and, if hostile, attacks you nationally.
// Allies in the government bloc leave your seats mostly alone unless coalition trust collapses.
// Draws only from hash01, so the weekly random sequence is unchanged. All numbers TEMPORARY.

import { AI, DECAY, ECONOMY, EFFECT, PRN, START } from "../config";
import { serviceBase } from "../bases";

import { hash01 } from "../rng";
import type { Projection } from "../voter";
import { COALITIONS, contestingIn, cshort, SEATS, STATE_BY_ID, type CoalitionId } from "../world";

export type Mood = "confident" | "rattled" | "desperate";

export interface Rival {
  funds: number;
  members: number;
  buzz: number[];
  service: number[];
  nationalBuzz: number;
  /** 0–100, recalculated monthly from projected seats and money. */
  strength: number;
  mood: Mood;
  startSeats: number;
  /** Seats it worked on this month (most recent first). */
  targets: number[];
  /** Short descriptions of its latest moves. */
  recent: string[];
}

export type Rivals = Partial<Record<CoalitionId, Rival>>;

/** Every coalition except yours and the independents. */
export function rivalIds(player: CoalitionId): CoalitionId[] {
  return COALITIONS.filter((c) => c !== player && c !== "OTHERS");
}

export function initRivals(player: CoalitionId): Rivals {
  const out: Rivals = {};
  for (const c of rivalIds(player)) {
    out[c] = {
      funds: START[c].funds,
      members: START[c].members,
      buzz: SEATS.map(() => 0),
      service: SEATS.map((s) => serviceBase(c, s.index)),
      nationalBuzz: 0,
      strength: 50,
      mood: "confident",
      startSeats: SEATS.filter((s) => s.ge15Coalition === c).length,
      targets: [],
      recent: [],
    };
  }
  return out;
}

/** A rival's extra log-odds in one seat (relative to its starting presence). */
export function rivalSeatEffect(r: Rival, c: CoalitionId, i: number): number {
  return (r.service[i] - serviceBase(c, i)) * EFFECT.service + r.buzz[i] * EFFECT.buzz;
}

export function rivalNationalEffect(r: Rival): number {
  return r.nationalBuzz * EFFECT.nationalBuzz;
}

/** Is this rival out to get you? Opposition rivals always are; government partners only when trust collapses. */
export function isHostile(c: CoalitionId, player: CoalitionId, trust: number, government: CoalitionId[]): boolean {
  const sameSide = government.includes(c) === government.includes(player);
  return !sameSide || trust < AI.allyTrustFloor;
}

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
const addBuzz = (b: number, gain: number) => clamp(b + gain * (1 - b / 120));

export interface RivalsWeekInput {
  rivals: Rivals;
  player: CoalitionId;
  playerTrust: number;
  playerBuzz: number[];
  holders: CoalitionId[];
  week: number;
  seed: number;
  projections: Projection[];
  /** Weeks until the next general election polling day. */
  weeksToElection: number;
  /** States holding a state election campaign right now. */
  campaignStates: string[];
  /** Ruling coalition of each state. */
  rulers: Record<string, CoalitionId>;
  /** Coalitions in the federal government. */
  government: CoalitionId[];
  /** Difficulty multiplier on rival moves. */
  aggression?: number;
}

export interface RivalsWeekResult {
  rivals: Rivals;
  /** Damage to you from attack ads. */
  playerBuzzHit: number;
  playerScandalHit: number;
  lines: { text: string; tone: "good" | "bad" | "info" }[];
}

const MOOD_LABEL: Record<Mood, string> = { confident: "confident", rattled: "rattled", desperate: "desperate" };

export function rivalsWeek(input: RivalsWeekInput): RivalsWeekResult {
  const { player, holders, week, seed, projections } = input;
  const out: Rivals = {};
  const lines: RivalsWeekResult["lines"] = [];
  let playerBuzzHit = 0;
  let playerScandalHit = 0;
  const toGo = input.weeksToElection;
  const phase = toGo <= AI.lateWeeks ? "late" : toGo <= AI.midWeeks ? "mid" : "early";
  const moves = Math.round((phase === "late" ? AI.movesLate : phase === "mid" ? AI.movesMid : AI.movesEarly) * AI.aggression * (input.aggression ?? 1));

  for (const c of rivalIds(player)) {
    const prev = input.rivals[c];
    if (!prev) continue;
    const r: Rival = { ...prev, buzz: [...prev.buzz], service: [...prev.service], targets: [], recent: [...prev.recent] };
    const hostile = isHostile(c, player, input.playerTrust, input.government);
    const gov = input.government.includes(c);

    // Money: dues and seat allocations in, HQ out
    const held = holders.filter((h) => h === c).length;
    r.funds += r.members * ECONOMY.duesPerMember + held * (gov ? ECONOMY.seatIncomeGov : ECONOMY.seatIncomeOpp) - (ECONOMY.hqFixed + r.members * ECONOMY.hqPerMember);
    const governs = Object.entries(input.rulers).filter(([, ruler]) => ruler === c).map(([id]) => id);
    for (const id of governs) r.funds += STATE_BY_ID[id].dunSeats * PRN.stateIncomePerSeat;

    // Fading, as for the player
    for (let i = 0; i < SEATS.length; i++) {
      r.buzz[i] *= 1 - DECAY.buzz;
      const base = serviceBase(c, i);
      if (r.service[i] > base) r.service[i] -= (r.service[i] - base) * DECAY.service;
    }
    r.nationalBuzz *= 1 - DECAY.nationalBuzz;
    for (const seat of SEATS) if (governs.includes(seat.state)) r.service[seat.index] = clamp(r.service[seat.index] + PRN.stateServicePerWeek);

    // Which seats are worth fighting for?
    const scored: { i: number; u: number; defend: boolean }[] = [];
    for (const seat of SEATS) {
      const i = seat.index;
      if (!contestingIn(seat).includes(c)) continue;
      const p = projections[i];
      const mine = p.shares[c] ?? 0;
      let u = 0;
      let defend = false;
      if (p.leader === c) {
        const gap = mine - (p.runnerUp ? p.shares[p.runnerUp]! : 0);
        if (gap < AI.defendGap) {
          defend = true;
          // React to you: defend harder where you are campaigning.
          const threat = p.runnerUp === player ? 1 + input.playerBuzz[i] / 40 : 1;
          u = (AI.defendGap - gap) * 10 * threat;
        }
      } else {
        const gap = (p.shares[p.leader] ?? 0) - mine;
        if (gap < AI.attackGap) {
          // React to you: a seat you have just pulled ahead in is worth more to win back.
          const weight = p.leader === player ? (hostile ? AI.hostileWeight * (1 + input.playerBuzz[i] / 40) : AI.allyWeight) : 1;
          u = (AI.attackGap - gap) * 10 * weight;
        }
      }
      if (input.campaignStates.includes(seat.state)) u *= PRN.aiFocus;
      if (u > 0) scored.push({ i, u: u + hash01("ai", seed, week, c, i) * 0.05, defend });
    }
    scored.sort((a, b) => b.u - a.u);

    // Spend: build permanent service early, switch to buzz as the election nears
    const spent: string[] = [];
    let onYourSeats = 0;
    const can = (cost: number) => r.funds - cost >= AI.reserve;
    for (const t of scored.slice(0, moves)) {
      if (r.mood === "desperate" && phase !== "early" && can(AI.handout.cost)) {
        r.funds -= AI.handout.cost;
        r.buzz[t.i] = addBuzz(r.buzz[t.i], AI.handout.buzz * (1 - 0.6 * SEATS[t.i].demo.urbanity));
      } else if (phase === "early" && !input.campaignStates.includes(SEATS[t.i].state) && can(AI.service.cost)) {
        r.funds -= AI.service.cost;
        r.service[t.i] = clamp(r.service[t.i] + AI.service.gain);
      } else if (can(AI.ceramah.cost)) {
        r.funds -= AI.ceramah.cost;
        r.buzz[t.i] = addBuzz(r.buzz[t.i], AI.ceramah.buzz);
      } else break;
      r.targets.push(t.i);
      spent.push(SEATS[t.i].name);
      if (holders[t.i] === player) onYourSeats++;
    }

    // National campaign in the run-up, and attack ads on you when hostile
    if ((phase === "late" || (phase === "mid" && week % 2 === 0)) && can(AI.media.cost * 4)) {
      r.funds -= AI.media.cost;
      r.nationalBuzz = addBuzz(r.nationalBuzz, AI.media.buzz);
      spent.push("a national media blitz");
    }
    // Head-to-head seats: you and this rival are the top two
    const rivalry = projections.filter((p) => (p.leader === c && p.runnerUp === player) || (p.leader === player && p.runnerUp === c)).length;
    const baseChance = phase === "early" ? 0.08 : r.mood === "confident" ? 0.2 : 0.4;
    const attackWeek = hash01("attack", seed, week, c) < baseChance * Math.min(1, rivalry / AI.attackRivalrySeats);
    if (hostile && attackWeek && can(AI.attack.cost)) {
      r.funds -= AI.attack.cost;
      playerBuzzHit += AI.attack.playerBuzz;
      playerScandalHit += AI.attack.playerScandal;
      lines.push({ text: `${cshort(c)} ran attack ads against ${cshort(player)}.`, tone: "bad" });
      spent.push("attack ads against you");
    }

    if (onYourSeats > 0 && week % 4 === 0) {
      const names = r.targets.filter((i) => holders[i] === player).map((i) => SEATS[i].name);
      lines.push({ text: `${cshort(c)} is working your seats: ${names.slice(0, 3).join(", ")}${names.length > 3 ? ` and ${names.length - 3} more` : ""}.`, tone: hostile ? "bad" : "info" });
    }
    if (spent.length) r.recent = [`Week ${week + 1}: ${spent.slice(0, 4).join(", ")}${spent.length > 4 ? "…" : ""}`, ...r.recent].slice(0, 5);

    // Strength and mood, monthly
    if (week % 4 === 0 && week > 0) {
      const now = SEATS.filter((s) => projections[s.index].leader === c).length;
      const seatTerm = ((now - r.startSeats) / Math.max(3, r.startSeats)) * 50;
      const moneyTerm = Math.max(-20, Math.min(20, ((r.funds - START[c].funds) / START[c].funds) * 20));
      r.strength = Math.round(clamp(50 + seatTerm + moneyTerm));
      const mood: Mood = r.strength >= 45 ? "confident" : r.strength >= 30 ? "rattled" : "desperate";
      if (mood !== prev.mood) lines.push({ text: `${cshort(c)} is now ${MOOD_LABEL[mood]} (strength ${r.strength}).`, tone: "info" });
      r.mood = mood;
    }
    out[c] = r;
  }
  return { rivals: out, playerBuzzHit, playerScandalHit, lines };
}

