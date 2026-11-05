// Wawasan: building Malaysia into a superpower. Unlike the indicators in nation.ts, which drift back toward where the
// economy "wants" to be, these build up over the years and only your government builds them.
// - Four pillars (0–100): human capital, infrastructure, innovation and institutions. Their average lifts the economy's
//   potential growth (and steadies the ringgit). Your Budget builds them line by line, your mega projects and a clean
//   government add to them; every pillar wears down a little each year, and under any other government nothing builds.
// - Income per head (USD) compounds with real growth per head; a stronger ringgit lifts it in dollars.
// - Quality of Life (0–100) blends income, the pillars and the cost of living; it lifts approval.
// - Global Power ranks Malaysia against a table of other countries (data/world.ts).
// - Tax take (10–22% of GDP): more revenue for a bigger Budget and fiscal space, at a cost to growth and approval that
//   strong institutions soften.
// - Milestones (high income, developed nation, top 15 / 10 / 5) are reached once, kept forever and rewarded.
// All numbers TEMPORARY.

import type { GameState, ReportLine } from "../state";
import { WORLD } from "../data/world";

export type Pillar = "human" | "infra" | "innov" | "inst";

export interface Wawasan {
  human: number;
  infra: number;
  innov: number;
  inst: number;
  /** Real income per head, USD at the 2026 exchange rate (4.2). */
  real: number;
  /** Tax revenue, % of GDP. */
  tax: number;
  /** The last Budget your government passed: points per line, building pillars all year. */
  alloc: Record<string, number>;
  /** Milestones reached (kept for good). */
  reached: string[];
}

export const WAWASAN = {
  start: { human: 50, infra: 45, innov: 30, inst: 45 } as Record<Pillar, number>,
  startIncome: 13000,
  baseRinggit: 4.2,
  /** Population growth, % a year (income per head grows by growth minus this). */
  population: 1.1,
  population2026: 34,
  /** Potential growth per point of pillar average above `pivot`. */
  growthPerPoint: 0.1,
  pivot: 40,
  /** Ringgit strength per point of pillar average above 45 (RM per USD, negative = stronger). */
  ringgitPerPoint: -0.02,
  /** Wear and tear on every pillar, points a year; under another government, the decay is all there is. */
  decay: 1,
  /** Growth per head is capped this low while someone else governs. */
  stagnantGrowth: 2,
  /** Budget gains are this much stronger (the player's edge in building). */
  buildMult: 1.4,
  /** Gains slow as a pillar fills: gain × (1 − pillar / fill). */
  fill: 120,
  /** Tax: range, start, and per point above the start. */
  tax: { min: 10, max: 22, start: 12, capital: 5, fiscal: 0.08, envelope: 0.8, growth: -0.06, approval: -0.5 },
  /** Institutions soften the tax bite: 1% per point above 45, down to 30% of the bite. */
  taxSoften: { from: 45, per: 0.01, floor: 0.3 },
  /** Mega projects add infrastructure (and innovation for the data centres) when they open. */
  project: { infra: 4, big: 8, datacentre: 6 },
  /** A clean government builds institutions; a dirty one wears them down (points a year). */
  integrity: { good: 70, bad: 50, gain: 1.5, loss: -1.5 },
  /** Approval per point of Quality of Life above where it started. */
  approvalPerQol: 0.15,
  /** National swing per point of Quality of Life gained over the last five years (in government). */
  swingPerQol: 0.006,
  swingCap: 0.15,
};

/** What each Budget line builds, per point, over a year. */
export const BUILDS: Record<string, { pillar?: Pillar; gain?: number; col?: number; label: string }> = {
  youth: { pillar: "human", gain: 1.5, label: "Human capital" },
  health: { pillar: "human", gain: 1.5, label: "Human capital" },
  urban: { pillar: "infra", gain: 1.2, col: -0.8, label: "Infrastructure, cheaper living" },
  rural: { pillar: "infra", gain: 1.2, label: "Infrastructure" },
  borneo: { pillar: "infra", gain: 1.2, label: "Infrastructure" },
  rnd: { pillar: "innov", gain: 2, label: "Innovation" },
  civil: { pillar: "inst", gain: 0.8, label: "Institutions" },
};

export const PILLARS: { id: Pillar; name: string; blurb: string }[] = [
  { id: "human", name: "Human capital", blurb: "Schools, universities, TVET and hospitals. Built by Education & youth and Health." },
  { id: "infra", name: "Infrastructure", blurb: "Rail, roads, ports, power and broadband. Built by Transit & housing, Rural, Sabah & Sarawak, and mega projects." },
  { id: "innov", name: "Innovation", blurb: "R&D, chips, AI and high-tech industry. Built by R&D & industry and the Johor data centres." },
  { id: "inst", name: "Institutions", blurb: "Rule of law, a capable civil service, clean government. Built by Civil service pay and integrity above 70." },
];

export interface Milestone {
  id: string;
  name: string;
  text: string;
  capital: number;
  approval: number;
  reached: (s: GameState, w: Wawasan) => boolean;
  /** 0–1, for the progress bar. */
  progress: (s: GameState, w: Wawasan) => number;
}

const toward = (v: number, from: number, to: number) => Math.max(0, Math.min(1, (v - from) / (to - from)));
const rankProgress = (s: GameState, w: Wawasan, top: number) => toward(32 - worldRank(s, w), 32 - 30, 32 - top);

export const MILESTONES: Milestone[] = [
  { id: "highincome", name: "High-income nation", text: "Income per head of US$15,000.", capital: 15, approval: 3, reached: (s, w) => incomeUsd(s, w) >= 15000, progress: (s, w) => toward(incomeUsd(s, w), WAWASAN.startIncome, 15000) },
  {
    id: "developed",
    name: "Negara Maju",
    text: "A developed nation: income per head of US$30,000 and Quality of Life 70.",
    capital: 20,
    approval: 3,
    reached: (s, w) => incomeUsd(s, w) >= 30000 && qualityOfLife(s, w) >= 70,
    progress: (s, w) => Math.min(toward(incomeUsd(s, w), WAWASAN.startIncome, 30000), toward(qualityOfLife(s, w), 50, 70)),
  },
  { id: "tiger", name: "Asian Tiger", text: "Into the world's top 15 on Global Power.", capital: 20, approval: 2, reached: (s, w) => worldRank(s, w) <= 15, progress: (s, w) => rankProgress(s, w, 15) },
  { id: "power", name: "Global power", text: "Into the world's top 10.", capital: 25, approval: 2, reached: (s, w) => worldRank(s, w) <= 10, progress: (s, w) => rankProgress(s, w, 10) },
  {
    id: "superpower",
    name: "Kuasa Besar Dunia",
    text: "A superpower: the world's top 5, with Quality of Life 80.",
    capital: 30,
    approval: 4,
    reached: (s, w) => worldRank(s, w) <= 5 && qualityOfLife(s, w) >= 80,
    progress: (s, w) => Math.min(rankProgress(s, w, 5), toward(qualityOfLife(s, w), 50, 80)),
  },
];

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

export function initWawasan(): Wawasan {
  return { ...WAWASAN.start, real: WAWASAN.startIncome, tax: WAWASAN.tax.start, alloc: {}, reached: [] };
}

/** The Wawasan state (old saves start fresh). */
export const wz = (s: Pick<GameState, "nation">): Wawasan => s.nation.wawasan ?? initWawasan();

/** You lead the government: only then does the nation build. */
export const youBuild = (s: Pick<GameState, "parliament" | "player">) => s.parliament.pm === s.player;

export const pillarAvg = (w: Wawasan) => (w.human + w.infra + w.innov + w.inst) / 4;

/** Extra potential growth from the pillars (% a year). */
export const potentialBoost = (w: Wawasan) => (pillarAvg(w) - WAWASAN.pivot) * WAWASAN.growthPerPoint;

/** How much of the tax bite is left after institutions soften it (1 = all of it). */
export const taxBite = (w: Wawasan) => Math.max(WAWASAN.taxSoften.floor, 1 - Math.max(0, w.inst - WAWASAN.taxSoften.from) * WAWASAN.taxSoften.per);

/** Tax points above the start (GST counts as one more). */
export const taxPoints = (s: Pick<GameState, "nation" | "me">, w = wz(s)) => w.tax - WAWASAN.tax.start + ((s.me.policies?.tax ?? 0) === 2 ? 1 : 0);

/** Tax effects on the growth and approval targets (the bite softened by institutions). */
export function taxTargets(s: Pick<GameState, "nation" | "me">, w = wz(s)) {
  const pts = taxPoints(s, w);
  const bite = pts > 0 ? taxBite(w) : 1;
  return { growth: pts * WAWASAN.tax.growth * bite, approval: pts * WAWASAN.tax.approval * bite, fiscal: pts * WAWASAN.tax.fiscal, envelope: pts * WAWASAN.tax.envelope };
}

/** Income per head in US dollars at today's ringgit. */
export const incomeUsd = (s: Pick<GameState, "nation">, w = wz(s)) => (w.real * WAWASAN.baseRinggit) / s.nation.ringgit;

const yearsSince2026 = (week: number) => week / 52;
const population = (week: number) => WAWASAN.population2026 * Math.pow(1 + WAWASAN.population / 100, yearsSince2026(week));

/** GDP in US$ billions. */
export const gdpUsdBn = (s: Pick<GameState, "nation" | "week">, w = wz(s)) => (incomeUsd(s, w) * population(s.week)) / 1000;

const logScore = (v: number, lo: number, hi: number) => clamp((Math.log(v / lo) / Math.log(hi / lo)) * 100);
export const incomeScore = (usd: number) => logScore(usd, 2000, 90000);

/** Quality of Life, 0–100. */
export function qualityOfLife(s: Pick<GameState, "nation">, w = wz(s)): number {
  return clamp(0.3 * incomeScore(incomeUsd(s, w)) + 0.25 * w.human + 0.15 * w.infra + 0.15 * (100 - s.nation.col) + 0.15 * w.inst);
}

/** Quality of Life when the game begins (approval is measured against it). */
export const QOL_START = 0.3 * incomeScore(WAWASAN.startIncome) + 0.25 * WAWASAN.start.human + 0.15 * WAWASAN.start.infra + 0.15 * 45 + 0.15 * WAWASAN.start.inst;

/** Malaysia's Global Power score. */
export function malaysiaPower(s: Pick<GameState, "nation" | "week">, w = wz(s)): number {
  return 0.4 * incomeScore(incomeUsd(s, w)) + 0.3 * qualityOfLife(s, w) + 0.2 * w.innov + 0.1 * logScore(gdpUsdBn(s, w), 50, 30000);
}

export function worldTable(s: Pick<GameState, "nation" | "week">, w = wz(s)): { name: string; flag: string; power: number; you: boolean }[] {
  const yrs = yearsSince2026(s.week);
  return [...WORLD.map((c) => ({ name: c.name, flag: c.flag, power: c.power + c.drift * yrs, you: false })), { name: "Malaysia", flag: "🇲🇾", power: malaysiaPower(s, w), you: true }].sort((a, b) => b.power - a.power);
}

export const worldRank = (s: Pick<GameState, "nation" | "week">, w = wz(s)) => worldTable(s, w).findIndex((c) => c.you) + 1;

/** The Budget's lasting effect on the cost-of-living target. */
export const budgetCol = (w: Wawasan) => Object.entries(w.alloc).reduce((t, [id, pts]) => t + (BUILDS[id]?.col ?? 0) * pts, 0);

/** Pillar gains a year from the Budget, projects aside, before diminishing returns. */
export function budgetGains(alloc: Record<string, number>): Record<Pillar, number> {
  const out: Record<Pillar, number> = { human: 0, infra: 0, innov: 0, inst: 0 };
  for (const [id, pts] of Object.entries(alloc)) {
    const b = BUILDS[id];
    if (b?.pillar) out[b.pillar] += (b.gain ?? 0) * pts;
  }
  return out;
}

/** This year's change in each pillar at the current pace (points a year). */
export function pillarPace(s: Pick<GameState, "nation" | "me" | "parliament" | "player">, w = wz(s)): Record<Pillar, number> {
  const build = youBuild(s);
  const gains = budgetGains(w.alloc);
  const integ = s.me.integrity >= WAWASAN.integrity.good ? WAWASAN.integrity.gain : s.me.integrity < WAWASAN.integrity.bad ? WAWASAN.integrity.loss : 0;
  const out = {} as Record<Pillar, number>;
  for (const p of ["human", "infra", "innov", "inst"] as Pillar[]) {
    const g = build ? (gains[p] * WAWASAN.buildMult + (p === "inst" ? integ : 0)) * (1 - w[p] / WAWASAN.fill) : 0;
    out[p] = g - WAWASAN.decay;
  }
  return out;
}

export interface WawasanWeek {
  wawasan: Wawasan;
  lines: ReportLine[];
  /** Milestones reached this week. */
  reached: Milestone[];
}

/** One week of nation-building. `opened`: mega projects that opened this week. */
export function wawasanWeek(s: GameState, gdp: number, opened: string[]): WawasanWeek {
  const w0 = wz(s);
  const w: Wawasan = { ...w0, alloc: { ...w0.alloc }, reached: [...w0.reached] };
  const build = youBuild(s);
  const pace = pillarPace(s, w0);
  for (const p of ["human", "infra", "innov", "inst"] as Pillar[]) w[p] = clamp(w[p] + pace[p] / 52);
  if (build)
    for (const id of opened) {
      w.infra = clamp(w.infra + (id === "hsr" ? WAWASAN.project.big : WAWASAN.project.infra));
      if (id === "datacentre") w.innov = clamp(w.innov + WAWASAN.project.datacentre);
    }
  const perHead = Math.min(gdp - WAWASAN.population, build ? 99 : WAWASAN.stagnantGrowth);
  w.real = w.real * (1 + perHead / 100 / 52);
  const lines: ReportLine[] = [];
  const reached: Milestone[] = [];
  if (build) {
    const next = { ...s, nation: { ...s.nation, wawasan: w } };
    for (const m of MILESTONES) {
      if (w.reached.includes(m.id) || !m.reached(next, w)) continue;
      w.reached.push(m.id);
      reached.push(m);
      lines.push({ text: `WAWASAN: ${m.name}! ${m.text} The nation celebrates (+${m.capital} capital).`, tone: "good" });
    }
  }
  return { wawasan: w, lines, reached };
}

/** National swing from the Quality of Life your government delivered over the last five years. */
export function developmentSwing(s: GameState): number {
  if (!youBuild(s)) return 0;
  const h = s.nation.history;
  const then = h.find((x) => x.week >= s.week - 260 && x.qol !== undefined)?.qol ?? QOL_START;
  const d = (qualityOfLife(s) - then) * WAWASAN.swingPerQol;
  return Math.max(-WAWASAN.swingCap, Math.min(WAWASAN.swingCap, d)) + (wz(s).reached.includes("developed") ? 0.03 : 0);
}

/** Weeks to reach a target at the current pace of a value (null when not heading there). */
export function etaWeeks(now: number, target: number, perWeek: number): number | null {
  if (now >= target) return 0;
  if (perWeek <= 0) return null;
  return Math.ceil((target - now) / perWeek);
}
