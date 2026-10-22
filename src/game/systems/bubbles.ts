// Opportunity bubbles (in the spirit of Plague Inc): each week 1–3 pop up on seats. Click one to collect a small free
// bonus; they disappear when the week ends. Drawn with hash01, so the weekly random sequence is unchanged.

import { hash01 } from "../rng";
import type { GameState } from "../state";
import { ge15MarginShare } from "../voter";
import { SEATS, contestingIn } from "../world";
import { addPoints } from "./career";

export type BubbleKind = "crowd" | "donor" | "volunteers" | "viral" | "loyal";

export interface Bubble {
  id: number;
  seat: number;
  kind: BubbleKind;
  value: number;
}

export const BUBBLE_INFO: Record<BubbleKind, { icon: string; title: string; reward: (v: number) => string }> = {
  crowd: { icon: "📣", title: "Crowd surge", reward: (v) => `+${v} buzz here` },
  donor: { icon: "💰", title: "Donor at a kenduri", reward: (v) => `+RM ${Math.round(v / 1000)}k` },
  volunteers: { icon: "🙋", title: "Volunteers sign up", reward: (v) => `+${v} machinery here` },
  viral: { icon: "📱", title: "Clip goes viral", reward: (v) => `+${v} national buzz` },
  loyal: { icon: "🤝", title: "MP pledges loyalty", reward: (v) => `+${v} loyalty, +2 career points` },
};

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

/** This week's bubbles: mostly close races and your own seats. */
export function newBubbles(s: GameState): Bubble[] {
  const h = (...k: (string | number)[]) => hash01("bubble", s.seed, s.week, ...k);
  const contested = SEATS.filter((seat) => contestingIn(seat, s.entries).includes(s.player));
  if (!contested.length) return [];
  const close = contested.filter((seat) => s.holders[seat.index] === s.player || ge15MarginShare(seat) < 0.12);
  const count = 1 + Math.floor(h("count") * 3);
  const out: Bubble[] = [];
  for (let n = 0; n < count; n++) {
    const pool = h("pool", n) < 0.7 && close.length ? close : contested;
    const seat = pool[Math.floor(h("seat", n) * pool.length)].index;
    if (out.some((b) => b.seat === seat)) continue;
    const ownSeat = s.holders[seat] === s.player;
    const roll = h("kind", n);
    const kind: BubbleKind = ownSeat && roll < 0.2 ? "loyal" : roll < 0.45 ? "crowd" : roll < 0.7 ? "donor" : roll < 0.88 ? "volunteers" : "viral";
    const value = kind === "donor" ? Math.round((150_000 + h("value", n) * 250_000) / 10_000) * 10_000 : kind === "crowd" ? 12 : kind === "volunteers" ? 8 : kind === "viral" ? 5 : 15;
    out.push({ id: s.week * 10 + n, seat, kind, value });
  }
  return out;
}

export function applyBubble(s: GameState, b: Bubble): GameState {
  const me = { ...s.me, buzz: [...s.me.buzz], machinery: [...s.me.machinery] };
  let career = s.career;
  switch (b.kind) {
    case "crowd":
      me.buzz[b.seat] = clamp(me.buzz[b.seat] + b.value);
      break;
    case "donor":
      me.funds += b.value;
      break;
    case "volunteers":
      me.machinery[b.seat] = clamp(me.machinery[b.seat] + b.value);
      break;
    case "viral":
      me.nationalBuzz = clamp(me.nationalBuzz + b.value);
      break;
    case "loyal": {
      const loyalty = [...career.loyalty];
      loyalty[b.seat] = clamp(loyalty[b.seat] + b.value);
      career = addPoints({ ...career, loyalty }, s.week, 2, `an MP in ${SEATS[b.seat].name} pledged loyalty`);
      break;
    }
  }
  return { ...s, me, career, bubbles: s.bubbles.filter((x) => x.id !== b.id) };
}
