// The Party Chairman: when you take over a party, its old president is not pushed aside. They stay on as chairman, the
// party's elder statesman, and lead it with you. You are the primary; they are your strongest supporter.
// - Star campaigner: once a week they hold a ceramah for you in a seat you pick, free of AP, strongest in their home state.
// - Unity: a loyal chairman keeps the party behind you every week.
// - Counsel: now and then they offer advice (a card). Heed it and they stay close; ignore it too often and they drift.
// - Respect: leave them out of your cabinet and their loyalty slips. If it falls too far, they break ranks (a card).
// All numbers TEMPORARY.

import { hash01 } from "../rng";
import type { GameState, ReportLine } from "../state";
import { SEATS, contestingIn } from "../world";
import { standsAside } from "./pacts";
import type { CardDef } from "./events";
import { ROSTERS } from "../data/people";
import { makeChairman, recruitPerson, type Person } from "./people";

export const CHAIRMAN = {
  /** Buzz from their weekly ceramah (×1.4 in their home state), before saturation. */
  buzz: 14,
  homeState: 1.4,
  /** Unity each week while their loyalty is at least `unityLoyalty`. */
  unity: 0.3,
  unityLoyalty: 50,
  /** Loyalty lost each month they sit outside your cabinet while you govern. */
  snub: 4,
  /** Below this loyalty they break ranks. */
  rift: 25,
  /** Weeks between counsel cards. */
  counselEvery: 26,
};

/** Your party's chairman, if you have one. */
export function chairmanOf(s: Pick<GameState, "people" | "coalitions" | "player">): Person | undefined {
  const lead = s.coalitions[s.player].members[0];
  return s.people.find((p) => p.chairman && p.party === lead);
}

const homeStateOf = (p: Person) => (p.seat !== null ? SEATS[p.seat].state : null);

export function chairmanCampaignBlocked(s: GameState, seat: number): string | null {
  const ch = chairmanOf(s);
  if (!ch) return "Your party has no chairman.";
  if (ch.campaignWeek === s.week) return `${ch.name} has already campaigned this week.`;
  if (!contestingIn(SEATS[seat], s.entries).includes(s.player)) return "Your coalition does not stand here.";
  if (standsAside(s, seat, s.player)) return "You stand aside here for a partner. Back their candidate instead.";
  return null;
}

/** The chairman holds a ceramah for you in a seat: no AP, once a week. */
export function chairmanCampaign(s: GameState, seat: number): { state: GameState; message: string } | { error: string } {
  const why = chairmanCampaignBlocked(s, seat);
  if (why) return { error: why };
  const ch = chairmanOf(s)!;
  const home = homeStateOf(ch) === SEATS[seat].state;
  const sat = 1 / (1 + (s.seatWork?.[seat] ?? 0) * 0.12);
  const gain = CHAIRMAN.buzz * (home ? CHAIRMAN.homeState : 1) * sat * (0.6 + ch.influence / 250);
  const buzz = [...s.me.buzz];
  buzz[seat] = Math.min(100, buzz[seat] + gain * (1 - buzz[seat] / 120));
  const seatWork = [...(s.seatWork ?? SEATS.map(() => 0))];
  seatWork[seat] += 1;
  const people = s.people.map((p) => (p.id === ch.id ? { ...p, campaignWeek: s.week } : p));
  return {
    state: { ...s, me: { ...s.me, buzz }, seatWork, people },
    message: `${ch.name} takes the stage in ${SEATS[seat].name}${home ? ", on home ground" : ""}. The crowd came for the chairman and stayed for your plan.`,
  };
}

/** Weekly: a loyal chairman steadies the party; a snubbed one drifts; counsel and rifts become cards. */
export function chairmanWeek(s: GameState): { state: GameState; lines: ReportLine[]; card: "chairmanCounsel" | "chairmanRift" | null } {
  const lines: ReportLine[] = [];
  const ch = chairmanOf(s);
  if (!ch) return { state: s, lines, card: null };
  let state = s;
  if (ch.loyalty >= CHAIRMAN.unityLoyalty) state = { ...state, me: { ...state.me, unity: Math.min(100, state.me.unity + CHAIRMAN.unity) } };
  if (s.week % 4 === 3 && s.parliament.pm === s.player && !Object.values(s.cabinet).includes(ch.id)) {
    state = { ...state, people: state.people.map((p) => (p.id === ch.id ? { ...p, loyalty: Math.max(0, p.loyalty - CHAIRMAN.snub) } : p)) };
    if (hash01("snub", s.seed, s.week) < 0.4) lines.push({ text: `${ch.name} is said to feel sidelined: the chairman holds no post in your cabinet.`, tone: "bad" });
  }
  const last = (k: string) => s.cardLast[k] ?? -99;
  let card: "chairmanCounsel" | "chairmanRift" | null = null;
  if (ch.loyalty < CHAIRMAN.rift && last("chairmanRift") < s.week - 26) card = "chairmanRift";
  else if (last("chairmanCounsel") < s.week - CHAIRMAN.counselEvery && hash01("counsel", s.seed, s.week) < 0.15) card = "chairmanCounsel";
  return { state, lines, card };
}

/** What the chairman advises depends on the moment. */
function counselTopic(s: GameState): "campaign" | "govern" | "partners" {
  if (s.parliament.status === "campaign" || s.parliament.deadlineWeek - s.week < 26) return "campaign";
  if (s.parliament.pm === s.player) return "govern";
  return "partners";
}

const COUNSEL_TEXT = {
  campaign: (n: string) => `${n} calls you over after the Supreme Council: "Don't spread yourself thin. Pick the seats we can really win, and let me take the ones where the old guard still listens to me."`,
  govern: (n: string) => `${n} drops by Seri Perdana: "People forgive a slow government, never an arrogant one. Go to the ground, and keep the promises you made them."`,
  partners: (n: string) => `${n} over teh tarik: "We can't win alone. Our partners need to feel respected, not counted. Let me talk to their leaders."`,
};

export const CHAIRMAN_COUNSEL_CARD: CardDef = {
  kind: "chairmanCounsel",
  title: "The chairman's counsel",
  text: (s) => {
    const ch = chairmanOf(s);
    return ch ? COUNSEL_TEXT[counselTopic(s)](ch.name) : "The chairman has advice for you.";
  },
  choices: (s) => {
    const topic = counselTopic(s);
    const person = (d: number) => (st: GameState) => {
      const ch = chairmanOf(st);
      return { state: ch ? { ...st, people: st.people.map((p) => (p.id === ch.id ? { ...p, loyalty: Math.max(0, Math.min(100, p.loyalty + d)) } : p)) } : st };
    };
    const heed =
      topic === "campaign"
        ? { unity: 4, stateBuzz: { states: chairmanState(s), amount: 8 }, then: person(10) }
        : topic === "govern"
          ? { approval: 2, unity: 3, then: person(10) }
          : { partnersSat: 8, trust: 4, then: person(10) };
    return [
      { label: "Take the chairman's advice", effect: heed },
      { label: "Thank them, and go your own way", effect: { capital: 4, then: person(-8) }, note: "Their loyalty slips." },
    ];
  },
  defaultChoice: 0,
};

function chairmanState(s: GameState): string[] {
  const ch = chairmanOf(s);
  const st = ch ? homeStateOf(ch) : null;
  return st ? [st] : [];
}

export const CHAIRMAN_RIFT_CARD: CardDef = {
  kind: "chairmanRift",
  title: "The chairman breaks ranks",
  text: (s) => {
    const ch = chairmanOf(s);
    return ch ? `${ch.name} tells a press conference that the party "has lost its way". The divisions are watching to see what you do.` : "The chairman is unhappy.";
  },
  choices: () => [
    {
      label: "Reconcile: a bigger say for the chairman",
      effect: {
        capital: -10,
        unity: 3,
        then: (st: GameState) => {
          const ch = chairmanOf(st);
          return { state: ch ? { ...st, people: st.people.map((p) => (p.id === ch.id ? { ...p, loyalty: Math.min(100, p.loyalty + 35) } : p)) } : st };
        },
      },
    },
    {
      label: "Let them go",
      effect: {
        unity: -10,
        then: (st: GameState) => {
          const ch = chairmanOf(st);
          if (!ch) return { state: st };
          const lines: ReportLine[] = [{ text: `${ch.name} steps down as Party Chairman. Part of the old guard leaves with them.`, tone: "bad" }];
          return { state: { ...st, people: st.people.map((p) => (p.id === ch.id ? { ...p, chairman: false, rank: 2, loyalty: 10 } : p)) }, lines };
        },
      },
      note: "Unity falls; the chairman becomes a backbench critic.",
    },
  ],
  defaultChoice: 0,
};

/**
 * Old saves where your character took the real president's place: the real president comes back as chairman
 * (without a seat; theirs is yours now).
 */
export function restoreChairman(s: GameState): GameState {
  if (s.career.mode !== "leader" || chairmanOf(s)) return s;
  const lead = s.coalitions[s.player].members[0];
  const real = ROSTERS[lead]?.president;
  if (!real || real[0] === s.career.name || s.people.some((p) => p.name === real[0])) return s;
  const p = recruitPerson(s.nextPersonId, lead, s.seed, s.week, s);
  const ch = makeChairman({ ...p, name: real[0], born: real[2], real: true, retireAge: Math.max(p.retireAge, 2026 - real[2] + 6) }, s.week);
  return { ...s, people: [...s.people, ch], nextPersonId: s.nextPersonId + 1 };
}

