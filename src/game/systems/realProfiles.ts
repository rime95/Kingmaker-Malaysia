// Researched profiles of real politicians (data/profiles/*.json, each with its sources). Facts as of late 2026; a field
// is missing where nothing could be confirmed. Allegations and court cases are deliberately not recorded.

import bersatu from "../data/profiles/bersatu.json";
import bn from "../data/profiles/bn.json";
import dap from "../data/profiles/dap.json";
import added from "../data/profiles/new.json";
import pas from "../data/profiles/pas.json";
import pkr from "../data/profiles/pkr.json";
import sabah from "../data/profiles/sabah.json";
import sarawak from "../data/profiles/sarawak.json";
import tokoh from "../data/profiles/tokoh.json";

export interface RealProfile {
  name: string;
  party?: string;
  status: "active" | "inactive" | "deceased";
  post?: string;
  background?: string;
  stance?: string;
  faction?: string;
  patron?: string;
  allies?: string[];
  rivals?: string[];
  wants?: string;
  changed?: string;
  sources: string[];
  /** New people only. */
  born?: number;
  gender?: "m" | "f";
  home?: string;
  bloc?: string;
}

const PROFILES = [...bersatu, ...bn, ...dap, ...added, ...pas, ...pkr, ...sabah, ...sarawak, ...tokoh] as RealProfile[];

const BY_NAME = new Map(PROFILES.map((p) => [p.name, p]));

export const profileOf = (name: string): RealProfile | undefined => BY_NAME.get(name);
