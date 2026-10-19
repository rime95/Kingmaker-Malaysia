// Policy stances. Option 0 is the status quo (no effect). In government a stance is enacted (full effect,
// needs a Dewan majority, moves the economy and public finances); in opposition it is a pledge (60% effect).
// Voter effects are log-odds for your coalition by segment. All numbers TEMPORARY.

import { addSeg, type SegEffects } from "./segments";
import type { CoalitionId } from "../world";

export interface PolicyOption {
  id: string;
  label: string;
  blurb: string;
  voters: SegEffects;
  /** One-off change to the economy index (government only). */
  economy?: number;
  /** One-off change to fiscal space (government only). */
  fiscal?: number;
  /** One-off change to coalition trust if your coalition spans communities. */
  trustMultiracial?: number;
  integrity?: number;
}

export interface Policy {
  id: string;
  name: string;
  area: "Economy" | "Welfare" | "Identity" | "Governance" | "Regions";
  options: PolicyOption[];
}

const STATUS_QUO = (blurb: string): PolicyOption => ({ id: "sq", label: "Status quo", blurb, voters: {} });

export const POLICIES: Policy[] = [
  {
    id: "fuel",
    name: "Fuel subsidies",
    area: "Economy",
    options: [
      STATUS_QUO("Blanket RON95 subsidy for everyone. Popular, very expensive."),
      { id: "targeted", label: "Targeted subsidy", blurb: "Only B40 and rural drivers keep cheap fuel. Saves billions; the middle class feels it.", voters: { urban: -0.08, b40: 0.01 }, economy: 2, fiscal: 15 },
      { id: "float", label: "Float fuel prices", blurb: "Market prices for all. Big savings, big anger.", voters: { all: -0.06, b40: -0.06, rural: -0.03 }, economy: 3, fiscal: 25 },
    ],
  },
  {
    id: "cashaid",
    name: "Cash aid (STR)",
    area: "Welfare",
    options: [
      STATUS_QUO("Current cash transfers to poorer households."),
      { id: "expand", label: "Expand cash aid", blurb: "Bigger and wider payments. B40 and rural voters love it; the Treasury doesn't.", voters: { b40: 0.1, rural: 0.04 }, fiscal: -12 },
      { id: "cut", label: "Cut cash aid", blurb: "Fiscal discipline. Hurts the poorest.", voters: { b40: -0.1, rural: -0.04, urban: 0.01 }, fiscal: 10 },
    ],
  },
  {
    id: "wage",
    name: "Minimum wage",
    area: "Welfare",
    options: [
      STATUS_QUO("RM 1,700 a month."),
      { id: "raise", label: "Raise to RM 2,000", blurb: "Workers gain; small businesses grumble.", voters: { b40: 0.06, urban: 0.02, youth: 0.03 }, economy: -2 },
    ],
  },
  {
    id: "tax",
    name: "Sales tax",
    area: "Economy",
    options: [
      STATUS_QUO("SST at current rates."),
      { id: "expand", label: "Widen SST", blurb: "More goods taxed. Revenue up; prices up.", voters: { all: -0.04, b40: -0.03 }, fiscal: 12, economy: -1 },
      { id: "gst", label: "Bring back GST", blurb: "Efficient, unpopular, and remembered.", voters: { all: -0.09, b40: -0.04 }, fiscal: 25, economy: 1 },
      { id: "cut", label: "Cut SST", blurb: "Cheaper goods now; a hole in the budget.", voters: { all: 0.05 }, fiscal: -12, economy: 2 },
    ],
  },
  {
    id: "religion",
    name: "Religion in public life",
    area: "Identity",
    options: [
      STATUS_QUO("The current balance between syariah and civil law."),
      { id: "syariah", label: "Strengthen syariah courts", blurb: "Popular with conservative Malay voters; alarms non-Muslims and partners.", voters: { malay: 0.12, rural: 0.02, chinese: -0.15, indian: -0.12, sabah: -0.05, sarawak: -0.08, urban: -0.03 }, trustMultiracial: -15 },
      { id: "moderate", label: "Moderate, inclusive line", blurb: "Reassures minorities and urban voters; conservatives call it weak.", voters: { malay: -0.08, chinese: 0.08, indian: 0.07, sabah: 0.03, sarawak: 0.04, urban: 0.03 }, trustMultiracial: 8 },
    ],
  },
  {
    id: "education",
    name: "Education & language",
    area: "Identity",
    options: [
      STATUS_QUO("National schools plus vernacular schools as today."),
      { id: "uec", label: "Recognise the UEC", blurb: "Recognise Chinese independent school certificates. A DAP promise; Malay groups object.", voters: { chinese: 0.15, malay: -0.05, sarawak: 0.02 }, trustMultiracial: 4 },
      { id: "national", label: "Bahasa-first national schools", blurb: "One school system in Bahasa Malaysia.", voters: { malay: 0.06, chinese: -0.12, indian: -0.08 }, trustMultiracial: -8 },
    ],
  },
  {
    id: "affirmative",
    name: "Affirmative action",
    area: "Identity",
    options: [
      STATUS_QUO("Bumiputera policy as it stands."),
      { id: "needs", label: "Needs-based, not race-based", blurb: "Help the poor of every race. Minorities and the urban middle class approve.", voters: { malay: -0.08, chinese: 0.08, indian: 0.1, b40: 0.02, urban: 0.02 }, trustMultiracial: 5 },
      { id: "expand", label: "Expand Bumiputera quotas", blurb: "Bigger quotas in contracts, housing and universities.", voters: { malay: 0.1, sabah: 0.04, sarawak: 0.04, chinese: -0.12, indian: -0.1 }, trustMultiracial: -10, economy: -1 },
    ],
  },
  {
    id: "ma63",
    name: "Malaysia Agreement 1963",
    area: "Regions",
    options: [
      STATUS_QUO("Slow negotiations on Sabah and Sarawak's rights."),
      { id: "devolve", label: "Full MA63 devolution", blurb: "40% revenue share, more autonomy. Borneo cheers; Putrajaya pays.", voters: { sabah: 0.18, sarawak: 0.18, malay: -0.01 }, fiscal: -10 },
    ],
  },
  {
    id: "integrity",
    name: "Anti-corruption",
    area: "Governance",
    options: [
      STATUS_QUO("MACC under the PMO, no political financing law."),
      { id: "reform", label: "Political Financing Act", blurb: "Independent prosecutor and donation limits. Urban and young voters reward it; your own donors don't.", voters: { urban: 0.06, youth: 0.04 }, integrity: 6 },
    ],
  },
  {
    id: "infra",
    name: "Mega projects",
    area: "Economy",
    options: [
      STATUS_QUO("Finish what's already started."),
      { id: "build", label: "Launch mega projects", blurb: "Rail, highways, ports. Jobs and ribbon-cutting; debt and contract scandals.", voters: { rural: 0.04, all: 0.02 }, economy: 4, fiscal: -15, integrity: -4 },
    ],
  },
];

export const POLICY_BY_ID: Record<string, Policy> = Object.fromEntries(POLICIES.map((p) => [p.id, p]));

/** Coalitions whose partners come from different communities: identity plays strain them. */
export const MULTIRACIAL: CoalitionId[] = ["PH", "BN", "GPS", "GRS"];

/** Opposition stances are pledges: voters only half-believe them. */
export const PLEDGE_WEIGHT = 0.5;

/** Scales every option's voter numbers (tuning knob: a few points among the groups affected). */
export const POLICY_SCALE = 0.45;

/** Opposition pledges that cost public money dent integrity: voters ask how you would pay for them. */
export const UNFUNDED_INTEGRITY_PER_FISCAL = 1 / 3;

export function policyVoters(stances: Record<string, number>, inGovernment: boolean): SegEffects {
  let out: SegEffects = {};
  for (const [id, idx] of Object.entries(stances)) {
    const opt = POLICY_BY_ID[id]?.options[idx];
    if (opt) out = addSeg(out, opt.voters, (inGovernment ? 1 : PLEDGE_WEIGHT) * POLICY_SCALE);
  }
  return out;
}

export const POLICY_COST = { ap: 2, gov: 15, opp: 5 };
