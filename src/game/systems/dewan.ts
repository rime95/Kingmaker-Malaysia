// The Dewan Rakyat sits three times a year, like the real one: Feb–Mar, Jun–Jul and Oct–Nov (the Budget comes in the
// third). Each meeting opens with an Order Paper of bills and motions, drawn from what the country is going through
// (prices, floods, debt, a crisis) and from a pool of perennial fights, so it never runs dry across endless terms.
// One motion comes to a vote each turn. Before it does you can whip your MPs, court another coalition, amend the bill,
// speak, walk out, or (as Prime Minister) withdraw it. Every MP then votes: whips hold most of them, leanings and
// low trust break some away. All randomness is hash01, so a division is the same however you skip time.

import { hash01 } from "../rng";
import type { GameState, ReportLine } from "../state";
import { addSeg, type SegEffects } from "./segments";
import { cshort, type CoalitionId } from "../world";

export type MotionKind = "bill" | "constitutional" | "royal" | "oppMotion";
export type Vote = "aye" | "no" | "abstain" | "absent";

export interface MotionDef {
  id: string;
  kind: MotionKind;
  title: (year: number) => string;
  blurb: string;
  /** How each coalition leans beyond the whip: −1 hates it, +1 loves it. */
  lean?: Partial<Record<CoalitionId, number>>;
  /** How it lands with voters (credit to whoever backed it, blame to whoever blocked it). */
  seg: SegEffects;
  /** Government approval if it passes (points). */
  approval: number;
  /** How likely it is to be tabled now (0 = not now). */
  when?: (s: GameState) => number;
}

export interface Prep {
  /** Your coalition's line: for or against (defaults to your side's). */
  stance: "for" | "against" | null;
  whip: boolean;
  courted: CoalitionId[];
  amended: boolean;
  spoke: boolean;
  walkout: boolean;
}

export interface Division {
  ayes: number;
  noes: number;
  abstain: number;
  absent: number;
  passed: boolean;
  /** Seat index → how its MP voted. */
  votes: Vote[];
}

export interface Motion {
  id: number;
  def: string;
  title: string;
  kind: MotionKind;
  /** Who tabled it. */
  by: CoalitionId;
  voteWeek: number;
  twoThirds: boolean;
  withdrawn: boolean;
  prep: Prep;
  result: Division | null;
}

export interface Dewan {
  /** The meeting in session ("2027-1"), or null in recess. */
  meeting: string | null;
  /** This meeting's Order Paper. */
  motions: Motion[];
  /** Decided and lapsed motions, newest first (kept short). */
  history: Motion[];
  nextId: number;
}

export const DEWAN = {
  /** Months the House sits (1 = January), by meeting. */
  meetings: [
    [2, 3],
    [6, 7],
    [10, 11],
  ],
  /** Bills on each Order Paper. */
  perMeeting: 3,
  /** A template isn't tabled again within this many weeks. */
  repeatAfter: 104,
  twoThirds: 148,
  absent: 0.03,
  whip: { ap: 1, capital: 5 },
  court: { ap: 1, cost: 1_000_000 },
  amend: { ap: 2, capital: 5, accepted: 0.55, effect: 0.6 },
  speak: { ap: 1, buzz: 4 },
  table: { ap: 2, capital: 8 },
  withdraw: { capital: 5 },
};

const N = (y: number, t: string) => `${t} ${y}`;

/** Bills and motions: the perennial fights of Malaysian politics, and ones the times call for. */
export const MOTIONS: MotionDef[] = [
  { id: "royal", kind: "royal", title: (y) => `Motion of Thanks for the Royal Address ${y}`, blurb: "The debate on the Agong's speech that opens the parliamentary year. A chance to set the tone.", seg: { all: 0.01 }, approval: 0.5, lean: { PH: 0.6, BN: 0.6, PN: 0.4, GPS: 0.6, GRS: 0.6, WARISAN: 0.5, MUDA: 0.4, OTHERS: 0.5 } },
  { id: "price", kind: "bill", title: (y) => N(y, "Price Control and Anti-Profiteering (Amendment) Bill"), blurb: "Heavier fines for profiteers and price caps on essentials. Popular with B40 households; business grumbles.", seg: { b40: 0.04, rural: 0.02, chinese: -0.01 }, approval: 2, when: (s) => (s.nation.col > 55 ? 3 : 0.6) },
  { id: "jobs", kind: "bill", title: (y) => N(y, "Employment Insurance System (Amendment) Bill"), blurb: "Longer jobless benefits and retraining credits.", seg: { youth: 0.03, urban: 0.02 }, approval: 1.5, when: (s) => (s.nation.unemployment > 3.8 ? 3 : 0.5) },
  { id: "floods", kind: "bill", title: (y) => N(y, "National Disaster Management Agency Bill"), blurb: "A statutory disaster agency with its own budget, after another season of floods.", seg: { rural: 0.03, all: 0.01 }, approval: 2, when: () => 0.8 },
  { id: "pandemic", kind: "bill", title: (y) => N(y, "Prevention and Control of Infectious Diseases (Amendment) Bill"), blurb: "Emergency powers to fight the new virus: closures, fines, mandatory reporting.", seg: { all: 0.02, youth: -0.02 }, approval: 2, when: (s) => (s.nation.crisis?.kind === "pandemic" ? 8 : 0) },
  { id: "stimulus", kind: "bill", title: (y) => N(y, "Economic Stimulus (Temporary Measures) Bill"), blurb: "Wage subsidies and loan moratoriums while exports collapse.", seg: { b40: 0.03, all: 0.01 }, approval: 2.5, when: (s) => (s.nation.crisis?.kind === "recession" ? 8 : 0) },
  { id: "capital", kind: "bill", title: (y) => N(y, "Exchange Control (Temporary Measures) Bill"), blurb: "Curbs on hot money to stop the ringgit's slide. Investors hate it; it might work.", seg: { all: 0.01, chinese: -0.02 }, approval: 1, when: (s) => (s.nation.crisis?.kind === "ringgit" ? 8 : 0), lean: { MUDA: -0.4 } },
  { id: "windfall", kind: "bill", title: (y) => N(y, "Windfall Profit Levy Bill"), blurb: "A levy on oil and palm oil windfalls, shared with the producing states.", seg: { sabah: 0.03, sarawak: 0.03, rural: 0.01 }, approval: 1, when: (s) => (s.nation.crisis?.kind === "boom" ? 8 : 0), lean: { GPS: 0.5 } },
  { id: "fiscal", kind: "bill", title: (y) => N(y, "Public Finance and Fiscal Responsibility Bill"), blurb: "A legal ceiling on debt and deficits. Markets like it; it ties the government's hands.", seg: { urban: 0.02, chinese: 0.02, b40: -0.01 }, approval: 0.5, when: (s) => (s.nation.debt > 64 ? 3 : 0.7), lean: { PN: 0.2, MUDA: 0.4 } },
  { id: "subsidy", kind: "bill", title: (y) => N(y, "Supplies Control (Targeted Subsidy) Bill"), blurb: "Ends blanket fuel subsidies for targeted cash aid. Saves billions; angers the middle and the rural driver.", seg: { b40: 0.02, rural: -0.04, malay: -0.02, urban: 0.01 }, approval: -2, when: (s) => (s.nation.debt > 60 ? 2 : 0.8), lean: { PN: -0.6, BN: -0.3 } },
  { id: "hopping", kind: "constitutional", title: (y) => N(y, "Constitution (Amendment) Bill: Anti-Party Hopping"), blurb: "Tightens the anti-hopping law so MPs who switch sides lose their seats. Broad support, but every party has MPs it might want to poach.", seg: { all: 0.02, urban: 0.02 }, approval: 2, lean: { PH: 0.5, MUDA: 0.8, PN: 0.2, BN: 0.2, GPS: 0.3, GRS: 0.2, WARISAN: 0.4 } },
  { id: "ma63", kind: "constitutional", title: (y) => N(y, "Constitution (Amendment) Bill: Malaysia Agreement 1963 Rights"), blurb: "Restores Sabah and Sarawak as equal partners: a third of seats, more revenue. Huge in Borneo; the peninsula is wary.", seg: { sabah: 0.08, sarawak: 0.08, malay: -0.01 }, approval: 1.5, lean: { GPS: 1, GRS: 1, WARISAN: 1, PH: 0.3, BN: 0.1, PN: -0.2 } },
  { id: "ruu355", kind: "bill", title: (y) => N(y, "Syariah Courts (Criminal Jurisdiction) (Amendment) Bill"), blurb: "Raises the sentencing caps of the Syariah courts (RUU355). PAS's cause for decades; non-Muslim voters are alarmed.", seg: { malay: 0.04, rural: 0.02, chinese: -0.06, indian: -0.05, sabah: -0.03, sarawak: -0.03 }, approval: -0.5, lean: { PN: 1, BN: 0.4, PH: -0.5, MUDA: -0.8, GPS: -0.6, GRS: -0.3, WARISAN: -0.6 } },
  { id: "sedition", kind: "bill", title: (y) => N(y, "Sedition (Repeal) Bill"), blurb: "Scraps the colonial-era Sedition Act. Reformers cheer; conservatives warn about race and religion.", seg: { urban: 0.03, chinese: 0.03, youth: 0.02, malay: -0.03 }, approval: 0, lean: { MUDA: 1, PH: 0.3, PN: -0.8, BN: -0.5 } },
  { id: "funding", kind: "bill", title: (y) => N(y, "Political Financing Bill"), blurb: "Caps and discloses political donations. Clean, popular, and it starves every party's war chest.", seg: { urban: 0.04, youth: 0.03, all: 0.01 }, approval: 2, lean: { MUDA: 1, PH: 0.2, BN: -0.6, PN: -0.3, GPS: -0.3 } },
  { id: "termlimit", kind: "constitutional", title: (y) => N(y, "Constitution (Amendment) Bill: Prime Minister's Term Limit"), blurb: "Two terms and out for every future Prime Minister.", seg: { urban: 0.03, youth: 0.03 }, approval: 1.5, lean: { MUDA: 1, PH: 0.4, PN: 0.3, BN: -0.4 } },
  { id: "agpp", kind: "constitutional", title: (y) => N(y, "Constitution (Amendment) Bill: Separating the Attorney-General and Public Prosecutor"), blurb: "Takes prosecution decisions out of the government's hands.", seg: { urban: 0.03, chinese: 0.02 }, approval: 1, lean: { MUDA: 1, PH: 0.3, PN: 0.4, BN: -0.6 } },
  { id: "gig", kind: "bill", title: (y) => N(y, "Gig Workers Bill"), blurb: "Social security and minimum rates for e-hailing and delivery riders.", seg: { youth: 0.04, urban: 0.03, b40: 0.02 }, approval: 1.5, lean: { MUDA: 0.6 } },
  { id: "wage", kind: "bill", title: (y) => N(y, "National Wages Consultative Council (Amendment) Bill"), blurb: "Raises the minimum wage. Workers gain; small business protests.", seg: { b40: 0.04, indian: 0.02, chinese: -0.02 }, approval: 1.5, when: (s) => (s.nation.inflation > 3 ? 2 : 1) },
  { id: "online", kind: "bill", title: (y) => N(y, "Online Safety Bill"), blurb: "Licences for social media platforms and takedown powers. Parents like it; young voters call it censorship.", seg: { youth: -0.04, rural: 0.02, malay: 0.01 }, approval: 0, lean: { MUDA: -1, PN: 0.2 } },
  { id: "deathpen", kind: "bill", title: (y) => N(y, "Abolition of Mandatory Death Penalty (Amendment) Bill"), blurb: "Ends the last mandatory death sentences.", seg: { urban: 0.01, malay: -0.02 }, approval: -0.5, lean: { PN: -0.6, MUDA: 0.6 } },
  { id: "tobacco", kind: "bill", title: (y) => N(y, "Control of Smoking Products (Generational End Game) Bill"), blurb: "No cigarettes ever for anyone born after 2007.", seg: { urban: 0.01, rural: -0.02 }, approval: 0, lean: { PN: -0.3 } },
  { id: "water", kind: "bill", title: (y) => N(y, "Water Services Industry (Amendment) Bill"), blurb: "Federal money and powers to end water cuts. Kelantan and Kedah would gain most.", seg: { rural: 0.03, malay: 0.02 }, approval: 1.5, when: () => 0.7 },
  { id: "housing", kind: "bill", title: (y) => N(y, "Residensi Madani Affordable Housing Bill"), blurb: "Rent-to-own flats near transit for first-time buyers.", seg: { youth: 0.03, urban: 0.03, b40: 0.02 }, approval: 1.5 },
  { id: "ombudsman", kind: "bill", title: (y) => N(y, "Ombudsman Malaysia Bill"), blurb: "An independent ombudsman for complaints against the civil service.", seg: { urban: 0.02 }, approval: 0.5, lean: { MUDA: 0.6 } },
  { id: "undi18", kind: "bill", title: (y) => N(y, "Elections (Automatic Voter Registration Abroad) Bill"), blurb: "Postal votes made easy for Malaysians abroad and in Singapore.", seg: { youth: 0.02, chinese: 0.02 }, approval: 0.5, lean: { MUDA: 1, PH: 0.4, PN: -0.4 } },
  // Opposition motions
  { id: "rci", kind: "oppMotion", title: (y) => N(y, "Motion to establish a Royal Commission of Inquiry into GLC procurement"), blurb: "The opposition wants a royal commission into how government-linked companies award contracts.", seg: { urban: 0.03, all: 0.01 }, approval: -3 },
  { id: "privileges", kind: "oppMotion", title: (y) => N(y, "Motion to refer a Minister to the Committee of Privileges"), blurb: "For misleading the House about the cost of a mega-project.", seg: { urban: 0.02 }, approval: -2 },
  { id: "colmotion", kind: "oppMotion", title: (y) => N(y, "Motion for an emergency debate on the cost of living"), blurb: "The opposition demands the House set aside its business to debate prices.", seg: { b40: 0.03, rural: 0.02 }, approval: -2, when: (s) => (s.nation.col > 50 ? 3 : 0.5) },
  { id: "pac", kind: "oppMotion", title: (y) => N(y, "Motion to empower the Public Accounts Committee to summon ministers"), blurb: "Teeth for the PAC, which an opposition MP chairs.", seg: { urban: 0.02 }, approval: -1.5 },
];

export const MOTION_BY_ID: Record<string, MotionDef> = Object.fromEntries(MOTIONS.map((m) => [m.id, m]));

export const initDewan = (): Dewan => ({ meeting: null, motions: [], history: [], nextId: 1 });

const emptyPrep = (): Prep => ({ stance: null, whip: false, courted: [], amended: false, spoke: false, walkout: false });

/** The meeting a date falls in ("2027-1"), or null in recess. */
export function meetingOf(date: Date): string | null {
  const m = date.getMonth() + 1;
  const k = DEWAN.meetings.findIndex((ms) => ms.includes(m));
  return k < 0 ? null : `${date.getFullYear()}-${k + 1}`;
}

/** The biggest opposition coalition in the House. */
export function mainOpposition(s: GameState): CoalitionId {
  const n: Partial<Record<CoalitionId, number>> = {};
  for (const h of s.holders) if (!s.government.includes(h) && h !== "OTHERS") n[h] = (n[h] ?? 0) + 1;
  return (Object.entries(n).sort((a, b) => b[1]! - a[1]!)[0]?.[0] as CoalitionId) ?? "PN";
}

function pick(s: GameState, pool: MotionDef[], salt: string): MotionDef | null {
  const recent = new Set([...s.dewan.history, ...s.dewan.motions].filter((m) => s.week - m.voteWeek < DEWAN.repeatAfter).map((m) => m.def));
  const left = pool.map((d) => ({ d, w: recent.has(d.id) ? 0 : (d.when?.(s) ?? 1) })).filter((x) => x.w > 0);
  const total = left.reduce((a, x) => a + x.w, 0);
  if (!total) return null;
  let r = hash01("motion", s.seed, s.week, salt) * total;
  return (left.find((x) => (r -= x.w) <= 0) ?? left.at(-1)!).d;
}

function makeMotion(s: GameState, def: MotionDef, id: number, voteWeek: number, by: CoalitionId, year: number): Motion {
  return { id, def: def.id, title: def.title(year), kind: def.kind, by, voteWeek, twoThirds: def.kind === "constitutional", withdrawn: false, prep: emptyPrep(), result: null };
}

/** A new meeting: the Order Paper (the Royal Address opens the year). One vote a turn, from next week. */
export function openMeeting(s: GameState, key: string, year: number): Dewan {
  const d = { ...s.dewan, motions: [] as Motion[] };
  let id = d.nextId;
  let w = s.week + 1;
  const pm = s.parliament.pm;
  const add = (def: MotionDef | null, by: CoalitionId) => {
    if (!def) return;
    d.motions.push(makeMotion({ ...s, dewan: d }, def, id++, w, by, year));
    w += 2;
  };
  if (key.endsWith("-1")) add(MOTION_BY_ID.royal, pm);
  const bills = MOTIONS.filter((m) => m.kind === "bill" || m.kind === "constitutional");
  for (let k = 0; k < DEWAN.perMeeting; k++) add(pick({ ...s, dewan: d }, bills, `${key}-${k}`), pm);
  if (hash01("oppmotion", s.seed, key) < 0.6) add(pick({ ...s, dewan: d }, MOTIONS.filter((m) => m.kind === "oppMotion"), `${key}-opp`), mainOpposition(s));
  return { ...d, meeting: key, nextId: id };
}

const govSide = (s: GameState, c: CoalitionId) => s.government.includes(c);
/** Which side a motion's tablers are on. */
const tabledByGov = (s: GameState, m: Motion) => govSide(s, m.by);

/** Your coalition's line on a motion (your own choice, else your side's). */
export function yourStance(s: GameState, m: Motion): "for" | "against" {
  if (m.prep.stance) return m.prep.stance;
  if (m.kind === "royal") return "for";
  return tabledByGov(s, m) === govSide(s, s.player) ? "for" : "against";
}

/** Everyone's votes on a motion as things stand. */
export function division(s: GameState, m: Motion): Division {
  const def = MOTION_BY_ID[m.def];
  const forGov = tabledByGov(s, m);
  const mine = yourStance(s, m);
  const amend = m.prep.amended ? 0.5 : 1;
  const votes: Vote[] = s.holders.map((c, i) => {
    const h = (k: string) => hash01("division", s.seed, m.id, i, k);
    if (h("absent") < DEWAN.absent) return "absent";
    let lean = def.lean?.[c] ?? 0;
    if (lean < 0) lean *= amend;
    // The line a coalition's whips set.
    let line: "aye" | "no";
    if (c === s.player) line = mine === "for" ? "aye" : "no";
    else if (m.kind === "royal") line = "aye";
    else line = govSide(s, c) === forGov ? "aye" : "no";
    if (c === s.player && m.prep.walkout && line === "no") return "absent";
    if (c !== s.player && lean > 0.6 && line === "no" && h("cross") < lean - 0.3) line = "aye";
    // Breaking the whip.
    let p = line === "aye" ? Math.max(0, -lean) * 0.45 : Math.max(0, lean) * 0.35;
    if (c === s.player) p += Math.max(0, (55 - s.me.unity) / 120);
    else if (govSide(s, c) && govSide(s, s.player)) p += Math.max(0, (50 - s.me.trust) / 120);
    else p += 0.02;
    if (c === s.player && m.prep.whip) p *= 0.15;
    const courted = m.prep.courted.includes(c);
    const wanted = mine === "for" ? "aye" : "no";
    if (courted && line === wanted) p *= 0.2;
    if (courted && line !== wanted) p += 0.35;
    if (m.prep.spoke && c !== s.player) p += line === wanted ? -0.02 : 0.03;
    if (h("rebel") < Math.max(0, p)) return h("how") < 0.6 ? "abstain" : line === "aye" ? "no" : "aye";
    return line;
  });
  const count = (v: Vote) => votes.filter((x) => x === v).length;
  const ayes = count("aye");
  const noes = count("no");
  return { ayes, noes, abstain: count("abstain"), absent: count("absent"), passed: m.twoThirds ? ayes >= DEWAN.twoThirds : ayes > noes, votes };
}

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

/** The vote: tally it, then the fallout for the government and for you. */
export function resolveMotion(s: GameState, m: Motion): { state: GameState; lines: ReportLine[] } {
  const def = MOTION_BY_ID[m.def];
  const r = division(s, m);
  const lines: ReportLine[] = [];
  const done: Motion = { ...m, result: r };
  const scale = m.prep.amended ? DEWAN.amend.effect : 1;
  let me = { ...s.me };
  let nation = s.nation;
  const youPm = s.parliament.pm === s.player;
  const mine = yourStance(s, m);
  const verdict = `${r.passed ? "passed" : "defeated"}: ${r.ayes} ayes, ${r.noes} noes${r.abstain + r.absent ? `, ${r.abstain + r.absent} abstained or absent` : ""}${m.twoThirds ? ` (needs ${DEWAN.twoThirds})` : ""}`;
  lines.push({ text: `Dewan Rakyat: ${m.title} ${verdict}.`, tone: (r.passed ? mine === "for" : mine === "against") ? "good" : "bad" });
  if (r.passed) {
    if (m.kind !== "oppMotion") nation = { ...nation, approval: clamp(nation.approval + def.approval * scale) };
    else nation = { ...nation, approval: clamp(nation.approval + def.approval) };
    // Voters remember who backed it: full credit to the government that passed it, some to those who voted with it.
    const credit = mine === "for" ? (youPm || (m.kind === "oppMotion" && m.by === s.player) ? 1 : 0.4) : -0.4;
    me.mood = addSeg(me.mood, def.seg, credit * scale);
  } else if (m.kind !== "royal") {
    const govDefeated = tabledByGov(s, m);
    if (govDefeated) nation = { ...nation, approval: clamp(nation.approval - 3) };
    if (govDefeated && youPm) {
      me = { ...me, capital: Math.max(0, me.capital - 10), unity: clamp(me.unity - 4) };
      lines.push({ text: "A government defeat on the floor of the House. Your authority takes a knock.", tone: "bad" });
    } else if (mine === "against") {
      me = { ...me, capital: me.capital + 6, nationalBuzz: clamp(me.nationalBuzz + 5) };
      lines.push({ text: `You helped defeat it: ${cshort(s.player)} is the story of the day.`, tone: "good" });
    }
    // Blocking something popular costs whoever blocked it.
    if (mine === "against") me.mood = addSeg(me.mood, def.seg, -0.2);
  }
  if (m.prep.walkout) {
    const pop = Object.values(def.seg).reduce((a, b) => a + (b ?? 0), 0);
    me = { ...me, nationalBuzz: clamp(me.nationalBuzz + (pop < 0 ? 4 : -2)) };
  }
  const dewan = { ...s.dewan, motions: s.dewan.motions.map((x) => (x.id === m.id ? done : x)) };
  return { state: { ...s, me, nation, dewan }, lines };
}

/** Each week: open or adjourn meetings, and hold the vote that falls due. */
export function dewanWeek(s: GameState, date: Date): { state: GameState; lines: ReportLine[] } {
  let state = s;
  const lines: ReportLine[] = [];
  const key = s.parliament.status === "sitting" ? meetingOf(date) : null;
  if (key !== s.dewan.meeting) {
    // Adjourn: whatever wasn't voted on lapses.
    const old = [...s.dewan.motions];
    let d: Dewan = { ...s.dewan, meeting: null, motions: [], history: [...old.reverse(), ...s.dewan.history].slice(0, 24) };
    if (s.dewan.meeting && s.dewan.motions.some((m) => !m.result && !m.withdrawn)) lines.push({ text: "The Dewan adjourns; unfinished business lapses.", tone: "info" });
    state = { ...state, dewan: d };
    if (key) {
      d = openMeeting(state, key, date.getFullYear());
      state = { ...state, dewan: d };
      lines.push({ text: `The Dewan Rakyat sits again: ${d.motions.length} items on the Order Paper (Parliament → Order paper).`, tone: "info" });
    }
  }
  for (const m of state.dewan.motions) {
    if (m.result || m.withdrawn || m.voteWeek > state.week) continue;
    const r = resolveMotion(state, m);
    state = r.state;
    lines.push(...r.lines);
  }
  return { state, lines };
}

/** The next motion to be voted on (this turn or later). */
export const nextMotion = (s: GameState) => s.dewan.motions.find((m) => !m.result && !m.withdrawn);

// ---------------------------------------------------------------------------------------------
// Your moves before a vote
// ---------------------------------------------------------------------------------------------

export type PrepMove = { kind: "stance"; stance: "for" | "against" } | { kind: "whip" } | { kind: "court"; c: CoalitionId } | { kind: "amend" } | { kind: "speak" } | { kind: "walkout" } | { kind: "withdraw" };

export function prepBlocked(s: GameState, m: Motion | undefined, move: PrepMove): string | null {
  if (!m || m.result || m.withdrawn) return "That vote is over.";
  const p = m.prep;
  switch (move.kind) {
    case "stance":
      return null;
    case "whip":
      if (p.whip) return "Your whips are already on it.";
      if (s.me.ap < DEWAN.whip.ap) return `Needs ${DEWAN.whip.ap} AP.`;
      return s.me.capital < DEWAN.whip.capital ? `Needs ${DEWAN.whip.capital} political capital.` : null;
    case "court":
      if (p.courted.includes(move.c)) return "Already courted.";
      if (move.c === s.player) return "That's you.";
      if (s.me.ap < DEWAN.court.ap) return `Needs ${DEWAN.court.ap} AP.`;
      return s.me.funds < DEWAN.court.cost ? "Not enough money for the allocations." : null;
    case "amend":
      if (p.amended) return "Already amended.";
      if (m.kind === "royal") return "There's nothing to amend.";
      if (s.me.ap < DEWAN.amend.ap) return `Needs ${DEWAN.amend.ap} AP.`;
      return s.me.capital < DEWAN.amend.capital ? `Needs ${DEWAN.amend.capital} political capital.` : null;
    case "speak":
      if (p.spoke) return "You've had your say.";
      return s.me.ap < DEWAN.speak.ap ? `Needs ${DEWAN.speak.ap} AP.` : null;
    case "walkout":
      if (p.walkout) return "You've already walked out.";
      return yourStance(s, m) !== "against" ? "Only when you oppose it." : null;
    case "withdraw":
      if (s.parliament.pm !== s.player || m.by !== s.player) return "Only the Prime Minister can withdraw a government bill.";
      if (m.kind === "royal") return "The Royal Address can't be withdrawn.";
      return s.me.capital < DEWAN.withdraw.capital ? `Needs ${DEWAN.withdraw.capital} political capital.` : null;
  }
}

export function prepMotion(s: GameState, id: number, move: PrepMove): { state: GameState; message: string } | { error: string } {
  const m = s.dewan.motions.find((x) => x.id === id);
  const why = prepBlocked(s, m, move);
  if (why || !m) return { error: why ?? "No such motion." };
  let me = { ...s.me };
  let prep = { ...m.prep };
  let withdrawn = false;
  let message = "";
  switch (move.kind) {
    case "stance":
      prep = { ...prep, stance: move.stance, walkout: move.stance === "for" ? false : prep.walkout };
      message = `${cshort(s.player)} will vote ${move.stance === "for" ? "for" : "against"} it.`;
      break;
    case "whip":
      me = { ...me, ap: me.ap - DEWAN.whip.ap, capital: me.capital - DEWAN.whip.capital };
      prep.whip = true;
      message = "Three-line whip: your MPs are told to be in the House and vote the party line.";
      break;
    case "court":
      me = { ...me, ap: me.ap - DEWAN.court.ap, funds: me.funds - DEWAN.court.cost };
      prep.courted = [...prep.courted, move.c];
      message = `You work on ${cshort(move.c)}'s MPs: constituency allocations, a word in the right ear.`;
      break;
    case "amend": {
      me = { ...me, ap: me.ap - DEWAN.amend.ap, capital: me.capital - DEWAN.amend.capital };
      const ok = m.by === s.player || hash01("amend", s.seed, m.id) < DEWAN.amend.accepted;
      prep.amended = ok;
      message = ok ? "Your amendment is accepted: the bill is softened, its opponents less dug in." : "The House rejects your amendment.";
      break;
    }
    case "speak":
      me = { ...me, ap: me.ap - DEWAN.speak.ap, nationalBuzz: clamp(me.nationalBuzz + DEWAN.speak.buzz * (0.5 + me.reach / 100)) };
      prep.spoke = true;
      message = "Your speech in the debate makes the evening news.";
      break;
    case "walkout":
      prep.walkout = true;
      message = "Your MPs will walk out when the bells ring.";
      break;
    case "withdraw":
      me = { ...me, capital: me.capital - DEWAN.withdraw.capital };
      withdrawn = true;
      message = "The bill is withdrawn for further consultation. The opposition calls it a U-turn.";
      break;
  }
  const motions = s.dewan.motions.map((x) => (x.id === id ? { ...x, prep, withdrawn: x.withdrawn || withdrawn } : x));
  const nation = withdrawn ? { ...s.nation, approval: clamp(s.nation.approval - 1) } : s.nation;
  return { state: { ...s, me, nation, dewan: { ...s.dewan, motions } }, message };
}

/** Opposition: table your own motion for the next free vote this meeting. */
export function tableMotion(s: GameState): { state: GameState; message: string } | { error: string } {
  if (!s.dewan.meeting) return { error: "The Dewan is in recess." };
  if (govSide(s, s.player)) return { error: "Opposition only: the government tables bills." };
  if (s.dewan.motions.some((m) => m.by === s.player && m.kind === "oppMotion")) return { error: "You already have a motion on this Order Paper." };
  if (s.me.ap < DEWAN.table.ap) return { error: `Needs ${DEWAN.table.ap} AP.` };
  if (s.me.capital < DEWAN.table.capital) return { error: `Needs ${DEWAN.table.capital} political capital.` };
  const def = pick(s, MOTIONS.filter((m) => m.kind === "oppMotion"), `table-${s.dewan.nextId}`);
  if (!def) return { error: "Nothing left to table this year." };
  const last = Math.max(s.week, ...s.dewan.motions.map((m) => m.voteWeek));
  const motion = makeMotion(s, def, s.dewan.nextId, last + 2, s.player, Number(s.dewan.meeting.slice(0, 4)));
  return {
    state: { ...s, me: { ...s.me, ap: s.me.ap - DEWAN.table.ap, capital: s.me.capital - DEWAN.table.capital }, dewan: { ...s.dewan, motions: [...s.dewan.motions, motion], nextId: s.dewan.nextId + 1 } },
    message: `You table a motion: ${motion.title}.`,
  };
}

/** Seats in a division, for the hemicycle: seat → vote. */
export const lastDivision = (s: GameState) => [...s.dewan.motions].reverse().find((m) => m.result) ?? s.dewan.history.find((m) => m.result);

