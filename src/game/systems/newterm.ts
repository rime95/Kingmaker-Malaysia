// Forming the cabinet after an election. When you are Prime Minister you pick every minister before the term begins:
// the game drafts a suggested line-up (formCabinet) and you change any post. Confirming has consequences:
// - Partners judge their share: fewer posts than their seats earn and they sulk; a fair share pleases them.
// - Your chairman expects a senior post; heavyweights left out (party leaders, last term's ministers) take it badly.
// If time moves on with the screen open, the draft stands. A partner-led government forms its own cabinet.
// All numbers TEMPORARY.

import { PORTFOLIOS, type PortfolioId } from "../data/people";
import type { GameState, ReportLine } from "../state";
import { cabinetFairness, formCabinet, youArePm } from "./people";

export interface NewTerm {
  /** The cabinet being drawn up. */
  draft: Partial<Record<PortfolioId, number>>;
  /** The cabinet before the election (to know who was dropped). */
  previous: Partial<Record<PortfolioId, number>>;
}

export const NEW_TERM = {
  /** Satisfaction for a partner treated fairly (fairness ≥ 0.9), and the most it can lose when shortchanged. */
  fair: 5,
  shortchanged: -15,
  chairmanPost: 10,
  chairmanSnub: -10,
  /** Loyalty lost by a heavyweight left out of cabinet. */
  dropped: -15,
};

/** Opens the cabinet screen after an election you win as Prime Minister. */
export function openNewTerm(s: GameState, previous: Partial<Record<PortfolioId, number>>): GameState {
  return youArePm(s) ? { ...s, newTerm: { draft: { ...s.cabinet }, previous } } : s;
}

/** Who can sit in cabinet: MPs and senior members of the government's parties. */
export function cabinetPool(s: GameState) {
  return s.people
    .filter((p) => !p.retired && p.rank >= 1 && s.government.some((c) => s.coalitions[c].members.includes(p.party)))
    .sort((a, b) => (b.seat !== null ? 1 : 0) - (a.seat !== null ? 1 : 0) || b.competence - a.competence);
}

/** Put someone in a post on the draft (one post each; the PM may also take Finance). */
export function setDraft(s: GameState, post: PortfolioId, id: number | null): GameState {
  const t = s.newTerm;
  if (!t || post === "pm") return s;
  const draft = { ...t.draft };
  if (id !== null) {
    if (!cabinetPool(s).some((x) => x.id === id)) return s;
    if (id === draft.pm && post !== "finance") return s;
    for (const [k, v] of Object.entries(draft)) if (v === id && k !== "pm") delete draft[k as PortfolioId];
    draft[post] = id;
  } else delete draft[post];
  return { ...s, newTerm: { ...t, draft } };
}

/** Back to the suggested line-up. */
export function resetDraft(s: GameState): GameState {
  if (!s.newTerm) return s;
  return { ...s, newTerm: { ...s.newTerm, draft: formCabinet(s, { pm: s.cabinet.pm }) } };
}

/**
 * Each government party's share: posts on the draft ÷ posts its seats earn (1 = fair). Parties too small to earn even
 * half a post expect nothing and are left out.
 */
export function draftFairness(s: GameState): Record<string, number> {
  const cabinet = s.newTerm?.draft ?? s.cabinet;
  const fair = cabinetFairness({ ...s, cabinet });
  const seats: Record<string, number> = {};
  s.holders.forEach((h, i) => {
    if (s.government.includes(h)) seats[s.holderParties[i]] = (seats[s.holderParties[i]] ?? 0) + 1;
  });
  const total = Object.values(seats).reduce((a, b) => a + b, 0) || 1;
  const posts = Object.keys(cabinet).length || 1;
  return Object.fromEntries(Object.entries(fair).filter(([p]) => ((seats[p] ?? 0) / total) * posts >= 0.5));
}

/** Swear in the cabinet on the draft. */
export function confirmCabinet(s: GameState): { state: GameState; lines: ReportLine[] } {
  const t = s.newTerm;
  if (!t) return { state: s, lines: [] };
  const lines: ReportLine[] = [];
  const cabinet = { ...t.draft };
  const fair = draftFairness(s);
  const mine = s.coalitions[s.player].members;
  const partySat = { ...s.partySat };
  for (const [party, f] of Object.entries(fair)) {
    if (party === mine[0]) continue;
    const d = f >= 0.9 ? NEW_TERM.fair : Math.round(NEW_TERM.shortchanged * Math.min(1, (0.9 - f) / 0.9));
    if (mine.includes(party) || s.government.some((c) => s.coalitions[c].members.includes(party))) partySat[party] = Math.max(0, Math.min(100, (partySat[party] ?? 55) + d));
    if (d <= -5) lines.push({ text: `${party} feels shortchanged in your cabinet.`, tone: "bad" });
  }
  const inCabinet = new Set(Object.values(cabinet));
  const wasIn = new Set(Object.values(t.previous));
  const people = s.people.map((p) => {
    if (p.chairman && mine.includes(p.party)) return { ...p, loyalty: Math.max(0, Math.min(100, p.loyalty + (inCabinet.has(p.id) ? NEW_TERM.chairmanPost : NEW_TERM.chairmanSnub))) };
    const heavy = (p.rank >= 3 || wasIn.has(p.id)) && !p.retired && p.id !== s.youId && s.government.some((c) => s.coalitions[c].members.includes(p.party));
    if (heavy && !inCabinet.has(p.id)) return { ...p, loyalty: Math.max(0, p.loyalty + NEW_TERM.dropped) };
    return p;
  });
  const filled = PORTFOLIOS.filter((x) => cabinet[x.id]).length;
  lines.push({ text: `The new cabinet is sworn in at Istana Negara: ${filled} posts filled.`, tone: "good" });
  return { state: { ...s, cabinet, partySat, people, newTerm: null }, lines };
}
