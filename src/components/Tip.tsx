"use client";

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";

const GAP = 14;
const MARGIN = 8;

/**
 * A hover card that follows the pointer and always stays on screen: it measures itself, sits below-right of the
 * pointer, flips to the other side when it would spill over an edge, and is clamped inside the window.
 */
export function Tip({ x, y, width, className = "", style, children }: { x: number; y: number; width?: number; className?: string; style?: CSSProperties; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = x + GAP;
    if (left + w > vw - MARGIN) left = x - GAP - w;
    let top = y + GAP;
    if (top + h > vh - MARGIN) top = y - GAP - h;
    el.style.left = `${Math.max(MARGIN, Math.min(left, vw - w - MARGIN))}px`;
    el.style.top = `${Math.max(MARGIN, Math.min(top, vh - h - MARGIN))}px`;
    el.style.visibility = "visible";
  });
  return (
    <div ref={ref} className={`tooltip ${className}`} style={{ ...style, width, maxWidth: `calc(100vw - ${MARGIN * 2}px)`, maxHeight: `calc(100vh - ${MARGIN * 2}px)`, overflow: "hidden", left: x + GAP, top: y + GAP, visibility: "hidden" }}>
      {children}
    </div>
  );
}
