"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type Shot = { pos: [number, number, number]; target: [number, number, number] };

// The chamber: seats in a half circle of radius about 5 round the origin, on the -z side; the Speaker at +z.
export const SHOTS = {
  overview: { pos: [0, 8.6, 6.4], target: [0, 0, -1.8] },
  top: { pos: [0, 15.5, -0.6], target: [0, 0, -2.4] },
  // The government sits on the left of the chart (-x); each view looks across the floor at one side.
  government: { pos: [4.6, 4.2, 2.2], target: [-2.4, 0.3, -2.2] },
  opposition: { pos: [-4.6, 4.2, 2.2], target: [2.4, 0.3, -2.2] },
} satisfies Record<string, Shot>;

/** Where the camera starts: high above, before gliding to the overview. */
const START: Shot = { pos: [0, 15, 9], target: [0, 0, -2] };

/** Keeps the camera's focus over the chamber floor. */
const clampTarget = (t: THREE.Vector3) => {
  t.x = THREE.MathUtils.clamp(t.x, -6, 6);
  t.y = THREE.MathUtils.clamp(t.y, 0, 2);
  t.z = THREE.MathUtils.clamp(t.z, -7, 2);
};

/**
 * Orbit controls plus a camera that glides between shots. Any drag by the player cancels the glide; `orbit` turns the
 * chamber slowly until they touch it.
 */
export function CameraRig({ shot, nonce, orbit, onTouched }: { shot: Shot; nonce: number; orbit: boolean; onTouched: () => void }) {
  const { camera, gl } = useThree();
  const controls = useRef<OrbitControls | null>(null);
  const goal = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const touched = useRef(onTouched);
  useEffect(() => {
    touched.current = onTouched;
  }, [onTouched]);

  useEffect(() => {
    camera.position.set(...START.pos);
    const c = new OrbitControls(camera, gl.domElement);
    c.enableDamping = true;
    c.dampingFactor = 0.09;
    c.target.set(...START.target);
    c.minDistance = 2;
    c.maxDistance = 17;
    c.minPolarAngle = 0;
    c.maxPolarAngle = Math.PI * 0.42;
    c.autoRotateSpeed = 0.5;
    c.zoomSpeed = 0.8;
    c.screenSpacePanning = false;
    const stop = () => {
      goal.current = null;
      touched.current();
    };
    c.addEventListener("start", stop);
    c.update();
    controls.current = c;
    return () => {
      c.removeEventListener("start", stop);
      c.dispose();
    };
  }, [camera, gl]);

  // A new shot: glide to it.
  useEffect(() => {
    goal.current = { pos: new THREE.Vector3(...shot.pos), target: new THREE.Vector3(...shot.target) };
  }, [shot, nonce]);

  useEffect(() => {
    if (controls.current) controls.current.autoRotate = orbit;
  }, [orbit]);

  useFrame((_, dt) => {
    const c = controls.current;
    if (!c) return;
    const g = goal.current;
    if (g) {
      // Ease towards the shot: quick at first, settling gently.
      const k = 1 - Math.pow(0.015, Math.min(dt, 0.05));
      camera.position.lerp(g.pos, k);
      c.target.lerp(g.target, k);
      if (camera.position.distanceTo(g.pos) < 0.01 && c.target.distanceTo(g.target) < 0.01) goal.current = null;
    }
    clampTarget(c.target);
    c.update();
  });
  return null;
}
