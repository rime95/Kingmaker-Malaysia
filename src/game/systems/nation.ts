// The state of the country: the numbers a government is judged on, and what a Prime Minister can do about them.
// - Seven indicators move a little every week toward where the economy "wants" to be: growth, inflation, unemployment,
//   the ringgit, debt, cost-of-living pressure and investment. Policies, ministers, projects and crises move the targets.
// - Bank Negara is independent: it meets every eight weeks and raises or cuts the OPR on its own reading of inflation.
// - Public approval of the government follows the numbers people feel (prices, jobs, growth). It feeds national swing:
//   in government you own the numbers; in opposition you profit when they go wrong.
// - Ministers matter: each portfolio's minister pushes their indicator by their competence.
// - Mega projects cost money every week while they are built and pay off for years once finished.
// - Crises are arcs of several weeks with a decision at the start.
// - Who governs matters: your government has a steady hand (the numbers lean your way), while a government led by
//   anyone else drifts into misrule (slower growth, dearer living, weaker investment, crises that bite harder). Both
//   scale with your edge. That is your case to the rakyat: we govern better.
// The old `economy` and `fiscal` scores are derived from these each week. Noise uses hash01. All numbers TEMPORARY.

import type { PortfolioId } from "../data/people";
import { hash01 } from "../rng";
import type { GameState, ReportLine } from "../state";
import { SEATS, STATE_BY_ID } from "../world";
import { byId } from "./people";
import { edgeOf } from "../config";

export interface Nation {
  /** Real GDP growth, % a year. */
  gdp: number;
  /** Inflation, % a year. */
  inflation: number;
  /** Unemployment, %. */
  unemployment: number;
  /** Ringgit per US dollar (higher = weaker). */
  ringgit: number;
  /** Federal debt, % of GDP. */
  debt: number;
  /** Cost-of-living pressure, 0–100 (50 = normal grumbling). */
  col: number;
  /** Foreign investment climate, 0–100. */
  fdi: number;
  /** Bank Negara's overnight policy rate, %. */
  opr: number;
  /** Approval of the government, %. */
  approval: number;
  /** Civil service pay stance. */
  civilPay: "freeze" | "normal" | "raise";
  /** Weeks of stimulus left. */
  stimulus: number;
  projects: Project[];
  crisis: Crisis | null;
  /** Every four weeks. */
  history: { week: number; gdp: number; inflation: number; unemployment: number; approval: number; ringgit: number; debt: number }[];
}

export const START_NATION: Omit<Nation, "projects" | "crisis" | "history"> = {
  gdp: 4.4,
  inflation: 1.8,
  unemployment: 3.1,
  ringgit: 4.2,
  debt: 64,
  col: 55,
  fdi: 60,
  opr: 2.75,
  approval: 50,
  civilPay: "normal",
  stimulus: 0,
};

export function initNation(): Nation {
  return { ...START_NATION, projects: [], crisis: null, history: [] };
}

// --- Mega projects -------------------------------------------------------------------------------

export interface ProjectDef {
  id: string;
  name: string;
  /** RM billions. */
  cost: number;
  weeks: number;
  /** States whose seats get service when it opens. */
  states: string[];
  blurb: string;
  /** Lasting effects once open. */
  done: { gdp?: number; fdi?: number; approval?: number; col?: number };
}

export const PROJECTS: ProjectDef[] = [
  { id: "hsr", name: "KL–Singapore High-Speed Rail", cost: 70, weeks: 312, states: ["SGR", "KUL", "NSN", "MLK", "JHR"], blurb: "Ninety minutes to Singapore. The biggest ribbon you will ever cut.", done: { gdp: 0.4, fdi: 8, approval: 3 } },
  { id: "ecrl", name: "ECRL extension to Kota Bharu", cost: 12, weeks: 156, states: ["KTN", "TRG", "PHG"], blurb: "Rail for the east coast, where the votes are hardest to win.", done: { gdp: 0.15, approval: 2 } },
  { id: "panborneo", name: "Pan Borneo Highway, phase 2", cost: 15, weeks: 208, states: ["SBH", "SWK"], blurb: "Finish the road Borneo has waited decades for.", done: { gdp: 0.15, approval: 3 } },
  { id: "pglrt", name: "Penang LRT", cost: 10, weeks: 182, states: ["PNG"], blurb: "Unjam Penang. The island will remember.", done: { gdp: 0.1, approval: 1, col: -2 } },
  { id: "flood", name: "National flood mitigation", cost: 8, weeks: 130, states: ["KTN", "TRG", "PHG", "JHR", "SGR"], blurb: "Dams, drains and retention ponds. No ribbon, but no more floods.", done: { approval: 3, col: -1 } },
  { id: "datacentre", name: "Johor data-centre corridor", cost: 5, weeks: 104, states: ["JHR"], blurb: "Power, water and fibre for the AI boom.", done: { gdp: 0.2, fdi: 10 } },
  { id: "housing", name: "Rumah Mampu Milik drive", cost: 9, weeks: 130, states: ["SGR", "KUL", "PRK", "KDH", "PHG"], blurb: "A hundred thousand affordable homes.", done: { approval: 4, col: -4 } },
];
export const PROJECT_BY_ID: Record<string, ProjectDef> = Object.fromEntries(PROJECTS.map((p) => [p.id, p]));

export interface Project {
  id: string;
  /** 0–1. */
  progress: number;
  startWeek: number;
  done: boolean;
}

// --- Crises --------------------------------------------------------------------------------------

export interface CrisisDef {
  kind: string;
  title: string;
  weeks: number;
  text: string;
  /** Applied every week while it lasts. */
  weekly: Partial<Record<"gdp" | "inflation" | "unemployment" | "ringgit" | "col" | "fdi" | "approval", number>>;
}

export const CRISES: CrisisDef[] = [
  { kind: "recession", title: "Global recession", weeks: 20, text: "Exports are collapsing as the world economy stalls. Factories in Penang and Johor are cutting shifts.", weekly: { gdp: -0.12, unemployment: 0.04, fdi: -0.4 } },
  { kind: "ringgit", title: "Ringgit crash", weeks: 10, text: "Funds are fleeing emerging markets. The ringgit is sliding toward 5 to the dollar and imported food is getting dearer.", weekly: { ringgit: 0.05, inflation: 0.06, col: 0.6 } },
  { kind: "pandemic", title: "A new virus", weeks: 16, text: "Hospitals in the Klang Valley are filling up with a fast-spreading respiratory virus.", weekly: { gdp: -0.1, unemployment: 0.03, approval: -0.2 } },
  { kind: "boom", title: "Commodity boom", weeks: 16, text: "Oil and palm oil prices are soaring. Petronas dividends and plantation taxes are pouring in.", weekly: { gdp: 0.06, ringgit: -0.02, fdi: 0.2 } },
];
export const CRISIS_BY_KIND: Record<string, CrisisDef> = Object.fromEntries(CRISES.map((c) => [c.kind, c]));

export interface Crisis {
  kind: string;
  startWeek: number;
  weeksLeft: number;
  /** How hard it bites (the response chosen can soften or worsen it). */
  severity: number;
  /** Approval and growth when it began (to judge the government's handling). */
  from?: { approval: number; gdp: number };
}

export const NATION = {
  /** Share of the gap to target closed each week. */
  pull: 0.05,
  mpcEvery: 8,
  crisisChancePerMonth: 0.04,
  /** Approval effect on national swing, per point from 50. */
  approvalSwingGov: 0.004,
  approvalSwingOpp: 0.002,
  stimulusWeeks: 26,
  stimulusFiscal: -10,
  roadshowFdi: 5,
  /** Chance a crisis leads straight into another. */
  chainChance: 0.35,
};

/** Who governs: +1 is your steady hand, −1 another coalition's misrule (both grow with your edge). */
export function stewardship(s: GameState): number {
  const e = edgeOf(s) - 1;
  return s.parliament.pm === s.player ? STEWARD.you + e : -(STEWARD.them + e);
}
export const STEWARD = {
  /** Base steadiness of your government, and misrule of anyone else's (before your edge). */
  you: 0.5,
  them: 0.5,
  /** Per point of stewardship: growth, inflation, unemployment, cost of living, investment, approval targets. */
  gdp: 0.5,
  inflation: -0.35,
  unemployment: -0.3,
  col: -6,
  fdi: 6,
  approval: 4,
  /** Crisis damage per point (negative: yours bite less). */
  crisis: -0.2,
};

/** Which crisis can follow which. */
export const CRISIS_CHAIN: Record<string, string> = { ringgit: "recession", pandemic: "recession" };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** −1.5 … +1: how much a minister helps (competence 60 is neutral; an empty post hurts). */
export function ministerEffect(s: Pick<GameState, "cabinet" | "people">, post: PortfolioId): number {
  const p = byId(s, s.cabinet[post]);
  if (!p) return -0.75;
  return clamp((p.competence - 60) / 40, -1.5, 1);
}

/** Which indicator each ministry moves, for the dashboard. */
export const PORTFOLIO_KPI: Partial<Record<PortfolioId, string>> = {
  finance: "Debt and fiscal space",
  economy: "Growth",
  trade: "Investment",
  education: "Approval",
  health: "Approval",
  transport: "Project speed",
  works: "Project speed",
  housing: "Cost of living",
  rural: "Rural approval",
  home: "Crisis damage",
  communications: "Approval",
};

/** Where each indicator is heading this week. */
function targets(s: GameState) {
  const n = s.nation;
  const gov = s.government.includes(s.player);
  // The governing side's policies are the player's only when the player governs; otherwise the status quo holds.
  const pol = (id: string) => (gov ? (s.me.policies[id] ?? 0) : 0);
  const m = (post: PortfolioId) => ministerEffect(s, post);
  const finished = n.projects.filter((p) => p.done).map((p) => PROJECT_BY_ID[p.id].done);
  const sum = (k: keyof ProjectDef["done"]) => finished.reduce((t, d) => t + (d[k] ?? 0), 0);
  const building = n.projects.filter((p) => !p.done).length;
  const w = stewardship(s);

  const gdp = 4.2 + m("economy") * 0.4 + (n.fdi - 60) * 0.02 + sum("gdp") + building * 0.08 + (n.stimulus > 0 ? 0.8 : 0) - (n.opr - 2.75) * 0.4 + (pol("infra") === 1 ? 0.3 : 0) + (pol("wage") === 1 ? -0.15 : 0);
  const fuel = pol("fuel");
  const tax = pol("tax");
  const inflation =
    2.0 + (n.gdp - 4.4) * 0.25 - (n.opr - 2.75) * 0.7 + (n.ringgit - 4.2) * 1.2 + (fuel === 1 ? 0.6 : fuel === 2 ? 1.4 : 0) + (tax === 1 ? 0.3 : tax === 2 ? 0.8 : tax === 3 ? -0.3 : 0) + (pol("wage") === 1 ? 0.2 : 0);
  const unemployment = 3.2 - (n.gdp - 4.4) * 0.3 + (pol("wage") === 1 ? 0.2 : 0) - building * 0.05;
  const ringgit = 4.2 + (n.debt - 64) * 0.01 - (n.opr - 2.75) * 0.2 - (n.fdi - 60) * 0.004;
  const col = 50 + (n.inflation - 2) * 10 + (fuel === 1 ? 6 : fuel === 2 ? 14 : 0) - (pol("cashaid") === 1 ? 6 : pol("cashaid") === 2 ? -6 : 0) - (pol("wage") === 1 ? 4 : 0) - m("housing") * 3 + sum("col");
  const fdi = 55 + m("trade") * 10 + sum("fdi") + (s.me.integrity - 60) * 0.1 - (n.ringgit > 4.6 ? 5 : 0);
  const pay = n.civilPay === "raise" ? 3 : n.civilPay === "freeze" ? -3 : 0;
  const approval =
    50 + (n.gdp - 4.4) * 3 - (n.inflation - 2) * 3 - (n.unemployment - 3.2) * 4 - (n.col - 50) * 0.35 + sum("approval") + pay + (m("health") + m("education") + m("communications")) * 1.5 + m("rural") * 1;
  return {
    gdp: gdp + w * STEWARD.gdp,
    inflation: inflation + w * STEWARD.inflation,
    unemployment: unemployment + w * STEWARD.unemployment,
    ringgit,
    col: col + w * STEWARD.col,
    fdi: fdi + w * STEWARD.fdi,
    approval: approval + w * STEWARD.approval,
  };
}

export interface NationWeek {
  nation: Nation;
  /** Weekly change to fiscal space (deficits, projects, pay). */
  fiscal: number;
  lines: ReportLine[];
  /** A new crisis began (the decision card to show). */
  crisis: string | null;
  /** Projects that opened (their states get service in their seats). */
  opened: ProjectDef[];
  /** A crisis ended: how the government came through it (positive = well). */
  ended: { title: string; score: number } | null;
}

/** One week of the national economy. */
export function nationWeek(s: GameState): NationWeek {
  const n = { ...s.nation, projects: s.nation.projects.map((p) => ({ ...p })) };
  const lines: ReportLine[] = [];
  let ended: NationWeek["ended"] = null;
  const t = targets(s);
  const noise = (k: string, size: number) => (hash01("nation", k, s.seed, s.week) - 0.5) * size;
  const move = (cur: number, target: number, size: number, key: string) => cur + (target - cur) * NATION.pull + noise(key, size);
  n.gdp = clamp(move(n.gdp, t.gdp, 0.08, "gdp"), -8, 10);
  n.inflation = clamp(move(n.inflation, t.inflation, 0.05, "inflation"), -2, 15);
  n.unemployment = clamp(move(n.unemployment, t.unemployment, 0.03, "unemployment"), 1.5, 15);
  n.ringgit = clamp(move(n.ringgit, t.ringgit, 0.02, "ringgit"), 3, 7);
  n.col = clamp(move(n.col, t.col, 0.6, "col"), 0, 100);
  n.fdi = clamp(move(n.fdi, t.fdi, 0.4, "fdi"), 0, 100);
  n.approval = clamp(n.approval + (t.approval - n.approval) * 0.08 + noise("appr", 0.6), 5, 95);

  // Crises bite every week they last.
  if (n.crisis) {
    const def = CRISIS_BY_KIND[n.crisis.kind];
    const home = 1 - ministerEffect(s, "home") * 0.15;
    const k = n.crisis.severity * home * Math.max(0.4, 1 + stewardship(s) * STEWARD.crisis);
    n.gdp += (def.weekly.gdp ?? 0) * k;
    n.inflation += (def.weekly.inflation ?? 0) * k;
    n.unemployment += (def.weekly.unemployment ?? 0) * k;
    n.ringgit += (def.weekly.ringgit ?? 0) * k;
    n.col = clamp(n.col + (def.weekly.col ?? 0) * k, 0, 100);
    n.fdi = clamp(n.fdi + (def.weekly.fdi ?? 0) * k, 0, 100);
    n.approval = clamp(n.approval + (def.weekly.approval ?? 0) * k, 5, 95);
    n.crisis = { ...n.crisis, weeksLeft: n.crisis.weeksLeft - 1 };
    if (n.crisis.weeksLeft <= 0) {
      lines.push({ text: `The ${def.title.toLowerCase()} is over.`, tone: "info" });
      if (n.crisis.from) ended = { title: def.title, score: n.approval - n.crisis.from.approval + (n.gdp - n.crisis.from.gdp) * 3 };
      n.crisis = null;
      // Crises can chain: a currency crash or a virus can tip the economy into recession.
      const next = CRISIS_CHAIN[def.kind];
      if (next && hash01("chain", s.seed, s.week) < NATION.chainChance) {
        const nd = CRISIS_BY_KIND[next];
        n.crisis = { kind: nd.kind, startWeek: s.week, weeksLeft: nd.weeks, severity: 0.8, from: { approval: n.approval, gdp: n.gdp } };
        lines.push({ text: `It isn't over: the ${def.title.toLowerCase()} has tipped into a ${nd.title.toLowerCase()}.`, tone: "bad" });
      }
    }
  }
  let crisis: string | null = null;
  if (!n.crisis && s.week % 4 === 0 && s.week > 8 && hash01("crisis", s.seed, s.week) < NATION.crisisChancePerMonth) {
    const def = CRISES[Math.floor(hash01("crisiskind", s.seed, s.week) * CRISES.length)];
    n.crisis = { kind: def.kind, startWeek: s.week, weeksLeft: def.weeks, severity: 1, from: { approval: n.approval, gdp: n.gdp } };
    crisis = def.kind;
  }

  // Bank Negara's Monetary Policy Committee.
  if (s.week % NATION.mpcEvery === 4) {
    if (n.inflation > 3 && n.opr < 4.5) {
      n.opr = Math.round((n.opr + 0.25) * 100) / 100;
      lines.push({ text: `Bank Negara raises the OPR to ${n.opr.toFixed(2)}% to cool inflation (${n.inflation.toFixed(1)}%).`, tone: "info" });
    } else if (n.inflation < 1.8 && n.gdp < 3.5 && n.opr > 1.5) {
      n.opr = Math.round((n.opr - 0.25) * 100) / 100;
      lines.push({ text: `Bank Negara cuts the OPR to ${n.opr.toFixed(2)}% to support growth.`, tone: "info" });
    }
  }

  // Money: deficits from low fiscal space, projects and pay; debt follows.
  let fiscal = 0;
  const speed = 1 + (ministerEffect(s, "transport") + ministerEffect(s, "works")) * 0.15;
  const opened: ProjectDef[] = [];
  for (const p of n.projects) {
    if (p.done) continue;
    const def = PROJECT_BY_ID[p.id];
    p.progress = Math.min(1, p.progress + speed / def.weeks);
    fiscal -= (def.cost / def.weeks) * 0.6;
    if (p.progress >= 1) {
      p.done = true;
      opened.push(def);
      lines.push({ text: `The ${def.name} opens. Ribbons are cut.`, tone: "good" });
    }
  }
  if (n.stimulus > 0) n.stimulus -= 1;
  if (n.civilPay === "raise") fiscal -= 0.15;
  if (n.civilPay === "freeze") fiscal += 0.1;
  fiscal += ministerEffect(s, "finance") * 0.05;
  n.debt = clamp(n.debt + ((50 - s.fiscal) / 50) * 0.04 - (n.gdp - 4) * 0.004 - (n.inflation - 2) * 0.003, 30, 100);
  if (s.week % 4 === 0) n.history = [...n.history, { week: s.week, gdp: n.gdp, inflation: n.inflation, unemployment: n.unemployment, approval: n.approval, ringgit: n.ringgit, debt: n.debt }].slice(-130);
  return { nation: n, fiscal, lines, crisis, opened, ended };
}

/** The old 0–100 economy score, derived from the indicators. */
export function economyScore(n: Nation): number {
  return clamp(55 + (n.gdp - 4.4) * 6 - (n.inflation - 2) * 3 - (n.unemployment - 3.2) * 4 - (n.col - 50) * 0.15, 0, 100);
}

/** Seats in the states a finished project serves. */
export function projectSeats(def: ProjectDef): number[] {
  return SEATS.filter((s) => def.states.includes(s.state)).map((s) => s.index);
}

export const projectStates = (def: ProjectDef) => def.states.map((x) => STATE_BY_ID[x].name).join(", ");
