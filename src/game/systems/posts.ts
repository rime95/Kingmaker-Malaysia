// Party posts: the people you trust to run the party with you.
// - Lieutenants hold the national posts: Secretary-General (discipline), Treasurer (money), Information Chief (the
//   message), Election Director (every campaign), and the Youth, Wanita and Puteri chiefs (the wings).
// - Generals are the state chiefs (Pengerusi Perhubungan Negeri): one per state, running the party machine there. A
//   strong chief pulls votes in every seat in the state; a chief from outside the state ("parachuted") does half as
//   well. When the party wins a state, its chief is first in line to be Menteri Besar.
// - Every party has them, so rival generals matter too. You appoint your own party's; AI parties fill theirs.
// - Missions: send a post-holder on a job (1 AP, once every six weeks each). Success builds trust (loyalty); a
//   disloyal, ambitious lieutenant may turn on you (a card).
// All numbers TEMPORARY.

import { hash01 } from "../rng";
import type { CardDef } from "./events";
import type { GameState, ReportLine } from "../state";
import { COALITIONS, SEATS, STATES, candidateParty, contestingIn } from "../world";
import { seatCandidate } from "./coalitions";
import { HIERARCHY_PARTIES, type Person } from "./people";

export const NATIONAL_POSTS = ["sg", "treasurer", "info", "director", "youth", "wanita", "puteri"] as const;
export type NationalPost = (typeof NATIONAL_POSTS)[number];

export const POST_INFO: Record<NationalPost, { name: string; malay: string; job: string; mission: string; missionText: string }> = {
  sg: { name: "Secretary-General", malay: "Setiausaha Agung", job: "Keeps the party in line: unity holds up", mission: "Whip the divisions", missionText: "unity" },
  treasurer: { name: "Treasurer", malay: "Bendahari", job: "Brings in money every week", mission: "Donor round", missionText: "funds" },
  info: { name: "Information Chief", malay: "Ketua Penerangan", job: "Your message lasts longer in the news", mission: "Media blitz", missionText: "national buzz" },
  director: { name: "Election Director", malay: "Pengarah Pilihan Raya", job: "Sharpens every campaign while an election is on", mission: "Audit the battlegrounds", missionText: "machinery in your closest seats" },
  youth: { name: "Youth Chief", malay: "Ketua Pemuda", job: "Runs the Youth wing", mission: "Ground drive", missionText: "the Youth wing" },
  wanita: { name: "Wanita Chief", malay: "Ketua Wanita", job: "Runs the Wanita wing", mission: "Ground drive", missionText: "the Wanita wing" },
  puteri: { name: "Puteri Chief", malay: "Ketua Puteri", job: "Young women: helps both wings", mission: "Ground drive", missionText: "both wings" },
};

export const POSTS = {
  /** Log-odds per point of a state chief's competence above 50, in every seat in their state. */
  chiefPull: 0.002,
  /** Parachuted chiefs (not from the state) do this well. */
  parachuted: 0.5,
  /** Your own post-holders below this loyalty only half do their job. */
  sulk: 40,
  /** Election Director: log-odds per competence point above 50 while an election is on. */
  directorPull: 0.0012,
  /** Treasurer: extra on top of party dues, per competence point above 30 (90 → +40%). */
  treasurerPerPoint: 1 / 150,
  /** SG: unity a week per competence point above 50. */
  sgUnity: 0.004,
  missionAp: 1,
  missionEvery: 6,
  /** Appointing costs political capital; the people you pass over sulk. */
  appointCapital: 2,
  passedOver: -5,
  removed: -8,
  /** Rift: loyalty below and ambition above these. */
  riftLoyalty: 30,
  riftAmbition: 60,
};

export type Posts = Record<string, Partial<Record<string, number>>>;

/** Kuala Lumpur, Putrajaya and Labuan share one chief: the Federal Territories. */
export const FT = ["KUL", "PJY", "LBN"];
export const regionOf = (stateId: string) => (FT.includes(stateId) ? "WP" : stateId);
export const REGIONS = [...STATES.filter((s) => !FT.includes(s.id)).map((s) => s.id), "WP"];
export const regionName = (r: string) => (r === "WP" ? "Federal Territories" : (STATES.find((s) => s.id === r)?.name ?? r));
export const chiefKey = (region: string) => `chief:${region}`;

/** Regions where each party usually stands (from the starting map). */
const PARTY_REGIONS: Record<string, string[]> = (() => {
  const out: Record<string, Set<string>> = {};
  for (const seat of SEATS)
    for (const c of COALITIONS) {
      const p = candidateParty(seat, c);
      (out[p] ??= new Set()).add(regionOf(seat.state));
    }
  return Object.fromEntries(Object.entries(out).map(([p, set]) => [p, REGIONS.filter((r) => set.has(r))]));
})();

/** Where a person is from: their seat's state, or (for members without a seat) somewhere their party stands. */
export function homeOf(p: Person): string {
  if (p.home) return p.home;
  if (p.seat !== null) return regionOf(SEATS[p.seat].state);
  const list = PARTY_REGIONS[p.party]?.length ? PARTY_REGIONS[p.party] : REGIONS;
  return list[Math.floor(hash01("home", p.id) * list.length)];
}

const yourPartyOf = (s: Pick<GameState, "coalitions" | "player">) => s.coalitions[s.player].members[0];

/** The posts a party has: every national post, and a chief wherever it stands (your party: everywhere). */
export function postKeys(s: Pick<GameState, "coalitions" | "player">, party: string): string[] {
  const regions = party === yourPartyOf(s) ? REGIONS : (PARTY_REGIONS[party] ?? []);
  return [...NATIONAL_POSTS, ...regions.map(chiefKey)];
}

export const postName = (key: string) => (key.startsWith("chief:") ? `${regionName(key.slice(6))} chief` : POST_INFO[key as NationalPost].name);

/** The post someone holds (one each), if any. */
export function postOfPerson(s: Pick<GameState, "posts">, p: Person): string | undefined {
  const mine = s.posts?.[p.party];
  if (!mine) return undefined;
  return Object.keys(mine).find((k) => mine[k] === p.id);
}

export function holderOf(s: Pick<GameState, "posts" | "people">, party: string, key: string): Person | undefined {
  const id = s.posts?.[party]?.[key];
  return id === undefined ? undefined : s.people.find((p) => p.id === id);
}

/** Who can hold a party post: active members (not you, not the chairman). */
export function postPool(s: Pick<GameState, "people" | "youId">, party: string): Person[] {
  return s.people.filter((p) => p.party === party && !p.retired && !p.chairman && p.id !== s.youId);
}

function fitFor(p: Person, key: string): number {
  const local = key.startsWith("chief:") ? (homeOf(p) === key.slice(6) ? 25 : 0) : 0;
  return p.competence + p.influence * 0.5 + p.rank * 3 + local;
}

/** Fill every empty post of every party (and clear posts whose holder has left). */
export function autoPosts(s: GameState): GameState {
  const posts: Posts = {};
  for (const party of HIERARCHY_PARTIES) {
    const pool = postPool(s, party);
    const ids = new Set(pool.map((p) => p.id));
    const keys = postKeys(s, party);
    const cur: Partial<Record<string, number>> = {};
    for (const [k, id] of Object.entries(s.posts?.[party] ?? {})) if (id !== undefined && ids.has(id) && keys.includes(k)) cur[k] = id;
    const used = new Set(Object.values(cur));
    for (const key of keys) {
      if (cur[key] !== undefined) continue;
      const pick = pool.filter((p) => !used.has(p.id)).sort((a, b) => fitFor(b, key) - fitFor(a, key))[0];
      if (!pick) continue;
      cur[key] = pick.id;
      used.add(pick.id);
    }
    posts[party] = cur;
  }
  return { ...s, posts };
}

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

/** How well someone does their job: competence above 50, halved when your own lieutenant sulks. */
export function postSkill(s: Pick<GameState, "coalitions" | "player">, p: Person | undefined): number {
  if (!p) return 0;
  const sulk = p.party === yourPartyOf(s) && p.loyalty < POSTS.sulk ? 0.5 : 1;
  return (p.competence - 50) * sulk;
}

/** A state chief's pull in their state (log-odds). */
export function chiefPull(s: Pick<GameState, "coalitions" | "player">, p: Person | undefined, region: string): number {
  if (!p) return 0;
  return postSkill(s, p) * POSTS.chiefPull * (homeOf(p) === region ? 1 : POSTS.parachuted);
}

/** Every party's pull from each of its state chiefs ("party|region") and its election director ("party|director"). */
export function pullTable(s: Pick<GameState, "posts" | "people" | "coalitions" | "player">): Record<string, number> {
  const out: Record<string, number> = {};
  const people = new Map(s.people.map((p) => [p.id, p]));
  for (const [party, posts] of Object.entries(s.posts ?? {})) {
    for (const [k, id] of Object.entries(posts)) if (k.startsWith("chief:") && id !== undefined) out[`${party}|${k.slice(6)}`] = chiefPull(s, people.get(id), k.slice(6));
    const d = posts.director !== undefined ? people.get(posts.director) : undefined;
    out[`${party}|director`] = postSkill(s, d) * POSTS.directorPull;
  }
  return out;
}

/**
 * Every coalition's pull in every seat from its parties' state chiefs and election directors, counted from the
 * line-up the game started with (so the untouched world still reproduces GE15).
 */
export function postSeatEffects(s: GameState): number[][] {
  const now = pullTable(s);
  const base = s.postBase ?? {};
  const pull = (k: string) => (now[k] ?? 0) - (base[k] ?? 0);
  const campaign = s.parliament?.status === "campaign";
  const stateCampaign = new Set(Object.entries(s.assemblies ?? {}).filter(([, a]) => a.status === "campaign").map(([id]) => id));
  return SEATS.map((seat) => {
    const region = regionOf(seat.state);
    const on = campaign || stateCampaign.has(seat.state);
    return COALITIONS.map((c) => {
      if (c === "OTHERS" || !s.coalitions[c]?.members.length || !contestingIn(seat, s.entries).includes(c)) return 0;
      const party = seatCandidate(s, seat, c);
      return pull(`${party}|${region}`) + (on ? pull(`${party}|director`) : 0);
    });
  });
}

/** Your wings' resting level, set by the chiefs who run them. */
export function wingRest(s: GameState, base: number): { youth: number; women: number; drag: { youth: number; women: number } } {
  const party = yourPartyOf(s);
  const y = holderOf(s, party, "youth");
  const w = holderOf(s, party, "wanita");
  const pu = holderOf(s, party, "puteri");
  const k = 0.3;
  const puteri = pu ? (pu.competence - 50) * k * 0.5 : 0;
  return {
    youth: base + (y ? (y.competence - 50) * k : 0) + puteri,
    women: base + (w ? (w.competence - 50) * k : 0) + puteri,
    drag: { youth: y && y.loyalty < 35 ? 0.2 : 0, women: w && w.loyalty < 35 ? 0.2 : 0 },
  };
}

/** Your Treasurer's weekly takings: a share on top of the party's dues (a big party has more donors to work). */
export function treasurerIncome(s: GameState, dues: number): number {
  const t = holderOf(s, yourPartyOf(s), "treasurer");
  if (!t) return 0;
  const sulk = t.loyalty < POSTS.sulk ? 0.5 : 1;
  return Math.round(dues * Math.max(0, t.competence - 30) * POSTS.treasurerPerPoint * sulk);
}

const setPeople = (s: GameState, f: (p: Person) => Person) => ({ ...s, people: s.people.map(f) });

/** Why you can't appoint this person to this post (null when you can). */
export function appointPostBlocked(s: GameState, key: string, id: number): string | null {
  const party = yourPartyOf(s);
  if (s.career.rung < 6 && s.career.mode !== "leader") return "Only the party president makes appointments.";
  if (!postKeys(s, party).includes(key)) return "Your party has no such post.";
  if (!postPool(s, party).some((p) => p.id === id)) return "Only active members of your party.";
  if (s.posts?.[party]?.[key] === id) return "They already hold it.";
  if (s.me.capital < POSTS.appointCapital) return `Needs ${POSTS.appointCapital} political capital.`;
  return null;
}

/** Appoint someone to one of your party's posts. Whoever held it steps down; the ambitious people you passed over sulk. */
export function appointPost(s: GameState, key: string, id: number): { state: GameState; message: string } | { error: string } {
  const why = appointPostBlocked(s, key, id);
  if (why) return { error: why };
  const party = yourPartyOf(s);
  const posts = { ...(s.posts[party] ?? {}) };
  const pick = s.people.find((p) => p.id === id)!;
  const old = posts[key];
  for (const k of Object.keys(posts)) if (posts[k] === id) delete posts[k];
  posts[key] = id;
  const region = key.startsWith("chief:") ? key.slice(6) : null;
  const passed = new Set(
    postPool(s, party)
      .filter((p) => p.id !== id && p.id !== old && p.ambition > 60 && p.rank >= pick.rank && (!region || homeOf(p) === region))
      .sort((a, b) => b.ambition - a.ambition)
      .slice(0, 3)
      .map((p) => p.id),
  );
  let state = setPeople(s, (p) =>
    p.id === id ? { ...p, loyalty: clamp(p.loyalty + 10), influence: clamp(p.influence + 3) } : p.id === old ? { ...p, loyalty: clamp(p.loyalty + POSTS.removed) } : passed.has(p.id) ? { ...p, loyalty: clamp(p.loyalty + POSTS.passedOver) } : p,
  );
  state = { ...state, posts: { ...s.posts, [party]: posts }, me: { ...state.me, capital: state.me.capital - POSTS.appointCapital, unity: clamp(state.me.unity - (old !== undefined ? 1 : 0)) } };
  const was = old !== undefined ? s.people.find((p) => p.id === old)?.name : undefined;
  return { state, message: `${pick.name} is your new ${postName(key)}${was ? `, replacing ${was}` : ""}.${passed.size ? ` ${passed.size} hopeful${passed.size === 1 ? "" : "s"} passed over.` : ""}` };
}

/** Which state's hung-assembly talks a chief can work (set by stategov.ts). */
export type MissionHook = (s: GameState, region: string) => GameState | null;
let talksHook: MissionHook | null = null;
export const setTalksHook = (h: MissionHook) => (talksHook = h);

export function missionBlocked(s: GameState, id: number): string | null {
  const p = s.people.find((x) => x.id === id);
  if (!p || p.party !== yourPartyOf(s)) return "Only your own party's post-holders.";
  if (!postOfPerson(s, p)) return "They hold no post.";
  if (s.me.ap < POSTS.missionAp) return `Needs ${POSTS.missionAp} AP.`;
  if (p.missionWeek !== undefined && s.week - p.missionWeek < POSTS.missionEvery) return `Back from their last mission in ${POSTS.missionEvery - (s.week - p.missionWeek)} week(s).`;
  return null;
}

/** Your closest seats: where your projected share is nearest the leader's. */
function closest(s: GameState, n: number): number[] {
  return SEATS.filter((seat) => contestingIn(seat, s.entries).includes(s.player))
    .map((seat) => ({ i: seat.index, v: Math.abs(s.me.buzz[seat.index] - 50) + hash01("close", s.seed, seat.index) }))
    .sort((a, b) => a.v - b.v)
    .slice(0, n)
    .map((x) => x.i);
}

/** Chance a mission succeeds. */
export const missionChance = (p: Person) => Math.min(0.9, Math.max(0.15, 0.5 + (p.competence - 50) / 100 + (p.loyalty - 50) / 250));

/** Send a lieutenant or general on the mission their post calls for. */
export function sendOnMission(s: GameState, id: number): { state: GameState; message: string } | { error: string } {
  const why = missionBlocked(s, id);
  if (why) return { error: why };
  const p = s.people.find((x) => x.id === id)!;
  const key = postOfPerson(s, p)!;
  const ok = hash01("mission", s.seed, s.week, id) < missionChance(p);
  let state: GameState = { ...s, me: { ...s.me, ap: s.me.ap - POSTS.missionAp } };
  const me = { ...state.me };
  let what = "";
  if (key.startsWith("chief:")) {
    const region = key.slice(6);
    const hooked = ok && talksHook ? talksHook(state, region) : null;
    if (hooked) {
      state = hooked;
      what = `works the ${regionName(region)} assembly: the talks tilt your way`;
    } else {
      const buzz = [...me.buzz];
      for (const seat of SEATS) if (regionOf(seat.state) === region && contestingIn(seat, s.entries).includes(s.player)) buzz[seat.index] = clamp(buzz[seat.index] + (ok ? 10 : -3));
      me.buzz = buzz;
      what = ok ? `rallies the party across ${regionName(region)}` : `holds rallies in ${regionName(region)} that fall flat`;
    }
  } else {
    const k = key as NationalPost;
    const skill = 1 + (p.competence - 50) / 100;
    if (k === "sg") {
      me.unity = clamp(me.unity + (ok ? 6 * skill : -2));
      what = ok ? "whips the divisions into line" : "tries to whip the divisions, and they push back";
    } else if (k === "treasurer") {
      if (ok) me.funds += Math.round(400_000 + p.competence * 5_000);
      else me.risk = clamp(me.risk + 5);
      what = ok ? "comes back from a donor round with cheques" : "comes back from a donor round with questions about where the money came from";
    } else if (k === "info") {
      if (ok) me.nationalBuzz = clamp(me.nationalBuzz + 8 * skill);
      else me.scandal = clamp(me.scandal + 4);
      what = ok ? "runs a media blitz that sets the agenda" : "makes a gaffe on live TV";
    } else if (k === "director") {
      const machinery = [...me.machinery];
      for (const i of closest(s, 5)) machinery[i] = clamp(machinery[i] + (ok ? 6 * skill : 1));
      me.machinery = machinery;
      if (!ok) me.funds -= 100_000;
      what = ok ? "audits the battlegrounds and fixes the weak machines" : "audits the battlegrounds at great expense and little gain";
    } else {
      const d = ok ? 10 * skill : -3;
      const wings = { ...state.wings };
      if (k === "youth" || k === "puteri") wings.youth = clamp(wings.youth + (k === "puteri" ? d / 2 : d));
      if (k === "wanita" || k === "puteri") wings.women = clamp(wings.women + (k === "puteri" ? d / 2 : d));
      state = { ...state, wings };
      what = ok ? `leads a ground drive that fills the halls` : "leads a ground drive that nobody turns up to";
    }
  }
  state = { ...state, me };
  state = setPeople(state, (x) => (x.id === id ? { ...x, missionWeek: s.week, loyalty: clamp(x.loyalty + (ok ? 6 : -3)), influence: clamp(x.influence + (ok ? 2 : 0)) } : x));
  return { state, message: `${p.name} (${postName(key)}) ${what}.` };
}

/** Weekly: lieutenants do their jobs; a disloyal one may turn on you. */
export function postsWeek(s: GameState): { state: GameState; lines: ReportLine[]; rift: number | null } {
  const lines: ReportLine[] = [];
  let state = autoPosts(s);
  const party = yourPartyOf(state);
  const sg = holderOf(state, party, "sg");
  if (sg) state = { ...state, me: { ...state.me, unity: clamp(state.me.unity + postSkill(state, sg) * POSTS.sgUnity) } };
  const info = holderOf(state, party, "info");
  if (info && postSkill(state, info) > 0) state = { ...state, me: { ...state.me, nationalBuzz: clamp(state.me.nationalBuzz * (1 + postSkill(state, info) * 0.0006)) } };
  let rift: number | null = null;
  if (state.week % 4 === 0 && (state.cardLast.lieutenantRift ?? -99) < state.week - 16) {
    const mine = postPool(state, party).filter((p) => postOfPerson(state, p) && p.loyalty < POSTS.riftLoyalty && p.ambition > POSTS.riftAmbition);
    const r = mine.sort((a, b) => a.loyalty - b.loyalty)[0];
    if (r && hash01("rift", state.seed, state.week) < 0.35) rift = r.id;
  }
  return { state, lines, rift };
}

/** Take someone off their post. */
export function removeFromPost(s: GameState, id: number): GameState {
  const p = s.people.find((x) => x.id === id);
  if (!p || !s.posts?.[p.party]) return s;
  const posts = { ...s.posts[p.party] };
  for (const k of Object.keys(posts)) if (posts[k] === id) delete posts[k];
  return { ...s, posts: { ...s.posts, [p.party]: posts } };
}

export const LIEUTENANT_RIFT_CARD: CardDef = {
  kind: "lieutenantRift",
  title: "A lieutenant turns",
  text: (s, c) => {
    const p = s.people.find((x) => x.id === c.person);
    const key = p ? postOfPerson(s, p) : undefined;
    return p ? `${p.name}, your ${key ? postName(key) : "lieutenant"}, has been briefing the press against you and counting heads in the divisions.` : "One of your lieutenants is briefing against you.";
  },
  choices: () => [
    {
      label: "Sack them from the post",
      effect: {
        unity: -3,
        capital: -3,
        then: (st, c) => {
          const p = st.people.find((x) => x.id === c?.person);
          if (!p) return { state: st };
          const next = removeFromPost({ ...st, people: st.people.map((x) => (x.id === p.id ? { ...x, loyalty: 5 } : x)) }, p.id);
          return { state: autoPosts(next), lines: [{ text: `${p.name} is stripped of their post. Someone more loyal steps in.`, tone: "info" }] };
        },
      },
    },
    { label: "Buy them off with a bigger say", effect: { capital: -8, personLoyalty: 25 } },
    { label: "Ignore it", effect: { unity: -4, scandal: 3, personInfluence: 5 }, note: "They keep briefing, and grow stronger." },
  ],
  defaultChoice: 2,
};

/** A wing chief makes demands (Youth or Wanita). */
export function wingDemand(s: GameState): { person: number } | null {
  if ((s.cardLast.wingDemand ?? -99) > s.week - 26 || hash01("wingdemand", s.seed, s.week) > 0.06) return null;
  const party = yourPartyOf(s);
  const p = holderOf(s, party, hash01("wingwhich", s.seed, s.week) < 0.5 ? "youth" : "wanita");
  return p ? { person: p.id } : null;
}

export const WING_DEMAND_CARD: CardDef = {
  kind: "wingDemand",
  title: "A wing chief wants more",
  text: (s, c) => {
    const p = s.people.find((x) => x.id === c.person);
    if (!p) return "A wing chief has demands.";
    const youth = postOfPerson(s, p) === "youth";
    return youth
      ? `${p.name}, the Youth chief, wants a quota of winnable seats for young candidates and money for the wing's programmes. "The young are leaving us," they warn the council.`
      : `${p.name}, the Wanita chief, wants funds for kampung visits, kitchens and child-care drives, and more women on the ticket.`;
  },
  choices: (s, c) => {
    const p = s.people.find((x) => x.id === c.person);
    const youth = p ? postOfPerson(s, p) === "youth" : true;
    return [
      {
        label: "Give them what they want (RM 500k)",
        effect: {
          funds: -500_000,
          personLoyalty: 12,
          then: (st) => ({ state: { ...st, wings: { ...st.wings, [youth ? "youth" : "women"]: clamp(st.wings[youth ? "youth" : "women"] + 8) } } }),
        },
      },
      { label: "Not now", effect: { personLoyalty: -10 }, note: "The chief takes it personally." },
    ];
  },
  defaultChoice: 1,
};

