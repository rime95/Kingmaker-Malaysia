// Equal-size hex cartogram: every seat gets one hex, clustered around its state's rough position.
// Small states are placed first so they keep their spot; big states wrap around them.

import { SEATS, STATES } from "./world";

export const HEX_R = 13;
const W = Math.sqrt(3) * HEX_R;

export function hexCenter(col: number, row: number): [number, number] {
  return [col * W + (row & 1 ? W / 2 : 0) + W, row * 1.5 * HEX_R + HEX_R * 2];
}

export function hexPath(cx: number, cy: number, r = HEX_R - 1): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join("L")}Z`;
}

export interface HexCell {
  seatIndex: number;
  state: string;
  col: number;
  row: number;
  x: number;
  y: number;
}

export interface StateLabel {
  state: string;
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
}

/** Where to put a state's name so crowded states don't collide (default: above the cluster). */
const LABEL_SIDE: Record<string, "left" | "right"> = { PLS: "left", PNG: "left", SGR: "left", KUL: "right", NSN: "right", MLK: "left", PJY: "left", LBN: "left" };

// Neighbour offsets for each hex edge (edge i joins corners i and i+1), odd-r offset grid.
const EVEN_NB = [[1, 0], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1]];
const ODD_NB = [[1, 0], [1, 1], [0, 1], [-1, 0], [0, -1], [1, -1]];

export function hexCorner(cx: number, cy: number, i: number, r = HEX_R): [number, number] {
  const a = (Math.PI / 180) * (60 * i - 30);
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function build(): { cells: HexCell[]; labels: StateLabel[]; width: number; height: number } {
  const used = new Set<string>();
  const cells: HexCell[] = [];
  const labels: StateLabel[] = [];
  const order = [...STATES].sort((a, b) => SEATS.filter((s) => s.state === a.id).length - SEATS.filter((s) => s.state === b.id).length);
  const grid: [number, number][] = [];
  for (let row = -2; row < 28; row++) for (let col = -2; col < 40; col++) grid.push([col, row]);

  for (const st of order) {
    const seats = SEATS.filter((s) => s.state === st.id);
    const [cx, cy] = hexCenter(st.hex[0], st.hex[1]);
    const free = grid
      .filter(([c, r]) => !used.has(`${c},${r}`))
      .map(([c, r]) => {
        const [x, y] = hexCenter(c, r);
        return { c, r, x, y, d: Math.hypot(x - cx, y - cy) };
      })
      .sort((a, b) => a.d - b.d)
      .slice(0, seats.length);
    let sx = 0;
    let sy = 0;
    let top = Infinity;
    let left = Infinity;
    let right = -Infinity;
    seats.forEach((seat, i) => {
      const f = free[i];
      used.add(`${f.c},${f.r}`);
      cells.push({ seatIndex: seat.index, state: st.id, col: f.c, row: f.r, x: f.x, y: f.y });
      sx += f.x;
      sy += f.y;
      top = Math.min(top, f.y);
      left = Math.min(left, f.x);
      right = Math.max(right, f.x);
    });
    const side = LABEL_SIDE[st.id];
    if (side === "left") labels.push({ state: st.id, x: left - HEX_R - 3, y: sy / seats.length + 3, anchor: "end" });
    else if (side === "right") labels.push({ state: st.id, x: right + HEX_R + 3, y: sy / seats.length + 3, anchor: "start" });
    else labels.push({ state: st.id, x: sx / seats.length, y: top - HEX_R - 3, anchor: "middle" });
  }
  // Leave room for side labels (about 6px per character).
  const labelLeft = (l: StateLabel) => l.x - (l.anchor === "end" ? STATES.find((s) => s.id === l.state)!.name.length * 6 : 0);
  const labelRight = (l: StateLabel) => l.x + (l.anchor === "start" ? STATES.find((s) => s.id === l.state)!.name.length * 6 : 0);
  const minX = Math.min(...cells.map((c) => c.x - HEX_R * 2), ...labels.map(labelLeft)) - 4;
  const minY = Math.min(...cells.map((c) => c.y), ...labels.map((l) => l.y)) - HEX_R * 2;
  for (const c of cells) {
    c.x -= minX;
    c.y -= minY;
  }
  for (const l of labels) {
    l.x -= minX;
    l.y -= minY;
  }
  cells.sort((a, b) => a.seatIndex - b.seatIndex);
  return {
    cells,
    labels,
    width: Math.max(...cells.map((c) => c.x + HEX_R * 2), ...labels.map(labelRight)) + 4,
    height: Math.max(...cells.map((c) => c.y)) + HEX_R * 2,
  };
}

export const HEX_MAP = build();

/** One SVG path tracing every edge where a state meets another state or the sea. */
export const STATE_BORDERS: string = (() => {
  const at = new Map(HEX_MAP.cells.map((c) => [`${c.col},${c.row}`, c.state]));
  const parts: string[] = [];
  for (const c of HEX_MAP.cells) {
    const nb = c.row & 1 ? ODD_NB : EVEN_NB;
    for (let i = 0; i < 6; i++) {
      if (at.get(`${c.col + nb[i][0]},${c.row + nb[i][1]}`) === c.state) continue;
      const [x1, y1] = hexCorner(c.x, c.y, i);
      const [x2, y2] = hexCorner(c.x, c.y, (i + 1) % 6);
      parts.push(`M${x1.toFixed(1)},${y1.toFixed(1)}L${x2.toFixed(1)},${y2.toFixed(1)}`);
    }
  }
  return parts.join("");
})();
