// Line icons for the navigation rail (24×24, stroke = currentColor).

const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const ICONS = {
  campaign: (
    <svg viewBox="0 0 24 24" {...P}>
      <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  ),
  party: (
    <svg viewBox="0 0 24 24" {...P}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15.5 14.5A5 5 0 0 1 21 19" />
    </svg>
  ),
  people: (
    <svg viewBox="0 0 24 24" {...P}>
      <rect x="9" y="3" width="6" height="5" rx="1" />
      <rect x="3" y="16" width="6" height="5" rx="1" />
      <rect x="15" y="16" width="6" height="5" rx="1" />
      <path d="M12 8v4M6 16v-4h12v4" />
    </svg>
  ),
  team: (
    <svg viewBox="0 0 24 24" {...P}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" />
    </svg>
  ),
  nation: (
    <svg viewBox="0 0 24 24" {...P}>
      <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
    </svg>
  ),
  policy: (
    <svg viewBox="0 0 24 24" {...P}>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v4h4M9 12h7M9 16h7" />
    </svg>
  ),
  states: (
    <svg viewBox="0 0 24 24" {...P}>
      <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  ),
  parliament: (
    <svg viewBox="0 0 24 24" {...P}>
      <path d="M3 21h18M5 21v-8M9 21v-8M15 21v-8M19 21v-8" />
      <path d="M3 13h18L12 5z" />
    </svg>
  ),
  rivals: (
    <svg viewBox="0 0 24 24" {...P}>
      <path d="M4 20 14 10M14 10l2-6 4 4-6 2" />
      <path d="M20 20 10 10M10 10 8 4 4 8l6 2" />
    </svg>
  ),
  treasury: (
    <svg viewBox="0 0 24 24" {...P}>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" {...P}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  ),
  menu: (
    <svg viewBox="0 0 24 24" {...P}>
      <circle cx="5" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="19" cy="12" r="1.2" />
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 24 24" {...P}>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  ),
};

export type IconName = keyof typeof ICONS;

export function Icon({ name, className = "w-5 h-5" }: { name: IconName; className?: string }) {
  return <span className={`inline-block ${className}`}>{ICONS[name]}</span>;
}
