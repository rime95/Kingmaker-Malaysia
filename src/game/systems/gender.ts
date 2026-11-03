// Who is a woman, and what everyone wears in the chamber. Real figures come from the record (data/people.ts
// WOMEN_MPS); generated people are read from their name (a "binti", or a woman's given name). Attire follows: a Muslim
// woman in baju kurung and tudung, a Muslim man in baju Melayu and songkok (or a suit with songkok), everyone else in a
// suit, blazer or batik.

import { WOMEN_MPS } from "../data/people";
import { hash01 } from "../rng";
import { FEMALE_GIVEN, MUSLIM_FATHERS } from "./names";
import type { Person } from "./people";

type Who = Pick<Person, "id" | "name" | "party" | "real">;

/** Real women who wear the tudung in the House (the others with a Muslim name, such as Azalina Othman Said, do not). */
const REAL_TUDUNG = new Set([
  "Siti Zailah Mohd Yusoff",
  "Siti Mastura Mohamad",
  "Fadhlina Sidek",
  "Salamiah Mohd Nor",
  "Young Syefura Othman",
  "Rodziah Ismail",
  "Halimah Ali",
  "Raj Munni Sabu @ Aiman Athirah",
  "Wan Azizah Wan Ismail",
  "Mas Ermieyati Samsudin",
  "Zaliha Mustafa",
  "Noraini Ahmad",
  "Isnaraissah Munirah Majilis @ Fakharudy",
  "Siti Aminah Aching",
  "Nancy Shukri",
  "Rubiah Wang",
  "Rodiyah Sapiee",
  "Hanifah Hajar Taib",
  "Nurul Izzah Anwar",
  "Amira Aisya Abdul Aziz",
]);

const words = (name: string) => name.replace(/[@.,]/g, " ").split(/\s+/).filter(Boolean);

export function isWoman(p: Who): boolean {
  if (WOMEN_MPS.has(p.name)) return true;
  if (p.real) return false;
  const w = words(p.name);
  if (w.some((x) => x.toLowerCase() === "binti" || x.toLowerCase() === "bt")) return true;
  if (w.some((x) => x.toLowerCase() === "bin")) return false;
  // Malay women's given names can be two words ("Nurul Ain"); Chinese given names come after the surname.
  return FEMALE_GIVEN.has(w[0]) || FEMALE_GIVEN.has(w.slice(0, 2).join(" ")) || FEMALE_GIVEN.has(w.slice(1).join(" "));
}

const MUSLIM_MARK = new Set(["bin", "binti", "bt", "mohd", "muhammad", "muhamamd", "mohamad", "mohammad", "mohamed", "mohammed", "ahmad", "abdul", "ab", "abd", "siti", "nur", "nurul", "wan", "nik", "syed", "sh", "tuan", "che", "ku", "awang", "abang", "dayang", "haji", "hj"]);
const MUSLIM_PARTY = new Set(["PAS", "UMNO", "BERSATU", "AMANAH", "BERSATU Sabah", "PEJUANG", "BERJASA", "PUTRA"]);

export function isMuslim(p: Who): boolean {
  if (REAL_TUDUNG.has(p.name)) return true;
  const w = words(p.name);
  if (w.some((x) => MUSLIM_MARK.has(x.toLowerCase())) || MUSLIM_FATHERS.has(w.at(-1)!)) return true;
  return MUSLIM_PARTY.has(p.party);
}

export type Attire = "kurung" | "blazer" | "melayu" | "suitSongkok" | "suit" | "batik";

/** What someone wears in the chamber: fixed for each person. */
export function attireOf(p: Who): Attire {
  const r = hash01("attire", p.id, p.name);
  if (isWoman(p)) {
    if (p.real) return REAL_TUDUNG.has(p.name) ? "kurung" : "blazer";
    return isMuslim(p) ? (r < 0.9 ? "kurung" : "blazer") : "blazer";
  }
  if (isMuslim(p)) return r < 0.7 ? "melayu" : "suitSongkok";
  return r < 0.8 ? "suit" : "batik";
}
