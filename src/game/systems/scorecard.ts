// What voters judge a party on: four pillars, 0–100, for every coalition.
// - Policies: "their plans help people like me". Your stances (policies.ts) decide who they help, seat by seat; this
//   pillar is how well the plan is known and argued (policy launches, debates).
// - Principle: "they mean what they say". Integrity and scandal set where it rests; dark money, flip-flops, frogs and
//   broken promises knock it down; endorsements and standing firm lift it.
// - Execution: "they get things done". In government the economy and approval; in opposition the states you run and
//   a real shadow cabinet. Showcasing delivery lifts it.
// - Credibility: "they could actually run Malaysia". Size (no wasted vote), being in government, and a costed plan.
//   Uncosted giveaways drag it down until you publish the costings.
// Only movement counts: each coalition's starting pillars are recorded at the start, so today's map (GE15) is the
// baseline. Different voters weigh different pillars (urban and young voters principle, rural and B40 voters
// delivery), and your ground work decides how much of your case reaches a seat. Draws are hash01. Numbers TEMPORARY.

import { edgeOf, standing } from "../config";
import { hash01 } from "../rng";
import type { GameState, ReportLine } from "../state";
import { COALITIONS, SEATS, SUPERMAJORITY, cshort, type CoalitionId } from "../world";
import { POLICY_BY_ID } from "./policies";
import { addSeg, type SegEffects } from "./segments";
import { stateRulers } from "./assemblies";
import { serviceBase } from "../bases";
import { brokenPromise, itemMet } from "./agenda";
import { PORTFOLIO_KPI, ministerEffect } from "./nation";
import type { PortfolioId } from "../data/people";

export type Pillar = "policies" | "principle" | "execution" | "credibility";
export const PILLARS: Pillar[] = ["policies", "principle", "execution", "credibility"];
export type Scores = Record<Pillar, number>;

export const PILLAR_INFO: Record<Pillar, { name: string; voter: string }> = {
  policies: { name: "Policies", voter: "Their plans help people like me" },
  principle: { name: "Principle", voter: "They mean what they say" },
  execution: { name: "Execution", voter: "They get things done" },
  credibility: { name: "Credibility", voter: "They could actually run Malaysia" },
};

export interface Hit {
  pillar: Pillar;
  amount: number;
  week: number;
  by: string;
  rebutted?: boolean;
}

export interface Scorecard {
  now: Record<CoalitionId, Scores>;
  start: Record<CoalitionId, Scores>;
  /** Blows to your pillars, for rebuttals. */
  hits: Hit[];
  /** When you last exposed each rival (they hit back). */
  exposed: Partial<Record<CoalitionId, number>>;
  /** Weeks each move was last used (for diminishing returns and cooldowns). */
  used: Record<string, number[]>;
  /** Your plan has been costed since this week (null: uncosted pledges are open to attack). */
  costedWeek: number | null;
  /** The week of this campaign's leaders' debate. */
  debateWeek: number | null;
}

export const SCORE = {
  /** Log-odds per pillar point away from the start, before seat weights. */
  perPoint: 0.0045,
  /** Weekly pull toward each pillar's resting value. */
  pull: { policies: 0.03, principle: 0.03, execution: 0.05, credibility: 0.05 } as Scores,
  /** Repeats of a move within this many weeks give less. */
  window: 8,
  /** Ground work: how much of your case reaches a seat with no presence at all. */
  reachFloor: 0.55,
  /** Past a two-thirds majority, voters see arrogance: Principle and Credibility settle lower per extra seat, and rivals attack more. */
  arrogancePerSeat: 0.5,
};

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
const seatsOf = (s: GameState, c: CoalitionId) => s.holders.filter((h) => h === c).length;

// --- Resting values -------------------------------------------------------------------------------

/** The money your pledges would cost that you haven't shown how to pay for (fiscal points). */
export function unfunded(s: GameState): number {
  let v = 0;
  for (const [id, idx] of Object.entries(s.me.policies)) v += Math.max(0, -(POLICY_BY_ID[id]?.options[idx]?.fiscal ?? 0));
  return v;
}

/** Where each pillar settles for a coalition if nothing happens. */
export function restingScores(s: GameState, c: CoalitionId): Scores {
  const gov = s.government.includes(c);
  const mine = c === s.player;
  const ruled = Object.values(stateRulers(s.dunHolders, s.government)).filter((r) => r === c).length;
  const approval = s.nation?.approval ?? 50;
  // Your own government is also judged on the promises it made (met: up; broken: down).
  const promises = mine && gov && s.agenda ? s.agenda.items.reduce((a, it) => a + (itemMet(s, it) ? 3 : brokenPromise(s, it.kpi) ? -3 : 0), 0) : 0;
  // A strong cabinet is seen to get things done; a cabinet of warlords is not.
  const cabinet = mine && gov ? (Object.keys(PORTFOLIO_KPI) as PortfolioId[]).reduce((a, p) => a + ministerEffect(s, p), 0) * 1.2 : 0;
  const execution = gov
    ? 50 + (s.economy - 55) * 0.8 + (approval - 50) * 0.4 + promises + cabinet
    : 44 + ruled * 3 + (mine && Object.keys(s.opp?.shadow ?? {}).length >= 4 ? 5 : 0);
  const costed = mine && s.scorecard?.costedWeek === null ? -Math.min(15, unfunded(s) * 0.5) : 0;
  const credibility = 38 + Math.min(30, seatsOf(s, c) / 4) + (gov ? 6 : 0) + costed;
  const arrogance = Math.max(0, (mine ? standing(s) : seatsOf(s, c)) - SUPERMAJORITY) * SCORE.arrogancePerSeat;
  // A government that breaks its word loses trust, not just competence.
  const brokenWord = gov && s.agenda?.by === c ? s.agenda.items.filter((it) => brokenPromise(s, it.kpi)).length * 2 : 0;
  const principle = (mine ? 50 + (s.me.integrity - 60) * 0.6 - s.me.scandal * 0.3 : 50) - arrogance - brokenWord;
  return { policies: 50, principle: clamp(principle), execution: clamp(execution), credibility: clamp(credibility - arrogance) };
}

export function initScorecard(s: GameState): Scorecard {
  const pre: GameState = { ...s, scorecard: { costedWeek: 0 } as Scorecard };
  const now = Object.fromEntries(COALITIONS.map((c) => [c, restingScores(pre, c)])) as Record<CoalitionId, Scores>;
  return { now, start: structuredClone(now), hits: [], exposed: {}, used: {}, costedWeek: 0, debateWeek: null };
}

// --- The vote -------------------------------------------------------------------------------------

/** How much each seat's voters care about each pillar. */
const WEIGHTS: Scores[] = SEATS.map((x) => {
  const d = x.demo;
  return {
    policies: 1,
    principle: 0.7 + 0.5 * d.urbanity + 0.3 * (d.youth / 0.3 - 1),
    execution: 0.7 + 0.4 * (1 - d.urbanity) + 0.4 * (d.b40 / 0.5),
    credibility: 0.8 + 0.4 * d.urbanity,
  };
});
export const pillarWeight = (i: number, p: Pillar) => WEIGHTS[i][p];

/** How much of your case reaches a seat: your local presence (buzz and service) and national reach. */
export function reach(s: GameState, i: number): number {
  const local = (s.me.buzz[i] + Math.max(0, s.me.service[i] - serviceBase(s.player, i))) / 50 + s.me.nationalBuzz / 200;
  return SCORE.reachFloor + (1 - SCORE.reachFloor) * Math.min(1, local);
}

/** A coalition's log-odds in a seat from its pillars, by pillar (positive helps). */
export function pillarRows(s: GameState, c: CoalitionId, i: number): Scores {
  const sc = s.scorecard;
  const out = { policies: 0, principle: 0, execution: 0, credibility: 0 };
  if (!sc?.now[c]) return out;
  const mine = c === s.player;
  for (const p of PILLARS) {
    let v = (sc.now[c][p] - sc.start[c][p]) * SCORE.perPoint * WEIGHTS[i][p];
    // Your good case is amplified by your edge, and travels as far as your ground work carries it.
    if (mine && v > 0) v *= edgeOf(s) * reach(s, i);
    out[p] = v;
  }
  return out;
}

export const pillarEffect = (s: GameState, c: CoalitionId, i: number) => {
  const r = pillarRows(s, c, i);
  return r.policies + r.principle + r.execution + r.credibility;
};

// --- Changes --------------------------------------------------------------------------------------

/** Move one coalition's pillar (and remember blows to yours, for rebuttals). */
export function bump(s: GameState, c: CoalitionId, p: Pillar, d: number, by = ""): GameState {
  const sc = s.scorecard;
  if (!sc?.now[c] || !d) return s;
  // Each point is harder to win the higher you already stand.
  const v = sc.now[c][p];
  const gain = d > 0 ? d * Math.min(1, Math.max(0.1, (100 - v) / 50)) : d;
  const now = { ...sc.now, [c]: { ...sc.now[c], [p]: clamp(v + gain) } };
  const hits = c === s.player && d < 0 ? [{ pillar: p, amount: -d, week: s.week, by }, ...sc.hits].slice(0, 8) : sc.hits;
  return { ...s, scorecard: { ...sc, now, hits } };
}

/** Repeating a move within the window gives less: 1, 0.67, 0.5, 0.4… */
export function freshness(s: GameState, key: string): number {
  const n = (s.scorecard?.used[key] ?? []).filter((w) => w > s.week - SCORE.window).length;
  return 1 / (1 + n * 0.5);
}
const markUsed = (s: GameState, key: string): GameState => {
  const sc = s.scorecard;
  return { ...s, scorecard: { ...sc, used: { ...sc.used, [key]: [s.week, ...(sc.used[key] ?? [])].slice(0, 6) } } };
};

/** A pledge changes: dropping one you stood on looks like a flip-flop, and new spending needs costing. */
export function onPledgeChange(s: GameState, policyId: string, from: number, to: number): GameState {
  let next = s;
  if (from !== 0) next = bump(next, s.player, "principle", -4, "a U-turn on your pledges");
  const cost = POLICY_BY_ID[policyId]?.options[to]?.fiscal ?? 0;
  if (cost < 0) next = { ...next, scorecard: { ...next.scorecard, costedWeek: null } };
  return bump(next, s.player, "policies", 2);
}

// --- The weekly drift and the rivals' own campaigns ------------------------------------------------

export function scorecardWeek(s: GameState, phase: "early" | "mid" | "late"): { state: GameState; lines: ReportLine[] } {
  const sc = s.scorecard;
  if (!sc) return { state: s, lines: [] };
  const lines: ReportLine[] = [];
  const now = { ...sc.now };
  for (const c of COALITIONS) {
    const rest = restingScores(s, c);
    const cur = { ...now[c] };
    for (const p of PILLARS) cur[p] = clamp(cur[p] + (rest[p] - cur[p]) * SCORE.pull[p]);
    now[c] = cur;
  }
  let state: GameState = { ...s, scorecard: { ...sc, now } };
  const hot = phase === "late" ? 2 : phase === "mid" ? 1.4 : 1;
  // Everyone gangs up on a party that could rewrite the Constitution alone.
  const gang = 1 + Math.max(0, standing(s) - SUPERMAJORITY) / 15;
  for (const c of COALITIONS) {
    if (c === s.player || c === "OTHERS" || !seatsOf(s, c)) continue;
    const roll = (k: string) => hash01("pillar", s.seed, s.week, c, k);
    // Power corrupts the others: their governments see more scandals and deliver less than they promise.
    const governs = s.government.includes(c);
    if (roll("scandal") < (governs ? 0.05 : 0.025)) {
      state = bump(state, c, "principle", -6);
      lines.push({ text: governs ? `A scandal in the ${cshort(c)} government: another minister in the news for the wrong reasons.` : `A scandal hits ${cshort(c)}: their principle takes a knock.`, tone: "info" });
    }
    if (roll("launch") < 0.05 * hot) state = bump(state, c, "policies", 4);
    if (governs && roll("deliver") < 0.02) state = bump(state, c, "execution", 3);
    if (governs && s.parliament.pm === c && roll("fumble") < 0.04) {
      state = bump(state, c, "execution", -4);
      lines.push({ text: `The ${cshort(c)} government fumbles: a botched rollout, a U-turn, a project behind schedule.`, tone: "info" });
    }
    // They hit back when you go after them.
    const ex = sc.exposed[c];
    if (ex !== undefined && ex >= s.week - 3 && ex < s.week && roll("retaliate") < 0.6) {
      state = bump(state, s.player, "principle", -5, cshort(c));
      state = { ...state, scorecard: { ...state.scorecard, exposed: { ...state.scorecard.exposed, [c]: undefined } } };
      lines.push({ text: `${cshort(c)} hits back, digging into your own record. Rebut it while it's fresh.`, tone: "bad" });
    } else if (!s.government.includes(c) !== !s.government.includes(s.player) && roll("attack") < 0.025 * hot * gang) {
      const p: Pillar = s.government.includes(s.player) ? "execution" : roll("which") < 0.5 ? "principle" : "credibility";
      state = bump(state, s.player, p, -4, cshort(c));
      lines.push({ text: `${cshort(c)} goes after your ${PILLAR_INFO[p].name.toLowerCase()}. Rebut it while it's fresh.`, tone: "bad" });
    }
  }
  return { state, lines };
}

// --- Your campaign moves --------------------------------------------------------------------------

export type Endorser = "economists" | "ulama" | "ngos" | "borneo";
export const ENDORSERS: Record<Endorser, { name: string; pillar: Pillar; gain: number; cost: number; mood: SegEffects; blurb: string }> = {
  economists: {
    name: "Economists",
    pillar: "credibility",
    gain: 7,
    cost: 300_000,
    mood: { urban: 0.02 },
    blurb: "Leading economists vouch for your numbers. Needs a costed plan.",
  },
  ulama: {
    name: "Ulama",
    pillar: "principle",
    gain: 5,
    cost: 200_000,
    mood: { malay: 0.03 },
    blurb: "Respected religious scholars speak for your character. Moves Malay voters.",
  },
  ngos: {
    name: "Civil society",
    pillar: "principle",
    gain: 5,
    cost: 150_000,
    mood: { urban: 0.03, youth: 0.02 },
    blurb: "Bersih-style NGOs back your reform record. Moves urban and young voters.",
  },
  borneo: {
    name: "Borneo leaders",
    pillar: "policies",
    gain: 4,
    cost: 250_000,
    mood: { sabah: 0.04, sarawak: 0.04 },
    blurb: "Community leaders in Sabah and Sarawak back your MA63 stand.",
  },
};
export const ENDORSE_COOLDOWN = 26;

export type DebateLine = "attack" | "plan" | "empathy" | "record" | "broken";
export const DEBATE: Record<DebateLine, { name: string; blurb: string; pillars: Pillar[]; only?: "gov" | "opp" }> = {
  attack: {
    name: "Attack their record",
    blurb: "Go after what they've done. Strong when their principle or execution is weak.",
    pillars: ["principle", "execution"],
  },
  plan: {
    name: "Present your plan",
    blurb: "Walk the country through your manifesto. Strong when your policies and credibility lead.",
    pillars: ["policies", "credibility"],
  },
  empathy: {
    name: "Speak to their worries",
    blurb: "Cost of living, jobs, the kampung. Strong when your principle is trusted.",
    pillars: ["principle", "policies"],
  },
  record: {
    name: "Defend your record",
    blurb: "Promises kept, numbers that improved. Strong when you have delivered.",
    pillars: ["execution", "principle"],
    only: "gov",
  },
  broken: {
    name: "Their broken promises",
    blurb: "Hold up every promise they failed to keep. Strong when they've broken many.",
    pillars: ["execution", "credibility"],
    only: "opp",
  },
};

/** The government's record as a debate edge: −1 … 1 (promises kept minus broken, as a share). */
export function recordEdge(s: GameState): number {
  const a = s.agenda;
  if (!a || !a.items.length) return 0;
  const kept = a.items.filter((it) => itemMet(s, it)).length;
  const broken = a.items.filter((it) => brokenPromise(s, it.kpi)).length;
  return (kept - broken) / a.items.length;
}

export const MOVES = {
  launch: { name: "Policy launch", ap: 2, cost: 200_000, blurb: "A big-stage launch of one plank of your manifesto. Raises Policies." },
  whitePaper: {
    name: "Publish costings",
    ap: 3,
    cost: 400_000,
    blurb: "A costed white paper: shows how you'd pay for every pledge. Raises Credibility; uncosted giveaways stop hurting.",
  },
  expose: {
    name: "Expose a rival",
    ap: 2,
    cost: 150_000,
    capital: 10,
    blurb: "Lay out their failings. Lands with evidence (an investigation in progress) and a clean record of your own; backfires without.",
  },
  showcase: {
    name: "Showcase delivery",
    ap: 2,
    cost: 150_000,
    blurb: "Ribbon-cutting on what you've built: in government, or in a state you run. Raises Execution.",
  },
  rebut: { name: "Rebut", ap: 1, cost: 50_000, blurb: "Answer the latest attack before it sticks: wins back most of the damage." },
  endorse: { name: "Seek an endorsement", ap: 2 },
  debate: { name: "Leaders' debate", ap: 2, cost: 100_000 },
} as const;

export type CaseMove =
  | { move: "launch" }
  | { move: "whitePaper" }
  | { move: "expose"; target: CoalitionId; pillar: "principle" | "execution" }
  | { move: "showcase" }
  | { move: "rebut" }
  | { move: "endorse"; who: Endorser }
  | { move: "debate"; line: DebateLine };

const pay = (s: GameState, ap: number, cost: number, capital = 0): GameState => ({
  ...s,
  me: { ...s.me, ap: s.me.ap - ap, funds: s.me.funds - cost, capital: s.me.capital - capital },
});

/** The rival you'd face in a debate: the biggest other coalition. */
export const debateRival = (s: GameState) => COALITIONS.filter((c) => c !== s.player && c !== "OTHERS").sort((a, b) => seatsOf(s, b) - seatsOf(s, a))[0];

export const latestHit = (s: GameState) => s.scorecard?.hits.find((h) => !h.rebutted && h.week >= s.week - 3);

export function caseBlocked(s: GameState, m: CaseMove): string | null {
  const def = MOVES[m.move];
  const cost = m.move === "endorse" ? ENDORSERS[m.who].cost : "cost" in def ? def.cost : 0;
  if (s.me.ap < def.ap) return `Needs ${def.ap} AP.`;
  if (s.me.funds < cost) return "Not enough money.";
  if (m.move === "expose" && s.me.capital < MOVES.expose.capital) return `Needs ${MOVES.expose.capital} political capital.`;
  const sc = s.scorecard;
  switch (m.move) {
    case "whitePaper":
      return sc.costedWeek !== null && unfunded(s) === 0
        ? "Nothing to cost: your pledges don't spend money."
        : sc.costedWeek !== null
          ? "Your plan is already costed."
          : null;
    case "expose":
      return m.target === s.player || !seatsOf(s, m.target) ? "Pick a rival." : null;
    case "showcase": {
      const ruled = Object.values(stateRulers(s.dunHolders, s.government)).includes(s.player);
      return s.government.includes(s.player) || ruled ? null : "You need a record: be in government or run a state.";
    }
    case "rebut":
      return latestHit(s) ? null : "No fresh attack to answer.";
    case "endorse": {
      const last = sc.used[`endorse:${m.who}`]?.[0];
      if (last !== undefined && last > s.week - ENDORSE_COOLDOWN) return "They've spoken for you recently.";
      if (m.who === "economists" && sc.costedWeek === null && unfunded(s) > 0) return "Economists won't back uncosted pledges.";
      if (m.who !== "economists" && sc.now[s.player].principle < 40) return "Your principle is too weak for them to stand with you.";
      return null;
    }
    case "debate":
      if (s.parliament.status !== "campaign") return "Debates happen during the election campaign.";
      if (DEBATE[m.line].only === "gov" && !s.government.includes(s.player)) return "Only a government has a record to defend.";
      if (DEBATE[m.line].only === "opp" && (s.government.includes(s.player) || recordEdge(s) >= 0))
        return "Only works against a government that broke its promises.";
      return sc.debateWeek !== null && sc.debateWeek >= s.week - 4 ? "You've had this campaign's debate." : null;
    default:
      return null;
  }
}

export function caseMove(s: GameState, m: CaseMove): { state: GameState; message: string } | { error: string } {
  const why = caseBlocked(s, m);
  if (why) return { error: why };
  const me = s.player;
  const sc = s.scorecard;
  switch (m.move) {
    case "launch": {
      const f = freshness(s, "launch");
      let next = markUsed(pay(s, MOVES.launch.ap, MOVES.launch.cost), "launch");
      next = bump(next, me, "policies", 7 * f);
      next = { ...next, me: { ...next.me, nationalBuzz: clamp(next.me.nationalBuzz + 4 * f) } };
      return {
        state: next,
        message:
          f < 1
            ? "Another launch: the press is tiring of them, but it still helps."
            : "Your policy launch makes the evening news. Voters know what you stand for.",
      };
    }
    case "whitePaper": {
      let next = pay(s, MOVES.whitePaper.ap, MOVES.whitePaper.cost);
      next = { ...next, scorecard: { ...next.scorecard, costedWeek: s.week } };
      next = bump(bump(next, me, "credibility", 6), me, "policies", 2);
      return { state: next, message: "You publish full costings. Economists are impressed; your rivals' giveaways look reckless next to it." };
    }
    case "expose": {
      const evidence = (s.opp?.probe?.progress ?? 0) >= 50 ? 0.25 : 0;
      const chance = Math.min(0.9, Math.max(0.1, 0.35 + (sc.now[me].principle - sc.now[m.target][m.pillar]) / 100 + evidence));
      let next = pay(s, MOVES.expose.ap, MOVES.expose.cost, MOVES.expose.capital);
      next = { ...next, scorecard: { ...next.scorecard, exposed: { ...next.scorecard.exposed, [m.target]: s.week } } };
      if (hash01("expose", s.seed, s.week, m.target) < chance) {
        next = bump(next, m.target, m.pillar, -9);
        next = { ...next, me: { ...next.me, nationalBuzz: clamp(next.me.nationalBuzz + 5) } };
        return { state: next, message: `Your exposé of ${cshort(m.target)}'s ${PILLAR_INFO[m.pillar].name.toLowerCase()} lands. Expect them to hit back.` };
      }
      next = bump(next, me, "principle", -5, "your own smear backfiring");
      return { state: next, message: `Your attack on ${cshort(m.target)} falls flat and looks like a smear.${evidence ? "" : " Next time, have evidence."}` };
    }
    case "showcase": {
      const f = freshness(s, "showcase");
      const next = bump(markUsed(pay(s, MOVES.showcase.ap, MOVES.showcase.cost), "showcase"), me, "execution", 6 * f);
      return { state: next, message: "Ribbon-cutting and before-and-after photos: proof you deliver." };
    }
    case "rebut": {
      const h = latestHit(s)!;
      let next = pay(s, MOVES.rebut.ap, MOVES.rebut.cost);
      next = bump(next, me, h.pillar, h.amount * 0.7);
      next = {
        ...next,
        scorecard: {
          ...next.scorecard,
          hits: next.scorecard.hits.map((x) => (x === h || (x.week === h.week && x.pillar === h.pillar && x.by === h.by) ? { ...x, rebutted: true } : x)),
        },
      };
      return { state: next, message: `You answer ${h.by || "the attack"} point by point. Most of it doesn't stick.` };
    }
    case "endorse": {
      const e = ENDORSERS[m.who];
      let next = markUsed(pay(s, MOVES.endorse.ap, e.cost), `endorse:${m.who}`);
      next = bump(next, me, e.pillar, e.gain);
      next = { ...next, me: { ...next.me, mood: addSeg(next.me.mood, e.mood) } };
      return { state: next, message: `${e.name} come out for you.` };
    }
    case "debate": {
      const rival = debateRival(s);
      const d = DEBATE[m.line];
      const gap = d.pillars.reduce((a, p) => a + sc.now[me][p] - sc.now[rival][p], 0) / d.pillars.length;
      const record = m.line === "record" ? recordEdge(s) * 0.3 : m.line === "broken" ? -recordEdge(s) * 0.3 : 0;
      const chance = Math.min(0.85, Math.max(0.15, 0.5 + gap / 60 + (edgeOf(s) - 1) * 0.3 + record));
      let next = pay(s, MOVES.debate.ap, MOVES.debate.cost);
      next = { ...next, scorecard: { ...next.scorecard, debateWeek: s.week } };
      if (hash01("debate", s.seed, s.week, m.line) < chance) {
        for (const p of d.pillars) next = bump(next, me, p, 6);
        if (m.line === "attack" || m.line === "broken") for (const p of d.pillars) next = bump(next, rival, p, -4);
        next = { ...next, me: { ...next.me, nationalBuzz: clamp(next.me.nationalBuzz + 10), momentum: Math.min(100, (next.me.momentum ?? 0) + 5) } };
        return { state: next, message: `You win the debate against ${cshort(rival)}. The clips are everywhere by morning.` };
      }
      for (const p of d.pillars) next = bump(next, me, p, -4, `a poor debate against ${cshort(rival)}`);
      return { state: next, message: `${cshort(rival)} gets the better of you in the debate.` };
    }
  }
}

// --- Common ground (for forming a government) ------------------------------------------------------

/** The stances each AI coalition stands for (policy id → option id). */
export const AI_STANCES: Partial<Record<CoalitionId, Record<string, string>>> = {
  PH: { integrity: "reform", affirmative: "needs", religion: "moderate", fuel: "targeted" },
  BN: { affirmative: "expand", infra: "build", cashaid: "expand" },
  PN: { religion: "syariah", affirmative: "expand", education: "national" },
  GPS: { ma63: "devolve", infra: "build" },
  GRS: { ma63: "devolve", cashaid: "expand" },
  WARISAN: { ma63: "devolve", religion: "moderate" },
  MUDA: { integrity: "reform", affirmative: "needs", wage: "raise" },
};

/** Shared pledges with you make a coalition more willing to back you (and clashing ones less). */
export function commonGround(s: GameState): Partial<Record<CoalitionId, number>> {
  const out: Partial<Record<CoalitionId, number>> = {};
  for (const c of COALITIONS) {
    const theirs = AI_STANCES[c];
    if (!theirs || c === s.player) continue;
    let v = 0;
    for (const [id, opt] of Object.entries(theirs)) {
      const idx = POLICY_BY_ID[id]?.options.findIndex((o) => o.id === opt) ?? -1;
      const mine = s.me.policies[id] ?? 0;
      if (idx > 0 && mine === idx) v += 0.07;
      else if (idx > 0 && mine !== 0) v -= 0.05;
    }
    out[c] = Math.max(-0.15, Math.min(0.2, v));
  }
  return out;
}

// --- Battlegrounds --------------------------------------------------------------------------------

export const BATTLE = {
  /** Recent local AP spent in a rival's seat that makes it dig in. */
  pressure: 6,
  weeks: 6,
  /** Each week of a battleground: the rival's buzz there, and what its canvassers take off yours. */
  rivalBuzz: 10,
  yourBuzz: 3,
  cost: 60_000,
  /** Local pressure fades by this share a week. */
  fade: 0.4,
};

/** Weekly: hammering a rival's seat makes it a battleground, where the incumbent fights back; old ones end. */
export function battlegroundsWeek(s: GameState): { state: GameState; lines: ReportLine[] } {
  const lines: ReportLine[] = [];
  const battlegrounds = { ...s.battlegrounds };
  const rivals = { ...s.rivals };
  const buzz = [...s.me.buzz];
  const work = s.seatWork ?? [];
  for (let i = 0; i < work.length; i++) {
    const by = s.holders[i];
    if (by === s.player || by === "OTHERS" || battlegrounds[i] || work[i] < BATTLE.pressure || !rivals[by]) continue;
    battlegrounds[i] = { by, until: s.week + BATTLE.weeks };
    lines.push({ text: `${cshort(by)} digs in at ${SEATS[i].name}: they're counter-campaigning against you there.`, tone: "bad" });
  }
  for (const [k, b] of Object.entries(battlegrounds)) {
    const i = Number(k);
    const r = rivals[b.by];
    if (b.until < s.week || !r || s.holders[i] === s.player) {
      delete battlegrounds[i];
      continue;
    }
    if (r.funds < BATTLE.cost) continue;
    const rb = [...r.buzz];
    rb[i] = clamp(rb[i] + BATTLE.rivalBuzz * (1 - rb[i] / 120));
    rivals[b.by] = { ...r, buzz: rb, funds: r.funds - BATTLE.cost };
    buzz[i] = clamp(buzz[i] - BATTLE.yourBuzz);
  }
  const seatWork = work.map((w) => w * (1 - BATTLE.fade));
  return { state: { ...s, battlegrounds, rivals, seatWork, me: { ...s.me, buzz } }, lines };
}
