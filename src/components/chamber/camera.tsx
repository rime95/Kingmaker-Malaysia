"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type Shot = { pos: [number, number, number]; target: [number, number, number] };

export const SHOTS = {
  speaker: { pos: [0, 3.5, 2.3], target: [0, 0.6, -2.7] },
  // Inside the room (the wall is about 5.6 from the Speaker): from the public gallery, and across the floor at each side.
  gallery: { pos: [0, 4.3, -4.4], target: [0, 0.4, 0.4] },
  government: { pos: [2.6, 2.4, -0.6], target: [-3.2, 0.5, -1.8] },
  opposition: { pos: [-2.6, 2.4, -0.6], target: [3.2, 0.5, -1.8] },
} satisfies Record<string, Shot>;

/** Where the camera starts: high in the gallery, before gliding down to the Speaker's view. */
const START: Shot = { pos: [0, 5.2, -4.8], target: [0, 0.5, -1.0] };

/**
 * Orbit controls plus a camera that glides between shots. Any drag by the player cancels the glide; `orbit` turns the
 * room slowly until they touch it.
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
    c.dampingFactor = 0.08;
    c.target.set(...START.target);
    c.minDistance = 1.6;
    c.maxDistance = 7.5;
    c.maxPolarAngle = Math.PI * 0.47;
    c.autoRotateSpeed = 0.6;
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
      const k = 1 - Math.pow(0.02, Math.min(dt, 0.05));
      camera.position.lerp(g.pos, k);
      c.target.lerp(g.target, k);
      if (camera.position.distanceTo(g.pos) < 0.01 && c.target.distanceTo(g.target) < 0.01) goal.current = null;
    }
    c.update();
  });
  return null;
}
