"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clockTexture, crestTexture, flagTexture, songketTexture, teakTexture } from "./textures";

// The room in metres-ish units: the Speaker at the origin facing -z, the benches a half circle of radius SCALE in
// front, each row RISE higher than the one before; the Speaker's end is a rectangle reaching back to BACK_Z.
export const SCALE = 5;
export const R0 = 0.38;
export const RISE = 0.3;
export const BACK_Z = 2.4;
export const WALL_H = 5.6;

export const COLORS = {
  carpet: "#1f5a43",
  leather: "#2f7352",
  teak: "#6e4426",
  teakDark: "#3d2414",
  brass: "#c9a24a",
  plaster: "#e9dfc8",
};

// One brass for the whole room.
let BRASS: THREE.MeshStandardMaterial | null = null;
const brass = () => (BRASS ??= new THREE.MeshStandardMaterial({ color: COLORS.brass, metalness: 0.85, roughness: 0.28, emissive: "#3a2a08", emissiveIntensity: 0.35 }));
const noHit = { raycast: () => null };

export interface RoomDims {
  rows: number;
  /** Outer radius of the benches (the wall). */
  radius: number;
  /** Spacing between rows. */
  gap: number;
  /** Height of the back row. */
  top: number;
}

export function roomDims(rows: number): RoomDims {
  const gap = (SCALE * (1 - R0)) / Math.max(1, rows - 1);
  return { rows, gap, radius: SCALE + gap / 2 + 0.35, top: (rows - 1) * RISE };
}

/** A half ring (the benches' side of the room), lying flat and extruded upwards. */
function halfRing(inner: number, outer: number, depth: number, spread = 0.06) {
  const s = new THREE.Shape();
  s.absarc(0, 0, outer, -spread, Math.PI + spread, false);
  s.absarc(0, 0, inner, Math.PI + spread, -spread, true);
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 72 });
}

/** One tier: carpeted floor up to the row's height, with a teak desk front along its inner edge. */
function Tier({ inner, outer, height }: { inner: number; outer: number; height: number }) {
  const floor = useMemo(() => halfRing(inner, outer, height), [inner, outer, height]);
  const desk = useMemo(() => halfRing(inner - 0.02, inner + 0.12, 0.2), [inner]);
  return (
    <group>
      <mesh geometry={floor} rotation={[-Math.PI / 2, 0, 0]} receiveShadow castShadow {...noHit}>
        <meshStandardMaterial attach="material-0" color={COLORS.carpet} roughness={0.95} />
        <meshStandardMaterial attach="material-1" color={COLORS.teak} roughness={0.55} />
      </mesh>
      {/* The long curved desk the row sits behind */}
      <mesh geometry={desk} rotation={[-Math.PI / 2, 0, 0]} position={[0, height, 0]} castShadow receiveShadow {...noHit}>
        <meshStandardMaterial attach="material-0" color={COLORS.teakDark} roughness={0.35} />
        <meshStandardMaterial attach="material-1" color={COLORS.teak} roughness={0.5} />
      </mesh>
    </group>
  );
}

export function Benches({ d }: { d: RoomDims }) {
  return (
    <>
      {Array.from({ length: d.rows }, (_, row) => {
        const inner = SCALE * (R0 + ((1 - R0) * row) / Math.max(1, d.rows - 1)) - d.gap / 2;
        const outer = row === d.rows - 1 ? d.radius : inner + d.gap;
        return <Tier key={row} inner={inner} outer={outer} height={Math.max(0.02, row * RISE)} />;
      })}
    </>
  );
}

/** Panelled walls: teak below the galleries, plaster with brass pilasters above, round the half circle and the Speaker's end. */
export function Walls({ d }: { d: RoomDims }) {
  const teak = useMemo(() => teakTexture(), []);
  const galleryY = d.top + 1.9;
  const band = (y0: number, y1: number, mat: React.ReactNode) => (
    <mesh position={[0, (y0 + y1) / 2, 0]} receiveShadow {...noHit}>
      <cylinderGeometry args={[d.radius, d.radius, y1 - y0, 120, 1, true, Math.PI / 2, Math.PI]} />
      {mat}
    </mesh>
  );
  return (
    <group>
      {band(0, galleryY, <meshStandardMaterial map={teak} roughness={0.55} side={THREE.BackSide} />)}
      {band(galleryY, WALL_H, <meshStandardMaterial color={COLORS.plaster} roughness={0.85} side={THREE.BackSide} />)}
      {/* Brass pilasters between the gallery and the ceiling */}
      {Array.from({ length: 13 }, (_, k) => {
        const a = (k / 12) * Math.PI;
        return (
          <mesh key={k} position={[Math.cos(a) * (d.radius - 0.04), (galleryY + WALL_H) / 2, -Math.sin(a) * (d.radius - 0.04)]} rotation={[0, Math.atan2(-Math.cos(a), Math.sin(a)), 0]} {...noHit}>
            <boxGeometry args={[0.12, WALL_H - galleryY, 0.05]} />
            <primitive object={brass()} attach="material" />
          </mesh>
        );
      })}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * d.radius, WALL_H / 2, BACK_Z / 2]} rotation={[0, -side * (Math.PI / 2), 0]} receiveShadow {...noHit}>
          <planeGeometry args={[BACK_Z, WALL_H]} />
          <meshStandardMaterial map={teak} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

/** The public galleries: a balcony round the back of the room with a songket-banded front and a brass rail, full of visitors. */
export function Galleries({ d }: { d: RoomDims }) {
  const songket = useMemo(() => songketTexture(), []);
  const y = d.top + 1.9;
  const inner = d.radius - 0.95;
  const slab = useMemo(() => halfRing(inner, d.radius, 0.14, 0.02), [inner, d.radius]);
  const ref = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const visitors = useMemo(() => {
    const out: [number, number, number][] = [];
    for (const [r, h] of [
      [inner + 0.3, 0.14],
      [inner + 0.65, 0.34],
    ] as const)
      for (let k = 0; k < 46; k++) {
        const a = Math.PI * (0.04 + (k / 45) * 0.92);
        if (((k * 7919) % 11) / 11 < 0.15) continue; // the odd empty seat
        out.push([Math.cos(a) * r, y + h, -Math.sin(a) * r]);
      }
    return out;
  }, [inner, y]);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    visitors.forEach((p, k) => {
      o.position.set(p[0], p[1] + 0.2, p[2]);
      o.updateMatrix();
      ref.current?.setMatrixAt(k, o.matrix);
      o.position.set(p[0], p[1] + 0.36, p[2]);
      o.updateMatrix();
      heads.current?.setMatrixAt(k, o.matrix);
    });
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
    if (heads.current) heads.current.instanceMatrix.needsUpdate = true;
  }, [visitors]);
  return (
    <group>
      <mesh geometry={slab} rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} castShadow receiveShadow {...noHit}>
        <meshStandardMaterial attach="material-0" color={COLORS.teakDark} roughness={0.7} />
        <meshStandardMaterial attach="material-1" color={COLORS.teak} roughness={0.6} />
      </mesh>
      {/* The balcony front: songket band, brass rail */}
      <mesh position={[0, y + 0.18, 0]} {...noHit}>
        <cylinderGeometry args={[inner, inner, 0.36, 96, 1, true, Math.PI / 2 + 0.02, Math.PI - 0.04]} />
        <meshStandardMaterial map={songket} roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, y + 0.4, 0]} rotation={[-Math.PI / 2, 0, 0]} {...noHit}>
        <torusGeometry args={[inner, 0.018, 8, 96, Math.PI]} />
        <primitive object={brass()} attach="material" />
      </mesh>
      {/* Visitors: dim silhouettes so they never pull the eye from the floor */}
      <instancedMesh ref={ref} args={[undefined, undefined, visitors.length]} {...noHit}>
        <capsuleGeometry args={[0.05, 0.12, 3, 8]} />
        <meshStandardMaterial color="#2a2f3e" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, visitors.length]} {...noHit}>
        <sphereGeometry args={[0.04, 10, 8]} />
        <meshStandardMaterial color="#4a3a30" roughness={0.9} />
      </instancedMesh>
    </group>
  );
}

/** A stepped, coffered ceiling with gold edges and warm downlights; flat over the Speaker's end. */
export function Ceiling({ d }: { d: RoomDims }) {
  const steps = 5;
  const lights = useMemo(() => {
    const out: [number, number, number][] = [];
    for (let k = 0; k < steps; k++) {
      const r = d.radius * (1 - (k + 0.5) / (steps + 1));
      const n = 9 - k;
      for (let j = 0; j < n; j++) {
        const a = Math.PI * ((j + 0.5) / n);
        out.push([Math.cos(a) * r, WALL_H + k * 0.32 - 0.01, -Math.sin(a) * r]);
      }
    }
    return out;
  }, [d.radius]);
  return (
    <group>
      {Array.from({ length: steps }, (_, k) => {
        const outer = d.radius * (1 - k / (steps + 1));
        const inner = d.radius * (1 - (k + 1) / (steps + 1));
        const y = WALL_H + k * 0.32;
        return (
          <group key={k}>
            <mesh position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} {...noHit}>
              <ringGeometry args={[inner, outer, 96, 1, Math.PI, Math.PI]} />
              <meshStandardMaterial color={k % 2 ? "#d8cbb0" : "#e9dfc8"} roughness={0.9} side={THREE.DoubleSide} />
            </mesh>
            {/* The riser to the next step, edged in gold */}
            <mesh position={[0, y + 0.16, 0]} {...noHit}>
              <cylinderGeometry args={[inner, inner, 0.32, 96, 1, true, Math.PI / 2, Math.PI]} />
              <meshStandardMaterial color="#c8b892" roughness={0.8} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, y + 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} {...noHit}>
              <torusGeometry args={[inner, 0.02, 6, 96, Math.PI]} />
              <primitive object={brass()} attach="material" />
            </mesh>
          </group>
        );
      })}
      {/* The lantern at the top */}
      <mesh position={[0, WALL_H + steps * 0.32 - 0.02, 0]} rotation={[Math.PI / 2, 0, 0]} {...noHit}>
        <circleGeometry args={[d.radius / (steps + 1), 48, Math.PI, Math.PI]} />
        <meshBasicMaterial color="#ffe7b0" toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      {/* Over the Speaker's end */}
      <mesh position={[0, WALL_H, BACK_Z / 2]} rotation={[Math.PI / 2, 0, 0]} {...noHit}>
        <planeGeometry args={[2 * d.radius, BACK_Z]} />
        <meshStandardMaterial color="#e9dfc8" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      {lights.map((p, k) => (
        <mesh key={k} position={p} rotation={[Math.PI / 2, 0, 0]} {...noHit}>
          <circleGeometry args={[0.09, 16]} />
          <meshBasicMaterial color="#fff1cf" toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

/** A seated figure for the Speaker, the clerks and the Serjeant-at-Arms. */
function Official({ pos, rot = 0, robe, wig = false, songkok = true }: { pos: [number, number, number]; rot?: number; robe: string; wig?: boolean; songkok?: boolean }) {
  return (
    <group position={pos} rotation={[0, rot, 0]} scale={1.15}>
      <mesh position={[0, 0.235, 0.02]} castShadow {...noHit}>
        <capsuleGeometry args={[0.058, 0.1, 4, 12]} />
        <meshStandardMaterial color={robe} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.352, 0.01]} castShadow {...noHit}>
        <sphereGeometry args={[0.04, 16, 12]} />
        <meshStandardMaterial color="#b98560" roughness={0.6} />
      </mesh>
      {songkok && (
        <mesh position={[0, 0.39, 0.012]} {...noHit}>
          <cylinderGeometry args={[0.038, 0.041, 0.036, 18]} />
          <meshStandardMaterial color="#121212" roughness={0.5} />
        </mesh>
      )}
      {wig && (
        <mesh position={[0, 0.27, 0.02]} {...noHit}>
          <torusGeometry args={[0.055, 0.012, 6, 18]} />
          <primitive object={brass()} attach="material" />
        </mesh>
      )}
    </group>
  );
}

/** The Speaker's end: the canopied chair under the crest, a clock, flags, and the Clerk's table with the Cokmar. */
export function SpeakersEnd({ d }: { d: RoomDims }) {
  const flag = useMemo(() => flagTexture(), []);
  const crest = useMemo(() => crestTexture(), []);
  const clock = useMemo(() => clockTexture(), []);
  const teak = useMemo(() => teakTexture(), []);
  return (
    <group>
      {/* The back wall */}
      <mesh position={[0, WALL_H / 2, BACK_Z]} rotation={[0, Math.PI, 0]} receiveShadow {...noHit}>
        <planeGeometry args={[2 * d.radius, WALL_H]} />
        <meshStandardMaterial map={teak} roughness={0.6} />
      </mesh>
      {/* The carved backdrop and canopy over the Speaker */}
      <mesh position={[0, 1.9, BACK_Z - 0.08]} castShadow {...noHit}>
        <boxGeometry args={[1.8, 3.8, 0.12]} />
        <meshStandardMaterial color={COLORS.teakDark} roughness={0.45} />
      </mesh>
      {[-0.86, 0.86].map((x) => (
        <mesh key={x} position={[x, 1.9, BACK_Z - 0.15]} {...noHit}>
          <boxGeometry args={[0.08, 3.8, 0.08]} />
          <primitive object={brass()} attach="material" />
        </mesh>
      ))}
      <mesh position={[0, 3.85, BACK_Z - 0.45]} castShadow {...noHit}>
        <boxGeometry args={[2.0, 0.16, 0.9]} />
        <meshStandardMaterial color={COLORS.teakDark} roughness={0.45} />
      </mesh>
      <mesh position={[0, 3.77, BACK_Z - 0.9]} {...noHit}>
        <boxGeometry args={[2.0, 0.05, 0.03]} />
        <primitive object={brass()} attach="material" />
      </mesh>
      <mesh position={[0, 3.0, BACK_Z - 0.15]} rotation={[0, Math.PI, 0]} {...noHit}>
        <circleGeometry args={[0.5, 48]} />
        <meshStandardMaterial map={crest} roughness={0.4} metalness={0.35} />
      </mesh>
      <mesh position={[0, 3.0, BACK_Z - 0.14]} rotation={[0, Math.PI, 0]} {...noHit}>
        <ringGeometry args={[0.5, 0.56, 48]} />
        <primitive object={brass()} attach="material" />
      </mesh>
      {/* The clock, high on the back wall */}
      <mesh position={[0, 4.7, BACK_Z - 0.02]} rotation={[0, Math.PI, 0]} {...noHit}>
        <circleGeometry args={[0.32, 40]} />
        <meshStandardMaterial map={clock} roughness={0.5} />
      </mesh>
      {/* Flags either side */}
      {[-1.35, 1.35].map((x) => (
        <group key={x} position={[x, 0.4, BACK_Z - 0.45]}>
          <mesh position={[0, 1.15, 0]} castShadow {...noHit}>
            <cylinderGeometry args={[0.02, 0.02, 2.3, 10]} />
            <primitive object={brass()} attach="material" />
          </mesh>
          <mesh position={[0, 2.33, 0]} {...noHit}>
            <sphereGeometry args={[0.045, 12, 10]} />
            <primitive object={brass()} attach="material" />
          </mesh>
          <mesh position={[x < 0 ? 0.33 : -0.33, 1.95, 0]} rotation={[0, Math.PI, 0]} {...noHit}>
            <planeGeometry args={[0.64, 0.32, 8, 1]} />
            <meshStandardMaterial map={flag} roughness={0.8} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      {/* The dais and steps */}
      <mesh position={[0, 0.2, 1.55]} castShadow receiveShadow {...noHit}>
        <boxGeometry args={[2.8, 0.4, 1.5]} />
        <meshStandardMaterial color={COLORS.teak} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.1, 0.72]} castShadow receiveShadow {...noHit}>
        <boxGeometry args={[1.8, 0.2, 0.25]} />
        <meshStandardMaterial color={COLORS.teak} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.405, 1.55]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow {...noHit}>
        <planeGeometry args={[2.7, 1.4]} />
        <meshStandardMaterial color={COLORS.carpet} roughness={0.95} />
      </mesh>
      {/* The Speaker's chair: a tall green back crowned in brass */}
      <group position={[0, 0.4, 1.75]}>
        <mesh position={[0, 0.16, 0]} castShadow {...noHit}>
          <boxGeometry args={[0.46, 0.12, 0.4]} />
          <meshStandardMaterial color={COLORS.leather} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.7, 0.2]} castShadow {...noHit}>
          <boxGeometry args={[0.56, 1.2, 0.1]} />
          <meshStandardMaterial color={COLORS.leather} roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.34, 0.2]} castShadow {...noHit}>
          <boxGeometry args={[0.66, 0.12, 0.14]} />
          <primitive object={brass()} attach="material" />
        </mesh>
        <Official pos={[0, 0, -0.02]} robe="#0f1014" wig />
      </group>
      {/* The Clerk's table, with the Cokmar (mace) laid on it, the clerks and the Serjeant-at-Arms */}
      <mesh position={[0, 0.17, -0.35]} castShadow receiveShadow {...noHit}>
        <boxGeometry args={[1.5, 0.34, 0.6]} />
        <meshStandardMaterial color={COLORS.teak} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.345, -0.35]} {...noHit}>
        <boxGeometry args={[1.52, 0.015, 0.62]} />
        <meshStandardMaterial color={COLORS.leather} roughness={0.6} />
      </mesh>
      <group position={[0, 0.39, -0.35]} rotation={[0, 0, Math.PI / 2]}>
        <mesh castShadow {...noHit}>
          <cylinderGeometry args={[0.025, 0.025, 0.95, 14]} />
          <primitive object={brass()} attach="material" />
        </mesh>
        <mesh position={[0, 0.5, 0]} {...noHit}>
          <sphereGeometry args={[0.075, 18, 14]} />
          <primitive object={brass()} attach="material" />
        </mesh>
      </group>
      {[-0.5, 0, 0.5].map((x) => (
        <Official key={x} pos={[x, 0, 0.12]} robe="#16181f" songkok={x === 0} />
      ))}
      <Official pos={[-d.radius + 0.9, 0, 0.9]} rot={Math.PI / 2} robe="#1a1a1a" />
    </group>
  );
}
