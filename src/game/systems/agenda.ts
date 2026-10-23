// Governing and opposing, with depth.
// - The national agenda: every government sets three promises for its term, drawn from what's going wrong (prices,
//   jobs, debt...). Keep them and approval builds month by month; break them and the opposition hits harder.
// - The opposition's tools: a shadow cabinet, attacks on the numbers that are genuinely bad (an attack on a good number
//   falls flat), investigations that take weeks and may land or backfire, street rallies, and court challenges.
// All draws are hash01. Numbers TEMPORARY.

import type { PortfolioId } from "../data/people";
import { hash01 } from "../rng";
import type { GameState, ReportLine } from "../state";
import { addSeg } from "./segments";
import { byId } from "./people";
import { cshort } from "../world";
import { bump } from "./scorecard";
import { RECORD_SWAY, pledgeAgenda, reportCard, snapshot, type Snapshot } from "./governing";

export type Kpi = "gdp" | "inflation" | "unemployment" | "debt" | "col" | "approval" | "fdi";

export const KPI_INFO: Record<Kpi, { label: string; fmt: (v: number) => string; upIsGood: boolean; post: PortfolioId; bad: (v: number) => number }> = {
  gdp: { label: "Growth", fmt: (v) => `${v.toFixed(1)}%`, upIsGood: true, post: "economy", bad: (v) => (4.4 - v) / 3 },
  inflation: { label: "Inflation", fmt: (v) => `${v.toFixed(1)}%`, upIsGood: false, post: "finance", bad: (v) => (v - 2) / 3 },
  unemployment: { label: "Unemployment", fmt: (v) => `${v.toFixed(1)}%`, upIsGood: false, post: "economy", bad: (v) => (v - 3.2) / 2 },
  debt: { label: "Federal debt", fmt: (v) => `${v.toFixed(0)}% of GDP`, upIsGood: false, post: "finance", bad: (v) => (v - 60) / 15 },
  col: { label: "Cost of living", fmt: (v) => `${v.toFixed(0)}`, upIsGood: false, post: "housing", bad: (v) => (v - 50) / 30 },
  approval: { label: "Government approval", fmt: (v) => `${v.toFixed(0)}%`, upIsGood: true, post: "communications", bad: (v) => (50 - v) / 25 },
  fdi: { label: "Investment", fmt: (v) => `${v.toFixed(0)}`, upIsGood: true, post: "trade", bad: (v) => (60 - v) / 30 },
};
export const KPIS = Object.keys(KPI_INFO) as Kpi[];

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
/** 0 (fine) … 1 (dire): how bad a number is. */
export const badness = (s: Pick<GameState, "nation">, k: Kpi) => clamp(KPI_INFO[k].bad(s.nation[k]), 0, 1);

// --- The national agenda --------------------------------------------------------------------------

export interface AgendaItem {
  kpi: Kpi;
  target: number;
  /** Value when promised. */
  from: number;
  /** The manifesto pledge this promise comes from (your government). */
  pledge?: string;
}

export interface Agenda {
  /** The parliament (GE number) and the coalition that set it. */
  term: number;
  by: CoalitionId;
  week: number;
  items: AgendaItem[];
  /** The numbers when the term began (for the report card). */
  start?: Snapshot;
  /** The record has gone before the voters (once a campaign). */
  judged?: boolean;
}
type CoalitionId = GameState["player"];

export const AGENDA = { items: 3, monthlyApproval: 0.4, brokenBonus: 1.5, /** Weeks before an unmet promise counts as broken. */ grace: 26 };

const targetFor = (k: Kpi, v: number): number => {
  switch (k) {
    case "gdp":
      return Math.min(6, v + 0.8);
    case "inflation":
      return Math.max(1.5, v - 0.6);
    case "unemployment":
      return Math.max(2.5, v - 0.5);
    case "debt":
      return v - 3;
    case "col":
      return Math.max(35, v - 8);
    case "approval":
      return Math.max(52, v + 6);
    case "fdi":
      return Math.min(90, v + 8);
  }
};

export const itemMet = (s: Pick<GameState, "nation">, it: AgendaItem) => (KPI_INFO[it.kpi].upIsGood ? s.nation[it.kpi] >= it.target : s.nation[it.kpi] <= it.target);

/** The promises for a term: your own government's come from your manifesto; the rest lean towards what's going worst. */
export function rollAgenda(s: GameState): Agenda {
  const pool = KPIS.map((k) => ({ k, w: 0.3 + badness(s, k) }));
  const items: AgendaItem[] = s.parliament.pm === s.player ? pledgeAgenda(s) : [];
  for (let n = items.length; n < AGENDA.items; n++) {
    const left = pool.filter((x) => !items.some((i) => i.kpi === x.k));
    let r = hash01("agenda", s.seed, s.geCount, s.parliament.pm, n) * left.reduce((a, x) => a + x.w, 0);
    const k = (left.find((x) => (r -= x.w) <= 0) ?? left.at(-1)!).k;
    items.push({ kpi: k, from: s.nation[k], target: targetFor(k, s.nation[k]) });
  }
  return { term: s.geCount, by: s.parliament.pm, week: s.week, items, start: snapshot(s) };
}

export const agendaText = (it: AgendaItem) => `${KPI_INFO[it.kpi].label} ${KPI_INFO[it.kpi].upIsGood ? "up to" : "down to"} ${KPI_INFO[it.kpi].fmt(it.target)}${it.pledge ? ` (${it.pledge})` : ""}`;

/** Weekly: a new government sets its agenda; kept promises build approval each month. */
export function agendaWeek(s: GameState): { state: GameState; lines: ReportLine[] } {
  const lines: ReportLine[] = [];
  let state = s;
  if (s.parliament.status === "sitting" && (!s.agenda || s.agenda.term !== s.geCount || s.agenda.by !== s.parliament.pm)) {
    const agenda = rollAgenda(s);
    state = { ...state, agenda };
    lines.push({ text: `The ${cshort(agenda.by)} government's promises for this term: ${agenda.items.map(agendaText).join("; ")}.`, tone: "info" });
  } else if (s.agenda && s.week % 4 === 0) {
    const met = s.agenda.items.filter((it) => itemMet(s, it)).length;
    if (met) state = { ...state, nation: { ...state.nation, approval: clamp(state.nation.approval + met * AGENDA.monthlyApproval, 5, 95) } };
  }
  // The campaign begins: the government's record goes before the voters.
  if (s.parliament.status === "campaign" && state.agenda && !state.agenda.judged) {
    const card = reportCard(state);
    const by = state.agenda.by;
    state = { ...state, agenda: { ...state.agenda, judged: true } };
    if (card) {
      state = bump(bump(state, by, "execution", card.grade * RECORD_SWAY.execution), by, "principle", card.grade * RECORD_SWAY.principle);
      const whose = by === s.player ? "Your" : `The ${cshort(by)}`;
      lines.push({ text: `${whose} government's record goes before the voters: ${card.kept} of ${card.total} promises kept. ${card.verdict}`, tone: by === s.player ? (card.grade >= 0 ? "good" : "bad") : "info" });
    }
  }
  return { state, lines };
}

/** A broken promise: a KPI the government pledged to fix and hasn't. */
export const brokenPromise = (s: GameState, k: Kpi) => !!s.agenda && s.week - s.agenda.week >= AGENDA.grace && s.agenda.items.some((it) => it.kpi === k && !itemMet(s, it));

// --- The opposition -------------------------------------------------------------------------------

export interface Probe {
  /** What you're digging into. */
  title: string;
  post: PortfolioId;
  progress: number;
  /** 0–1: how solid the evidence is. */
  quality: number;
  startWeek: number;
}

export interface Opposition {
  /** Shadow posts → person id (your coalition's MPs). */
  shadow: Partial<Record<PortfolioId, number>>;
  /** Last week each number was attacked. */
  critiqued: Partial<Record<Kpi, number>>;
  probe: Probe | null;
  rallyWeek: number;
  /** Motion ids already challenged in court. */
  challenged: number[];
}

export const initOpposition = (): Opposition => ({ shadow: {}, critiqued: {}, probe: null, rallyWeek: -99, challenged: [] });

export const OPP = {
  critique: { ap: 1, cost: 50_000, cooldown: 4 },
  probe: { ap: 2, cost: 300_000, perWeek: 9 },
  rally: { ap: 3, cost: 800_000, cooldown: 12, crackdown: 0.3, riot: 0.08 },
  court: { ap: 2, cost: 500_000, chance: 0.3, window: 52 },
};

const PROBES: { title: string; post: PortfolioId }[] = [
  { title: "the Finance Ministry's procurement contracts", post: "finance" },
  { title: "a mega-project's ballooning costs", post: "works" },
  { title: "land deals at the Housing Ministry", post: "housing" },
  { title: "a defence equipment purchase", post: "defence" },
  { title: "grants to the minister's own constituency", post: "rural" },
  { title: "a telco licence handed to a crony", post: "communications" },
  { title: "the hospital supplies tender", post: "health" },
];

const inOpposition = (s: GameState) => !s.government.includes(s.player);

/** The shadow minister for a post, and how much they add (0.5 – 1.5). */
export function shadowBoost(s: GameState, post: PortfolioId): number {
  const p = byId(s, s.opp.shadow[post]);
  return p ? 0.5 + p.competence / 100 : 0.7;
}

export function critiqueBlocked(s: GameState, k: Kpi): string | null {
  if (!inOpposition(s)) return "Opposition only.";
  if (s.me.ap < OPP.critique.ap) return `Needs ${OPP.critique.ap} AP.`;
  if (s.me.funds < OPP.critique.cost) return "Not enough money.";
  const last = s.opp.critiqued[k];
  if (last !== undefined && s.week - last < OPP.critique.cooldown) return "You hit that one recently.";
  return null;
}

/** Attack the government on one number: the worse it is (and if they promised to fix it), the harder it lands. */
export function critique(s: GameState, k: Kpi): { state: GameState; message: string } | { error: string } {
  const why = critiqueBlocked(s, k);
  if (why) return { error: why };
  const bad = badness(s, k);
  const broken = brokenPromise(s, k);
  // Under an allocations MoU with the government, your attacks are softer.
  const power = bad * shadowBoost(s, KPI_INFO[k].post) * (broken ? AGENDA.brokenBonus : 1) * (0.5 + s.me.reach / 100) * (s.funding?.mou ? 0.7 : 1);
  let me = { ...s.me, ap: s.me.ap - OPP.critique.ap, funds: s.me.funds - OPP.critique.cost };
  let nation = s.nation;
  let message: string;
  if (bad < 0.12) {
    me = { ...me, nationalBuzz: clamp(me.nationalBuzz - 2) };
    message = `The attack on ${KPI_INFO[k].label.toLowerCase()} falls flat: the number isn't that bad, and voters can see it.`;
  } else {
    me = { ...me, nationalBuzz: clamp(me.nationalBuzz + 3 + 10 * power), capital: me.capital + Math.round(3 * power) };
    nation = { ...nation, approval: clamp(nation.approval - (0.5 + 2.5 * power), 5, 95) };
    message = `${broken ? "A broken promise: " : ""}your attack on ${KPI_INFO[k].label.toLowerCase()} (${KPI_INFO[k].fmt(s.nation[k])}) leads the news.`;
  }
  return { state: { ...s, me, nation, opp: { ...s.opp, critiqued: { ...s.opp.critiqued, [k]: s.week } } }, message };
}

export function startProbe(s: GameState): { state: GameState; message: string } | { error: string } {
  if (!inOpposition(s)) return { error: "Opposition only." };
  if (s.opp.probe) return { error: "You already have an investigation running." };
  if (s.me.ap < OPP.probe.ap) return { error: `Needs ${OPP.probe.ap} AP.` };
  if (s.me.funds < OPP.probe.cost) return { error: "Not enough money." };
  const t = PROBES[Math.floor(hash01("probe", s.seed, s.week) * PROBES.length)];
  const quality = 0.35 + hash01("probeq", s.seed, s.week) * 0.55;
  return {
    state: { ...s, me: { ...s.me, ap: s.me.ap - OPP.probe.ap, funds: s.me.funds - OPP.probe.cost }, opp: { ...s.opp, probe: { ...t, progress: 0, quality, startWeek: s.week } } },
    message: `Your researchers start digging into ${t.title}. It will take a few months.`,
  };
}

export const evidenceLabel = (q: number) => (q >= 0.75 ? "strong" : q >= 0.55 ? "solid" : "thin");

/** Go public: the better the evidence and the further along, the likelier it lands. */
export function publishProbe(s: GameState): { state: GameState; lines: ReportLine[] } {
  const p = s.opp.probe;
  if (!p) return { state: s, lines: [] };
  const chance = p.quality * Math.min(1, p.progress / 100) * (0.6 + shadowBoost(s, p.post) * 0.4);
  const lands = hash01("publish", s.seed, s.week, p.startWeek) < chance;
  const lines: ReportLine[] = [];
  let state: GameState = { ...s, opp: { ...s.opp, probe: null } };
  if (lands) {
    const minister = byId(s, s.cabinet[p.post]);
    state = {
      ...state,
      me: { ...state.me, nationalBuzz: clamp(state.me.nationalBuzz + 15), capital: state.me.capital + 10 },
      nation: { ...state.nation, approval: clamp(state.nation.approval - 6, 5, 95) },
      cabinet: minister && s.government.includes(s.player) === false ? { ...state.cabinet, [p.post]: undefined } : state.cabinet,
    };
    state = bump(bump(state, s.parliament.pm, "principle", -8), s.parliament.pm, "execution", -3);
    lines.push({ text: `Your exposé on ${p.title} lands${minister ? `: ${minister.name} resigns` : ""}. The government reels.`, tone: "good" });
  } else {
    state = { ...state, me: { ...state.me, integrity: clamp(state.me.integrity - 6), scandal: clamp(state.me.scandal + 12), funds: state.me.funds - 500_000 } };
    state = bump(state, s.player, "credibility", -5, "your failed exposé");
    lines.push({ text: `Your claims about ${p.title} fall apart. A defamation suit costs RM 500k and your credibility.`, tone: "bad" });
  }
  return { state, lines };
}

export function rallyBlocked(s: GameState): string | null {
  if (!inOpposition(s)) return "Opposition only.";
  if (s.week - s.opp.rallyWeek < OPP.rally.cooldown) return `Your supporters need a rest (${OPP.rally.cooldown - (s.week - s.opp.rallyWeek)} weeks).`;
  if (s.me.ap < OPP.rally.ap) return `Needs ${OPP.rally.ap} AP.`;
  return s.me.funds < OPP.rally.cost ? "Not enough money." : null;
}

/** A Bersih-style street rally: a big moment, with real risks. */
export function streetRally(s: GameState): { state: GameState; message: string } | { error: string } {
  const why = rallyBlocked(s);
  if (why) return { error: why };
  const roll = hash01("rally", s.seed, s.week);
  let me = { ...s.me, ap: s.me.ap - OPP.rally.ap, funds: s.me.funds - OPP.rally.cost, nationalBuzz: clamp(s.me.nationalBuzz + 12 * (0.5 + s.me.reach / 100)) };
  me = { ...me, mood: addSeg(me.mood, { urban: 0.03, youth: 0.03 }) };
  let message = "Tens of thousands march through Kuala Lumpur in yellow. The government looks rattled.";
  if (roll < OPP.rally.riot) {
    me = { ...me, integrity: clamp(me.integrity - 8), mood: addSeg(me.mood, { rural: -0.03, malay: -0.02 }) };
    message = "The rally turns ugly: clashes, smashed shopfronts, and the headlines turn on you.";
  } else if (roll < OPP.rally.crackdown) {
    me = { ...me, nationalBuzz: clamp(me.nationalBuzz + 5), mood: addSeg(me.mood, { all: 0.01 }) };
    message = "Police fire tear gas and water cannon. The pictures win you sympathy across the country.";
  }
  return { state: { ...s, me, nation: { ...s.nation, approval: clamp(s.nation.approval - 2, 5, 95) }, opp: { ...s.opp, rallyWeek: s.week } }, message };
}

/** Bills the government passed recently that you could take to court. */
export const challengeable = (s: GameState) =>
  [...s.dewan.motions, ...s.dewan.history].filter((m) => m.result?.passed && m.kind !== "royal" && m.kind !== "oppMotion" && s.week - m.voteWeek < OPP.court.window && !s.opp.challenged.includes(m.id));

export function courtChallenge(s: GameState, motionId: number): { state: GameState; message: string } | { error: string } {
  if (!inOpposition(s)) return { error: "Opposition only." };
  const m = challengeable(s).find((x) => x.id === motionId);
  if (!m) return { error: "Nothing to challenge." };
  if (s.me.ap < OPP.court.ap) return { error: `Needs ${OPP.court.ap} AP.` };
  if (s.me.funds < OPP.court.cost) return { error: "Not enough money." };
  const wins = hash01("court", s.seed, m.id) < OPP.court.chance + (m.kind === "constitutional" ? 0.1 : 0);
  const me = { ...s.me, ap: s.me.ap - OPP.court.ap, funds: s.me.funds - OPP.court.cost, capital: s.me.capital + (wins ? 10 : -4) };
  const nation = wins ? { ...s.nation, approval: clamp(s.nation.approval - 3, 5, 95) } : s.nation;
  return {
    state: { ...s, me, nation, opp: { ...s.opp, challenged: [...s.opp.challenged, m.id] } },
    message: wins ? `The Federal Court strikes down the ${m.title}. A humiliation for the government.` : `The court upholds the ${m.title}. Your challenge fails.`,
  };
}

/** Weekly: the investigation moves on; it goes public by itself when it's done. */
export function oppositionWeek(input: GameState): { state: GameState; lines: ReportLine[] } {
  // A new opposition names its shadow cabinet straight away (you can change it).
  const s = inOpposition(input) && !Object.keys(input.opp.shadow).length ? { ...input, opp: { ...input.opp, shadow: defaultShadow(input) } } : input;
  const p = s.opp.probe;
  if (!p) return { state: s, lines: [] };
  if (!inOpposition(s)) return { state: { ...s, opp: { ...s.opp, probe: null } }, lines: [{ text: "In government now, you shelve your investigation.", tone: "info" }] };
  const progress = Math.min(100, p.progress + OPP.probe.perWeek * (0.6 + s.me.reach / 100));
  const next = { ...s, opp: { ...s.opp, probe: { ...p, progress } } };
  if (progress >= 100) return publishProbe(next);
  return { state: next, lines: [] };
}

/** Your shadow cabinet: the best of your coalition's MPs in the posts that shadow each number. */
export function defaultShadow(s: GameState): Partial<Record<PortfolioId, number>> {
  const parties = s.coalitions[s.player].members;
  const pool = s.people.filter((p) => parties.includes(p.party) && p.seat !== null && !p.retired && p.id !== s.youId).sort((a, b) => b.competence + b.influence - (a.competence + a.influence));
  const posts = [...new Set(KPIS.map((k) => KPI_INFO[k].post)), "health", "education", "home"] as PortfolioId[];
  const out: Partial<Record<PortfolioId, number>> = {};
  posts.forEach((post, n) => {
    if (pool[n]) out[post] = pool[n].id;
  });
  return out;
}

export function setShadow(s: GameState, post: PortfolioId, id: number | null): { state: GameState; message: string } | { error: string } {
  if (!inOpposition(s)) return { error: "Only the opposition names a shadow cabinet." };
  const shadow = { ...s.opp.shadow };
  for (const k of Object.keys(shadow) as PortfolioId[]) if (shadow[k] === id) delete shadow[k];
  if (id === null) delete shadow[post];
  else shadow[post] = id;
  const p = byId(s, id ?? undefined);
  const people = p ? s.people.map((x) => (x.id === p.id ? { ...x, loyalty: clamp(x.loyalty + 5) } : x)) : s.people;
  return { state: { ...s, people, opp: { ...s.opp, shadow } }, message: p ? `${p.name} is your shadow minister.` : "Post left empty." };
}
