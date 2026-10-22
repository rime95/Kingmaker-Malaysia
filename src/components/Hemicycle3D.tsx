"use client";

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Geo } from "./Dewan";

// The chamber is laid out in metres-ish units: the Speaker at the origin facing -z, the benches a half circle of radius
// SCALE in front, each row RISE higher than the one before.
const SCALE = 5;
const RISE = 0.22;
const WALL_H = 3.2;
const BACK_Z = 2.1;

const WOOD = "#6b4426";
const WOOD_DARK = "#3f2716";
const CARPET = "#1c4a3a";
const LEATHER = "#2d6b4b";
const GOLD = "#d9ad48";
const SKIN = ["#c99872", "#a8744f", "#e0b48c", "#8a5a3b"].map((c) => new THREE.Color(c));
const TUDUNG = ["#e9d7e8", "#c9def0", "#f2e3c4", "#d3ecd8", "#f0c9cf", "#3b3f58"].map((c) => new THREE.Color(c));

/** A CSS colour (including `var(--c-PH)`) as a three.js colour. */
function resolve(css: string): THREE.Color {
  const m = css.match(/^var\((--[^)]+)\)$/);
  const v = m ? getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() : css;
  return new THREE.Color(v || "#8a8f9c");
}

/** A small stable hash, for who wears a songkok or a tudung. */
const pick = (i: number, salt: number) => (((i + 1) * 2654435761 + salt * 40503) >>> 0) % 1000;

/** Drag to orbit, scroll or pinch to zoom, right-drag to pan. */
function Controls() {
  const { camera, gl } = useThree();
  const ref = useRef<OrbitControls | null>(null);
  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement);
    c.enableDamping = true;
    c.target.set(0, 0.5, -2.7);
    c.minDistance = 2.5;
    c.maxDistance = 12;
    c.maxPolarAngle = Math.PI * 0.46;
    c.update();
    ref.current = c;
    return () => c.dispose();
  }, [camera, gl]);
  useFrame(() => ref.current?.update());
  return null;
}

interface Props {
  geo: Geo;
  color: (seat: number) => string;
  selected: number | null;
  onHover: (h: { i: number; x: number; y: number } | null) => void;
  onSelect: (i: number) => void;
}

interface Spot {
  i: number;
  pos: [number, number, number];
  rot: number;
}

/** Many copies of one mesh, one per spot, optionally coloured one by one. */
function Instances({ geometry, material, at, colors, solid = true }: { geometry: THREE.BufferGeometry; material: THREE.Material; at: Spot[]; colors?: THREE.Color[]; solid?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    at.forEach((s, k) => {
      o.position.set(...s.pos);
      o.rotation.set(0, s.rot, 0);
      o.updateMatrix();
      m.setMatrixAt(k, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [at]);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m || !colors) return;
    colors.forEach((c, k) => m.setColorAt(k, c));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [colors, at]);
  return <instancedMesh ref={ref} args={[geometry, material, at.length]} castShadow receiveShadow {...(solid ? {} : { raycast: () => null })} />;
}

const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

/** The parts of a seat and its MP, built once and shared by every instance. Local -z faces the Speaker. */
function useParts() {
  return useMemo(() => {
    const mat = (color: string, roughness = 0.7, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
    return {
      cushion: { g: box(0.2, 0.07, 0.18, 0, 0.085, 0), m: mat(LEATHER, 0.55) },
      back: { g: box(0.2, 0.24, 0.045, 0, 0.21, 0.085), m: mat("#ffffff", 0.55) },
      desk: { g: box(0.22, 0.15, 0.07, 0, 0.075, -0.17), m: mat(WOOD, 0.5) },
      deskTop: { g: box(0.24, 0.02, 0.1, 0, 0.16, -0.17), m: mat(WOOD_DARK, 0.4) },
      legs: { g: box(0.11, 0.04, 0.12, 0, 0.14, -0.03), m: mat("#24262e", 0.8) },
      torso: { g: new THREE.CapsuleGeometry(0.052, 0.09, 4, 10).translate(0, 0.235, 0.02), m: mat("#ffffff", 0.75) },
      head: { g: new THREE.SphereGeometry(0.04, 14, 10).translate(0, 0.345, 0.01), m: mat("#ffffff", 0.6) },
      songkok: { g: new THREE.CylinderGeometry(0.038, 0.041, 0.036, 16).translate(0, 0.385, 0.012), m: mat("#141414", 0.5) },
      tudung: { g: new THREE.SphereGeometry(0.047, 14, 10).scale(1, 1.08, 1).translate(0, 0.34, 0.018), m: mat("#ffffff", 0.8) },
      drape: { g: new THREE.CylinderGeometry(0.044, 0.07, 0.07, 14).translate(0, 0.285, 0.02), m: mat("#ffffff", 0.8) },
    };
  }, []);
}

/** One tier of benches: a half ring of floor from the room's floor up to the row's height, carpeted on top. */
function Tier({ inner, outer, height }: { inner: number; outer: number; height: number }) {
  const geometry = useMemo(() => {
    const s = new THREE.Shape();
    s.absarc(0, 0, outer, -0.06, Math.PI + 0.06, false);
    s.absarc(0, 0, inner, Math.PI + 0.06, -0.06, true);
    return new THREE.ExtrudeGeometry(s, { depth: height, bevelEnabled: false, curveSegments: 64 });
  }, [inner, outer, height]);
  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow castShadow raycast={() => null}>
      <meshStandardMaterial attach="material-0" color={CARPET} roughness={0.95} />
      <meshStandardMaterial attach="material-1" color={WOOD} roughness={0.55} />
    </mesh>
  );
}

/** The Jalur Gemilang, drawn on a canvas. */
function useFlag() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 280;
    c.height = 140;
    const g = c.getContext("2d")!;
    for (let k = 0; k < 14; k++) {
      g.fillStyle = k % 2 ? "#ffffff" : "#cc0001";
      g.fillRect(0, k * 10, 280, 10);
    }
    g.fillStyle = "#010066";
    g.fillRect(0, 0, 140, 80);
    g.fillStyle = "#ffcc00";
    g.beginPath();
    g.arc(50, 40, 27, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#010066";
    g.beginPath();
    g.arc(58, 40, 23, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#ffcc00";
    g.beginPath();
    for (let k = 0; k < 28; k++) {
      const r = k % 2 ? 9 : 22;
      const a = (k * Math.PI) / 14 - Math.PI / 2;
      g.lineTo(100 + r * Math.cos(a), 40 + r * Math.sin(a));
    }
    g.closePath();
    g.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
}

/** A crest above the Speaker's chair, in the spirit of the Jata Negara: a shield under a crescent and star. */
function useCrest() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d")!;
    g.fillStyle = "#d9ad48";
    g.beginPath();
    g.arc(128, 128, 124, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#8a6420";
    g.lineWidth = 6;
    g.stroke();
    // Shield
    g.save();
    g.beginPath();
    g.moveTo(78, 100);
    g.lineTo(178, 100);
    g.lineTo(178, 170);
    g.quadraticCurveTo(128, 215, 78, 170);
    g.closePath();
    g.clip();
    ["#cc0001", "#ffffff", "#010066", "#ffcc00", "#cc0001"].forEach((col, k) => {
      g.fillStyle = col;
      g.fillRect(78 + k * 20, 100, 20, 120);
    });
    g.restore();
    // Crescent and star
    g.fillStyle = "#ffcc00";
    g.beginPath();
    g.arc(112, 62, 26, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#d9ad48";
    g.beginPath();
    g.arc(120, 58, 23, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#ffcc00";
    g.beginPath();
    for (let k = 0; k < 28; k++) {
      const r = k % 2 ? 7 : 17;
      const a = (k * Math.PI) / 14 - Math.PI / 2;
      g.lineTo(150 + r * Math.cos(a), 62 + r * Math.sin(a));
    }
    g.closePath();
    g.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
}

/** A seated figure for the Speaker and the clerks. */
function Figure({ pos, rot = 0, robe, hat = true }: { pos: [number, number, number]; rot?: number; robe: string; hat?: boolean }) {
  return (
    <group position={pos} rotation={[0, rot, 0]} scale={1.15}>
      <mesh position={[0, 0.235, 0.02]} castShadow>
        <capsuleGeometry args={[0.055, 0.1, 4, 10]} />
        <meshStandardMaterial color={robe} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.35, 0.01]} castShadow>
        <sphereGeometry args={[0.04, 14, 10]} />
        <meshStandardMaterial color="#b98560" roughness={0.6} />
      </mesh>
      {hat && (
        <mesh position={[0, 0.39, 0.012]}>
          <cylinderGeometry args={[0.038, 0.041, 0.036, 16]} />
          <meshStandardMaterial color="#141414" roughness={0.5} />
        </mesh>
      )}
    </group>
  );
}

/** The front of the House: the Speaker's dais and chair under the crest, flags, and the Clerk's table with the mace. */
function Dais() {
  const flag = useFlag();
  const crest = useCrest();
  return (
    <group>
      {/* The wall behind the Speaker: wood panels with gold pilasters */}
      <mesh position={[0, WALL_H / 2, BACK_Z]} rotation={[0, Math.PI, 0]} receiveShadow raycast={() => null}>
        <planeGeometry args={[2 * (SCALE + 0.6), WALL_H]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={0.6} />
      </mesh>
      {[-2.4, -1.2, 1.2, 2.4].map((x) => (
        <mesh key={x} position={[x, WALL_H / 2, BACK_Z - 0.01]} rotation={[0, Math.PI, 0]} raycast={() => null}>
          <planeGeometry args={[0.12, WALL_H]} />
          <meshStandardMaterial color={GOLD} metalness={0.6} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[0, 2.35, BACK_Z - 0.05]} rotation={[0, Math.PI, 0]} raycast={() => null}>
        <circleGeometry args={[0.45, 48]} />
        <meshStandardMaterial map={crest} roughness={0.4} metalness={0.3} />
      </mesh>
      {[-1.75, 1.75].map((x) => (
        <group key={x} position={[x, 0, BACK_Z - 0.3]}>
          <mesh position={[0, 1.1, 0]} castShadow raycast={() => null}>
            <cylinderGeometry args={[0.02, 0.02, 2.2, 8]} />
            <meshStandardMaterial color={GOLD} metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[x < 0 ? 0.36 : -0.36, 1.8, 0]} rotation={[0, Math.PI, 0]} raycast={() => null}>
            <planeGeometry args={[0.7, 0.35]} />
            <meshStandardMaterial map={flag} roughness={0.8} />
          </mesh>
        </group>
      ))}
      {/* The dais and its steps */}
      <mesh position={[0, 0.2, 1.35]} castShadow receiveShadow raycast={() => null}>
        <boxGeometry args={[2.6, 0.4, 1.3]} />
        <meshStandardMaterial color={WOOD} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.1, 0.6]} castShadow receiveShadow raycast={() => null}>
        <boxGeometry args={[1.6, 0.2, 0.25]} />
        <meshStandardMaterial color={WOOD} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.405, 1.35]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow raycast={() => null}>
        <planeGeometry args={[2.5, 1.2]} />
        <meshStandardMaterial color={CARPET} roughness={0.95} />
      </mesh>
      {/* The Speaker's chair: a tall back topped in gold */}
      <group position={[0, 0.4, 1.5]}>
        <mesh position={[0, 0.16, 0]} castShadow raycast={() => null}>
          <boxGeometry args={[0.42, 0.12, 0.38]} />
          <meshStandardMaterial color={LEATHER} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.6, 0.2]} castShadow raycast={() => null}>
          <boxGeometry args={[0.5, 1.0, 0.08]} />
          <meshStandardMaterial color={LEATHER} roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.15, 0.2]} castShadow raycast={() => null}>
          <boxGeometry args={[0.6, 0.14, 0.12]} />
          <meshStandardMaterial color={GOLD} metalness={0.7} roughness={0.3} />
        </mesh>
        <Figure pos={[0, 0, -0.02]} rot={0} robe="#111216" />
      </group>
      {/* The Clerk's table, with the mace (the Cokmar) laid on it */}
      <mesh position={[0, 0.17, -0.45]} castShadow receiveShadow raycast={() => null}>
        <boxGeometry args={[1.3, 0.34, 0.55]} />
        <meshStandardMaterial color={WOOD} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.345, -0.45]} raycast={() => null}>
        <boxGeometry args={[1.32, 0.015, 0.57]} />
        <meshStandardMaterial color={LEATHER} roughness={0.6} />
      </mesh>
      <group position={[0, 0.39, -0.45]} rotation={[0, 0, Math.PI / 2]}>
        <mesh castShadow raycast={() => null}>
          <cylinderGeometry args={[0.025, 0.025, 0.9, 12]} />
          <meshStandardMaterial color={GOLD} metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.48, 0]} raycast={() => null}>
          <sphereGeometry args={[0.07, 16, 12]} />
          <meshStandardMaterial color={GOLD} metalness={0.9} roughness={0.2} />
        </mesh>
      </group>
      {[-0.4, 0.4].map((x) => (
        <Figure key={x} pos={[x, 0, 0.05]} rot={0} robe="#1a1c24" hat={false} />
      ))}
    </group>
  );
}

/** The walls: a curved, panelled wall closing the back of the benches, and side walls to the Speaker's end. */
function Walls({ radius }: { radius: number }) {
  const band = (y0: number, y1: number, color: string, metal = 0) => (
    <mesh position={[0, (y0 + y1) / 2, 0]} receiveShadow raycast={() => null}>
      <cylinderGeometry args={[radius, radius, y1 - y0, 96, 1, true, Math.PI / 2, Math.PI]} />
      <meshStandardMaterial color={color} roughness={0.6} metalness={metal} side={THREE.BackSide} />
    </mesh>
  );
  return (
    <group>
      {band(0, 2.0, WOOD)}
      {band(2.0, 2.08, GOLD, 0.6)}
      {band(2.08, WALL_H, "#e8dcc2")}
      {band(WALL_H - 0.08, WALL_H, GOLD, 0.6)}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * radius, WALL_H / 2, BACK_Z / 2]} rotation={[0, -side * (Math.PI / 2), 0]} receiveShadow raycast={() => null}>
          <planeGeometry args={[BACK_Z, WALL_H]} />
          <meshStandardMaterial color={WOOD} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

/** The chamber in 3D: tiered benches in a half circle with every MP in their seat, the Speaker's dais and the Clerk's table. */
export function Hemicycle3D({ geo, color, selected, onHover, onSelect }: Props) {
  const R = (geo.w - 28) / 2;
  const parts = useParts();
  const [hot, setHot] = useState<number | null>(null);

  const seats: Spot[] = useMemo(
    () =>
      geo.dots.map((d) => {
        // The flat chart mapped into the room: benches rising row by row, every seat facing the Speaker.
        const x = ((d.x - R - 14) / R) * SCALE;
        const z = -((R + 14 - d.y) / R) * SCALE;
        return { i: d.seatIndex, pos: [x, d.row * RISE, z] as [number, number, number], rot: Math.atan2(x, z) };
      }),
    [geo, R],
  );
  const gap = (SCALE * (1 - 0.38)) / Math.max(1, geo.rows - 1);
  const radius = SCALE + gap / 2 + 0.25;

  // Who wears what: about half the men in songkok, one MP in five in a tudung.
  const tudung = useMemo(() => seats.filter((s) => pick(s.i, 1) < 200), [seats]);
  const songkok = useMemo(() => seats.filter((s) => pick(s.i, 1) >= 200 && pick(s.i, 2) < 550), [seats]);

  const party = useMemo(() => seats.map((s) => resolve(color(s.i))), [seats, color]);
  const skin = useMemo(() => seats.map((s) => SKIN[pick(s.i, 3) % SKIN.length]), [seats]);
  const scarf = useMemo(() => tudung.map((s) => TUDUNG[pick(s.i, 4) % TUDUNG.length]), [tudung]);

  const over = (e: ThreeEvent<PointerEvent>) => {
    if (e.instanceId === undefined) return;
    e.stopPropagation();
    const s = seats[e.instanceId];
    if (!s) return;
    setHot(s.i);
    document.body.style.cursor = "pointer";
    onHover({ i: s.i, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY });
  };
  const out = () => {
    setHot(null);
    document.body.style.cursor = "";
    onHover(null);
  };
  useEffect(() => () => void (document.body.style.cursor = ""), []);

  const marks = [hot, selected].filter((v, k, a): v is number => v !== null && a.indexOf(v) === k);

  return (
    <div className="relative h-[440px] rounded-xl overflow-hidden" style={{ background: "#0d1220" }}>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 3.5, 1.7], fov: 50 }} onPointerMissed={out}>
        <color attach="background" args={["#0d1220"]} />
        <fog attach="fog" args={["#0d1220", 12, 22]} />
        <hemisphereLight args={["#fff4dc", "#2a2014", 0.9]} />
        <directionalLight position={[3, 9, 4]} intensity={1.4} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004}>
          <orthographicCamera attach="shadow-camera" args={[-7, 7, 7, -7, 0.5, 25]} />
        </directionalLight>
        <pointLight position={[0, 3, -2.5]} intensity={8} distance={10} color="#ffd9a0" />
        <pointLight position={[0, 2.6, 1.2]} intensity={4} distance={5} color="#ffe6bf" />
        <Controls />

        {/* The floor of the House, with a gold border round the well */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow raycast={() => null}>
          <circleGeometry args={[radius + 0.5, 96]} />
          <meshStandardMaterial color={CARPET} roughness={1} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, BACK_Z / 2]} receiveShadow raycast={() => null}>
          <planeGeometry args={[2 * radius, BACK_Z]} />
          <meshStandardMaterial color={CARPET} roughness={1} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]} raycast={() => null}>
          <ringGeometry args={[SCALE * 0.38 - gap / 2 - 0.06, SCALE * 0.38 - gap / 2 - 0.02, 96, 1, 0, Math.PI]} />
          <meshStandardMaterial color={GOLD} metalness={0.6} roughness={0.35} side={THREE.DoubleSide} />
        </mesh>

        {Array.from({ length: geo.rows - 1 }, (_, k) => {
          const row = k + 1;
          const inner = SCALE * (0.38 + ((1 - 0.38) * row) / (geo.rows - 1)) - gap / 2;
          const outer = row === geo.rows - 1 ? radius : inner + gap;
          return <Tier key={row} inner={inner} outer={outer} height={row * RISE} />;
        })}
        <Walls radius={radius} />
        <Dais />

        {/* Every seat and its MP: hover for who sits there, click to open the seat */}
        <group onPointerMove={over} onPointerOut={out} onClick={(e) => e.instanceId !== undefined && seats[e.instanceId] && (e.stopPropagation(), onSelect(seats[e.instanceId].i))}>
          <Instances geometry={parts.cushion.g} material={parts.cushion.m} at={seats} />
          <Instances geometry={parts.back.g} material={parts.back.m} at={seats} colors={party} />
          <Instances geometry={parts.desk.g} material={parts.desk.m} at={seats} />
          <Instances geometry={parts.deskTop.g} material={parts.deskTop.m} at={seats} />
          <Instances geometry={parts.legs.g} material={parts.legs.m} at={seats} />
          <Instances geometry={parts.torso.g} material={parts.torso.m} at={seats} colors={party} />
          <Instances geometry={parts.head.g} material={parts.head.m} at={seats} colors={skin} />
        </group>
        <Instances geometry={parts.songkok.g} material={parts.songkok.m} at={songkok} solid={false} />
        <Instances geometry={parts.tudung.g} material={parts.tudung.m} at={tudung} colors={scarf} solid={false} />
        <Instances geometry={parts.drape.g} material={parts.drape.m} at={tudung} colors={scarf} solid={false} />

        {/* A glowing ring under the seat you're pointing at, and the one you picked */}
        {marks.map((i) => {
          const s = seats.find((x) => x.i === i);
          if (!s) return null;
          return (
            <group key={i} position={[s.pos[0], s.pos[1] + 0.012, s.pos[2]]}>
              <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
                <ringGeometry args={[0.13, 0.17, 32]} />
                <meshBasicMaterial color={i === selected ? "#ffd166" : "#ffffff"} toneMapped={false} />
              </mesh>
            </group>
          );
        })}
      </Canvas>
      <div className="absolute bottom-2 left-3 text-[11px]" style={{ color: "#9aa3b8" }}>
        Drag to orbit · scroll to zoom · right-drag to pan
      </div>
    </div>
  );
}
