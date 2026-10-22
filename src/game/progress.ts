// Weekly bookkeeping for your career, term objectives and achievements, plus the career effects of elections.

import { TURN_WEEKS } from "./config";
import type { GameState, ReportLine } from "./state";
import { AP_BY_RUNG, CAREER, MP, PRESIDENT, addPoints, factionSize, promote, rungName, succession } from "./systems/career";
import { ACHIEVEMENTS, OBJECTIVE_REWARD, newAchievements, newObjectives, objectiveMet } from "./systems/goals";
import type { Formation, FormationOutcome } from "./systems/formation";
import { SEATS } from "./world";
import { teamAp } from "./systems/team";

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

export function careerWeek(s: GameState): { state: GameState; lines: ReportLine[] } {
  const lines: ReportLine[] = [];
  let c = { ...s.career, loyalty: s.career.loyalty.map((l) => l * (1 - CAREER.loyaltyDecay)) };
  const pm = s.parliament.pm === s.player && c.rung >= PRESIDENT;
  if (pm) c.pmWeeks += 1;

  if (s.week % 52 === c.birthdayWeek % 52) {
    c.age += 1;
    if (c.age >= c.retireAge - 1 && c.age < c.retireAge) lines.push({ text: `${c.name} turns ${c.age}. The party is already talking about succession: ${c.protege} is ready.`, tone: "info" });
  }
  if (c.age >= c.retireAge) {
    const old = c.name;
    c = succession(c, s.seed, s.week);
    lines.push({ text: `${old} retires at ${s.career.age}. ${c.name} takes over: generation ${c.generation} of your dynasty.`, tone: "info" });
  }
  if (s.week % 4 === 0) {
    const faction = factionSize(c, s.holders, s.player);
    const pts = Math.floor(faction / 10) * CAREER.factionPointsPer10;
    if (pts) c = addPoints(c, s.week, pts, `a faction of ${faction} loyal MPs`);
  }
  if (c.rung >= PRESIDENT && s.me.unity < CAREER.challengeUnity && !c.challenge) {
    c.challenge = true;
    lines.push({ text: "Party unity has collapsed. Rivals inside the party will challenge your leadership at the next AGM.", tone: "bad" });
  }
  const apMax = (AP_BY_RUNG[c.rung] + (pm ? 2 : 0) + teamAp(s)) * TURN_WEEKS;
  return { state: { ...s, career: c, me: { ...s.me, apMax } }, lines };
}

export function goalsWeek(s: GameState): { state: GameState; lines: ReportLine[] } {
  let state = s;
  const lines: ReportLine[] = [];
  const objectives = state.objectives.map((o) => {
    if (o.done || !objectiveMet(state, o)) return o;
    lines.push({ text: `Objective complete: ${o.text}. Political capital +${OBJECTIVE_REWARD.capital}.`, tone: "good" });
    state = {
      ...state,
      me: { ...state.me, capital: clamp(state.me.capital + OBJECTIVE_REWARD.capital, 0, 200) },
      career: addPoints(state.career, state.week, OBJECTIVE_REWARD.points, `objective: ${o.text}`),
    };
    return { ...o, done: true };
  });
  state = { ...state, objectives };
  const earned = newAchievements(state);
  if (earned.length) {
    const achievements = { ...state.achievements };
    for (const id of earned) {
      achievements[id] = state.week;
      const a = ACHIEVEMENTS.find((x) => x.id === id)!;
      lines.push({ text: `Achievement: ${a.name}. ${a.text}`, tone: "good" });
    }
    state = { ...state, achievements };
  }
  return { state, lines };
}

/** Career effects of a general election: your home seat, and seats gained. Called when the results are in. */
export function careerAfterGE(s: GameState, prevHolders: GameState["holders"]): { state: GameState; lines: ReportLine[] } {
  const lines: ReportLine[] = [];
  let c = s.career;
  const home = c.homeSeat;
  const wonHome = s.holders[home] === s.player;
  const seat = SEATS[home].name;
  if (c.rung === MP - 1) {
    if (wonHome) {
      c = promote(c, s.week, `You win ${seat}: Yang Berhormat ${c.name}, Wakil Rakyat.`);
      lines.push({ text: `You win your home seat, ${seat}. You are now a Member of Parliament.`, tone: "good" });
    } else lines.push({ text: `You lose in ${seat}. Five more years of grassroots work before another chance.`, tone: "bad" });
  } else if (c.rung >= MP && !wonHome) {
    c = addPoints(c, s.week, -15, `lost your own seat, ${seat}`);
    if (c.rung === MP) c = { ...c, rung: MP - 1 };
    if (c.rung >= PRESIDENT) c = { ...c, challenge: true };
    lines.push({ text: `You lose your own seat, ${seat}!${c.rung >= PRESIDENT ? " Your leadership will be challenged at the next AGM." : ""}`, tone: "bad" });
  }
  const before = prevHolders.filter((h) => h === s.player).length;
  const after = s.holders.filter((h) => h === s.player).length;
  if (after > before) c = addPoints(c, s.week, after - before, `+${after - before} seats gained at the general election`);
  return { state: { ...s, career: c }, lines };
}

/** Career effects of forming a government, and a fresh set of objectives for the new term. */
export function careerAfterFormation(s: GameState, f: Formation, o: FormationOutcome): GameState {
  let c = s.career;
  const seatsObjective = s.objectives.find((x) => x.kind === "seats" && !x.done);
  let state = s;
  if (seatsObjective && f.seats[s.player] >= seatsObjective.target) {
    state = { ...state, me: { ...state.me, capital: clamp(state.me.capital + OBJECTIVE_REWARD.capital, 0, 200) } };
    c = addPoints(c, s.week, OBJECTIVE_REWARD.points, `objective: ${seatsObjective.text}`);
  }
  if (o.government.includes(s.player)) c = addPoints(c, s.week, 10, "your coalition is in government");
  if (o.pm === s.player) c = addPoints(c, s.week, 25, "your leader is Prime Minister");
  if (o.dpmGranted) c = { ...c, log: [{ week: s.week, text: "Your leader becomes Deputy Prime Minister." }, ...c.log].slice(0, 30) };
  state = { ...state, career: c };
  return { ...state, objectives: newObjectives(state) };
}

export function careerTitle(s: GameState): string {
  return rungName(s.career, s.government.includes(s.player), s.parliament.pm === s.player);
}
