// Term objectives (three per term, with rewards) and achievements (permanent, checked every week).

import { hash01 } from "../rng";
import type { GameState } from "../state";
import { COALITION_INFO, SEATS, STATE_BY_ID } from "../world";
import { ASSEMBLY_STATES, stateRule, stateRulers } from "./assemblies";
import { PRESIDENT, factionSize } from "./career";
import { DUNS_BY_STATE } from "./dun";
import { itemMet } from "./agenda";

export interface Objective {
  id: string;
  kind: "seats" | "state" | "fortress" | "unity" | "chest" | "faction" | "business";
  text: string;
  target: number;
  stateId?: string;
  done: boolean;
}

export const OBJECTIVE_REWARD = { capital: 10, points: 8 };

const fortresses = (s: GameState) => s.me.service.filter((v, i) => v >= 70 && s.holders[i] === s.player).length;

/** Three objectives for a new term, chosen from what is a stretch for you right now. */
export function newObjectives(s: GameState): Objective[] {
  const seats = s.holders.filter((h) => h === s.player).length;
  const rulers = stateRulers(s.dunHolders, s.government);
  const targetState = ASSEMBLY_STATES.filter((id) => rulers[id] !== s.player)
    .map((id) => ({ id, share: (stateRule(s.dunHolders, id, s.government).seats[s.player] ?? 0) / DUNS_BY_STATE[id].length }))
    .sort((a, b) => b.share - a.share)[0];
  const pool: Objective[] = [
    { id: "seats", kind: "seats", text: `Win at least ${seats + 6} seats at the next general election`, target: seats + 6, done: false },
    { id: "fortress", kind: "fortress", text: `Hold ${fortresses(s) + 5} Kubu Kuat strongholds (service 70+)`, target: fortresses(s) + 5, done: false },
    { id: "unity", kind: "unity", text: "End a month with party unity above 75", target: 75, done: false },
    { id: "chest", kind: "chest", text: `Build a war chest of RM ${Math.round((Math.max(s.me.funds, 2e6) * 1.5) / 1e6)}M`, target: Math.round((Math.max(s.me.funds, 2e6) * 1.5) / 1e6) * 1e6, done: false },
    { id: "faction", kind: "faction", text: `Build a faction of ${factionSize(s.career, s.holders, s.player) + 8} loyal MPs`, target: factionSize(s.career, s.holders, s.player) + 8, done: false },
    { id: "business", kind: "business", text: "Own three businesses in the party holding company", target: 3, done: false },
  ];
  if (targetState) pool.push({ id: `state-${targetState.id}`, kind: "state", text: `Win the ${STATE_BY_ID[targetState.id].name} state government`, target: 1, stateId: targetState.id, done: false });
  const picked: Objective[] = [];
  const order = pool.map((o, i) => ({ o, r: hash01("objective", s.seed, s.week, i) })).sort((a, b) => a.r - b.r);
  // Always include the general election target and a state if available, then one more.
  for (const want of ["seats", "state"]) {
    const hit = order.find((x) => x.o.kind === want);
    if (hit) picked.push(hit.o);
  }
  for (const x of order) if (picked.length < 3 && !picked.includes(x.o)) picked.push(x.o);
  return picked;
}

/** Is an objective met now? (`seats` is judged at a general election, see checkSeatsObjective.) */
export function objectiveMet(s: GameState, o: Objective): boolean {
  switch (o.kind) {
    case "state":
      return stateRule(s.dunHolders, o.stateId!, s.government).ruler === s.player;
    case "fortress":
      return fortresses(s) >= o.target;
    case "unity":
      return s.week % 4 === 0 && s.me.unity > o.target;
    case "chest":
      return s.me.funds >= o.target;
    case "faction":
      return factionSize(s.career, s.holders, s.player) >= o.target;
    case "business":
      return s.me.assets.length >= o.target;
    case "seats":
      return false;
  }
}

export interface AchievementDef {
  id: string;
  name: string;
  text: string;
  check: (s: GameState) => boolean;
}

export const tiers = (s: GameState) => s.tiers.map((t) => t.tier);

// --- Legacy: what a great Prime Minister leaves behind, over several terms ---------------------------------------------------------------------------------------

export interface LegacyGoal {
  id: string;
  name: string;
  text: string;
  /** Progress 0–1 (1 = done), judged while you are Prime Minister. */
  progress: (s: GameState) => number;
}

const pm = (s: GameState) => s.parliament.pm === s.player;
const terms = (s: GameState) => s.tiers.filter((t) => t.tier === "platinum" || t.tier === "diamond").length;
const toward = (v: number, from: number, to: number) => Math.max(0, Math.min(1, (v - from) / (to - from)));

export const LEGACY: LegacyGoal[] = [
  { id: "wawasan", name: "Negara Maju", text: "A high-income nation: growth of 5.5% or more with unemployment at 3% or less.", progress: (s) => (pm(s) ? Math.min(toward(s.nation.gdp, 4, 5.5), toward(-s.nation.unemployment, -4, -3)) : 0) },
  { id: "debt60", name: "Fiscal Discipline", text: "Bring federal debt below 60% of GDP.", progress: (s) => (pm(s) ? toward(-s.nation.debt, -66, -60) : 0) },
  { id: "living", name: "Rakyat Didahulukan", text: "Cost-of-living pressure down to 40 or below.", progress: (s) => (pm(s) ? toward(-s.nation.col, -55, -40) : 0) },
  { id: "clean", name: "Clean Government", text: "Integrity 80 and Principle 65 or more while governing.", progress: (s) => (pm(s) ? Math.min(toward(s.me.integrity, 60, 80), toward(s.scorecard?.now[s.player].principle ?? 50, 50, 65)) : 0) },
  {
    id: "promises",
    name: "Janji Ditepati",
    text: "Keep every promise of a full term.",
    progress: (s) => (pm(s) && s.agenda?.by === s.player && s.agenda.items.length ? s.agenda.items.filter((it) => itemMet(s, it)).length / s.agenda.items.length : 0),
  },
  { id: "mandate", name: "Mandate Renewed", text: "Win re-election as Prime Minister.", progress: (s) => Math.min(1, terms(s) / 2) },
  { id: "era", name: "An Era", text: "Lead the country through three terms.", progress: (s) => Math.min(1, terms(s) / 3) },
];

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first-week", name: "Selamat Datang", text: "Play your first week.", check: (s) => s.week >= 1 },
  { id: "byelection", name: "First Blood", text: "Win a by-election.", check: (s) => s.career.log.some((l) => l.text.includes("by-election")) },
  { id: "state", name: "State Builder", text: "Govern a state.", check: (s) => Object.values(stateRulers(s.dunHolders, s.government)).includes(s.player) },
  { id: "states4", name: "Empire of States", text: "Govern four states at once.", check: (s) => Object.values(stateRulers(s.dunHolders, s.government)).filter((c) => c === s.player).length >= 4 },
  { id: "fortress5", name: "Kubu Kuat", text: "Hold five strongholds (service 70+).", check: (s) => fortresses(s) >= 5 },
  { id: "fortress20", name: "Fortress Malaysia", text: "Hold twenty strongholds.", check: (s) => fortresses(s) >= 20 },
  { id: "tycoon", name: "Tycoon Party", text: "Own five businesses.", check: (s) => s.me.assets.length >= 5 },
  { id: "chest50", name: "Deep Pockets", text: "Hold a RM 50M war chest.", check: (s) => s.me.funds >= 50_000_000 },
  { id: "clean", name: "Clean Hands", text: "Reach integrity 85.", check: (s) => s.me.integrity >= 85 },
  { id: "united", name: "One Party", text: "Reach party unity 90.", check: (s) => s.me.unity >= 90 },
  { id: "faction20", name: "Kingpin", text: "Command a faction of 20 loyal MPs.", check: (s) => factionSize(s.career, s.holders, s.player) >= 20 },
  { id: "mp", name: "Yang Berhormat", text: "Win your home seat and become a Wakil Rakyat.", check: (s) => s.career.rung >= 2 },
  { id: "president", name: "Party President", text: "Lead your party.", check: (s) => s.career.rung >= PRESIDENT },
  { id: "budget", name: "Belanjawan", text: "Pass a Budget as the government.", check: (s) => s.career.log.some((l) => l.text.includes("Budget")) },
  { id: "bronze", name: "Momentum", text: "Gain seats at a general election.", check: (s) => s.tiers.some((t) => t.tier !== "none") },
  { id: "gold", name: "In Government", text: "Be part of the government after a general election.", check: (s) => tiers(s).some((t) => t === "gold" || t === "platinum" || t === "diamond") },
  { id: "pm", name: "Prime Minister", text: "Your leader becomes Prime Minister.", check: (s) => tiers(s).some((t) => t === "platinum" || t === "diamond") },
  { id: "diamond", name: "Supermajority", text: "Form a government with two-thirds of the Dewan.", check: (s) => tiers(s).includes("diamond") },
  { id: "tsunami", name: "Tsunami Politik", text: "Gain 20 or more seats at one general election.", check: (s) => s.career.log.some((l) => /seats gained at the general election/.test(l.text) && Number(l.text.match(/\+(\d+)/)?.[1] ?? 0) >= 20) },
  { id: "comeback", name: "The Comeback", text: "Become Prime Minister after starting in opposition.", check: (s) => !COALITION_INFO[s.player].inGovernment && s.parliament.pm === s.player },
  { id: "kingmaker", name: "Kingmaker", text: "Decide who becomes Prime Minister as the kingmaker, and get the DPM.", check: (s) => s.career.log.some((l) => l.text.includes("Deputy Prime Minister")) },
  { id: "ma63", name: "Borneo Promise", text: "Enact full MA63 devolution in government.", check: (s) => s.me.policies.ma63 === 1 && s.government.includes(s.player) },
  { id: "survivor", name: "Survivor", text: "Survive a MACC raid.", check: (s) => s.career.log.some((l) => l.text.includes("MACC")) },
  { id: "term", name: "Full Term", text: "Play five years.", check: (s) => s.week >= 260 },
  { id: "pm2", name: "Negarawan", text: "Serve five years as Prime Minister.", check: (s) => s.career.pmWeeks >= 260 },
  { id: "dynasty", name: "Dynasty", text: "Hand over to a protégé.", check: (s) => s.career.generation >= 2 },
  { id: "everyseat", name: "Sapu Bersih", text: "Win every assembly seat in a state.", check: (s) => ASSEMBLY_STATES.some((id) => DUNS_BY_STATE[id].every((d) => s.dunHolders[d] === s.player)) },
  { id: "borneo", name: "Land Below the Wind", text: "Hold ten seats in Sabah and Sarawak.", check: (s) => SEATS.filter((x) => (x.state === "SBH" || x.state === "SWK") && s.holders[x.index] === s.player).length >= 10 },
  // Legacy goals: a promise record only counts after a year in office.
  ...LEGACY.map((l) => ({ id: `legacy-${l.id}`, name: l.name, text: l.text, check: (s: GameState) => l.progress(s) >= 1 && (l.id !== "promises" || s.week - (s.agenda?.week ?? s.week) >= 52) })),
];

/** Newly earned achievements this week. */
export function newAchievements(s: GameState): string[] {
  return ACHIEVEMENTS.filter((a) => s.achievements[a.id] === undefined && a.check(s)).map((a) => a.id);
}
