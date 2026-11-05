// Tokoh: well-known Malaysians with no seat and no party post in this game, who could be brought back into politics.
// A snapshot as of October 2026, written from the public record as it stood; edit freely, like the rosters.
// `lean` is the coalition whose politics they are closest to (it sets who can win them over). `appeal` is their
// standing with voters (it becomes their influence, and so their pull as a candidate).

import type { Bloc, CoalitionId } from "../world";

export interface TokohEntry {
  name: string;
  born: number;
  /** Home state (posts.ts regions). */
  home: string;
  /** Where they come from, in words. */
  was: string;
  lean: CoalitionId;
  bloc: Bloc;
  appeal: number;
  blurb: string;
}

export const TOKOH: TokohEntry[] = [
  { name: "Khairy Jamaluddin", born: 1976, home: "NSN", was: "UMNO (sacked 2023)", lean: "BN", bloc: "malay", appeal: 86, blurb: "Former health minister and Rembau MP; a popular podcaster since leaving UMNO." },
  { name: "Lim Kit Siang", born: 1941, home: "JHR", was: "DAP (stood down 2022)", lean: "PH", bloc: "chinese", appeal: 78, blurb: "DAP's elder statesman, an MP for half a century; still draws a crowd." },
  { name: "Mahathir Mohamad", born: 1925, home: "KDH", was: "PEJUANG (lost Langkawi 2022)", lean: "PN", bloc: "malay", appeal: 70, blurb: "Twice Prime Minister. Past standing, but his name still moves Malay voters." },
  { name: "Mukhriz Mahathir", born: 1964, home: "KDH", was: "PEJUANG (lost Jerlun 2022)", lean: "PN", bloc: "malay", appeal: 58, blurb: "Former Kedah Menteri Besar, out of the House since 2022." },
  { name: "Tengku Razaleigh Hamzah", born: 1937, home: "KTN", was: "UMNO (stood down 2022)", lean: "BN", bloc: "malay", appeal: 55, blurb: "Ku Li: Gua Musang's prince and UMNO's perennial challenger." },
  { name: "Tony Pua", born: 1972, home: "SGR", was: "DAP (stood down 2022)", lean: "PH", bloc: "chinese", appeal: 60, blurb: "Former Damansara MP and DAP's sharpest economics voice." },
  { name: "Ong Kian Ming", born: 1976, home: "SGR", was: "DAP (stood down 2022)", lean: "PH", bloc: "chinese", appeal: 56, blurb: "Former Bangi MP and deputy minister; a data-minded policy wonk." },
  { name: "Charles Santiago", born: 1960, home: "SGR", was: "DAP (dropped 2022)", lean: "PH", bloc: "indian", appeal: 52, blurb: "Former Klang MP, a campaigner on water and workers' rights." },
  { name: "Khalid Samad", born: 1957, home: "SGR", was: "AMANAH (lost Shah Alam 2022)", lean: "PH", bloc: "malay", appeal: 58, blurb: "Former Federal Territories minister and Shah Alam MP." },
  { name: "Maszlee Malik", born: 1974, home: "JHR", was: "Former education minister (lost 2022)", lean: "PH", bloc: "malay", appeal: 55, blurb: "Former education minister, out of the House since 2022." },
  { name: "Tian Chua", born: 1963, home: "WP", was: "Former PKR vice-president", lean: "PH", bloc: "chinese", appeal: 48, blurb: "Reformasi street veteran and former Batu MP." },
  { name: "Maria Chin Abdullah", born: 1956, home: "SGR", was: "Former Petaling Jaya MP", lean: "PH", bloc: "malay", appeal: 50, blurb: "Former Bersih chair who took Petaling Jaya in 2018." },
  { name: "Zaid Ibrahim", born: 1951, home: "KTN", was: "Former law minister", lean: "PH", bloc: "malay", appeal: 44, blurb: "Lawyer and former law minister who has crossed most of the political map." },
  { name: "Khalid Ibrahim", born: 1946, home: "SGR", was: "Former Selangor Menteri Besar", lean: "PH", bloc: "malay", appeal: 45, blurb: "Ran Selangor from 2008 to 2014; a technocrat with a clean name." },
  { name: "Noor Hisham Abdullah", born: 1963, home: "WP", was: "Former Director-General of Health", lean: "PH", bloc: "malay", appeal: 80, blurb: "The calm face of the pandemic briefings. Never in a party, trusted across the board." },
];
