"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { Attire } from "@/game/systems/gender";
import { COLORS } from "./Room";

/** Where one MP sits, and what they look like. */
export interface Sitter {
  /** Seat index (who sits here). */
  i: number;
  pos: [number, number, number];
  rot: number;
  attire: Attire | null;
  party: THREE.Color;
  /** A stable number in [0, 1000) for picking colours. */
  h: number;
}

const SKIN = ["#c99872", "#a8744f", "#e0b48c", "#8a5a3b", "#d6a57c"].map((c) => new THREE.Color(c));
const SUIT = ["#1d2433", "#222222", "#2b2f3a", "#1e2a44", "#3a3a3a", "#2a3240"].map((c) => new THREE.Color(c));
const BATIK = ["#8a4b1f", "#2f5d6b", "#6b2f45", "#a0782c", "#3e5f3a", "#5b3a7a"].map((c) => new THREE.Color(c));
const KURUNG = ["#e6b8c8", "#b9d3ea", "#f1dcb0", "#c9e4cf", "#d9c1e8", "#f3c6a8", "#9ec5c0"].map((c) => new THREE.Color(c));
const TUDUNG = ["#e9d7e8", "#c9def0", "#f2e3c4", "#d3ecd8", "#f0c9cf", "#3b3f58", "#7a5a6e"].map((c) => new THREE.Color(c));
const BLAZER = ["#1e2a44", "#6b1f2c", "#efe6d2", "#2f5d5b", "#3a3a3a", "#8a6b9e"].map((c) => new THREE.Color(c));
const HAIR = new THREE.Color("#1a1310");
/** Seats and MPs a little larger than life, so faces and dress read from the gallery. */
const FIGURE_SCALE = 1.25;
const BLACK = new THREE.Color("#000000");
const pickOf = <T,>(list: T[], h: number, salt: number) => list[(h * (salt + 7)) % list.length];

const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const mat = (color: string, roughness = 0.7, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });

/** The shapes, built once. Local -z faces the Speaker. */
function useParts() {
  return useMemo(
    () => ({
      cushion: { g: box(0.2, 0.07, 0.18, 0, 0.085, 0), m: mat(COLORS.leather, 0.5) },
      back: { g: box(0.2, 0.17, 0.04, 0, 0.19, 0.095), m: mat("#ffffff", 0.5) },
      legs: { g: box(0.11, 0.04, 0.12, 0, 0.145, -0.03), m: mat("#24262e", 0.8) },
      micStem: { g: new THREE.CylinderGeometry(0.004, 0.004, 0.12, 6).rotateX(-0.5).translate(0.06, 0.255, -0.15), m: mat("#2a2a2a", 0.4, 0.6) },
      micHead: { g: new THREE.SphereGeometry(0.012, 8, 6).translate(0.06, 0.31, -0.12), m: mat("#111111", 0.4, 0.3) },
      manTorso: { g: new THREE.CapsuleGeometry(0.056, 0.09, 4, 12).scale(1.14, 1, 1).translate(0, 0.24, 0.02), m: mat("#ffffff", 0.75) },
      womanTorso: { g: new THREE.CapsuleGeometry(0.046, 0.085, 4, 12).translate(0, 0.238, 0.02), m: mat("#ffffff", 0.75) },
      lap: { g: new THREE.CylinderGeometry(0.05, 0.08, 0.1, 14).translate(0, 0.17, 0.0), m: mat("#ffffff", 0.8) },
      samping: { g: new THREE.CylinderGeometry(0.066, 0.068, 0.04, 14).translate(0, 0.19, 0.02), m: mat("#ffffff", 0.6) },
      shirt: { g: box(0.032, 0.07, 0.006, 0, 0.265, -0.043), m: mat("#f4f1ea", 0.6) },
      tie: { g: box(0.012, 0.066, 0.005, 0, 0.255, -0.047), m: mat("#ffffff", 0.5) },
      head: { g: new THREE.SphereGeometry(0.04, 16, 12).translate(0, 0.352, 0.01), m: mat("#ffffff", 0.6) },
      songkok: { g: new THREE.CylinderGeometry(0.038, 0.041, 0.038, 18).translate(0, 0.392, 0.012), m: mat("#121212", 0.45) },
      manHair: { g: new THREE.SphereGeometry(0.042, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.356, 0.014), m: mat("#1a1310", 0.8) },
      womanHair: { g: new THREE.SphereGeometry(0.046, 14, 10).scale(1.05, 1, 1.08).translate(0, 0.352, 0.016), m: mat("#1a1310", 0.8) },
      bun: { g: new THREE.SphereGeometry(0.022, 10, 8).translate(0, 0.37, 0.058), m: mat("#1a1310", 0.8) },
      tudung: { g: new THREE.SphereGeometry(0.048, 14, 10).scale(1, 1.1, 1.02).translate(0, 0.346, 0.018), m: mat("#ffffff", 0.85) },
      drape: { g: new THREE.CylinderGeometry(0.045, 0.078, 0.085, 14).translate(0, 0.29, 0.02), m: mat("#ffffff", 0.85) },
    }),
    [],
  );
}

/** Many copies of one shape, one per sitter, each optionally in its own colour. Pointer events know which sitter. */
function Many({ part, at, colors, solid = true }: { part: { g: THREE.BufferGeometry; m: THREE.Material }; at: Sitter[]; colors?: THREE.Color[]; solid?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    at.forEach((s, k) => {
      o.position.set(...s.pos);
      o.rotation.set(0, s.rot, 0);
      o.scale.setScalar(FIGURE_SCALE);
      o.updateMatrix();
      m.setMatrixAt(k, o.matrix);
      if (colors) m.setColorAt(k, colors[k]);
    });
    m.count = at.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
    m.userData.at = at;
  }, [at, colors]);
  if (!at.length) return null;
  return <instancedMesh key={at.length} ref={ref} args={[part.g, part.m, at.length]} castShadow receiveShadow {...(solid ? {} : { raycast: () => null })} />;
}

/** Every MP in their seat, dressed as they would be: hover for who sits there, click to open the seat. */
export function Figures({ sitters, onOver, onOut, onPick }: { sitters: Sitter[]; onOver: (s: Sitter, e: ThreeEvent<PointerEvent>) => void; onOut: () => void; onPick: (s: Sitter) => void }) {
  const p = useParts();
  const sets = useMemo(() => {
    const by = (f: (s: Sitter) => boolean) => sitters.filter(f);
    const seated = by((s) => s.attire !== null);
    const men = by((s) => s.attire === "melayu" || s.attire === "suit" || s.attire === "suitSongkok" || s.attire === "batik");
    const women = by((s) => s.attire === "kurung" || s.attire === "blazer");
    const suited = by((s) => s.attire === "suit" || s.attire === "suitSongkok");
    const songkok = by((s) => s.attire === "melayu" || s.attire === "suitSongkok");
    const bareMen = by((s) => s.attire === "suit" || s.attire === "batik");
    const kurung = by((s) => s.attire === "kurung");
    const blazer = by((s) => s.attire === "blazer");
    const melayu = by((s) => s.attire === "melayu");
    const manColor = men.map((s) =>
      s.attire === "melayu" ? s.party.clone().lerp(BLACK, 0.35) : s.attire === "batik" ? pickOf(BATIK, s.h, 1) : pickOf(SUIT, s.h, 2),
    );
    const womanColor = women.map((s) => (s.attire === "kurung" ? pickOf(KURUNG, s.h, 3) : pickOf(BLAZER, s.h, 4)));
    return {
      sitters,
      seated,
      men,
      women,
      suited,
      songkok,
      bareMen,
      kurung,
      blazer,
      melayu,
      party: sitters.map((s) => s.party),
      seatedSkin: seated.map((s) => pickOf(SKIN, s.h, 5)),
      manColor,
      womanColor,
      tie: suited.map((s) => s.party),
      samping: melayu.map((s) => s.party.clone().lerp(new THREE.Color("#c9a24a"), 0.35)),
      lap: kurung.map((s) => pickOf(KURUNG, s.h, 3)),
      tudung: kurung.map((s) => pickOf(TUDUNG, s.h, 6)),
      hair: blazer.map(() => HAIR),
    };
  }, [sitters]);
  const hit = (e: ThreeEvent<PointerEvent>) => {
    const at = (e.object.userData.at as Sitter[] | undefined) ?? [];
    return e.instanceId !== undefined ? at[e.instanceId] : undefined;
  };
  return (
    <group
      onPointerMove={(e) => {
        const s = hit(e);
        if (!s) return;
        e.stopPropagation();
        onOver(s, e);
      }}
      onPointerOut={onOut}
      onClick={(e) => {
        const s = hit(e as unknown as ThreeEvent<PointerEvent>);
        if (!s) return;
        e.stopPropagation();
        onPick(s);
      }}
    >
      {/* Seats: green leather, the back in the MP's party colour */}
      <Many part={p.cushion} at={sets.sitters} />
      <Many part={p.back} at={sets.sitters} colors={sets.party} />
      <Many part={p.micStem} at={sets.sitters} solid={false} />
      <Many part={p.micHead} at={sets.sitters} solid={false} />
      {/* The MPs */}
      <Many part={p.legs} at={sets.seated} />
      <Many part={p.manTorso} at={sets.men} colors={sets.manColor} />
      <Many part={p.womanTorso} at={sets.women} colors={sets.womanColor} />
      <Many part={p.head} at={sets.seated} colors={sets.seatedSkin} />
      <Many part={p.shirt} at={sets.suited} solid={false} />
      <Many part={p.tie} at={sets.suited} colors={sets.tie} solid={false} />
      <Many part={p.samping} at={sets.melayu} colors={sets.samping} solid={false} />
      <Many part={p.songkok} at={sets.songkok} solid={false} />
      <Many part={p.manHair} at={sets.bareMen} solid={false} />
      <Many part={p.lap} at={sets.kurung} colors={sets.lap} solid={false} />
      <Many part={p.tudung} at={sets.kurung} colors={sets.tudung} solid={false} />
      <Many part={p.drape} at={sets.kurung} colors={sets.tudung} solid={false} />
      <Many part={p.womanHair} at={sets.blazer} colors={sets.hair} solid={false} />
      <Many part={p.bun} at={sets.blazer} solid={false} />
    </group>
  );
}
