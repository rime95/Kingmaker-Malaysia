// The parliament-chart layout, shared by the 2D chart and the 3D chamber.

export interface Geo {
  dots: Dot[];
  size: number;
  w: number;
  h: number;
  /** Number of rows (0 = front). */
  rows: number;
}
export interface Dot {
  seatIndex: number;
  x: number;
  y: number;
  row: number;
}

/** Parliament-chart layout for any number of seats: rows of a half circle, filled left to right in `order`. */
export function hemicycle(order: number[]): Geo {
  const n = order.length;
  const rows = Math.max(2, Math.min(8, Math.round(Math.sqrt(n / 3.5))));
  const r0 = 0.38;
  const radii = Array.from({ length: rows }, (_, k) => r0 + ((1 - r0) * k) / (rows - 1));
  const sum = radii.reduce((a, b) => a + b, 0);
  const counts = radii.map((r) => Math.max(2, Math.round((n * r) / sum)));
  counts[rows - 1] += n - counts.reduce((a, b) => a + b, 0);
  const pos: { a: number; r: number; row: number }[] = [];
  radii.forEach((r, k) => {
    const m = counts[k];
    for (let j = 0; j < m; j++) pos.push({ a: Math.PI - (j * Math.PI) / Math.max(1, m - 1), r, row: k });
  });
  pos.sort((p, q) => q.a - p.a || p.r - q.r);
  const R = 300;
  // Dots as big as the tighter of row spacing and spacing along the outer row allows.
  const rowGap = ((1 - r0) * R) / (rows - 1);
  const arcGap = (Math.PI * R) / Math.max(1, counts[rows - 1] - 1);
  const size = Math.min(16, Math.min(rowGap, arcGap) * 0.42);
  const dots = order.map((seatIndex, i) => ({
    seatIndex,
    x: R + 14 + pos[i].r * R * Math.cos(pos[i].a),
    y: R + 14 - pos[i].r * R * Math.sin(pos[i].a),
    row: pos[i].row,
  }));
  return { dots, size, w: 2 * R + 28, h: R + 40, rows };
}
