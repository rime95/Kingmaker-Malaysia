// The world league table for Wawasan: each country's Global Power score (0–100) in 2026 and how it drifts a year.
// Malaysia's own score is computed from its income, quality of life, innovation and the size of its economy
// (wawasan.ts). The figures are game numbers, not a real index: TEMPORARY, edit freely.

export interface Country {
  name: string;
  flag: string;
  power: number;
  /** Change a year. */
  drift: number;
}

export const WORLD: Country[] = [
  { name: "United States", flag: "🇺🇸", power: 92, drift: 0.1 },
  { name: "China", flag: "🇨🇳", power: 82, drift: 0.4 },
  { name: "Germany", flag: "🇩🇪", power: 80, drift: 0 },
  { name: "Japan", flag: "🇯🇵", power: 79, drift: -0.1 },
  { name: "United Kingdom", flag: "🇬🇧", power: 78, drift: 0 },
  { name: "France", flag: "🇫🇷", power: 76, drift: 0 },
  { name: "South Korea", flag: "🇰🇷", power: 75, drift: 0.2 },
  { name: "Canada", flag: "🇨🇦", power: 74, drift: 0 },
  { name: "Singapore", flag: "🇸🇬", power: 74, drift: 0.1 },
  { name: "Switzerland", flag: "🇨🇭", power: 72, drift: 0 },
  { name: "Australia", flag: "🇦🇺", power: 72, drift: 0 },
  { name: "Netherlands", flag: "🇳🇱", power: 71, drift: 0 },
  { name: "Taiwan", flag: "🇹🇼", power: 70, drift: 0.2 },
  { name: "Sweden", flag: "🇸🇪", power: 69, drift: 0 },
  { name: "Italy", flag: "🇮🇹", power: 68, drift: -0.1 },
  { name: "UAE", flag: "🇦🇪", power: 66, drift: 0.2 },
  { name: "Spain", flag: "🇪🇸", power: 65, drift: 0 },
  { name: "Israel", flag: "🇮🇱", power: 63, drift: 0 },
  { name: "Saudi Arabia", flag: "🇸🇦", power: 62, drift: 0.2 },
  { name: "Poland", flag: "🇵🇱", power: 60, drift: 0.2 },
  { name: "India", flag: "🇮🇳", power: 58, drift: 0.6 },
  { name: "Russia", flag: "🇷🇺", power: 58, drift: -0.2 },
  { name: "Brazil", flag: "🇧🇷", power: 54, drift: 0.1 },
  { name: "Turkey", flag: "🇹🇷", power: 53, drift: 0.1 },
  { name: "Indonesia", flag: "🇮🇩", power: 52, drift: 0.4 },
  { name: "Mexico", flag: "🇲🇽", power: 50, drift: 0 },
  { name: "Thailand", flag: "🇹🇭", power: 49, drift: 0.1 },
  { name: "Vietnam", flag: "🇻🇳", power: 47, drift: 0.4 },
  { name: "South Africa", flag: "🇿🇦", power: 46, drift: 0 },
  { name: "Philippines", flag: "🇵🇭", power: 43, drift: 0.3 },
  { name: "Egypt", flag: "🇪🇬", power: 42, drift: 0.1 },
];
