// Your own people: the personal team that makes you more than one politician.
// - Seven jobs, each with a skill from 1 to 5: political secretary (action points), press secretary (scandals fade
//   faster), strategist (sharper polls), fundraiser (weekly donations), legal adviser (MACC risk), ground organiser
//   (cheaper machinery) and social media lead (young voters).
// - Staff are paid weekly from the war chest. They grow more skilled the longer they stay, and ask for more money.
// - Loyalty matters: underpaid or neglected staff get poached by rivals, and a bitter press secretary or strategist
//   may leak to the papers. A raise or a bonus keeps them.
// - How many you can employ grows with your rank. Three new candidates come on the market each month.
// Everything uses hash01 (no game-RNG draws). All numbers TEMPORARY.

import { DIFFICULTY } from "../config";
import { hash01 } from "../rng";
import type { GameState, ReportLine } from "../state";
import { BLOCS, type Bloc } from "../world";
import { makeName } from "./names";

export const ROLES = {
  polsec: { name: "Political secretary", blurb: "Runs your diary", effect: (s: number) => `+${s >= 5 ? 2 : 1} action point${s >= 5 ? "s" : ""} a week` },
  press: { name: "Press secretary", blurb: "Handles the media", effect: (s: number) => `scandals fade ${s * 2}% faster each week` },
  strategist: { name: "Strategist", blurb: "Reads the numbers", effect: (s: number) => `polls ${s * 6}% more accurate` },
  fundraiser: { name: "Fundraiser", blurb: "Knows the donors", effect: (s: number) => `+RM ${s * 30}k a week in donations` },
  legal: { name: "Legal adviser", blurb: "Keeps you out of trouble", effect: (s: number) => `MACC risk −${(s * 0.4).toFixed(1)} a week, raids ${s * 8}% less likely` },
  organiser: { name: "Ground organiser", blurb: "Runs the machinery", effect: (s: number) => `machinery upkeep −${s * 5}%` },
  social: { name: "Social media lead", blurb: "Owns TikTok", effect: (s: number) => `steady pull with young voters (+${(s * 0.2).toFixed(1)} a week)` },
} as const;

export type Role = keyof typeof ROLES;
export const ROLE_IDS = Object.keys(ROLES) as Role[];

export interface Staff {
  id: number;
  name: string;
  role: Role;
  /** 1–5. */
  skill: number;
  /** RM a week. */
  salary: number;
  /** 0–100. */
  loyalty: number;
  /** Weeks employed. */
  weeks: number;
  /** Runs the routine part of their job on their own (see delegate.ts). */
  auto?: boolean;
}

export const TEAM = {
  /** Team size by career rung (Ketua Cawangan … Party President). */
  slots: [2, 2, 3, 3, 4, 5, 6],
  salaryPerSkill: 6_000,
  /** Hiring costs this many weeks of salary. */
  signingWeeks: 4,
  severanceWeeks: 4,
  /** Weeks of service before each skill level. */
  levelWeeks: [0, 0, 26, 52, 104, 156],
  raise: 0.2,
  raiseLoyalty: 20,
  loyaltyRest: 60,
  poachBelow: 40,
  poachChance: 0.15,
  leakBelow: 25,
  leakChance: 0.1,
  leakScandal: 6,
  marketSize: 6,
  /** A headhunter finds a fresh shortlist now. */
  headhuntCost: 50_000,
};

export interface TeamState {
  team: Staff[];
  teamMarket: Staff[];
  nextStaffId: number;
}

const skillOf = (s: Pick<GameState, "team">, role: Role) => s.team.filter((x) => x.role === role).reduce((m, x) => Math.max(m, x.skill), 0);

export const teamSlots = (s: Pick<GameState, "career">) => TEAM.slots[s.career.rung] ?? 2;
export const teamAp = (s: Pick<GameState, "team">) => {
  const k = skillOf(s, "polsec");
  return k >= 5 ? 2 : k > 0 ? 1 : 0;
};
export const teamSalaries = (s: Pick<GameState, "team">) => s.team.reduce((sum, x) => sum + x.salary, 0);
export const teamDonations = (s: Pick<GameState, "team">) => skillOf(s, "fundraiser") * 30_000;
export const teamUpkeepMult = (s: Pick<GameState, "team">) => 1 - skillOf(s, "organiser") * 0.05;
export const teamRaidMult = (s: Pick<GameState, "team">) => 1 - skillOf(s, "legal") * 0.08;
/** Poll error for this game: difficulty, sharpened by a strategist. */
export const pollError = (s: Pick<GameState, "team" | "settings">) => DIFFICULTY[s.settings.difficulty].pollError * (1 - skillOf(s, "strategist") * 0.06);

/** Someone looking for work: skill 1–4, paid by skill, with a little haggling. */
function candidate(id: number, seed: number, week: number, slot: number): Staff {
  const role = ROLE_IDS[Math.floor(hash01("role", seed, week, slot) * ROLE_IDS.length)];
  const skill = 1 + Math.floor(hash01("skill", seed, week, slot) ** 1.6 * 4);
  const bloc: Bloc = BLOCS[Math.floor(hash01("sbloc", seed, week, slot) * 5)];
  return {
    id,
    name: makeName(bloc, "staff", seed, week, slot),
    role,
    skill,
    salary: Math.round((skill * TEAM.salaryPerSkill * (0.85 + hash01("pay", seed, week, slot) * 0.3)) / 500) * 500,
    loyalty: 55 + Math.round(hash01("sloy", seed, week, slot) * 20),
    weeks: 0,
  };
}

export function freshMarket(seed: number, week: number, nextId: number): { market: Staff[]; nextId: number } {
  const market = Array.from({ length: TEAM.marketSize }, (_, k) => candidate(nextId + k, seed, week, k));
  return { market, nextId: nextId + TEAM.marketSize };
}

export function initTeam(seed: number): TeamState {
  const { market, nextId } = freshMarket(seed, 0, 1);
  return { team: [], teamMarket: market, nextStaffId: nextId };
}

/** Weekly: pay, experience, loyalty, promotions, poaching and leaks. The salary bill is paid in the cash flow. */
export function teamWeek(s: GameState, paid: boolean): { state: GameState; lines: ReportLine[]; scandal: number } {
  const lines: ReportLine[] = [];
  let scandal = 0;
  let team = s.team.map((x) => {
    const weeks = x.weeks + 1;
    let skill = x.skill;
    let salary = x.salary;
    if (skill < 5 && weeks >= TEAM.levelWeeks[skill + 1] && x.weeks < TEAM.levelWeeks[skill + 1]) {
      skill += 1;
      salary = Math.round((salary * 1.15) / 500) * 500;
      lines.push({ text: `${x.name}, your ${ROLES[x.role].name.toLowerCase()}, has grown into the job (skill ${skill}) and now earns ${(salary / 1000).toFixed(1)}k a week.`, tone: "good" });
    }
    const loyalty = Math.max(0, Math.min(100, x.loyalty + (TEAM.loyaltyRest - x.loyalty) * 0.02 - (paid ? 0 : 10)));
    return { ...x, weeks, skill, salary, loyalty };
  });
  // Monthly: rivals try to poach the unhappy; bitter insiders leak.
  if (s.week % 4 === 3) {
    const kept: Staff[] = [];
    for (const x of team) {
      if (x.loyalty < TEAM.poachBelow && hash01("poach", s.seed, s.week, x.id) < TEAM.poachChance) {
        lines.push({ text: `${x.name}, your ${ROLES[x.role].name.toLowerCase()}, is poached by a rival party.`, tone: "bad" });
        continue;
      }
      if (x.loyalty < TEAM.leakBelow && (x.role === "press" || x.role === "strategist") && hash01("leak", s.seed, s.week, x.id) < TEAM.leakChance) {
        scandal += TEAM.leakScandal;
        lines.push({ text: `Someone in your office leaks your campaign plans to the press. Suspicion falls on ${x.name}.`, tone: "bad" });
      }
      kept.push(x);
    }
    team = kept;
  }
  let state: GameState = { ...s, team };
  if (s.week % 4 === 0 && s.week > 0) {
    const { market, nextId } = freshMarket(s.seed, s.week, s.nextStaffId);
    state = { ...state, teamMarket: market, nextStaffId: nextId };
  }
  return { state, lines, scandal };
}

export function hireBlocked(s: GameState, id: number): string | null {
  const c = s.teamMarket.find((x) => x.id === id);
  if (!c) return "They have taken another job.";
  if (s.team.length >= teamSlots(s)) return `Your team is full (${teamSlots(s)} at your rank).`;
  if (s.me.funds < c.salary * TEAM.signingWeeks) return "Not enough money for the signing fee.";
  return null;
}

export function hire(s: GameState, id: number): { state: GameState; message: string } | { error: string } {
  const why = hireBlocked(s, id);
  if (why) return { error: why };
  const c = s.teamMarket.find((x) => x.id === id)!;
  return {
    state: { ...s, team: [...s.team, c], teamMarket: s.teamMarket.filter((x) => x.id !== id), me: { ...s.me, funds: s.me.funds - c.salary * TEAM.signingWeeks } },
    message: `${c.name} joins your team as ${ROLES[c.role].name.toLowerCase()}.`,
  };
}

export function fire(s: GameState, id: number): { state: GameState; message: string } | { error: string } {
  const x = s.team.find((t) => t.id === id);
  if (!x) return { error: "Not on your team." };
  const severance = x.salary * TEAM.severanceWeeks;
  if (s.me.funds < severance) return { error: "Not enough money for severance." };
  const team = s.team.filter((t) => t.id !== id).map((t) => ({ ...t, loyalty: Math.max(0, t.loyalty - 5) }));
  return { state: { ...s, team, me: { ...s.me, funds: s.me.funds - severance } }, message: `${x.name} clears their desk. The rest of the team takes note.` };
}

export function headhunt(s: GameState): { state: GameState; message: string } | { error: string } {
  if (s.me.funds < TEAM.headhuntCost) return { error: "Not enough money." };
  const { market, nextId } = freshMarket(s.seed, s.week * 7 + s.nextStaffId, s.nextStaffId);
  return { state: { ...s, teamMarket: market, nextStaffId: nextId, me: { ...s.me, funds: s.me.funds - TEAM.headhuntCost } }, message: "The headhunter sends a new shortlist." };
}

export function setAuto(s: GameState, id: number, auto: boolean): { state: GameState; message: string } | { error: string } {
  const x = s.team.find((t) => t.id === id);
  if (!x) return { error: "Not on your team." };
  return { state: { ...s, team: s.team.map((t) => (t.id === id ? { ...t, auto } : t)) }, message: auto ? `${x.name} will handle it from now on.` : `You take ${x.name}'s work back.` };
}

export function raise(s: GameState, id: number): { state: GameState; message: string } | { error: string } {
  const x = s.team.find((t) => t.id === id);
  if (!x) return { error: "Not on your team." };
  const salary = Math.round((x.salary * (1 + TEAM.raise)) / 500) * 500;
  const team = s.team.map((t) => (t.id === id ? { ...t, salary, loyalty: Math.min(100, t.loyalty + TEAM.raiseLoyalty) } : t));
  return { state: { ...s, team }, message: `${x.name} gets a raise to ${(salary / 1000).toFixed(1)}k a week.` };
}
