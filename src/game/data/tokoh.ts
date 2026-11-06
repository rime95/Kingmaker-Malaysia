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
  // Researched in November 2026 (data/profiles/new.json). Birth years and homes are estimates where sources gave none.
  {"name":"Tengku Zafrul Aziz","born":1965,"home":"SGR","was":"PKR: PKR political bureau (ex-officio); senior political adviser to the Prime Mi","lean":"PH","bloc":"malay","appeal":56,"blurb":"Former finance and trade minister and appointed senator who left UMNO in 2025 and joined PKR; Senate term ended December 2025."},
  {"name":"Asyraf Wajdi Dusuki","born":1965,"home":"SGR","was":"UMNO: UMNO secretary-general; MARA chairman","lean":"BN","bloc":"malay","appeal":48,"blurb":"Former UMNO Youth chief; reappointed MARA chairman for two years from March 2026."},
  {"name":"Onn Hafiz Ghazi","born":1965,"home":"JHR","was":"UMNO: Johor Menteri Besar","lean":"BN","bloc":"malay","appeal":56,"blurb":"Machap assemblyman; led BN to a large win in the July 2026 Johor election and was sworn in for a second term."},
  {"name":"Saarani Mohamad","born":1965,"home":"PRK","was":"UMNO: Perak Menteri Besar","lean":"BN","bloc":"malay","appeal":56,"blurb":"Perak Menteri Besar since 2020; dismissed talk of a snap state election in April 2026."},
  {"name":"Muhammad Sanusi Md Nor","born":1965,"home":"KDH","was":"PAS: Kedah Menteri Besar","lean":"PN","bloc":"malay","appeal":56,"blurb":"Kedah Menteri Besar since 2020; declined the PN chairmanship in January 2026 and proposed Ahmad Samsuri Mokhtar instead."},
  {"name":"Azmin Ali","born":1965,"home":"SGR","was":"BERSATU: Bersatu election director","lean":"PN","bloc":"malay","appeal":48,"blurb":"Appointed Bersatu election director in May 2026; resigned his PN post effective January 2026 and ruled out returning to PKR."},
  {"name":"Reezal Merican Naina Merican","born":1965,"home":"PNG","was":"UMNO: UMNO Supreme Council member; MATRADE chairman","lean":"BN","bloc":"malay","appeal":48,"blurb":"Former housing and local government minister and Kepala Batas MP, close to the family circle of the late Abdullah Badawi."},
  {"name":"Isham Jalil","born":1965,"home":"SGR","was":"PAS: PAS member","lean":"PN","bloc":"malay","appeal":48,"blurb":"Former UMNO Supreme Council member who applied to join PAS in July 2026 after years outside UMNO."},
  {"name":"Akmal Saleh","born":1965,"home":"MLK","was":"UMNO: UMNO Youth chief; Merlimau assemblyman","lean":"BN","bloc":"malay","appeal":56,"blurb":"Melaka UMNO Youth leader who defends the Merlimau state seat; Melaka state election is set for 14 November."},
  {"name":"Mohd Puad Zarkashi","born":1965,"home":"JHR","was":"IND: none (quit UMNO)","lean":"OTHERS","bloc":"malay","appeal":48,"blurb":"Veteran Johor UMNO figure who announced his exit from the party on 25 June 2026, citing loss of Johor UMNO autonomy."},
  {"name":"Lokman Noor Adam","born":1965,"home":"SGR","was":"UMNO: UMNO Supreme Council member (reported)","lean":"BN","bloc":"malay","appeal":48,"blurb":"Outspoken UMNO supreme council member who publicly clashed with the UMNO Youth chief over party directives."},
  {"name":"Mohamed Nazri Abdul Aziz","born":1965,"home":"PRK","was":"UMNO: Former UMNO Supreme Council member; former ambassador to the US","lean":"BN","bloc":"malay","appeal":48,"blurb":"Former minister and long-time Padang Rengas MP who has hinted he may return to contest GE16 if UMNO needs him."},
  {"name":"Zairil Khir Johari","born":1965,"home":"PNG","was":"DAP: Penang state exco (infrastructure and transport); DAP assistant national pu","lean":"PH","bloc":"chinese","appeal":48,"blurb":"Penang DAP vice-chairman who argues DAP should not compete with Malay parties for Malay votes."},
  {"name":"P. Ramasamy","born":1965,"home":"PNG","was":"URIMAI: Urimai chairman","lean":"OTHERS","bloc":"indian","appeal":48,"blurb":"Former Penang deputy chief minister who quit DAP in August 2023 and formed an Indian-focused party, Urimai."},
  {"name":"Mahfuz Omar","born":1965,"home":"KDH","was":"AMANAH: Amanah vice-president","lean":"PH","bloc":"malay","appeal":56,"blurb":"Former Pokok Sena MP and Amanah vice-president since January 2024, a frequent critic of UMNO stance on DAP."},
  {"name":"Mohamed Hanipa Maidin","born":1965,"home":"SGR","was":"AMANAH: Amanah member; former Sepang MP","lean":"PH","bloc":"malay","appeal":48,"blurb":"Former deputy law minister dropped for GE15, known for criticising his own coalition."},
  {"name":"Ti Lian Ker","born":1965,"home":"SGR","was":"MCA: former MCA vice-president and senator","lean":"BN","bloc":"chinese","appeal":56,"blurb":"Former MCA vice-president and senator who regularly criticises DAP and favours BN contesting Melaka alone."},
  {"name":"Chua Tee Yong","born":1965,"home":"JHR","was":"MCA","lean":"BN","bloc":"chinese","appeal":48,"blurb":"Former Labis MP and deputy trade minister who lost Labis in 2022."},
  {"name":"Vell Paari","born":1965,"home":"SGR","was":"MIC: Senator (per Wikipedia)","lean":"BN","bloc":"indian","appeal":48,"blurb":"MIC member and senator, son of former MIC president Samy Vellu."},
  {"name":"Noh Omar","born":1965,"home":"SGR","was":"UMNO: UMNO member (rejoined)","lean":"BN","bloc":"malay","appeal":48,"blurb":"Former minister who left Bersatu and rejoined UMNO on 8 June 2026 at the Johor BN launch."},
  {"name":"Liow Tiong Lai","born":1965,"home":"PHG","was":"MCA: former MCA president","lean":"BN","bloc":"chinese","appeal":56,"blurb":"Former MCA president and transport minister who lost Bentong in GE15."},
  {"name":"Annuar Musa","born":1965,"home":"KTN","was":"PAS: PAS leader; Johor election director; PN information chief","lean":"PN","bloc":"malay","appeal":56,"blurb":"Former communications minister and UMNO secretary-general who moved to PAS and was named its Johor election director in June 2026."},
  {"name":"Syed Hamid Albar","born":1965,"home":"SGR","was":"UMNO: UMNO member (rejoined)","lean":"BN","bloc":"malay","appeal":48,"blurb":"Former foreign and home minister readmitted to UMNO in April 2026 under the Rumah Bangsa initiative."},
  {"name":"Abdul Rahman Dahlan","born":1965,"home":"SBH","was":"UMNO: UMNO Supreme Council member","lean":"BN","bloc":"sabah","appeal":48,"blurb":"Former minister who quit as Tuaran UMNO chief in April 2026 to make way for younger leaders."},
  {"name":"Mahdzir Khalid","born":1965,"home":"KDH","was":"UMNO: Padang Terap UMNO division chief (2023 term)","lean":"BN","bloc":"malay","appeal":56,"blurb":"Former Kedah menteri besar and rural development minister, UMNO vice-president until 2023."},
  {"name":"Mustapa Mohamed","born":1965,"home":"KTN","was":"UMNO: UMNO member (rejoined)","lean":"BN","bloc":"malay","appeal":48,"blurb":"Veteran former minister and Jeli MP who returned to UMNO after leaving Bersatu, and says he will not contest GE16."},
  {"name":"Ahmad Shabery Cheek","born":1965,"home":"TRG","was":"UMNO: FELDA chairman (reappointed 2026)","lean":"BN","bloc":"malay","appeal":48,"blurb":"Former minister reappointed chairman of FELDA under the Madani government."},
  {"name":"Rais Yatim","born":1942,"home":"NSN","was":"IND: none","lean":"OTHERS","bloc":"malay","appeal":48,"blurb":"Veteran former minister and Dewan Negara president."},
  {"name":"Nur Jazlan Mohamed","born":1965,"home":"JHR","was":"UMNO: Dewan Negara deputy speaker; UMNO Supreme Council member; Pulai UMNO chief","lean":"BN","bloc":"malay","appeal":56,"blurb":"Reappointed senator and deputy Dewan Negara speaker in July 2026; leads Pulai UMNO."},
  {"name":"Ab Rauf Yusoh","born":1965,"home":"MLK","was":"UMNO: Melaka Chief Minister (caretaker pending 14 Nov 2026 state election)","lean":"BN","bloc":"malay","appeal":56,"blurb":"Tanjung Bidara assemblyman leading BN's Melaka campaign; Zahid says he will back him for another term if BN wins."},
  {"name":"Mohd Nassuruddin Daud","born":1965,"home":"KTN","was":"PAS: Kelantan Menteri Besar","lean":"PN","bloc":"malay","appeal":56,"blurb":"Meranti assemblyman who has led the PAS-run Kelantan government since August 2023."},
  {"name":"Abu Bakar Hamzah","born":1965,"home":"PLS","was":"BERSATU","lean":"PN","bloc":"malay","appeal":48,"blurb":"A familiar name in Malaysian politics."},
  {"name":"Maximus Ongkili","born":1965,"home":"SBH","was":"PBS: Chairman, Energy Commission of Sabah","lean":"GRS","bloc":"sabah","appeal":48,"blurb":"Kota Marudu leader who headed PBS for six years and handed the presidency to Joachim Gunsalam."},
  {"name":"Joniston Bangkuai","born":1962,"home":"SBH","was":"PBS: Kiulu assemblyman; Sabah assistant minister (tourism, culture, environment)","lean":"GRS","bloc":"sabah","appeal":56,"blurb":"Kiulu assemblyman since 2013 and former Sabah Tourism Board chairman."},
  {"name":"Joachim Gunsalam","born":1965,"home":"SBH","was":"PBS: PBS president; Sabah Deputy Chief Minister","lean":"GRS","bloc":"sabah","appeal":56,"blurb":"Acting PBS head since June 2024, elected unopposed president for 2026-2029 after Maximus Ongkili."},
  {"name":"Baru Bian","born":1965,"home":"SWK","was":"PDP: Ba'Kelalan assemblyman; PDP Ba'Kelalan division chairman","lean":"GPS","bloc":"sarawak","appeal":48,"blurb":"Former PKR Sarawak chief, now a Sarawak assemblyman in the PDP, active on indigenous heritage and rural health."},
  {"name":"John Sikie Tayai","born":1965,"home":"SWK","was":"PRS: PRS president; Sarawak Minister in the Premier's Department; Kakus assembly","lean":"GPS","bloc":"sarawak","appeal":56,"blurb":"Won the PRS presidency in October 2025 in the party's first contested race, beating Wilson Nyabong Ijang."},
  {"name":"Mohd Amar Abdullah","born":1965,"home":"KTN","was":"PAS: PAS vice-president; Speaker of Kelantan assembly","lean":"PN","bloc":"malay","appeal":56,"blurb":"Former Kelantan deputy MB who offered himself as a Perikatan PM candidate in September 2025."},
  {"name":"Nik Abduh Nik Abdul Aziz","born":1965,"home":"KTN","was":"PAS: PAS central committee member; former Bachok MP and PAS Youth chief","lean":"PN","bloc":"malay","appeal":56,"blurb":"Son of Nik Aziz Nik Mat; attended UMNO's 2026 assembly as Zahid's guest, backing Muslim unity."},
  {"name":"Muhammad Khalil Abdul Hadi","born":1965,"home":"TRG","was":"PAS: Terengganu state exco member; PAS central committee member","lean":"PN","bloc":"malay","appeal":48,"blurb":"Former PAS Youth chief (2017-2019) who placed fourth in the 2025 central committee polls."},
  {"name":"Nurul Amal Mohd Fauzi","born":1965,"home":"SGR","was":"UMNO: Puteri UMNO chief","lean":"BN","bloc":"malay","appeal":56,"blurb":"Puteri wing head pushing for 30 percent women and youth candidates and Puteri seats in Melaka polls."},
  {"name":"Masidi Manjun","born":1965,"home":"SBH","was":"UMNO: Sabah Deputy Chief Minister II and Finance Minister; Karanaan assemblyman","lean":"BN","bloc":"sabah","appeal":56,"blurb":"Sabah Deputy Chief Minister II and Finance Minister; Karanaan assemblyman"},
  {"name":"Jagdeep Singh Deo","born":1965,"home":"PNG","was":"DAP: Penang Deputy Chief Minister II","lean":"PH","bloc":"indian","appeal":56,"blurb":"Deputy chief minister since August 2023 alongside Mohamad Abdul Hamid; leads state investment delegations."},
  {"name":"Jamaliah Jamaluddin","born":1965,"home":"SGR","was":"DAP: Selangor exco (public health, environment); Bandar Utama assemblywoman","lean":"PH","bloc":"malay","appeal":48,"blurb":"Selangor exco member since August 2023; 2026 status not re-confirmed."},
  {"name":"Ng Sze Han","born":1965,"home":"SGR","was":"DAP: Selangor DAP chairman; Selangor exco (investment, trade, mobility)","lean":"PH","bloc":"chinese","appeal":48,"blurb":"Replaced Gobind Singh Deo as Selangor DAP chairman in November 2024."},
  {"name":"Abdul Karim Hamzah","born":1965,"home":"SWK","was":"PBB: Sarawak Minister of Tourism, Creative Industry and Performing Arts; Saberka","lean":"GPS","bloc":"sarawak","appeal":56,"blurb":"Lost the PBB vice-presidency in 2025 but kept his ministry; became Saberkas president in March 2026."},
  {"name":"Julaihi Narawi","born":1965,"home":"SWK","was":"PBB: Sarawak Minister of Utility and Telecommunication; PBB vice-president","lean":"GPS","bloc":"sarawak","appeal":56,"blurb":"Re-elected PBB vice-president; handled Petronas coordination for the Sarawak government."},
  {"name":"Mohd Na'im Mokhtar","born":1965,"home":"SGR","was":"IND: Senator; former Religious Affairs Minister","lean":"OTHERS","bloc":"malay","appeal":56,"blurb":"Non-party former minister dropped from Cabinet in December 2025; a senator on a second term."},
  {"name":"Zulkifli Hasan","born":1965,"home":"SGR","was":"PKR: Minister in the PM's Department (Religious Affairs)","lean":"PH","bloc":"malay","appeal":56,"blurb":"Former deputy religious affairs minister promoted in December 2025 to replace Mohd Na'im Mokhtar."},
  {"name":"Fuziah Salleh","born":1965,"home":"PHG","was":"PKR: PKR secretary-general; Deputy Minister of Domestic Trade and Cost of Living","lean":"PH","bloc":"malay","appeal":56,"blurb":"Became PKR secretary-general in 2024 replacing Saifuddin Nasution; commented on Nurul Izzah's leave in 2026."},
  {"name":"Jaujan Sambakong","born":1965,"home":"SBH","was":"WARISAN: Sulabayan assemblyman; former Sabah Deputy Chief Minister II","lean":"WARISAN","bloc":"sabah","appeal":56,"blurb":"Won Sulabayan again in 2025 and keeps pressing for Semporna services and the Bum Bum bridge."},
  {"name":"Ghulamhaidar Khan Bahadar","born":1965,"home":"SBH","was":"GRS: Kawang assemblyman","lean":"GRS","bloc":"sabah","appeal":48,"blurb":"Former Sabah assistant minister; spoke on the 2026 state budget as Kawang assemblyman."},
  {"name":"Shahril Hamdan","born":1985,"home":"SGR","was":"IND: Managing Director, Watchtower Advisory; podcast co-host","lean":"BN","bloc":"malay","appeal":54,"blurb":"Former UMNO information chief and PMO economic director; lost the Alor Gajah seat in 2022 and now works in advisory and media."},
  {"name":"Zuraida Kamaruddin","born":1965,"home":"SGR","was":"PBM: Parti Bangsa Malaysia leader (claimed)","lean":"PN","bloc":"malay","appeal":48,"blurb":"Former PKR vice-president and plantation minister who left for Bersatu then Parti Bangsa Malaysia; says she will not rejoin PKR for now."},
  {"name":"Latheefa Koya","born":1965,"home":"SGR","was":"IND","lean":"PH","bloc":"other","appeal":48,"blurb":"A familiar name in Malaysian politics."},
  {"name":"Sivarasa Rasiah","born":1965,"home":"SGR","was":"PKR: former PKR vice-president","lean":"PH","bloc":"indian","appeal":48,"blurb":"Rights lawyer and SUARAM co-founder, former Subang and Sungai Buloh MP, not fielded in GE15."},
  {"name":"Husam Musa","born":1965,"home":"KTN","was":"PKR","lean":"PH","bloc":"malay","appeal":48,"blurb":"Former PAS leader who joined Amanah in 2016, resigned as vice-president in 2020, and was later named a PKR candidate."},
];
