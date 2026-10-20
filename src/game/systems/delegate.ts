// Delegation: staff you trust run the routine part of their job on their own each week, paid from the war chest.
// - Political secretary: collects the opportunity bubbles you left on the map.
// - Ground organiser: builds machinery in your closest battleground seats.
// - Fundraiser: holds a fundraising dinner every four weeks (donors still tire of being asked).
// - Strategist: re-polls battleground seats whose numbers have gone stale, at half price.
// - Press secretary: fights the scandal of the week. Legal adviser: cleans up when MACC risk climbs.
// - Social media lead: targets young voters in battleground seats.
// Better staff do more. Nobody spends the war chest below the reserve. All numbers TEMPORARY.

import { ECONOMY } from "../config";
import type { GameState, ReportLine } from "../state";
import { SEATS, contestingIn } from "../world";
import { applyBubble } from "./bubbles";
import { POLLS, bestRead, commissionedRead, winChance } from "./polls";
import { pollError, type Role } from "./team";
import type { Projection } from "../voter";

export const DELEGATE = {
  /** Staff stop spending below this war chest. */
  reserve: 1_000_000,
  machinery: { cost: 40_000, gain: 8, cap: 70 },
  dinnerEvery: 4,
  pollShare: 0.5,
  pollStale: 8,
  press: { scandal: 15, perSkill: 2, cost: 30_000 },
  legal: { risk: 45, perSkill: 2, cost: 20_000 },
  social: { buzz: 3, cost: 15_000 },
};

/** What each job does when delegated (shown on the Team panel). */
export const DELEGATE_TEXT: Record<Role, (skill: number) => string> = {
  polsec: () => "Collects the opportunity bubbles you miss",
  organiser: (k) => `Builds machinery in ${k} battleground seat${k === 1 ? "" : "s"} a week`,
  fundraiser: () => "Holds a fundraising dinner every four weeks",
  strategist: (k) => `Re-polls ${k} stale battleground seat${k === 1 ? "" : "s"} a month at half price`,
  press: (k) => `Fights scandals over ${DELEGATE.press.scandal} (−${k * DELEGATE.press.perSkill} a week)`,
  legal: (k) => `Cleans up when MACC risk passes ${DELEGATE.legal.risk} (−${k * DELEGATE.legal.perSkill} a week)`,
  social: (k) => `Targets young voters in ${k} battleground seat${k === 1 ? "" : "s"} a week`,
};

/** Your closest races: seats you contest where your chance is nearest a coin flip. */
function battlegrounds(s: GameState, projections: Projection[]): number[] {
  const err = pollError(s);
  return SEATS.filter((seat) => contestingIn(seat).includes(s.player))
    .map((seat) => ({ i: seat.index, c: winChance(bestRead(s.polls, projections, s.seed, seat.index, s.week, err), s.player, s.week) ?? 0 }))
    .filter((x) => x.c > 0.2 && x.c < 0.8)
    .sort((a, b) => Math.abs(a.c - 0.5) - Math.abs(b.c - 0.5))
    .map((x) => x.i);
}

const clamp = (v: number) => Math.min(100, Math.max(0, v));

/** Runs every delegated job once. Called at the start of the weekly turn. */
export function delegateWeek(s: GameState, projections: Projection[]): { state: GameState; lines: ReportLine[] } {
  const lines: ReportLine[] = [];
  const staff = s.team.filter((x) => x.auto);
  if (!staff.length) return { state: s, lines };
  let state: GameState = { ...s, me: { ...s.me, buzz: [...s.me.buzz], machinery: [...s.me.machinery] } };
  const spend = (cost: number) => {
    if (state.me.funds - cost < DELEGATE.reserve) return false;
    state.me.funds -= cost;
    return true;
  };
  const fights = battlegrounds(s, projections);
  for (const x of staff) {
    const k = x.skill;
    const first = x.name.split(" ")[0];
    switch (x.role) {
      case "polsec": {
        const n = state.bubbles.length;
        for (const b of state.bubbles) state = applyBubble(state, b);
        if (n) lines.push({ text: `${first} collected ${n} opportunit${n === 1 ? "y" : "ies"} you missed.`, tone: "good" });
        break;
      }
      case "organiser": {
        const seats = fights.filter((i) => state.me.machinery[i] < DELEGATE.machinery.cap).slice(0, k);
        let done = 0;
        for (const i of seats) {
          if (!spend(DELEGATE.machinery.cost)) break;
          state.me.machinery[i] = clamp(state.me.machinery[i] + DELEGATE.machinery.gain);
          done++;
        }
        if (done) lines.push({ text: `${first} built machinery in ${seats.slice(0, done).map((i) => SEATS[i].name).join(", ")}.`, tone: "info" });
        break;
      }
      case "fundraiser": {
        if (s.week % DELEGATE.dinnerEvery !== 0) break;
        const raised = Math.round((200_000 + state.me.members * 0.1) * (1 - state.me.fundFatigue) * (0.6 + k * 0.15));
        state.me.funds += raised;
        state.me.fundFatigue = Math.min(0.9, state.me.fundFatigue + ECONOMY.fatiguePerDinner);
        lines.push({ text: `${first} held a fundraising dinner: RM ${raised.toLocaleString("en-MY")}.`, tone: "good" });
        break;
      }
      case "strategist": {
        if (s.week % 4 !== 0) break;
        const stale = fights.filter((i) => {
          const r = state.polls.seats[i];
          return !r || r.source !== "poll" || s.week - r.week > DELEGATE.pollStale;
        });
        const seatsPolled: number[] = [];
        const seats = [...state.polls.seats];
        for (const i of stale.slice(0, k)) {
          if (!spend(POLLS.seatCost * DELEGATE.pollShare)) break;
          seats[i] = commissionedRead(projections[i], s.seed, s.week, i, state.me.machinery[i], pollError(state));
          seatsPolled.push(i);
        }
        state = { ...state, polls: { ...state.polls, seats } };
        if (seatsPolled.length) lines.push({ text: `${first} polled ${seatsPolled.map((i) => SEATS[i].name).join(", ")}.`, tone: "info" });
        break;
      }
      case "press": {
        if (state.me.scandal <= DELEGATE.press.scandal || !spend(DELEGATE.press.cost)) break;
        state.me.scandal = clamp(state.me.scandal - k * DELEGATE.press.perSkill);
        lines.push({ text: `${first} spent the week rebutting the papers. Scandal down.`, tone: "info" });
        break;
      }
      case "legal": {
        if (state.me.risk <= DELEGATE.legal.risk || !spend(DELEGATE.legal.cost)) break;
        state.me.risk = clamp(state.me.risk - k * DELEGATE.legal.perSkill);
        lines.push({ text: `${first} tidied up the party's paperwork. MACC risk down.`, tone: "info" });
        break;
      }
      case "social": {
        const young = [...fights].sort((a, b) => SEATS[b].demo.youth - SEATS[a].demo.youth).slice(0, k);
        let done = 0;
        for (const i of young) {
          if (!spend(DELEGATE.social.cost)) break;
          state.me.buzz[i] = clamp(state.me.buzz[i] + DELEGATE.social.buzz);
          done++;
        }
        if (done) lines.push({ text: `${first}'s campaign trended in ${done} seat${done === 1 ? "" : "s"}.`, tone: "info" });
        break;
      }
    }
  }
  return { state, lines };
}
