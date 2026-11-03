"use client";

// Flags: the Jalur Gemilang and each party's flag, drawn as small stylised SVGs (close to the real ones, simplified so
// they stay crisp at icon size). Coalitions you have renamed get a flag in their own colour with their initials.

import type { ReactNode } from "react";
import type { GameState } from "@/game/state";
import { COALITION_INFO, type CoalitionId } from "@/game/world";

const W = 30;
const H = 20;

/** A five-petal bunga raya. */
function Hibiscus({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  return (
    <g fill={fill}>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx={x} cy={y - r * 0.55} rx={r * 0.38} ry={r * 0.55} transform={`rotate(${a} ${x} ${y})`} />
      ))}
      <circle cx={x} cy={y} r={r * 0.18} fill="#c00" />
    </g>
  );
}

/** A star with n points. */
function star(cx: number, cy: number, outer: number, inner: number, n: number): string {
  const pts: string[] = [];
  for (let k = 0; k < n * 2; k++) {
    const r = k % 2 ? inner : outer;
    const a = (Math.PI * k) / n - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}

const Letters = ({ text, fill = "#fff", size = 8 }: { text: string; fill?: string; size?: number }) => (
  <text x={W / 2} y={H / 2 + size * 0.36} textAnchor="middle" fontSize={size} fontWeight={800} fill={fill} fontFamily="system-ui, sans-serif" letterSpacing={0.3}>
    {text}
  </text>
);

/** Each flag's artwork, on a 30×20 field. */
const ART: Record<string, () => ReactNode> = {
  // Barisan Nasional: the white dacing (scales) on blue.
  BN: () => (
    <>
      <rect width={W} height={H} fill="#0a2a8f" />
      <g stroke="#fff" strokeWidth={1.1} fill="none" strokeLinecap="round">
        <path d="M15 4.5 V15.5 M10 16 H20 M8 7 H22" />
        <path d="M8 7 L5.5 12 M8 7 L10.5 12 M22 7 L19.5 12 M22 7 L24.5 12" strokeWidth={0.7} />
      </g>
      <path d="M5 12 Q8 14.5 11 12 Z M19 12 Q22 14.5 25 12 Z" fill="#fff" />
    </>
  ),
  // UMNO: red over white, the keris in a green panel with a yellow border.
  UMNO: () => (
    <>
      <rect width={W} height={H / 2} fill="#d0021b" />
      <rect y={H / 2} width={W} height={H / 2} fill="#fff" />
      <rect x={10} y={4} width={10} height={12} fill="#00843d" stroke="#ffd200" strokeWidth={0.8} />
      <path d="M15 5.5 Q16.4 8 14.6 10 Q16.2 12 15 14.5" stroke="#ffd200" strokeWidth={1.1} fill="none" strokeLinecap="round" />
      <path d="M13.2 12.6 H16.8" stroke="#ffd200" strokeWidth={0.9} />
    </>
  ),
  MCA: () => (
    <>
      <rect width={W} height={H} fill="#1d3f9e" />
      <circle cx={15} cy={10} r={6} fill="#ffd200" />
      <circle cx={15} cy={10} r={3.6} fill="#1d3f9e" />
      <path d="M15 6.4 V13.6 M11.4 10 H18.6" stroke="#ffd200" strokeWidth={1} />
    </>
  ),
  MIC: () => (
    <>
      <rect width={W} height={H} fill="#007a3d" />
      <rect y={7} width={W} height={6} fill="#fff" />
      <circle cx={15} cy={10} r={2.6} fill="#f39c12" />
    </>
  ),
  PBRS: () => (
    <>
      <rect width={W} height={H} fill="#0b4ea2" />
      <Letters text="PBRS" size={6.5} />
    </>
  ),
  // Pakatan Harapan: red with the white ring.
  PH: () => (
    <>
      <rect width={W} height={H} fill="#e01b22" />
      <circle cx={15} cy={10} r={6.2} fill="none" stroke="#fff" strokeWidth={2} />
      <path d="M11.5 12.8 L15 6.6 L18.5 12.8" stroke="#00a1e4" strokeWidth={1.6} fill="none" strokeLinejoin="round" />
    </>
  ),
  // PKR: the eye on light blue.
  PKR: () => (
    <>
      <rect width={W} height={H} fill="#38b6ff" />
      <path d="M4.5 10 Q15 1.5 25.5 10 Q15 18.5 4.5 10 Z" fill="#fff" />
      <circle cx={15} cy={10} r={3.8} fill="#e01b22" />
      <circle cx={15} cy={10} r={1.3} fill="#fff" />
    </>
  ),
  // DAP: the red rocket in a blue circle on white.
  DAP: () => (
    <>
      <rect width={W} height={H} fill="#fff" />
      <circle cx={15} cy={10} r={7.5} fill="none" stroke="#1f3f9a" strokeWidth={1.4} />
      <path d="M15 3.6 Q17.4 6.5 17 12.5 L13 12.5 Q12.6 6.5 15 3.6 Z" fill="#e01b22" />
      <path d="M13 11 L10.8 14.6 L13.3 13.4 Z M17 11 L19.2 14.6 L16.7 13.4 Z M14.2 12.5 L15 16.2 L15.8 12.5 Z" fill="#e01b22" />
    </>
  ),
  // AMANAH: orange with the white emblem.
  AMANAH: () => (
    <>
      <rect width={W} height={H} fill="#f7941d" />
      <circle cx={15} cy={10} r={6} fill="#fff" />
      <path d="M12 13.5 L15 6 L18 13.5 M13.2 11 H16.8" stroke="#f7941d" strokeWidth={1.4} fill="none" strokeLinejoin="round" />
    </>
  ),
  UPKO: () => (
    <>
      <rect width={W} height={H} fill="#0a7d3b" />
      <rect y={13} width={W} height={7} fill="#f2c500" />
      <Letters text="UPKO" size={6.5} />
    </>
  ),
  // Perikatan Nasional: navy with the PN mark.
  PN: () => (
    <>
      <rect width={W} height={H} fill="#0b2a5b" />
      <rect y={15.5} width={W} height={4.5} fill="#159a7c" />
      <Letters text="PN" size={9} />
    </>
  ),
  // PAS: the white full moon on green.
  PAS: () => (
    <>
      <rect width={W} height={H} fill="#00923f" />
      <circle cx={15} cy={10} r={5.6} fill="#fff" />
    </>
  ),
  // BERSATU: the bunga raya on red.
  BERSATU: () => (
    <>
      <rect width={W} height={H} fill="#d0021b" />
      <Hibiscus x={15} y={10} r={6.2} fill="#fff" />
    </>
  ),
  GERAKAN: () => (
    <>
      <rect width={W} height={H} fill="#d0021b" />
      <circle cx={15} cy={10} r={6} fill="#fff" />
      <path d="M11.6 8.6 H18.4 M11.6 11.4 H18.4" stroke="#d0021b" strokeWidth={1.4} />
    </>
  ),
  // Gabungan Parti Sarawak: Sarawak's yellow, red and black, with the star.
  GPS: () => (
    <>
      <rect width={W} height={H} fill="#ffd200" />
      <path d="M0 20 L30 0 L30 6 L9 20 Z" fill="#d0021b" />
      <path d="M0 20 L0 14 L21 0 L30 0 Z" fill="#111" />
      <polygon points={star(20.5, 13.5, 3, 1.3, 9)} fill="#ffd200" />
    </>
  ),
  PBB: () => (
    <>
      <rect width={W} height={H} fill="#00843d" />
      <polygon points={star(15, 10, 5.5, 2.3, 5)} fill="#fff" />
    </>
  ),
  SUPP: () => (
    <>
      <rect width={W} height={H} fill="#00843d" />
      <rect y={6.5} width={W} height={7} fill="#fff" />
      <Letters text="SUPP" size={5.5} fill="#00843d" />
    </>
  ),
  PRS: () => (
    <>
      <rect width={W} height={H} fill="#d0021b" />
      <Letters text="PRS" size={7.5} />
    </>
  ),
  PDP: () => (
    <>
      <rect width={W} height={H} fill="#0b4ea2" />
      <Letters text="PDP" size={7.5} />
    </>
  ),
  // Gabungan Rakyat Sabah: Mount Kinabalu on Sabah blue.
  GRS: () => (
    <>
      <rect width={W} height={H} fill="#0e4f9e" />
      <path d="M3 16 L10 8.5 L12.5 10.5 L15 6 L18 9.5 L20 8 L27 16 Z" fill="#fff" />
      <rect y={16} width={W} height={4} fill="#d0021b" />
    </>
  ),
  // Warisan: the white wave on sea blue.
  WARISAN: () => (
    <>
      <rect width={W} height={H} fill="#1a9fd0" />
      <path d="M4 12 Q9 6 15 11 T26 9" stroke="#fff" strokeWidth={2.2} fill="none" strokeLinecap="round" />
      <path d="M4 15.5 Q9 10 15 14.5 T26 12.5" stroke="#fff" strokeWidth={1.1} fill="none" strokeLinecap="round" opacity={0.75} />
    </>
  ),
  // MUDA: white on black.
  MUDA: () => (
    <>
      <rect width={W} height={H} fill="#111" />
      <path d="M7.5 14.5 V6 L15 11.5 L22.5 6 V14.5" stroke="#fff" strokeWidth={2.2} fill="none" strokeLinejoin="round" />
    </>
  ),
  // Parti Bersama: yellow, two circles joined.
  BERSAMA: () => (
    <>
      <rect width={W} height={H} fill="#f5c400" />
      <circle cx={12.4} cy={10} r={4.6} fill="none" stroke="#1b1b1b" strokeWidth={1.5} />
      <circle cx={17.6} cy={10} r={4.6} fill="none" stroke="#fff" strokeWidth={1.5} />
    </>
  ),
  KDM: () => (
    <>
      <rect width={W} height={H} fill="#5b2c83" />
      <Letters text="KDM" size={7.5} />
    </>
  ),
  PBM: () => (
    <>
      <rect width={W} height={H} fill="#2e7d32" />
      <Letters text="PBM" size={7.5} />
    </>
  ),
  IND: () => (
    <>
      <rect width={W} height={H} fill="#8a8f9c" />
      <Letters text="BEBAS" size={5.5} />
    </>
  ),
  OTHERS: () => (
    <>
      <rect width={W} height={H} fill="#8a8f9c" />
      <Letters text="BEBAS" size={5.5} />
    </>
  ),
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => w && w[0] === w[0].toUpperCase())
    .map((w) => w[0])
    .join("")
    .slice(0, 4) || name.slice(0, 3).toUpperCase();

/** A plain flag for a party or coalition without its own artwork (or one you renamed). */
function Generic({ color, label }: { color: string; label: string }) {
  return (
    <>
      <rect width={W} height={H} fill={color} />
      <rect y={H - 3.5} width={W} height={3.5} fill="#fff" opacity={0.35} />
      <Letters text={label} size={label.length > 3 ? 6 : 8} />
    </>
  );
}

interface FlagProps {
  /** Party or coalition id. */
  id: string;
  /** Height in px (width is 1.5×). */
  size?: number;
  className?: string;
  title?: string;
}

/** A party's (or coalition's) flag. */
export function PartyFlag({ id, size = 14, className = "", title }: FlagProps) {
  const art = ART[id];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={size * 1.5} height={size} className={`party-flag ${className}`} role="img" aria-label={title ?? `${id} flag`}>
      <title>{title ?? id}</title>
      {art ? art() : <Generic color="#8a8f9c" label={initials(id)} />}
      <rect width={W} height={H} fill="none" stroke="rgba(0,0,0,.25)" strokeWidth={0.6} />
    </svg>
  );
}

/** A coalition's flag in a game: its real flag, or its own colours once you have renamed it. */
export function CoalitionFlag({ game, c, size = 14, className = "" }: { game: Pick<GameState, "coalitions">; c: CoalitionId; size?: number; className?: string }) {
  const co = game.coalitions[c];
  const renamed = co && co.name !== COALITION_INFO[c].name;
  if (!renamed) return <PartyFlag id={c} size={size} className={className} title={co?.name ?? c} />;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={size * 1.5} height={size} className={`party-flag ${className}`} role="img" aria-label={`${co.name} flag`}>
      <title>{co.name}</title>
      <Generic color={co.color} label={initials(co.short || co.name)} />
      <rect width={W} height={H} fill="none" stroke="rgba(0,0,0,.25)" strokeWidth={0.6} />
    </svg>
  );
}

/** The Jalur Gemilang: 14 red and white stripes, the blue canton, the crescent and the 14-point star. */
export function JalurGemilang({ height = 20, className = "", wave = false }: { height?: number; className?: string; wave?: boolean }) {
  const w = 28;
  const h = 14;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={height * 2} height={height} className={`jalur-gemilang ${wave ? "jalur-wave" : ""} ${className}`} role="img" aria-label="Jalur Gemilang">
      {Array.from({ length: 14 }, (_, k) => (
        <rect key={k} y={k} width={w} height={1} fill={k % 2 ? "#fff" : "#cc0001"} />
      ))}
      <rect width={14} height={8} fill="#010066" />
      <circle cx={5.6} cy={4} r={3} fill="#fc0" />
      <circle cx={6.5} cy={4} r={2.5} fill="#010066" />
      <polygon points={star(10, 4, 2.5, 1.05, 14)} fill="#fc0" />
      {wave && <rect width={w} height={h} fill="url(#jg-sheen)" className="jalur-sheen" />}
      {wave && (
        <defs>
          <linearGradient id="jg-sheen" x1="0" x2="1">
            <stop offset="0" stopColor="#000" stopOpacity="0.18" />
            <stop offset="0.3" stopColor="#fff" stopOpacity="0.12" />
            <stop offset="0.55" stopColor="#000" stopOpacity="0.15" />
            <stop offset="0.8" stopColor="#fff" stopOpacity="0.1" />
            <stop offset="1" stopColor="#000" stopOpacity="0.18" />
          </linearGradient>
        </defs>
      )}
    </svg>
  );
}

/** A string of bunting: small flags of the given parties on a line. */
export function Bunting({ ids, size = 9 }: { ids: string[]; size?: number }) {
  return (
    <div className="bunting" aria-hidden>
      {ids.map((id, k) => (
        <span key={k} className="bunting-flag" style={{ animationDelay: `${(k % 7) * 0.23}s` }}>
          <PartyFlag id={id} size={size} />
        </span>
      ))}
    </div>
  );
}
