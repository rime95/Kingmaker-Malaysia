// Plausible Malaysian names for generated characters, matched to who lives in a seat and which party they join.
// Names are composed from common given names and patronymics/surnames, so they read as ordinary people, not anyone real.

import { hash01 } from "../rng";
import type { Bloc } from "../world";

const pick = <T>(list: readonly T[], ...key: (string | number)[]) => list[Math.floor(hash01("name", ...key) * list.length)];

const MALAY_M = ["Ahmad", "Mohd Faiz", "Hafiz", "Amirul", "Syafiq", "Azlan", "Khairul", "Zulkifli", "Rosli", "Firdaus", "Iskandar", "Nazri", "Shahrul", "Hakim", "Ridzuan", "Fauzi", "Hisham", "Imran", "Kamarul", "Danial"];
const MALAY_F = ["Nurul Ain", "Siti Aisyah", "Farah", "Nor Azura", "Hidayah", "Aminah", "Zarina", "Liyana", "Rozita", "Nadia", "Suraya", "Fatimah", "Haslinda", "Izzati"];
const MALAY_FATHER = ["Abdullah", "Ismail", "Hassan", "Othman", "Yusof", "Ibrahim", "Rahman", "Salleh", "Kassim", "Hamid", "Mahmud", "Ali", "Jamal", "Rashid", "Omar", "Zakaria", "Razak", "Aziz"];
const CHINESE_SURNAME = ["Tan", "Lim", "Lee", "Wong", "Ng", "Chong", "Teo", "Goh", "Ong", "Chan", "Yap", "Lau", "Chin", "Low", "Koh", "Ooi"];
const CHINESE_GIVEN = ["Wei Ming", "Kah Seng", "Mei Ling", "Chee Keong", "Siew Lan", "Boon Hock", "Hui Min", "Kok Wai", "Jia Hui", "Yong Sheng", "Pei Shan", "Chun Hao", "Li Ying", "Wai Kit"];
const INDIAN_GIVEN = ["Ravi", "Kumar", "Saravanan", "Priya", "Kavitha", "Ganesh", "Devi", "Suresh", "Anand", "Meena", "Vijay", "Lakshmi", "Prakash", "Nirmala"];
const INDIAN_FATHER = ["Muthu", "Krishnan", "Raman", "Subramaniam", "Pillai", "Nair", "Rajoo", "Gopal", "Selvam", "Arumugam"];
const SABAH_GIVEN = ["Jeffrin", "Rosnah", "Joanna", "Bernard", "Grace", "Alvin", "Felicia", "Duncan", "Herman", "Mojinal", "Juslie", "Clara"];
const SABAH_SURNAME = ["Majinbon", "Sundang", "Lingkai", "Gindol", "Ansiong", "Tuyon", "Gonsilou", "Jilan", "Mosigil", "Sumpit"];
const SARAWAK_GIVEN = ["Joanna", "Michael", "Jinggut", "Rentap", "Lily", "Dennis", "Ambrose", "Julia", "Gerawat", "Sylvia", "Wilson", "Anyi"];
const SARAWAK_FATHER = ["Ngumbang", "Entili", "Unting", "Lajang", "Bundan", "Sagah", "Ugak", "Nyalau", "Jimbai", "Langgi"];

/** A name for someone from a bloc. Women are about a third of new recruits. */
export function makeName(bloc: Bloc, ...key: (string | number)[]): string {
  const female = hash01("female", ...key) < 0.33;
  switch (bloc) {
    case "chinese":
      return `${pick(CHINESE_SURNAME, "cs", ...key)} ${pick(CHINESE_GIVEN, "cg", ...key)}`;
    case "indian": {
      const given = pick(INDIAN_GIVEN, "ig", ...key);
      return `${given} ${pick(INDIAN_FATHER, "if", ...key)}`;
    }
    case "sabah":
      return `${pick(SABAH_GIVEN, "sg", ...key)} ${pick(SABAH_SURNAME, "ss", ...key)}`;
    case "sarawak":
      return `${pick(SARAWAK_GIVEN, "wg", ...key)} anak ${pick(SARAWAK_FATHER, "wf", ...key)}`;
    default: {
      const given = female ? pick(MALAY_F, "mf", ...key) : pick(MALAY_M, "mm", ...key);
      return `${given} ${female ? "binti" : "bin"} ${pick(MALAY_FATHER, "mfa", ...key)}`;
    }
  }
}

/** Which community a party's recruits usually come from in a seat. */
export function recruitBloc(party: string, seatEthnic: Record<Bloc, number>, ...key: (string | number)[]): Bloc {
  const fixed: Record<string, Bloc> = { MCA: "chinese", MIC: "indian", GERAKAN: "chinese", SUPP: "chinese", PAS: "malay", UMNO: "malay", BERSATU: "malay", PBB: "sarawak", PRS: "sarawak", UPKO: "sabah", PBRS: "sabah", KDM: "sabah" };
  if (fixed[party]) return fixed[party];
  if (party === "DAP") return hash01("dapbloc", ...key) < 0.75 ? "chinese" : hash01("dap2", ...key) < 0.5 ? "indian" : "malay";
  // Otherwise: in proportion to who lives there.
  let r = hash01("bloc", ...key);
  for (const [b, share] of Object.entries(seatEthnic) as [Bloc, number][]) {
    r -= share;
    if (r <= 0) return b === "other" ? "malay" : b;
  }
  return "malay";
}
