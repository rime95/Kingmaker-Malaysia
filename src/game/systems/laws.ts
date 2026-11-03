// The anti-hopping law (Article 49A of the Federal Constitution). Passed in July 2022 (209 to 0) and in force since
// 5 October 2022: an MP who quits their party, or joins another, loses the seat and a by-election follows. An MP the
// party sacks keeps the seat (the loophole parties later closed in their own constitutions). Changing it is a
// constitutional amendment: two-thirds of the Dewan Rakyat (148 of 222).
// - "2022": the law as it stands.
// - "strict": tightened. Sacked MPs lose their seats too, and fewer MPs dare to jump.
// - "none": repealed (or a game started under the old rules). MPs cross the floor and keep their seats: rivals can
//   poach yours ("frogs"), you can poach theirs, and a falling government can be propped up with defectors.
// All numbers TEMPORARY.

import { hash01 } from "../rng";
import type { CardDef } from "./events";
import type { GameState, ReportLine } from "../state";
import { COALITIONS, SEATS, cshort, type CoalitionId } from "../world";
import { AFFINITY } from "./formation";
import type { Person } from "./people";

export type HoppingLaw = "none" | "2022" | "strict";
export interface Laws {
  hopping: HoppingLaw;
}

export const hoppingLaw = (s: Pick<GameState, "laws">): HoppingLaw => s.laws?.hopping ?? "2022";

export const HOPPING_TEXT: Record<HoppingLaw, { name: string; rules: string }> = {
  "2022": { name: "In force (Art. 49A, 2022)", rules: "An MP who quits their party loses the seat (by-election). An MP the party sacks keeps it." },
  strict: { name: "Tightened", rules: "An MP who quits, or is sacked, loses the seat (by-election). Fewer MPs dare to jump." },
  none: { name: "Not in force", rules: "MPs can cross the floor and keep their seats. Rivals can poach your MPs; you can poach theirs." },
};

export const LAWS = {
  /** Poaching a rival MP (no anti-hopping law): money, capital, and the chance it works. */
  poach: { cost: 1_500_000, capital: 6, base: 0.12, perLoyalty: 1 / 150 },
  /** Matching a rival's offer for one of your MPs. */
  outbid: 1_500_000,
  /** Opposition MPs a coalition forming a government mid-term may lure across. */
  midTermPoach: 3,
};

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

/** The coalition an MP would most likely cross to (the strongest it gets along with, not their own). */
export function courtedBy(s: GameState, p: Person): CoalitionId {
  const own = SEATS[p.seat!] ? s.holders[p.seat!] : s.player;
  const seats = (c: CoalitionId) => s.holders.filter((h) => h === c).length;
  return COALITIONS.filter((c) => c !== own && c !== "OTHERS" && s.coalitions[c].members.length).sort(
    (a, b) => seats(b) * (1 + (AFFINITY[own]?.[b] ?? 0)) - seats(a) * (1 + (AFFINITY[own]?.[a] ?? 0)),
  )[0];
}

/** An MP crosses the floor and keeps the seat: it now counts for the coalition they joined. */
export function crossFloor(s: GameState, id: number, to: CoalitionId, lines: ReportLine[]): GameState {
  const p = s.people.find((x) => x.id === id);
  if (!p || p.seat === null) return s;
  const i = p.seat;
  const from = s.holders[i];
  const party = s.coalitions[to].members[0];
  const holders = [...s.holders];
  const holderParties = [...s.holderParties];
  holders[i] = to;
  holderParties[i] = party;
  const cabinet = { ...s.cabinet };
  if (!s.government.includes(to)) for (const [k, v] of Object.entries(cabinet)) if (v === id && k !== "pm") delete cabinet[k as keyof typeof cabinet];
  const picks = s.nominations ? Object.fromEntries(Object.entries(s.nominations.picks).filter(([, v]) => v !== id)) : null;
  lines.push({ text: `${p.name} crosses the floor from ${cshort(from)} to ${cshort(to)} and keeps ${SEATS[i].name}.`, tone: to === s.player ? "good" : from === s.player ? "bad" : "info" });
  return {
    ...s,
    holders,
    holderParties,
    cabinet,
    // They stand for their new side here next time.
    seatParty: { ...s.seatParty, [i]: { ...(s.seatParty[i] ?? {}), [to]: party } },
    nominations: s.nominations && picks ? { ...s.nominations, picks } : s.nominations,
    people: s.people.map((x) => (x.id === id ? { ...x, party, rank: 1, loyalty: to === s.player ? 60 : 10, since: s.week } : x)),
  };
}

/** Why you can't try to poach this MP (null when you can). */
export function poachBlocked(s: GameState, id: number): string | null {
  if (hoppingLaw(s) !== "none") return "The anti-hopping law would cost them their seat.";
  if (s.career.rung < 6) return "Only the party president can make that offer.";
  const p = s.people.find((x) => x.id === id);
  if (!p || p.seat === null) return "Only MPs.";
  if (s.holders[p.seat] === s.player || s.coalitions[s.player].members.includes(p.party)) return "Already on your side.";
  if (p.rank >= 4) return "Party leaders don't cross.";
  if (s.me.funds < LAWS.poach.cost) return "Not enough money.";
  if (s.me.capital < LAWS.poach.capital) return `Needs ${LAWS.poach.capital} political capital.`;
  return null;
}

export const poachChance = (p: Person) => Math.min(0.75, Math.max(0.05, LAWS.poach.base + p.loyalty * LAWS.poach.perLoyalty - (p.influence - 40) / 300));

/** Make a rival MP an offer to cross over to you, seat and all. */
export function poachMp(s: GameState, id: number): { state: GameState; message: string } | { error: string } {
  const why = poachBlocked(s, id);
  if (why) return { error: why };
  const p = s.people.find((x) => x.id === id)!;
  const paid: GameState = { ...s, me: { ...s.me, funds: s.me.funds - LAWS.poach.cost, capital: s.me.capital - LAWS.poach.capital, integrity: clamp(s.me.integrity - 2) } };
  if (hash01("poach", s.seed, s.week, id) < poachChance(p)) {
    const lines: ReportLine[] = [];
    const state = crossFloor(paid, id, s.player, lines);
    return { state, message: lines[0]?.text ?? `${p.name} joins you.` };
  }
  return {
    state: { ...paid, me: { ...paid.me, scandal: clamp(paid.me.scandal + 4) }, people: paid.people.map((x) => (x.id === id ? { ...x, loyalty: clamp(x.loyalty - 10) } : x)) },
    message: `${p.name} turns you down, and tells the press about your offer.`,
  };
}

/** A government falling with no anti-hopping law: the bigger side lures a few MPs from the small parties first. */
export function midTermDefections(s: GameState, leader: CoalitionId, lines: ReportLine[]): GameState {
  if (hoppingLaw(s) !== "none") return s;
  let state = s;
  const targets = state.people
    .filter((p) => p.seat !== null && !p.retired && p.rank <= 2 && ![leader, state.player].includes(state.holders[p.seat]) && (AFFINITY[state.holders[p.seat]]?.[leader] ?? 0) > -0.3)
    .filter((p) => hash01("midpoach", state.seed, state.week, p.id) < 0.08)
    .slice(0, LAWS.midTermPoach);
  for (const p of targets) state = crossFloor(state, p.id, leader, lines);
  return state;
}

/** Under no anti-hopping law, a wavering MP of yours is courted by a rival (a card), not just thinking of quitting. */
export const FROG_CARD: CardDef = {
  kind: "frog",
  title: "A rival is courting your MP",
  text: (s, c) => {
    const p = s.people.find((x) => x.id === c.person);
    const to = (c.party as CoalitionId) ?? "PN";
    return p && p.seat !== null
      ? `${cshort(to)} has offered ${p.name} (${SEATS[p.seat].name}) a post and a war chest to cross the floor. With no anti-hopping law, they would keep the seat.`
      : "A rival is courting one of your MPs.";
  },
  choices: () => [
    { label: `Outbid them (RM ${LAWS.outbid / 1e6}M)`, effect: { funds: -LAWS.outbid, personLoyalty: 30 } },
    {
      label: "Appeal to their loyalty",
      effect: {
        capital: -5,
        then: (st, c) => {
          if (hash01("appeal", st.seed, st.week, c?.person ?? 0) < 0.5) return { state: { ...st, people: st.people.map((p) => (p.id === c?.person ? { ...p, loyalty: clamp(p.loyalty + 15) } : p)) }, lines: [{ text: "They stay, for now.", tone: "good" }] };
          const lines: ReportLine[] = [];
          return { state: crossFloor(st, c!.person!, (c!.party as CoalitionId) ?? courtedBy(st, st.people.find((p) => p.id === c!.person)!), lines), lines };
        },
      },
      note: "Even odds.",
    },
    {
      label: "Let them go",
      effect: {
        unity: -2,
        then: (st, c) => {
          const lines: ReportLine[] = [];
          return { state: crossFloor(st, c!.person!, (c!.party as CoalitionId) ?? courtedBy(st, st.people.find((p) => p.id === c!.person)!), lines), lines };
        },
      },
    },
  ],
  defaultChoice: 2,
};

/** A constitutional amendment on hopping has passed: the law changes. */
export function lawPassed(s: GameState, motion: string, lines: ReportLine[]): GameState {
  const now = hoppingLaw(s);
  let next: HoppingLaw | null = null;
  if (motion === "hopping") next = now === "none" ? "2022" : "strict";
  if (motion === "hoppingRepeal") next = "none";
  if (!next || next === now) return s;
  lines.push({ text: `The anti-hopping law is now ${HOPPING_TEXT[next].name.toLowerCase()}: ${HOPPING_TEXT[next].rules}`, tone: "info" });
  return { ...s, laws: { ...s.laws, hopping: next } };
}
