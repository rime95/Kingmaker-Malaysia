// More decision cards: the Supreme Council, ministers in trouble, and the war-room calls of a general election
// campaign. Registered with the others in events.ts. Numbers TEMPORARY.

import type { CardDef } from "./events";
import { hash01 } from "../rng";
import type { GameState } from "../state";
import { byId, postOf } from "./people";
import { COUNCIL_ITEMS, councilAgenda } from "./partyorg";
import { PORTFOLIOS } from "../data/people";

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
const campaigning = (s: GameState) => s.parliament.status === "campaign";
const youPm = (s: GameState) => s.parliament.pm === s.player;

/** The Supreme Council meets every eight weeks with one item on the agenda. */
export const COUNCIL_CARD: CardDef = {
  kind: "council",
  title: "Supreme Council meeting",
  text: (s, c) => {
    const it = COUNCIL_ITEMS[councilAgenda(s.seed, c.week)];
    return `${it.title}. ${it.text}`;
  },
  choices: (s, c) => {
    switch (councilAgenda(s.seed, c.week)) {
      case 0:
        return [
          { label: "Pay out the allocations", effect: { funds: -1_000_000, unity: 6 } },
          { label: "Tell them to raise their own", effect: { unity: -5, capital: 3 } },
        ];
      case 1:
        return [
          { label: "Agree to a youth quota", effect: { unity: -2, then: (st) => ({ state: { ...st, wings: { ...st.wings, youth: clamp(st.wings.youth + 15) } } }) }, note: "Youth wing +15" },
          { label: "Refuse: seats go to the best candidates", effect: { capital: 2, then: (st) => ({ state: { ...st, wings: { ...st.wings, youth: clamp(st.wings.youth - 12) } } }) }, note: "Youth wing −12" },
        ];
      case 2:
        return [
          { label: "Suspend him", effect: { unity: -6, integrity: 5, capital: 5 } },
          { label: "Buy him off with a GLC seat", effect: { unity: 3, integrity: -4, risk: 4 } },
          { label: "Let it slide", effect: { unity: -2, capital: -3 } },
        ];
      case 3:
        return [
          { label: "Fund the drive (RM 600k)", effect: { funds: -600_000, then: (st) => ({ state: { ...st, me: { ...st.me, members: Math.round(st.me.members * 1.05) }, wings: { ...st.wings, women: clamp(st.wings.women + 6) } } }) }, note: "Members +5%, Wanita +6" },
          { label: "Not now", effect: {} },
        ];
      default:
        return [
          { label: "Hunt down the leaker", effect: { unity: -4, capital: 4 } },
          { label: "Ignore it", effect: { scandal: 4 } },
        ];
    }
  },
  defaultChoice: 1,
};

/** One of your ministers in trouble (you're the Prime Minister). */
export const MINISTER_SCANDAL_CARD: CardDef = {
  kind: "ministerScandal",
  title: "A minister in trouble",
  eligible: (s) => youPm(s) && Object.keys(s.cabinet).length > 4,
  text: (s, c) => {
    const p = byId(s, c.person);
    const post = p ? postOf(s, p.id)[0] : undefined;
    const name = post ? PORTFOLIOS.find((x) => x.id === post)!.name : "a ministry";
    return `${p?.name ?? "A minister"} (${name}) is accused of steering contracts to a relative's company. The portals have the documents.`;
  },
  choices: (s, c) => [
    {
      label: "Sack them",
      effect: {
        unity: -3,
        approval: 1.5,
        integrity: 4,
        then: (st) => {
          const posts = c.person !== undefined ? postOf(st, c.person) : [];
          const cabinet = { ...st.cabinet };
          for (const k of posts) if (k !== "pm") delete cabinet[k];
          return { state: { ...st, cabinet, people: st.people.map((p) => (p.id === c.person ? { ...p, loyalty: clamp(p.loyalty - 40) } : p)) }, lines: [{ text: "The ministry is vacant until you appoint someone (Government → Cabinet).", tone: "info" }] };
        },
      },
      note: "Their ministry falls vacant",
    },
    { label: "Order an independent inquiry", effect: { capital: -5, approval: -1 } },
    { label: "Stand by them", effect: { approval: -3, integrity: -5, risk: 5, personLoyalty: 15 } },
  ],
  defaultChoice: 2,
};

/** Pick a minister for the scandal card (deterministic). */
export function scandalMinister(s: GameState, week: number): number | undefined {
  const ids = Object.entries(s.cabinet)
    .filter(([k, v]) => k !== "pm" && v !== undefined && v !== s.youId)
    .map(([, v]) => v as number);
  return ids.length ? ids[Math.floor(hash01("scandalmin", s.seed, week) * ids.length)] : undefined;
}

/** War-room calls during a general election campaign. */
export const CAMPAIGN_CARDS: CardDef[] = [
  {
    kind: "debate",
    title: "Live TV debate",
    eligible: campaigning,
    text: () => "The networks invite every coalition leader to a live debate. The audience will be huge; so will the risk of a gaffe.",
    choices: () => {
      return [
        {
          label: "Accept",
          effect: {
            then: (st) => {
              const good = hash01("debate", st.seed, st.week) < 0.35 + st.me.reach / 200;
              const me = good
                ? { ...st.me, nationalBuzz: clamp(st.me.nationalBuzz + 12), mood: { ...st.me.mood, youth: (st.me.mood.youth ?? 0) + 0.02, urban: (st.me.mood.urban ?? 0) + 0.02 } }
                : { ...st.me, nationalBuzz: clamp(st.me.nationalBuzz + 3), scandal: clamp(st.me.scandal + 6) };
              return { state: { ...st, me }, lines: [{ text: good ? "You win the debate: the clips are everywhere." : "A gaffe in the debate becomes the meme of the week.", tone: good ? "good" : "bad" }] };
            },
          },
          note: "Unpredictable: you could own the night, or flub it (media reach helps)",
        },
        { label: "Send a deputy", effect: { nationalBuzz: 2 } },
        { label: "Decline", effect: { nationalBuzz: -4 } },
      ];
    },
    defaultChoice: 2,
  },
  {
    kind: "endorsement",
    title: "A celebrity endorsement",
    eligible: campaigning,
    text: () => "A hugely popular singer offers to perform at your rallies and post for you. Their manager wants a fee.",
    choices: () => [
      { label: "Sign them (RM 500k)", effect: { funds: -500_000, nationalBuzz: 8, mood: { youth: 0.04 } } },
      { label: "No thanks", effect: {} },
    ],
    defaultChoice: 1,
  },
  {
    kind: "attackAd",
    title: "An attack ad goes viral",
    eligible: campaigning,
    text: () => "A rival's slick video claims your party will cut subsidies. It has two million views and counting.",
    choices: () => [
      { label: "Rebut it point by point", effect: { capital: -3, nationalBuzz: 2 } },
      { label: "Hit back harder (RM 300k)", effect: { funds: -300_000, nationalBuzz: 6, integrity: -3 } },
      { label: "Ignore it", effect: { mood: { b40: -0.03, rural: -0.02 } } },
    ],
    defaultChoice: 2,
  },
  {
    kind: "permit",
    title: "Rally permit refused",
    eligible: campaigning,
    text: () => "Police refuse a permit for your biggest ceramah of the campaign, citing security.",
    choices: () => [
      { label: "Go ahead anyway", effect: { nationalBuzz: 9, risk: 5, mood: { youth: 0.02 } } },
      { label: "Move to a stadium (RM 250k)", effect: { funds: -250_000, nationalBuzz: 4 } },
      { label: "Cancel", effect: { nationalBuzz: -3 } },
    ],
    defaultChoice: 2,
  },
  {
    kind: "manifesto",
    title: "Manifesto launch",
    eligible: campaigning,
    text: () => "Your team has the manifesto ready. How big do you go?",
    choices: () => [
      { label: "Bold and costed", effect: { capital: -5, nationalBuzz: 6, mood: { urban: 0.02, all: 0.01 } } },
      { label: "Promise everything", effect: { nationalBuzz: 10, integrity: -4, mood: { b40: 0.03, rural: 0.02 } } },
      { label: "Keep it modest", effect: { nationalBuzz: 2 } },
    ],
    defaultChoice: 2,
  },
];
