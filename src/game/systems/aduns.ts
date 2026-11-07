// State assembly members. Every one of the 600 state seats has a named ADUN, a generated politician who works in that
// state. They are who a Menteri Besar and exco are chosen from, along with each party's state chief.
// - They sit at rank 0, so they stay out of the cabinet, party polls and other federal lists until they rise.
// - Each state election: the sitting member stands again with a term more, or a new first-term ADUN takes the seat.
// - Their record (terms, exco, top job) is the history note shown wherever they are picked.
// - Real politicians get no invented past: only what happens to them in the game goes on their record.
// All numbers TEMPORARY.

import { hash01 } from "../rng";
import type { GameState } from "../state";
import { SEATS, regionOf } from "../world";
import { seatCandidate } from "./coalitions";
import { DUNS, DUNS_BY_STATE } from "./dun";
import { ageOf, recruitPerson, yearOf, type Person } from "./people";
import { postName, postOfPerson } from "./posts";
import { mbTitle } from "./stategov";

export const ADUN = {
  /** Chance a sitting member steps aside at an election, and the age everyone does. */
  standDown: 0.12,
  retireAge: 70,
  maxStartTerms: 5,
  firstTermAge: 32,
  perTermAge: 5,
  ageSpread: 14,
  /** Standing per term served. */
  termInfluence: 3,
};

const makeAdun = (s: Pick<GameState, "seed" | "week" | "player" | "coalitions">, id: number, dun: number, party: string, terms: number): Person => {
  const d = DUNS[dun];
  const base = recruitPerson(id, party, s.seed, s.week, s, d.parent);
  const age = ADUN.firstTermAge + (terms - 1) * ADUN.perTermAge + Math.floor(hash01("adunage", s.seed, id) * ADUN.ageSpread);
  return { ...base, home: regionOf(d.state), born: yearOf(s.week) - age, influence: base.influence + terms * ADUN.termInfluence, adun: { state: d.state, dun, terms, excoTerms: 0, mbTerms: 0 } };
};

const sitting = (s: Pick<GameState, "people">) => {
  const out = new Map<number, Person>();
  for (const p of s.people) if (p.adun && p.adun.dun !== null) out.set(p.adun.dun, p);
  return out;
};

/** The member for a state seat. */
export const adunOf = (s: Pick<GameState, "people">, dun: number) => s.people.find((p) => p.adun?.dun === dun);

/** Fills every seat without a member. Seats that have one are left alone. */
export function initAduns(s: GameState): GameState {
  const held = sitting(s);
  const added: Person[] = [];
  let next = s.nextPersonId;
  for (const d of DUNS) {
    if (held.has(d.index)) continue;
    const party = seatCandidate(s, SEATS[d.parent], s.dunHolders[d.index]);
    const id = next++;
    const terms = 1 + Math.floor(hash01("adunterms", s.seed, d.index) * ADUN.maxStartTerms);
    added.push(makeAdun(s, id, d.index, party, terms));
  }
  return { ...s, people: [...s.people, ...added], nextPersonId: next };
}

/** A start-of-game exco has been around: its generated members have served before. */
export function seedExcoRecords(s: GameState): GameState {
  const exco = new Set(Object.values(s.stateGov).flatMap((g) => g.exco));
  return {
    ...s,
    people: s.people.map((p) => {
      if (!exco.has(p.id) || !p.adun || p.real) return p;
      return { ...p, adun: { ...p.adun, excoTerms: Math.floor(hash01("adunexco", s.seed, p.id) * p.adun.terms) } };
    }),
  };
}

/** A state has voted: the old government's term counts, sitting members win or lose, and new members take their seats. */
export function adunsAfterPolls(s: GameState, polled: string[]): GameState {
  if (!polled.length) return s;
  const people = new Map(s.people.map((p) => [p.id, p]));
  const credit = (id: number | null, state: string, field: "excoTerms" | "mbTerms") => {
    const p = id === null ? undefined : people.get(id);
    if (!p) return;
    // Someone with no assembly record (a real figure, or a chief) starts one here, with no invented terms.
    const rec = p.adun ?? { state, dun: null, terms: 0, excoTerms: 0, mbTerms: 0 };
    people.set(p.id, { ...p, adun: { ...rec, [field]: rec[field] + 1 } });
  };
  for (const id of polled) {
    const g = s.stateGov?.[id];
    if (!g) continue;
    credit(g.mb, id, "mbTerms");
    for (const x of g.exco) credit(x, id, "excoTerms");
  }
  const held = sitting({ people: [...people.values()] });
  const posted = new Set(Object.values(s.posts ?? {}).flatMap((m) => Object.values(m)));
  const added: Person[] = [];
  let next = s.nextPersonId;
  for (const id of polled) {
    for (const d of DUNS_BY_STATE[id]) {
      const party = seatCandidate(s, SEATS[DUNS[d].parent], s.dunHolders[d]);
      const cur = held.get(d);
      const stands = !!cur && !cur.retired && ageOf(cur, s.week) < ADUN.retireAge && hash01("adunstay", s.seed, s.week, d) >= ADUN.standDown;
      // A sitting member keeps a seat their coalition held, whichever partner has the parliamentary seat above it.
      if (cur && stands && s.coalitions[s.dunHolders[d]].members.includes(cur.party)) {
        people.set(cur.id, { ...cur, influence: Math.min(100, cur.influence + ADUN.termInfluence), adun: { ...cur.adun!, terms: cur.adun!.terms + 1 } });
        continue;
      }
      if (cur) {
        // A plain ADUN leaves the game with the seat; anyone with a party career stays on as a former member.
        if (cur.rank === 0 && !cur.real && !posted.has(cur.id) && cur.id !== s.youId) people.delete(cur.id);
        else people.set(cur.id, { ...cur, adun: { ...cur.adun!, dun: null } });
      }
      added.push(makeAdun(s, next++, d, party, 1));
    }
  }
  return { ...s, people: [...people.values(), ...added], nextPersonId: next };
}

/** The government a person is serving in, and how, as the screen in front of the player should describe it. */
function roleIn(s: GameState, p: Person): { state: string; role: "mb" | "exco" } | null {
  for (const [id, g] of Object.entries(s.stateGov ?? {})) {
    // While a new team is being drawn up, the incumbents are the outgoing team.
    const team = s.stateTerms?.some((t) => t.state === id) && g.outgoing ? g.outgoing : g;
    if (team.mb === p.id) return { state: id, role: "mb" };
    if (team.exco.includes(p.id)) return { state: id, role: "exco" };
  }
  return null;
}

const terms = (n: number) => `${n} term${n === 1 ? "" : "s"}`;

/** A short history: "Incumbent exco · ADUN 2 terms, N.12 Bukit Lanjan". */
export function adunNote(s: GameState, p: Person): string | null {
  const parts: string[] = [];
  const r = p.adun;
  const role = roleIn(s, p);
  if (role?.role === "mb") parts.push(`Incumbent ${mbTitle(role.state)}${r?.mbTerms ? `, ${terms(r.mbTerms + 1)}` : ""}`);
  else if (role) parts.push(`Incumbent exco${r?.excoTerms ? `, ${terms(r.excoTerms + 1)}` : ""}`);
  else if (r?.mbTerms) parts.push(`Former ${mbTitle(r.state)}`);
  else if (r?.excoTerms) parts.push("Former exco");
  if (r && r.terms > 0) {
    if (r.dun === null) parts.push(`Former ADUN, ${terms(r.terms)}`);
    else {
      const seat = `${DUNS[r.dun].code} ${DUNS[r.dun].name}`;
      parts.push(r.terms === 1 && !role ? `New ADUN, first term, ${seat}` : `ADUN ${terms(r.terms)}, ${seat}`);
    }
  }
  const post = postOfPerson(s, p);
  if (post?.startsWith("chief:")) parts.push(postName(post));
  return parts.length ? parts.join(" · ") : null;
}
