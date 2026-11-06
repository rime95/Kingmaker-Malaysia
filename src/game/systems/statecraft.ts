// Statecraft: the standing boards of a Prime Minister. No pop-ups: each is a screen you set, with lasting effects.
// - Malaysia Plan: three national priorities for five years.
// - Ministry programmes: each ministry runs one programme; a good minister finishes faster.
// - State allocations: development money by state, feeding each state's level and your service in its seats.
// - Industry queue: builds in eight sectors, which need the pillars behind them.
// - Top appointments: the people at the head of national institutions.
// - Foreign relations: five meters, trips and trade deals.
// - Interest groups: seven meters that follow what you do and pay out above a level.
// Only your government builds; none of this runs or counts under anyone else's. All numbers TEMPORARY.

import type { GameState, ReportLine } from "../state";
import type { PortfolioId } from "../data/people";
import { SEATS, STATES, STATE_BY_ID, contestingIn } from "../world";
import { ministerEffect } from "./nation";
import { byId, remember, type Person } from "./people";
import { wz, youBuild, type Pillar, type Wawasan } from "./wawasan";

export const CRAFT = {
  plan: { picks: 3, years: 5, boost: 1.5 },
  /** Programme speed: per point of minister effect; floor; and Budget (fiscal space) swing. */
  programme: { minister: 0.5, floor: 0.4, ribbon: 3 },
  state: { min: 0, max: 10, normal: 5, gainYear: 1.5, wear: 0.6, servicePerPoint: 0.05, regional: 1.5 },
  ma63: { levels: [0, 20, 40], fiscalPer20: -0.02, devPer20: 2, servicePer20: 0.1 },
  build: { fiscal: 2, weeks: 52, slots: 3, slow: 0.5, service: 2, dev: 3, gdp: 0.06, jobs: -0.03, capital: 2, needPerLevel: 5 },
  relation: { start: 55, rest: 50, drift: 0.01, visitAp: 1, visit: 8, rivalHit: 2, deal: 75, dealGdp: 0.1, dealPower: 1, fdiPer: 0.08 },
  group: { line: 60 },
  appointLoyalty: 12,
};

export type PlanId = "human" | "infra" | "innov" | "inst" | "living" | "jobs" | "exports" | "regions";

export const PLANS: { id: PlanId; name: string; text: string }[] = [
  { id: "human", name: "People first", text: "Human capital builds 50% faster." },
  { id: "infra", name: "Connect the nation", text: "Infrastructure builds 50% faster." },
  { id: "innov", name: "High-tech leap", text: "Innovation builds 50% faster." },
  { id: "inst", name: "Clean institutions", text: "Institutions build 50% faster." },
  { id: "living", name: "Cost of living", text: "Cost-of-living pressure −4." },
  { id: "jobs", name: "Good jobs", text: "Unemployment −0.3." },
  { id: "exports", name: "Export nation", text: "Investment +4, and trips count for 50% more." },
  { id: "regions", name: "Balanced regions", text: "State development grows 50% faster." },
];

export interface ProgrammeDef {
  id: string;
  post: PortfolioId;
  name: string;
  weeks: number;
  blurb: string;
  pillar?: Pillar;
  gain?: number;
  done?: { gdp?: number; col?: number; fdi?: number; approval?: number; unemployment?: number };
}

export const PROGRAMMES: ProgrammeDef[] = [
  { id: "taxadmin", post: "finance", name: "Tax administration overhaul", weeks: 60, blurb: "Close leaks, widen the base.", pillar: "inst", gain: 3, done: { fdi: 1 } },
  { id: "subsidy", post: "finance", name: "Subsidy targeting", weeks: 70, blurb: "Aid that reaches those who need it.", done: { col: -2, approval: 1 } },
  { id: "plan13", post: "economy", name: "Productivity masterplan", weeks: 80, blurb: "Higher value, higher wages.", done: { gdp: 0.15 } },
  { id: "gig", post: "economy", name: "Gig and informal workers", weeks: 50, blurb: "Protection for the new workforce.", done: { unemployment: -0.1, approval: 1 } },
  { id: "chips", post: "trade", name: "National semiconductor strategy", weeks: 90, blurb: "Design, not only assembly.", pillar: "innov", gain: 5, done: { fdi: 3 } },
  { id: "invest", post: "trade", name: "One-stop investment desk", weeks: 40, blurb: "Approvals in weeks, not years.", done: { fdi: 4 } },
  { id: "tvet", post: "education", name: "TVET for all", weeks: 70, blurb: "Skilled trades with real pay.", pillar: "human", gain: 5, done: { unemployment: -0.1 } },
  { id: "stem", post: "education", name: "STEM schools", weeks: 90, blurb: "Science and maths from the first year.", pillar: "human", gain: 6 },
  { id: "clinics", post: "health", name: "Rural clinics", weeks: 60, blurb: "A clinic within reach of every kampung.", pillar: "human", gain: 4, done: { approval: 1 } },
  { id: "hospitals", post: "health", name: "Hospital waiting times", weeks: 70, blurb: "Beds, doctors and nurses.", pillar: "human", gain: 3, done: { approval: 2 } },
  { id: "buses", post: "transport", name: "City bus and rail network", weeks: 70, blurb: "Off the jam, on the bus.", pillar: "infra", gain: 4, done: { col: -1 } },
  { id: "ports", post: "transport", name: "Port upgrades", weeks: 80, blurb: "Port Klang and Tanjung Pelepas at world standard.", pillar: "infra", gain: 4, done: { gdp: 0.05 } },
  { id: "roads", post: "works", name: "Trunk road repairs", weeks: 50, blurb: "Fix the roads people use every day.", pillar: "infra", gain: 3 },
  { id: "broadband", post: "communications", name: "National 5G and fibre", weeks: 70, blurb: "Fast internet in every district.", pillar: "infra", gain: 3, done: { fdi: 2 } },
  { id: "padi", post: "rural", name: "Smallholder modernisation", weeks: 60, blurb: "Better yields for padi and palm.", done: { approval: 1, col: -1 } },
  { id: "water", post: "rural", name: "Clean water for every kampung", weeks: 70, blurb: "Pipes where there are still none.", pillar: "infra", gain: 3, done: { approval: 1 } },
  { id: "homes", post: "housing", name: "First home scheme", weeks: 60, blurb: "Deposits within reach of young families.", done: { col: -2, approval: 1 } },
  { id: "police", post: "home", name: "Police reform", weeks: 70, blurb: "Trust on the street.", pillar: "inst", gain: 4 },
  { id: "embassies", post: "foreign", name: "Trade diplomacy corps", weeks: 50, blurb: "Embassies that sell Malaysia.", done: { fdi: 3 } },
  { id: "sport", post: "youth", name: "Youth leaders and sport", weeks: 50, blurb: "Pride, fitness and a way up.", pillar: "human", gain: 2, done: { approval: 1 } },
];

export const PROGRAMME_BY_ID: Record<string, ProgrammeDef> = Object.fromEntries(PROGRAMMES.map((p) => [p.id, p]));

export const SECTORS: { id: string; name: string; states: string[]; pillar: Pillar }[] = [
  { id: "ee", name: "Electronics and chips", states: ["PNG", "KDH", "SGR"], pillar: "innov" },
  { id: "digital", name: "Data centres and AI", states: ["JHR", "SGR", "KUL"], pillar: "innov" },
  { id: "energy", name: "Oil, gas and green energy", states: ["TRG", "SWK", "SBH"], pillar: "infra" },
  { id: "auto", name: "Cars and aerospace", states: ["PRK", "SGR", "PHG"], pillar: "human" },
  { id: "palm", name: "Palm oil and agri-food", states: ["SBH", "PHG", "JHR", "KTN"], pillar: "infra" },
  { id: "finance", name: "Islamic finance", states: ["KUL", "LBN"], pillar: "inst" },
  { id: "tourism", name: "Tourism and heritage", states: ["MLK", "PNG", "SBH", "KDH"], pillar: "infra" },
  { id: "halal", name: "Halal hub", states: ["SGR", "KTN", "NSN"], pillar: "inst" },
];

export type Partner = "US" | "China" | "ASEAN" | "Gulf" | "Singapore";
export const PARTNERS: { id: Partner; name: string; rival?: Partner }[] = [
  { id: "US", name: "United States", rival: "China" },
  { id: "China", name: "China", rival: "US" },
  { id: "ASEAN", name: "ASEAN" },
  { id: "Gulf", name: "The Gulf" },
  { id: "Singapore", name: "Singapore" },
];

export type TopPost = "petronas" | "epf" | "khazanah" | "ag" | "igp" | "macc";
export const TOP_POSTS: { id: TopPost; name: string; text: string }[] = [
  { id: "petronas", name: "Petronas chairman", text: "A capable hand adds fiscal space." },
  { id: "epf", name: "EPF chairman", text: "A capable hand lifts investment." },
  { id: "khazanah", name: "Khazanah chairman", text: "A capable hand builds innovation." },
  { id: "ag", name: "Attorney General", text: "A capable hand builds institutions." },
  { id: "igp", name: "Inspector-General of Police", text: "A capable hand softens crises." },
  { id: "macc", name: "MACC chief", text: "A capable hand builds institutions; a loyal one lowers your MACC risk." },
];

export interface Craft {
  plan: { ids: PlanId[]; until: number } | null;
  programmes: Partial<Record<PortfolioId, { id: string; progress: number }>>;
  finished: string[];
  /** Development money, 0–10 a state (5 is even). */
  weights: Record<string, number>;
  /** Development level, 0–100 a state. */
  dev: Record<string, number>;
  /** Share of oil revenue returned to Sabah and Sarawak (MA63), %. */
  ma63: number;
  levels: Record<string, number>;
  queue: { sector: string; state: string; progress: number }[];
  top: Partial<Record<TopPost, number>>;
  relations: Record<Partner, number>;
  deals: Partner[];
}

export function initCraft(): Craft {
  return {
    plan: null,
    programmes: {},
    finished: [],
    weights: Object.fromEntries(STATES.map((x) => [x.id, CRAFT.state.normal])),
    dev: Object.fromEntries(STATES.map((x) => [x.id, Math.round(25 + x.urbanity * 50)])),
    ma63: 0,
    levels: Object.fromEntries(SECTORS.map((x) => [x.id, 0])),
    queue: [],
    top: {},
    relations: Object.fromEntries(PARTNERS.map((p) => [p.id, CRAFT.relation.start])) as Record<Partner, number>,
    deals: [],
  };
}

export const craftOf = (s: Pick<GameState, "craft">): Craft => s.craft ?? initCraft();

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
const onPlan = (s: Pick<GameState, "craft" | "week">, id: PlanId) => !!s.craft?.plan && s.week < s.craft.plan.until && s.craft.plan.ids.includes(id);

/** How much faster a pillar builds under the Malaysia Plan. */
export const planBoost = (s: Pick<GameState, "craft" | "week">, p: Pillar) => (onPlan(s, p) ? CRAFT.plan.boost : 1);

const topPerson = (s: Pick<GameState, "craft" | "people">, post: TopPost): Person | undefined => byId(s as GameState, s.craft?.top[post]);
/** −0.5 … 1: how much a top appointee helps. */
export const topEffect = (s: Pick<GameState, "craft" | "people">, post: TopPost) => {
  const p = topPerson(s, post);
  return p ? clamp((p.competence - 50) / 40, -0.5, 1) : 0;
};

// --- Interest groups -----------------------------------------------------------------------------

export const GROUPS: { id: string; name: string; bonus: string; likes: string }[] = [
  { id: "bumi", name: "Bumiputera business", bonus: "Approval +1", likes: "Rural and civil spending, the halal hub, affirmative policy" },
  { id: "chinese", name: "Chinese business", bonus: "Investment +3", likes: "Low tax, investment, electronics" },
  { id: "unions", name: "Unions", bonus: "Unemployment −0.1", likes: "A higher minimum wage, pay rises, low unemployment" },
  { id: "felda", name: "Felda and smallholders", bonus: "Approval +1", likes: "Rural Budget, palm oil, cash aid" },
  { id: "ulama", name: "Ulama", bonus: "Approval +1", likes: "Religious policy, integrity, Islamic finance" },
  { id: "civil", name: "Civil servants", bonus: "Programmes run 10% faster", likes: "Pay rises, the civil service Budget" },
  { id: "youth", name: "Urban youth", bonus: "Growth +0.05", likes: "Education, R&D, digital jobs, low tax" },
];

/** Where each group stands with you (0–100): worked out from what you actually do. */
export function groupScores(s: GameState): Record<string, number> {
  const w = wz(s);
  const c = craftOf(s);
  const n = s.nation;
  const a = (id: string) => w.alloc[id] ?? 0;
  const pol = (id: string) => s.me.policies[id] ?? 0;
  const lv = (id: string) => c.levels[id] ?? 0;
  const tax = w.tax - 12;
  const pay = n.civilPay === "raise" ? 12 : n.civilPay === "freeze" ? -12 : 0;
  return {
    bumi: clamp(50 + a("rural") * 2 + a("civil") * 2 + lv("halal") * 4 + (pol("affirmative") ? 6 : 0)),
    chinese: clamp(50 - tax * 3 + (n.fdi - 60) * 0.5 + lv("ee") * 4),
    unions: clamp(50 + (pol("wage") === 1 ? 12 : 0) + pay * 0.7 - (n.unemployment - 3.2) * 10),
    felda: clamp(50 + a("rural") * 3 + lv("palm") * 4 + (pol("cashaid") === 1 ? 6 : 0)),
    ulama: clamp(50 + (pol("religion") ? 8 : 0) + (s.me.integrity - 60) * 0.4 + lv("finance") * 4),
    civil: clamp(50 + pay + a("civil") * 3),
    youth: clamp(50 + a("youth") * 2 + a("rnd") * 2 + lv("digital") * 4 - tax * 1.5),
  };
}

const groupOk = (scores: Record<string, number>, id: string) => (scores[id] ?? 0) >= CRAFT.group.line;

// --- What it all adds up to ----------------------------------------------------------------------

/** What your boards add to the economy's targets. Nothing under another government. */
export function craftTargets(s: GameState): { gdp: number; unemployment: number; col: number; fdi: number; approval: number } {
  const out = { gdp: 0, unemployment: 0, col: 0, fdi: 0, approval: 0 };
  if (!youBuild(s) || !s.craft) return out;
  const c = s.craft;
  for (const id of c.finished) {
    const d = PROGRAMME_BY_ID[id]?.done;
    if (!d) continue;
    out.gdp += d.gdp ?? 0;
    out.unemployment += d.unemployment ?? 0;
    out.col += d.col ?? 0;
    out.fdi += d.fdi ?? 0;
    out.approval += d.approval ?? 0;
  }
  const levels = Object.values(c.levels).reduce((a, b) => a + b, 0);
  out.gdp += levels * CRAFT.build.gdp + c.deals.length * CRAFT.relation.dealGdp;
  out.unemployment += levels * CRAFT.build.jobs;
  if (onPlan(s, "living")) out.col -= 4;
  if (onPlan(s, "jobs")) out.unemployment -= 0.3;
  if (onPlan(s, "exports")) out.fdi += 4;
  out.fdi += Object.values(c.relations).reduce((t, r) => t + (r - CRAFT.relation.rest) * CRAFT.relation.fdiPer, 0) + topEffect(s, "epf") * 4;
  const devs = Object.values(c.dev);
  out.approval += (devs.reduce((a, b) => a + b, 0) / devs.length - 45) * 0.05;
  const g = groupScores(s);
  if (groupOk(g, "bumi")) out.approval += 1;
  if (groupOk(g, "felda")) out.approval += 1;
  if (groupOk(g, "ulama")) out.approval += 1;
  if (groupOk(g, "chinese")) out.fdi += 3;
  if (groupOk(g, "unions")) out.unemployment -= 0.1;
  if (groupOk(g, "youth")) out.gdp += 0.05;
  return out;
}

/** Yearly pillar points from your top appointees. */
export const topPillars = (s: GameState): Partial<Record<Pillar, number>> => ({ innov: topEffect(s, "khazanah") * 1.5, inst: (topEffect(s, "ag") + topEffect(s, "macc")) * 1 });

const programmeSpeed = (s: GameState, post: PortfolioId, def: ProgrammeDef, civil: boolean) => {
  const m = Math.max(CRAFT.programme.floor, 1 + ministerEffect(s, post) * CRAFT.programme.minister);
  return (m * (0.8 + s.fiscal / 250) * (civil ? 1.1 : 1)) / def.weeks;
};

/** Weeks left on a programme at the current pace. */
export function programmeEta(s: GameState, post: PortfolioId): number | null {
  const run = craftOf(s).programmes[post];
  if (!run) return null;
  return Math.ceil((1 - run.progress) / programmeSpeed(s, post, PROGRAMME_BY_ID[run.id], false));
}

/** What a sector needs before a new build runs at full speed. */
export const buildNeed = (c: Craft, sector: string) => 35 + (c.levels[sector] ?? 0) * CRAFT.build.needPerLevel;
export const buildShort = (s: GameState, sector: string) => {
  const def = SECTORS.find((x) => x.id === sector)!;
  return wz(s)[def.pillar] < buildNeed(craftOf(s), sector);
};

function seatsIn(s: GameState, state: string) {
  return SEATS.filter((x) => x.state === state && contestingIn(x, s.entries).includes(s.player)).map((x) => x.index);
}

const addPillar = (w: Wawasan, p: Pillar, n: number): Wawasan => ({ ...w, [p]: clamp(w[p] + n) });

/** A week of governing: programmes and builds move, money reaches the states, relations settle. */
export function craftWeek(s: GameState): { state: GameState; lines: ReportLine[] } {
  const lines: ReportLine[] = [];
  if (!youBuild(s)) return { state: s, lines };
  const c: Craft = { ...craftOf(s), programmes: { ...craftOf(s).programmes }, finished: [...craftOf(s).finished], dev: { ...craftOf(s).dev }, levels: { ...craftOf(s).levels }, relations: { ...craftOf(s).relations } };
  let w = wz(s);
  const service = [...s.me.service];
  let capital = s.me.capital;
  let fiscal = s.fiscal;
  let risk = s.me.risk;
  const g = groupScores(s);
  // Programmes.
  for (const [post, run] of Object.entries(c.programmes) as [PortfolioId, { id: string; progress: number }][]) {
    const def = PROGRAMME_BY_ID[run.id];
    const progress = run.progress + programmeSpeed(s, post, def, groupOk(g, "civil"));
    if (progress < 1) {
      c.programmes[post] = { ...run, progress };
      continue;
    }
    delete c.programmes[post];
    c.finished.push(def.id);
    if (def.pillar) w = addPillar(w, def.pillar, (def.gain ?? 0) * planBoost(s, def.pillar));
    capital += CRAFT.programme.ribbon;
    lines.push({ text: `Programme complete: ${def.name}. Ministers cut the ribbon.`, tone: "good" });
  }
  // Industry.
  const left: Craft["queue"] = [];
  for (const b of c.queue) {
    const progress = b.progress + (buildShort(s, b.sector) ? CRAFT.build.slow : 1) / CRAFT.build.weeks;
    if (progress < 1) {
      left.push({ ...b, progress });
      continue;
    }
    c.levels[b.sector] = (c.levels[b.sector] ?? 0) + 1;
    c.dev[b.state] = clamp((c.dev[b.state] ?? 40) + CRAFT.build.dev);
    capital += CRAFT.build.capital;
    for (const i of seatsIn(s, b.state)) service[i] = clamp(service[i] + CRAFT.build.service);
    lines.push({ text: `A new ${SECTORS.find((x) => x.id === b.sector)!.name.toLowerCase()} project opens in ${STATE_BY_ID[b.state].name}, with jobs across the state.`, tone: "good" });
  }
  c.queue = left;
  // Relations settle.
  for (const p of PARTNERS) c.relations[p.id] += (CRAFT.relation.rest - c.relations[p.id]) * CRAFT.relation.drift;
  // State money, MA63 and steady appointees' work.
  const borneo = c.ma63 / 20;
  fiscal = clamp(fiscal + borneo * CRAFT.ma63.fiscalPer20 + topEffect(s, "petronas") * 0.05);
  w = addPillar(addPillar(w, "innov", (topPillars(s).innov ?? 0) / 52), "inst", (topPillars(s).inst ?? 0) / 52);
  const loyal = topPerson(s, "macc");
  if (loyal && loyal.loyalty >= 60) risk = clamp(risk - 0.05);
  const avg = Object.values(c.weights).reduce((a, b) => a + b, 0) / STATES.length;
  const regional = onPlan(s, "regions") ? CRAFT.state.regional : 1;
  for (const st of STATES) {
    const weight = c.weights[st.id] ?? CRAFT.state.normal;
    const extra = st.id === "SBH" || st.id === "SWK" ? borneo : 0;
    c.dev[st.id] = clamp((c.dev[st.id] ?? 40) + (((weight / Math.max(1, avg)) * CRAFT.state.gainYear * regional + extra * CRAFT.ma63.devPer20 - CRAFT.state.wear) / 52));
    if (s.week % 4 === 0) {
      const d = (weight - CRAFT.state.normal) * CRAFT.state.servicePerPoint + extra * CRAFT.ma63.servicePer20;
      if (d) for (const i of seatsIn(s, st.id)) service[i] = clamp(service[i] + d);
    }
  }
  if (s.craft?.plan && s.week === s.craft.plan.until) lines.push({ text: "The Malaysia Plan has run its five years. Time to set the next one.", tone: "info" });
  return { state: { ...s, craft: c, fiscal, me: { ...s.me, service, capital: clamp(capital, 0, 200), risk }, nation: { ...s.nation, wawasan: w } }, lines };
}

// --- Actions -------------------------------------------------------------------------------------

type R = { state: GameState; message: string } | { error: string };
const pmOnly = (s: GameState): string | null => (s.parliament.pm === s.player && s.career.rung >= 6 ? null : "Only you as Prime Minister decide this.");

export function setPlan(s: GameState, ids: PlanId[]): R {
  const why = pmOnly(s);
  if (why) return { error: why };
  if (s.craft?.plan && s.week < s.craft.plan.until) return { error: "The current plan runs until its five years are up." };
  if (new Set(ids).size !== CRAFT.plan.picks) return { error: `Pick ${CRAFT.plan.picks} priorities.` };
  return { state: { ...s, craft: { ...craftOf(s), plan: { ids, until: s.week + CRAFT.plan.years * 52 } } }, message: "The Malaysia Plan is tabled: five years, three priorities." };
}

export function startProgramme(s: GameState, id: string): R {
  const why = pmOnly(s);
  if (why) return { error: why };
  const def = PROGRAMME_BY_ID[id];
  const c = craftOf(s);
  if (!def) return { error: "Unknown programme." };
  if (c.finished.includes(id)) return { error: "That one is finished." };
  if (c.programmes[def.post]) return { error: "This ministry is already running a programme." };
  return { state: { ...s, craft: { ...c, programmes: { ...c.programmes, [def.post]: { id, progress: 0 } } } }, message: `${def.name} begins.` };
}

export function setStateWeight(s: GameState, state: string, weight: number): R {
  const why = pmOnly(s);
  if (why) return { error: why };
  if (!STATE_BY_ID[state]) return { error: "Unknown state." };
  const c = craftOf(s);
  return { state: { ...s, craft: { ...c, weights: { ...c.weights, [state]: clamp(Math.round(weight), CRAFT.state.min, CRAFT.state.max) } } }, message: `${STATE_BY_ID[state].name}'s development money is reset.` };
}

export function setMa63(s: GameState, share: number): R {
  const why = pmOnly(s);
  if (why) return { error: why };
  if (!CRAFT.ma63.levels.includes(share)) return { error: "Pick a share." };
  return { state: { ...s, craft: { ...craftOf(s), ma63: share } }, message: `Sabah and Sarawak's MA63 share is set at ${share}%.` };
}

export function queueBuild(s: GameState, sector: string, state: string): R {
  const why = pmOnly(s);
  if (why) return { error: why };
  const def = SECTORS.find((x) => x.id === sector);
  const c = craftOf(s);
  if (!def || !def.states.includes(state)) return { error: "That sector doesn't suit that state." };
  if (c.queue.length >= CRAFT.build.slots) return { error: `At most ${CRAFT.build.slots} builds at once.` };
  if (s.fiscal < CRAFT.build.fiscal) return { error: "No fiscal space for it." };
  return { state: { ...s, fiscal: clamp(s.fiscal - CRAFT.build.fiscal), craft: { ...c, queue: [...c.queue, { sector, state, progress: 0 }] } }, message: `${def.name}: ground is broken in ${STATE_BY_ID[state].name}.` };
}

export function appointTop(s: GameState, post: TopPost, id: number | null): R {
  const why = pmOnly(s);
  if (why) return { error: why };
  const c = craftOf(s);
  const def = TOP_POSTS.find((x) => x.id === post)!;
  const top = { ...c.top };
  if (id === null) {
    delete top[post];
    return { state: { ...s, craft: { ...c, top } }, message: `${def.name} stands vacant.` };
  }
  const p = byId(s, id);
  if (!p || p.retired || p.id === s.youId) return { error: "Pick someone available." };
  if (Object.values(top).includes(id)) return { error: "They already hold a top post." };
  top[post] = id;
  return { state: { ...s, craft: { ...c, top }, people: s.people.map((x) => (x.id === id ? remember(x, CRAFT.appointLoyalty, `You made me ${def.name}`, s.week) : x)) }, message: `${p.name} is the new ${def.name}.` };
}

export function visitPartner(s: GameState, id: Partner): R {
  const why = pmOnly(s);
  if (why) return { error: why };
  if (s.me.ap < CRAFT.relation.visitAp) return { error: `Needs ${CRAFT.relation.visitAp} AP.` };
  const c = craftOf(s);
  const def = PARTNERS.find((x) => x.id === id)!;
  const gain = CRAFT.relation.visit * (onPlan(s, "exports") ? 1.5 : 1);
  const relations = { ...c.relations, [id]: clamp(c.relations[id] + gain) };
  if (def.rival) relations[def.rival] = clamp(relations[def.rival] - CRAFT.relation.rivalHit);
  return { state: { ...s, craft: { ...c, relations }, me: { ...s.me, ap: s.me.ap - CRAFT.relation.visitAp } }, message: `A successful visit: relations with ${def.name} warm.` };
}

export function signDeal(s: GameState, id: Partner): R {
  const why = pmOnly(s);
  if (why) return { error: why };
  const c = craftOf(s);
  if (c.deals.includes(id)) return { error: "You already have a deal." };
  if (c.relations[id] < CRAFT.relation.deal) return { error: `Relations need to reach ${CRAFT.relation.deal}.` };
  const def = PARTNERS.find((x) => x.id === id)!;
  return { state: { ...s, craft: { ...c, deals: [...c.deals, id] } }, message: `A trade deal with ${def.name} is signed. It adds to growth for good.` };
}
