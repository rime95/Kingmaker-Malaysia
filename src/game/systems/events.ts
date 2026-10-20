// Events as decision cards (as in Grounds Up): each card shows its choices with numbers, and an unanswered card
// takes its default after a few weeks. Random cards are drawn with hash01 (no game-RNG draws), festivals arrive on
// their dates. Scandals are always generic ("an MP from your party"), never about a real person. All numbers TEMPORARY.

import { CARDS, DIFFICULTY } from "../config";
import { runSeatElection } from "../election";
import { recordFrom } from "./results";
import { fmtRM } from "../money";
import { hash01 } from "../rng";
import { isGovernment, voterInputs, weekDate, type CardInstance, type GameState, type ReportLine } from "../state";
import { COALITION_INFO, SEATS, STATE_BY_ID, candidateParty, contestingIn } from "../world";
import { MULTIRACIAL } from "./policies";
import { CONTEST_POINTS, MP, PRESIDENT, RUNGS, addPoints, contestChance, factionSize, promote, succession } from "./career";
import { addSeg, describeSeg, type SegEffects } from "./segments";

export interface Effect {
  funds?: number;
  capital?: number;
  unity?: number;
  trust?: number;
  integrity?: number;
  risk?: number;
  reach?: number;
  nationalBuzz?: number;
  scandal?: number;
  economy?: number;
  fiscal?: number;
  favours?: number;
  /** Short-lived voter reaction (fades 4% a week). */
  mood?: SegEffects;
  /** Buzz in every seat you contest in these states. */
  stateBuzz?: { states: string[]; amount: number };
  /** Buzz in the card's seat. */
  seatBuzz?: number;
  /** Hold the card's by-election now. */
  byElection?: boolean;
  /** Party AGM outcomes. */
  careerContest?: boolean;
  careerChallenge?: boolean;
  careerStepAside?: boolean;
  careerPoints?: number;
}

export interface Choice {
  label: string;
  effect: Effect;
  /** Extra words shown under the numbers. */
  note?: string;
}

export interface CardDef {
  kind: string;
  title: string;
  /** Random cards only: can it appear now? */
  eligible?: (s: GameState) => boolean;
  /** Random cards that need a seat pick one here. */
  pickSeat?: (s: GameState, week: number) => number | undefined;
  text: (s: GameState, c: CardInstance) => string;
  choices: (s: GameState, c: CardInstance) => Choice[];
  /** Index of the choice taken when the card expires. */
  defaultChoice: number;
}

const gov = (s: GameState) => isGovernment(s);
const multiracial = (s: GameState) => MULTIRACIAL.includes(s.player);
const EAST_COAST = ["KTN", "TRG", "PHG"];

export const CARD_DEFS: CardDef[] = [
  {
    kind: "floods",
    title: "Monsoon floods on the east coast",
    eligible: (s) => [10, 11, 0].includes(weekDate(s.week).getMonth()),
    text: () => "Kelantan, Terengganu and Pahang are under water. Thousands are in relief centres and the cameras are rolling.",
    choices: (s) =>
      gov(s)
        ? [
            { label: "Full relief operation", effect: { fiscal: -5, economy: -1, stateBuzz: { states: EAST_COAST, amount: 20 }, nationalBuzz: 4 } },
            { label: "Leave it to the states", effect: { stateBuzz: { states: EAST_COAST, amount: -15 }, mood: { rural: -0.03 } } },
          ]
        : [
            { label: "Send party volunteers", effect: { funds: -300_000, stateBuzz: { states: EAST_COAST, amount: 18 } } },
            { label: "Blame the government's response", effect: { nationalBuzz: 5, mood: { urban: -0.01 } }, note: "Some call it politicking during a disaster." },
            { label: "Stay quiet", effect: {} },
          ],
    defaultChoice: 1,
  },
  {
    kind: "ringgit",
    title: "The ringgit slumps",
    text: () => "The ringgit hits a two-year low against the US dollar. Import prices are climbing.",
    choices: (s) =>
      gov(s)
        ? [
            { label: "Defend the ringgit with reserves", effect: { fiscal: -8, economy: 2 } },
            { label: "Let the market adjust", effect: { economy: -4, mood: { urban: -0.02 } } },
          ]
        : [
            { label: "Attack the government's economic record", effect: { nationalBuzz: 6, capital: 3 } },
            { label: "Offer a bipartisan plan", effect: { integrity: 4, mood: { urban: 0.02 } } },
          ],
    defaultChoice: 1,
  },
  {
    kind: "oil",
    title: "Global oil price spike",
    text: () => "Brent crude jumps 30%. Petronas profits soar, but fuel subsidies now cost the government billions more.",
    choices: (s) =>
      gov(s)
        ? [
            { label: "Absorb it with subsidies", effect: { fiscal: -10 } },
            { label: "Raise pump prices", effect: { fiscal: 4, mood: { all: -0.04, b40: -0.04 } } },
          ]
        : [
            { label: "Demand a price freeze", effect: { mood: { b40: 0.03 }, nationalBuzz: 3 } },
            { label: "Say nothing", effect: {} },
          ],
    defaultChoice: 0,
  },
  {
    kind: "audio",
    title: "Leaked audio",
    text: (s) => `A recording of an MP from ${COALITION_INFO[s.player].short} apparently discussing a project kickback is all over WhatsApp.`,
    choices: () => [
      { label: "Deny everything", effect: { scandal: 20, integrity: -5 }, note: "It may come back later." },
      { label: "Suspend the MP", effect: { unity: -8, integrity: 4, scandal: 6 } },
      { label: "Apologise and order an audit", effect: { scandal: 10, integrity: 6, funds: -100_000 } },
    ],
    defaultChoice: 0,
  },
  {
    kind: "division",
    title: "Money missing at a division",
    text: () => "A division treasury is RM 2 million short. Branch members are talking to journalists.",
    choices: () => [
      { label: "Investigate internally", effect: { integrity: 5, unity: -5 } },
      { label: "Make it go away", effect: { risk: 15, unity: 3 } },
    ],
    defaultChoice: 1,
  },
  {
    kind: "gaffe",
    title: "Gaffe in the Dewan",
    text: (s) => `A ${COALITION_INFO[s.player].short} backbencher made a crude racial remark in a debate. The clip has two million views.`,
    choices: (s) => [
      { label: "Make them apologise", effect: { capital: -5, unity: -3, mood: { chinese: 0.01, indian: 0.01 } } },
      { label: "Defend them", effect: { unity: 4, mood: { malay: 0.02, chinese: -0.05, indian: -0.05, urban: -0.02 }, trust: multiracial(s) ? -8 : 0 } },
    ],
    defaultChoice: 1,
  },
  {
    kind: "flashpoint",
    title: "Racial and religious flashpoint",
    text: () => "A viral video sparks a row over a place of worship. Tempers are rising online and outside.",
    choices: (s) => [
      { label: "Calm the waters", effect: { capital: -5, trust: 5, mood: { all: 0.01 } } },
      {
        label: "Champion your community",
        effect: { mood: { malay: 0.06, chinese: -0.06, indian: -0.06, urban: -0.02 }, trust: multiracial(s) ? -12 : 0, nationalBuzz: 3 },
        note: "Short-term gains; partners and minorities remember.",
      },
    ],
    defaultChoice: 0,
  },
  {
    kind: "partner",
    title: "A partner threatens to walk",
    eligible: (s) => s.me.trust < 50,
    text: () => "A coalition partner says it is being sidelined and will consider its options before the next election.",
    choices: (s) => [
      { label: "Give them more seats and posts", effect: { capital: -10, unity: -4, trust: 15 } },
      { label: "Call their bluff", effect: s.me.trust < 35 ? { trust: -10, unity: 5 } : { unity: 5, trust: -3 }, note: s.me.trust < 35 ? "With trust this low, they may mean it." : undefined },
    ],
    defaultChoice: 1,
  },
  {
    kind: "favour",
    title: "A tycoon calls in a favour",
    eligible: (s) => s.me.favours > 0,
    text: () => "The tycoon who funded you wants a state land deal approved for a friend.",
    choices: () => [
      { label: "Make it happen", effect: { risk: 12, funds: 500_000, favours: -1 } },
      { label: "Refuse", effect: { integrity: 3, favours: -1, funds: -300_000 }, note: "The donor pulls their next pledge." },
    ],
    defaultChoice: 0,
  },
  {
    kind: "chips",
    title: "Chip investment boom",
    text: () => "A global chipmaker announces a multi-billion plant in Penang and Kedah. Thousands of jobs.",
    choices: (s) =>
      gov(s)
        ? [{ label: "Take the credit", effect: { economy: 3, nationalBuzz: 6, stateBuzz: { states: ["PNG", "KDH"], amount: 8 } } }, { label: "Thank the investors", effect: { economy: 3, integrity: 2 } }]
        : [{ label: "Say the states made it happen", effect: { economy: 3, stateBuzz: { states: ["PNG", "KDH"], amount: 6 } } }, { label: "Welcome it", effect: { economy: 3 } }],
    defaultChoice: 1,
  },
  {
    kind: "tiktok",
    title: "A TikTok creator wants a collab",
    text: () => "A creator with 3 million young followers offers a funny video with your leader.",
    choices: () => [
      { label: "Do it (RM 200k)", effect: { funds: -200_000, mood: { youth: 0.04 } } },
      { label: "Too risky", effect: {} },
    ],
    defaultChoice: 1,
  },
  {
    kind: "verdict",
    title: "Verdict in a high-profile case",
    text: () => "The courts have convicted a senior politician from your coalition in a long-running corruption case.",
    choices: (s) => [
      { label: "Respect the courts", effect: { integrity: 5, unity: -6 } },
      { label: "Cry political persecution", effect: { unity: 6, integrity: -6, mood: { malay: 0.02, urban: -0.04, youth: -0.02 }, trust: multiracial(s) ? -5 : 0 } },
    ],
    defaultChoice: 1,
  },
  {
    kind: "cost",
    title: "Cost-of-living protests",
    text: () => "Thousands march in Kuala Lumpur over food prices and rents.",
    choices: (s) =>
      gov(s)
        ? [
            { label: "Price controls and aid", effect: { fiscal: -6, mood: { b40: 0.04 } } },
            { label: "Defend the reforms", effect: { mood: { b40: -0.04, urban: -0.02 }, capital: 3 } },
          ]
        : [
            { label: "March with them", effect: { mood: { b40: 0.04, urban: 0.02 }, risk: 3 } },
            { label: "Stay away", effect: {} },
          ],
    defaultChoice: 1,
  },
  {
    kind: "probe",
    title: "MACC opens a file on a rival",
    text: (s) => `Investigators raid the offices of ${gov(s) ? "an opposition" : "a government"} party over campaign funds.`,
    choices: () => [
      { label: "Make it the story", effect: { nationalBuzz: 6, integrity: -2 } },
      { label: "Stay above it", effect: { integrity: 3 } },
    ],
    defaultChoice: 1,
  },
  {
    kind: "byelection",
    title: "By-election called",
    eligible: (s) => s.week > 8,
    pickSeat: (s, week) => {
      const i = Math.floor(hash01("byseat", s.seed, week) * SEATS.length);
      return contestingIn(SEATS[i]).includes(s.player) ? i : undefined;
    },
    text: (s, c) => {
      const seat = SEATS[c.seat!];
      return `The MP for ${seat.name} (${STATE_BY_ID[seat.state].name}) has died. The by-election is a test of strength for everyone. Held by ${COALITION_INFO[s.holders[c.seat!]].short}.`;
    },
    choices: () => [
      { label: "Go all in (RM 1M)", effect: { funds: -1_000_000, seatBuzz: 35, byElection: true } },
      { label: "Normal campaign (RM 200k)", effect: { funds: -200_000, seatBuzz: 12, byElection: true } },
      { label: "Leave it to the locals", effect: { byElection: true } },
    ],
    defaultChoice: 2,
  },
];

// Festivals arrive on their dates (approximate 2027–2028 dates; later years reuse the month and day).
export const FESTIVALS: { kind: string; title: string; date: string; segment: SegEffects; text: string }[] = [
  { kind: "cny", title: "Chinese New Year open house", date: "02-06", segment: { chinese: 0.05 }, text: "Gong Xi Fa Cai! An open house is a chance to meet Chinese voters." },
  { kind: "raya", title: "Hari Raya Aidilfitri open house", date: "03-10", segment: { malay: 0.04 }, text: "Selamat Hari Raya. Every leader is expected to host an open house." },
  { kind: "kaamatan", title: "Kaamatan harvest festival", date: "05-30", segment: { sabah: 0.08 }, text: "Kotobian Tadau Tagazo do Kaamatan! Sabah celebrates the harvest." },
  { kind: "gawai", title: "Gawai Dayak", date: "06-01", segment: { sarawak: 0.08 }, text: "Selamat Hari Gawai! Sarawak's longhouses are celebrating." },
  { kind: "merdeka", title: "Merdeka Day", date: "08-31", segment: { all: 0.02 }, text: "National Day. A moment to talk about the whole country." },
  { kind: "deepavali", title: "Deepavali open house", date: "10-29", segment: { indian: 0.06 }, text: "Happy Deepavali! An open house for Indian voters." },
];

/** The annual party AGM (mid-June): contest the next post, defend the presidency, or rally the party. */
export const AGM_CARD: CardDef = {
  kind: "agm",
  title: "Party AGM",
  text: (s) => {
    const c = s.career;
    if (c.rung >= PRESIDENT) return c.challenge ? "A rival faction is challenging your leadership. Delegates are counting heads." : "Delegates gather for the annual assembly. A chance to rally the party.";
    if (c.rung === MP - 1) return `To rise further you must win your home seat, ${SEATS[c.homeSeat].name}, at the next general election. Until then, work the ground.`;
    const need = CONTEST_POINTS[c.rung];
    return c.points >= need
      ? `You have the support (${c.points} career points) to contest for ${RUNGS[c.rung + 1]}.`
      : `You need ${need} career points to contest for ${RUNGS[c.rung + 1]} (you have ${c.points}). Win seats, pass reforms and build your faction.`;
  },
  choices: (s) => {
    const c = s.career;
    if (c.rung >= PRESIDENT)
      return c.challenge
        ? [
            { label: "Fight the challenge", effect: { careerChallenge: true }, note: `About ${Math.round(challengeChance(s) * 100)}% chance to survive.` },
            { label: `Step aside for ${c.protege}`, effect: { careerStepAside: true, unity: 10 } },
          ]
        : [
            { label: "Rally the party", effect: { unity: 6, capital: 5, funds: -200_000 } },
            { label: "Keep it short", effect: {} },
          ];
    if (c.rung === MP - 1 || c.points < CONTEST_POINTS[c.rung])
      return [
        { label: "Work the delegates", effect: { careerPoints: 3, funds: -50_000 } },
        { label: "Keep your head down", effect: {} },
      ];
    const chance = contestChance(c, s.me.unity, factionSize(c, s.holders, s.player), s.holders.filter((h) => h === s.player).length);
    return [
      { label: `Contest for ${RUNGS[c.rung + 1]}`, effect: { careerContest: true }, note: `About ${Math.round(chance * 100)}% chance. Losing costs unity and support.` },
      { label: "Wait another year", effect: {} },
    ];
  },
  defaultChoice: 1,
};

function challengeChance(s: GameState): number {
  const seats = s.holders.filter((h) => h === s.player).length;
  const share = seats ? factionSize(s.career, s.holders, s.player) / seats : 0;
  return Math.max(0.1, Math.min(0.9, 0.3 + s.me.unity / 150 + share * 0.5));
}

export const CARD_BY_KIND: Record<string, CardDef> = Object.fromEntries([
  ...CARD_DEFS.map((d) => [d.kind, d]),
  [AGM_CARD.kind, AGM_CARD],
  ...FESTIVALS.map((f) => [
    f.kind,
    {
      kind: f.kind,
      title: f.title,
      text: () => f.text,
      choices: () => [
        { label: "Host a big open house (RM 300k)", effect: { funds: -300_000, mood: f.segment, unity: 2 } },
        { label: "A modest gathering (RM 50k)", effect: { funds: -50_000, mood: Object.fromEntries(Object.entries(f.segment).map(([k, v]) => [k, v! * 0.35])) } },
        { label: "Skip it", effect: { mood: Object.fromEntries(Object.entries(f.segment).map(([k, v]) => [k, -v! * 0.3])) } },
      ],
      defaultChoice: 2,
    } satisfies CardDef,
  ]),
]);

/** Numbers shown under a choice. */
export function describeEffect(e: Effect): string {
  const parts: string[] = [];
  const n = (label: string, v: number | undefined) => v && parts.push(`${label} ${v > 0 ? "+" : "−"}${Math.abs(Math.round(v))}`);
  if (e.funds) parts.push(`Funds ${e.funds > 0 ? "+" : "−"}${fmtRM(Math.abs(e.funds))}`);
  n("Capital", e.capital);
  n("Unity", e.unity);
  n("Partner trust", e.trust);
  n("Integrity", e.integrity);
  n("MACC risk", e.risk);
  n("National buzz", e.nationalBuzz);
  n("Scandal", e.scandal);
  n("Economy", e.economy);
  n("Fiscal space", e.fiscal);
  if (e.stateBuzz) parts.push(`Buzz ${e.stateBuzz.amount > 0 ? "+" : "−"}${Math.abs(e.stateBuzz.amount)} in ${e.stateBuzz.states.map((x) => STATE_BY_ID[x].name).join(", ")}`);
  if (e.seatBuzz) parts.push(`Local buzz +${e.seatBuzz}`);
  if (e.mood) parts.push(describeSeg(e.mood));
  if (e.byElection) parts.push("Polls open now");
  if (e.careerPoints) parts.push(`Career points +${e.careerPoints}`);
  if (e.careerContest) parts.push("Delegates vote");
  return parts.join(" · ") || "No effect";
}

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

/** Applies an effect to a copy of the state. Returns report lines for anything notable. */
export function applyEffect(s: GameState, e: Effect, card?: CardInstance): { state: GameState; lines: ReportLine[] } {
  const me = { ...s.me, buzz: [...s.me.buzz] };
  const lines: ReportLine[] = [];
  me.funds += e.funds ?? 0;
  me.capital = clamp(me.capital + (e.capital ?? 0), 0, 200);
  me.unity = clamp(me.unity + (e.unity ?? 0));
  me.trust = clamp(me.trust + (e.trust ?? 0));
  me.integrity = clamp(me.integrity + (e.integrity ?? 0));
  me.risk = clamp(me.risk + (e.risk ?? 0));
  me.reach = clamp(me.reach + (e.reach ?? 0));
  me.nationalBuzz = clamp(me.nationalBuzz + (e.nationalBuzz ?? 0));
  me.scandal = clamp(me.scandal + (e.scandal ?? 0));
  me.favours = Math.max(0, me.favours + (e.favours ?? 0));
  if (e.mood) me.mood = addSeg(me.mood, e.mood);
  if (e.stateBuzz)
    SEATS.forEach((seat, i) => {
      if (e.stateBuzz!.states.includes(seat.state) && contestingIn(seat).includes(s.player)) me.buzz[i] = clamp(me.buzz[i] + e.stateBuzz!.amount);
    });
  if (e.seatBuzz && card?.seat !== undefined) me.buzz[card.seat] = clamp(me.buzz[card.seat] + e.seatBuzz);
  let state: GameState = { ...s, me, economy: clamp(s.economy + (e.economy ?? 0)), fiscal: clamp(s.fiscal + (e.fiscal ?? 0)) };

  if (e.byElection && card?.seat !== undefined) {
    const i = card.seat;
    const before = state.holders[i];
    const { result, rngState } = runSeatElection(voterInputs(state), i, state.rng);
    const holders = [...state.holders];
    const holderParties = [...state.holderParties];
    holders[i] = result.winner;
    holderParties[i] = result.winnerParty;
    const seatResults = [...state.seatResults];
    seatResults[i] = recordFrom(result, "By-election", s.week, Object.fromEntries(contestingIn(SEATS[i]).map((c) => [c, candidateParty(SEATS[i], c)])));
    state = { ...state, rng: rngState, holders, holderParties, seatResults };
    const won = result.winner === s.player;
    const name = SEATS[i].name;
    state.me = { ...state.me, capital: clamp(state.me.capital + (won ? 10 : -3), 0, 200), unity: clamp(state.me.unity + (won ? 4 : -2)) };
    if (won) state.career = addPoints(state.career, s.week, 8, `won the ${name} by-election`);
    const flip = result.winner !== before ? `, a gain from ${COALITION_INFO[before].short}` : "";
    lines.push({
      text: `${name} by-election: ${result.winnerParty} (${COALITION_INFO[result.winner].short}) wins by ${result.majority.toLocaleString("en-MY")} votes${flip}.`,
      tone: won ? "good" : result.winner !== before && before === s.player ? "bad" : "info",
    });
  }
  state = applyCareerEffect(state, e, lines);
  return { state, lines };
}

/** AGM outcomes: contests are decided with hash01, so no game-RNG draws. */
function applyCareerEffect(s: GameState, e: Effect, lines: ReportLine[]): GameState {
  let c = s.career;
  if (e.careerPoints) c = addPoints(c, s.week, e.careerPoints, "worked the party delegates");
  if (e.careerContest) {
    const chance = contestChance(c, s.me.unity, factionSize(c, s.holders, s.player), s.holders.filter((h) => h === s.player).length);
    const post = RUNGS[c.rung + 1];
    if (hash01("agm", s.seed, s.week) < chance) {
      c = promote(c, s.week, `${c.name} wins the AGM vote: now ${post}.`);
      lines.push({ text: `You win the party vote and become ${post}.`, tone: "good" });
    } else {
      c = { ...addPoints(c, s.week, -Math.round(c.points * 0.2), `lost the contest for ${post}`) };
      s = { ...s, me: { ...s.me, unity: clamp(s.me.unity - 6) } };
      lines.push({ text: `You lose the party vote for ${post}. Try again next year.`, tone: "bad" });
    }
  }
  if (e.careerChallenge) {
    if (hash01("challenge", s.seed, s.week) < challengeChance(s)) {
      c = { ...c, challenge: false, log: [{ week: s.week, text: `${c.name} survives a leadership challenge.` }, ...c.log].slice(0, 30) };
      s = { ...s, me: { ...s.me, unity: clamp(s.me.unity + 10) } };
      lines.push({ text: "You survive the leadership challenge. The party closes ranks.", tone: "good" });
    } else {
      c = { ...c, rung: PRESIDENT - 1, challenge: false, log: [{ week: s.week, text: `${c.name} is ousted as party president.` }, ...c.log].slice(0, 30) };
      lines.push({ text: "You lose the leadership challenge and drop back to Vice President. Win it back at a future AGM.", tone: "bad" });
    }
  }
  if (e.careerStepAside) {
    const old = c.name;
    c = succession(c, s.seed, s.week);
    lines.push({ text: `${old} steps aside. ${c.name} becomes party president.`, tone: "info" });
  }
  return c === s.career ? s : { ...s, career: c };
}

/** Answers a waiting card with one of its choices. */
export function resolveCard(s: GameState, cardId: number, choiceIndex: number, auto = false): { state: GameState; lines: ReportLine[]; message: string } | null {
  const card = s.cards.find((c) => c.id === cardId);
  if (!card) return null;
  const def = CARD_BY_KIND[card.kind];
  const choice = def.choices(s, card)[choiceIndex];
  if (!choice) return null;
  const rest = { ...s, cards: s.cards.filter((c) => c.id !== cardId) };
  const { state, lines } = applyEffect(rest, choice.effect, card);
  const message = auto ? `${def.title}: no answer in time, so the default applies ("${choice.label}").` : `${def.title}: ${choice.label}.`;
  return { state, lines: auto ? [{ text: message, tone: "info" }, ...lines] : lines, message };
}

function festivalOn(date: Date): (typeof FESTIVALS)[number] | undefined {
  // A festival belongs to the week (Mon–Sun) that contains its date.
  for (const f of FESTIVALS) {
    const [m, d] = f.date.split("-").map(Number);
    const target = new Date(date.getFullYear(), m - 1, d);
    const diff = (target.getTime() - date.getTime()) / 86_400_000;
    if (diff >= 0 && diff < 7) return f;
  }
  return undefined;
}

/** Called once per week (inside advanceWeek): expire old cards, then add festival and random cards. */
export function cardsWeek(s: GameState): { state: GameState; lines: ReportLine[] } {
  let state = s;
  const lines: ReportLine[] = [];
  for (const card of s.cards.filter((c) => c.deadline <= s.week)) {
    const r = resolveCard(state, card.id, CARD_BY_KIND[card.kind].defaultChoice, true);
    if (r) {
      state = r.state;
      lines.push(...r.lines);
    }
  }
  const nextId = () => Math.max(0, ...state.cards.map((c) => c.id), s.week * 10) + 1;
  const add = (kind: string, seat?: number) => {
    const card: CardInstance = { id: nextId(), kind, week: s.week, deadline: s.week + CARDS.answerWeeks, seat };
    state = { ...state, cards: [...state.cards, card], cardLast: { ...state.cardLast, [kind]: s.week } };
    lines.push({ text: `Needs you: ${CARD_BY_KIND[kind].title}.`, tone: "info" });
  };

  const date = weekDate(s.week);
  if (date.getMonth() === 5 && date.getDate() >= 8 && date.getDate() <= 14 && !state.cards.some((c) => c.kind === "agm")) add("agm");
  const fest = festivalOn(date);
  if (fest) add(fest.kind);

  if (s.week >= CARDS.firstWeek && state.cards.length < CARDS.maxPending && hash01("card", s.seed, s.week) < CARDS.chance * DIFFICULTY[s.settings.difficulty].cards) {
    const open = CARD_DEFS.filter(
      (d) =>
        (d.eligible?.(state) ?? true) &&
        !state.cards.some((c) => c.kind === d.kind) &&
        (state.cardLast[d.kind] === undefined || s.week - state.cardLast[d.kind] >= CARDS.noRepeat),
    );
    if (open.length) {
      const def = open[Math.floor(hash01("cardpick", s.seed, s.week) * open.length)];
      const seat = def.pickSeat?.(state, s.week);
      if (!def.pickSeat || seat !== undefined) add(def.kind, seat);
    }
  }
  return { state, lines };
}

