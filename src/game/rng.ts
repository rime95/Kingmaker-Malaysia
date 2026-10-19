// Seeded random numbers (mulberry32). The state is a plain number stored in
// GameState, so saving and reloading keeps the random sequence identical.

export function nextRandom(state: number): [value: number, nextState: number] {
  const next = (state + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}

/**
 * Deterministic value in [0, 1) from a few integers or strings, without touching the game RNG
 * (yearly savings rates, CFO forecast errors). Same inputs, same value.
 */
export function hash01(...parts: (number | string)[]): number {
  let h = 0x811c9dc5;
  for (const p of parts) {
    const str = String(p);
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    h ^= 0x2c;
    h = Math.imul(h, 0x01000193);
  }
  return nextRandom(h)[0];
}

/** Small helper that threads the RNG state through a sequence of draws. */
export class Rng {
  state: number;

  constructor(state: number) {
    this.state = state;
  }

  next(): number {
    const [value, nextState] = nextRandom(this.state);
    this.state = nextState;
    return value;
  }
}
