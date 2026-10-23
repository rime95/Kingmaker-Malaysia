// Governing well, and being re-elected for it.
// - Your manifesto becomes your government's promises: each pledge carries a measurable target (cash aid → cost of
//   living down, a targeted subsidy → debt down) to hit before the next election.
// - A policy record: what each decision did to the numbers since you took it.
// - Crises are judged when they end: a government that kept growth and approval up through one gains a reputation
//   for getting things done; one that didn't loses it.
// - The term report card: when the campaign starts, voters weigh promises kept and broken, and the economy since.
// - A secretary-general who runs the seat-by-seat ground campaign for you, so your turns are about governing.
// All draws are hash01. Numbers TEMPORARY.

import type { GameState, ReportLine } from "../state";
import { SEATS, contestingIn, type CoalitionId } from "../world";
import { KPI_INFO, itemMet, type AgendaItem, type Kpi } from "./agenda";
import { POLICY_BY_ID } from "./policies";
import type { Target } from "../actions";
import { openIssues } from "./issues";
import { projectAllFor } from "../state";

// --- Pledges become promises ----------------------------------------------------------------------

/** What each pledge promises to fix, and by how much (in the KPI's own units, signed in the good direction). */
export const PLEDGE_KPI: Record<string, Record<string, { kpi: Kpi; by: number }>> = {
  fuel: { targeted: { kpi: "debt", by: 3 }, float: { kpi: "debt", by: 5 } },
  cashaid: { expand: { kpi: "col", by: 8 }, cut: { kpi: "debt", by: 2 } },
  wage: { raise: { kpi: "col", by: 6 } },
  tax: { expand: { kpi: "debt", by: 3 }, gst: { kpi: "debt", by: 5 }, cut: { kpi: "col", by: 6 } },
  religion: { syariah: { kpi: "approval", by: 4 }, moderate: { kpi: "fdi", by: 5 } },
  education: { uec: { kpi: "fdi", by: 6 }, national: { kpi: "approval", by: 4 } },
  affirmative: { needs: { kpi: "fdi", by: 5 }, expand: { kpi: "approval", by: 4 } },
  ma63: { devolve: { kpi: "approval", by: 5 } },
  integrity: { reform: { kpi: "fdi", by: 6 } },
  infra: { build: { kpi: "gdp", by: 0.6 } },
};

export const MAX_PROMISES = 5;

/** Your government's promises: one per pledge in your manifesto (the biggest per number), toward its target. */
export function pledgeAgenda(s: GameState): AgendaItem[] {
  const best = new Map<Kpi, AgendaItem>();
  for (const [id, idx] of Object.entries(s.me.policies)) {
    if (!idx) continue;
    const opt = POLICY_BY_ID[id]?.options[idx];
    const p = opt && PLEDGE_KPI[id]?.[opt.id];
    if (!p) continue;
    const from = s.nation[p.kpi];
    const target = KPI_INFO[p.kpi].upIsGood ? from + p.by : from - p.by;
    const prev = best.get(p.kpi);
    if (!prev || Math.abs(target - from) > Math.abs(prev.target - prev.from)) best.set(p.kpi, { kpi: p.kpi, from, target, pledge: opt.label });
  }
  return [...best.values()].slice(0, MAX_PROMISES);
}

// --- The policy record ----------------------------------------------------------------------------

export const RECORD_KPIS: Kpi[] = ["gdp", "inflation", "unemployment", "debt", "col", "fdi", "approval"];
export type Snapshot = Record<Kpi, number>;

export interface PolicyEntry {
  week: number;
  policy: string;
  option: number;
  /** Enacted in government (true) or pledged in opposition. */
  gov: boolean;
  at: Snapshot;
}

export const snapshot = (s: Pick<GameState, "nation">): Snapshot => Object.fromEntries(RECORD_KPIS.map((k) => [k, s.nation[k]])) as Snapshot;

export function logPolicy(s: GameState, policy: string, option: number, gov: boolean): GameState {
  return { ...s, policyLog: [{ week: s.week, policy, option, gov, at: snapshot(s) }, ...(s.policyLog ?? [])].slice(0, 20) };
}

/** How much better (+) or worse (−) a number is now than at a snapshot, in "good" units. */
export function better(s: Pick<GameState, "nation">, at: Snapshot, k: Kpi): number {
  const d = s.nation[k] - at[k];
  return KPI_INFO[k].upIsGood ? d : -d;
}

// --- The term report card -------------------------------------------------------------------------

export interface ReportCard {
  kept: number;
  broken: number;
  total: number;
  /** Change since the term began, "good" direction positive. */
  moves: { kpi: Kpi; by: number }[];
  /** −1 … 1: what voters make of it. */
  grade: number;
  verdict: string;
}

export function reportCard(s: GameState): ReportCard | null {
  const a = s.agenda;
  if (!a || !a.start) return null;
  const kept = a.items.filter((it) => itemMet(s, it)).length;
  const old = s.week - a.week >= 26;
  const broken = old ? a.items.length - kept : 0;
  const moves = RECORD_KPIS.map((k) => ({ kpi: k, by: better(s, a.start!, k) }));
  const scale: Record<Kpi, number> = { gdp: 1, inflation: 1, unemployment: 0.7, debt: 4, col: 8, fdi: 8, approval: 6 };
  const econ = moves.reduce((t, m) => t + Math.max(-1, Math.min(1, m.by / scale[m.kpi])), 0) / moves.length;
  const promises = a.items.length ? (kept - broken) / a.items.length : 0;
  const grade = Math.max(-1, Math.min(1, promises * 0.6 + econ * 0.8));
  const verdict =
    s.week - a.week < 8
      ? "Too early to judge."
      : grade > 0.35
        ? "A government that delivered."
        : grade > 0.05
          ? "A solid record, with gaps."
          : grade > -0.25
            ? "A mixed record: voters are unconvinced."
            : "A record of broken promises.";
  return { kept, broken, total: a.items.length, moves, grade, verdict };
}

/** Points to the governing coalition's Execution and Principle when the record goes before the voters. */
export const RECORD_SWAY = { execution: 12, principle: 6 };

// --- Crises, judged when they end -----------------------------------------------------------------

/** How a government came through a crisis: approval and growth against where they started. */
export function crisisScore(s: Pick<GameState, "nation">, from: { approval: number; gdp: number }): number {
  return s.nation.approval - from.approval + (s.nation.gdp - from.gdp) * 3;
}
export const CRISIS_SWAY = 6;

// --- The secretary-general's ground campaign ------------------------------------------------------

export const AUTO = { reserve: 1_500_000, maxSeats: 6, minSaturation: 0.6 };

type Apply = (s: GameState, id: string, t: Target) => { ok: true; state: GameState; message: string } | { ok: false; error: string };

/** Spends what's left of your AP on the closest seats you contest: local issues first, then service. */
export function autoGround(s: GameState, apply: Apply, saturation: (s: GameState, i: number) => number): { state: GameState; lines: ReportLine[] } {
  if (!s.strategy.autoGround || s.me.ap <= 0) return { state: s, lines: [] };
  const proj = projectAllFor(s);
  const me: CoalitionId = s.player;
  const seats = SEATS.filter((x) => contestingIn(x, s.entries).includes(me) && proj[x.index].shares[me] !== undefined)
    .map((x) => {
      const p = proj[x.index];
      const mine = p.shares[me] ?? 0;
      const best = Math.max(
        0,
        ...Object.entries(p.shares)
          .filter(([c]) => c !== me)
          .map(([, v]) => v ?? 0),
      );
      return { i: x.index, gap: best - mine };
    })
    .filter((t) => t.gap > -0.06 && t.gap < 0.12 && !s.battlegrounds?.[t.i])
    .sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap));
  let state = s;
  const worked: string[] = [];
  for (const t of seats) {
    if (worked.length >= AUTO.maxSeats || state.me.ap <= 0 || state.me.funds < AUTO.reserve) break;
    if (saturation(state, t.i) < AUTO.minSaturation) continue;
    const id = openIssues(state, t.i).length ? "issue" : "service";
    const r = apply(state, id, { kind: "seat", seat: t.i });
    if (r.ok) {
      state = r.state;
      worked.push(SEATS[t.i].name);
    }
  }
  return { state, lines: worked.length ? [{ text: `Your secretary-general worked the ground in ${worked.join(", ")}.`, tone: "info" }] : [] };
}
