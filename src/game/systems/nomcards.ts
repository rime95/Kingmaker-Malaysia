// Nomination drama: the cards that come up while you, as president, name your candidates.
// - A division chief says the ticket is theirs by right: give it to them (unity, their loyalty) or back your own pick.
// - A celebrity offers to stand for you: a famous face for free, if you can live with a newcomer jumping the queue.
// All numbers TEMPORARY.

import { hash01 } from "../rng";
import { remember } from "./people";
import type { GameState } from "../state";
import { SEATS } from "../world";
import type { CardDef } from "./events";
import { NOMINATION, nominate, partySeats } from "./nominations";
import { byId } from "./people";

/** A seat where an ambitious division chief without a seat wants the ticket, and isn't on the list. */
export function divisionDemand(s: GameState): { seat: number; person: number } | null {
  const n = s.nominations;
  if (!n?.open) return null;
  const picked = new Set(Object.values(n.picks));
  const seats = partySeats(s).filter((i) => s.holders[i] !== s.player);
  const chiefs = s.people.filter((p) => p.party === s.coalitions[s.player].members[0] && p.seat === null && p.rank >= 1 && !p.chairman && !p.retired && p.id !== s.youId && !picked.has(p.id) && p.ambition > 50);
  if (!seats.length || !chiefs.length) return null;
  const seat = seats[Math.floor(hash01("demand", s.seed, s.week) * seats.length)];
  const person = chiefs.sort((a, b) => b.influence - a.influence)[0];
  return { seat, person: person.id };
}

/** A city seat where a famous face would help. */
export function celebritySeat(s: GameState): number | null {
  const seats = partySeats(s).filter((i) => SEATS[i].demo.urbanity > 0.6 && s.holders[i] !== s.player);
  if (!seats.length) return null;
  return seats.sort((a, b) => SEATS[b].demo.youth - SEATS[a].demo.youth)[0];
}

const loyalty = (id: number | undefined, d: number) => (st: GameState) => ({ state: { ...st, people: st.people.map((p) => (p.id === id ? remember(p, d, d > 0 ? "You backed me over the ticket" : "You crossed me over the ticket", st.week) : p)) } });

export const DIVISION_DEMAND_CARD: CardDef = {
  kind: "divisionDemand",
  title: "A division chief wants the ticket",
  text: (s, c) => {
    const p = byId(s, c.person);
    const seat = c.seat !== undefined ? SEATS[c.seat].name : "the seat";
    return p ? `${p.name} has run the ${seat} division for years and says the ticket is theirs by right. Their branch chiefs are threatening to sit on their hands if you look elsewhere.` : "A division chief wants the ticket.";
  },
  choices: (s, c) => [
    {
      label: "Give them the ticket",
      effect: {
        unity: 4,
        then: (st) => {
          const r = c.seat !== undefined && c.person !== undefined ? nominate(st, c.seat, c.person) : null;
          return loyalty(c.person, 20)(r && "state" in r ? r.state : st);
        },
      },
    },
    { label: "Back your own pick", effect: { unity: -3, then: loyalty(c.person, -25) }, note: "They will not forget it." },
  ],
  defaultChoice: 0,
};

const CELEBS = ["a national badminton star", "a much-loved TV chef", "a footballer who played for Harimau Malaya", "a popular nasyid singer", "an actor from the drama everyone watched last Ramadan"];

const celebOf = (s: GameState, week: number) => {
  const who = CELEBS[Math.floor(hash01("celeb", s.seed, week) * CELEBS.length)];
  return who[0].toUpperCase() + who.slice(1);
};

export const CELEBRITY_CARD: CardDef = {
  kind: "celebrity",
  title: "A famous face wants to stand",
  text: (s, c) => `${celebOf(s, c.week)} offers to stand for you in ${c.seat !== undefined ? SEATS[c.seat].name : "a city seat"}. The cameras would follow. Your local members, who have waited years, would not be happy.`,
  choices: (s, c) => [
    {
      label: "Welcome them aboard",
      effect: {
        seatBuzz: 10,
        unity: -3,
        then: (st) => {
          if (c.seat === undefined) return { state: st };
          const r = nominate({ ...st, me: { ...st.me, funds: st.me.funds + NOMINATION.local.cost } }, c.seat, "local");
          return { state: "state" in r ? r.state : st };
        },
      },
    },
    { label: "Politics is not a stage", effect: { unity: 2 } },
  ],
  defaultChoice: 1,
};
