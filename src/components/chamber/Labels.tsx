"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, type RefObject } from "react";
import * as THREE from "three";

/** A point in the chamber that an HTML label follows. */
export interface Anchor {
  id: string;
  pos: THREE.Vector3;
  /** Which side of the point the label sits: centred above it (the default), or off to the left or right. */
  align?: "left" | "right";
}

/**
 * Moves HTML labels (absolutely placed over the canvas) to follow points in the 3D chamber, every frame. Labels behind
 * the camera are hidden. Kept outside React state so nothing re-renders as the camera moves.
 */
export function LabelProjector({ anchors, els }: { anchors: Anchor[]; els: RefObject<Record<string, HTMLElement | null>> }) {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const map = els.current;
    if (!map) return;
    for (const a of anchors) {
      const el = map[a.id];
      if (!el) continue;
      v.copy(a.pos).project(camera);
      const hidden = v.z > 1 || v.x < -1.2 || v.x > 1.2 || v.y < -1.2 || v.y > 1.2;
      // eslint-disable-next-line react-hooks/immutability -- labels move imperatively, outside React
      el.style.visibility = hidden ? "hidden" : "";
      if (hidden) continue;
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      const shift = a.align === "left" ? "translate(calc(-100% - 8px), -50%)" : a.align === "right" ? "translate(8px, -50%)" : "translate(-50%, -100%)";
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) ${shift}`;
    }
  });
  return null;
}
