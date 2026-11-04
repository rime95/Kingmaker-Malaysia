"use client";

import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { useGame } from "@/store/gameStore";
import type { GameState } from "@/game/state";
import { mpOf } from "@/game/systems/people";
import { coalitionOf } from "@/game/systems/coalitions";
import { marginOf } from "@/game/systems/partyStats";
import { MAJORITY } from "@/game/world";
import type { Geo } from "./hemicycle";
import { seatChamber } from "./chamber/seating";
import { CameraRig, SHOTS, type Shot } from "./chamber/camera";
import { LabelProjector, type Anchor } from "./chamber/Labels";

// The chamber in world units: the half circle of benches has radius SCALE round the origin on the -z side, each row
// RISE higher than the one in front; the Speaker sits at +z, facing the benches.
const SCALE = 5;
const R0 = 0.38;
const RISE = 0.32;
const PLINTH = 0.04;

/** A CSS colour (including `var(--c-PH)`) as a three.js colour. */
function resolve(css: string): THREE.Color {
  const m = css.match(/^var\((--[^)]+)\)$/);
  const v = m ? getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() : css;
  try {
    return new THREE.Color(v || "#8a8f9c");
  } catch {
    return new THREE.Color("#8a8f9c");
  }
}

/** A party's shade, as `partyColor` draws it: the lead party in the coalition colour, partners lighter or darker. */
function partyShade(s: GameState, party: string): THREE.Color {
  const c = coalitionOf(s, party);
  const base = resolve(`var(--c-${c})`);
  const k = s.coalitions[c].members.indexOf(party);
  if (k <= 0) return base;
  const amount = (22 + Math.floor((k - 1) / 2) * 16) / 100;
  return base.lerp(new THREE.Color(k % 2 ? "#ffffff" : "#000000"), amount);
}

type Metric = "flat" | "margin" | "standing";
const METRICS: [Metric, string, string][] = [
  ["flat", "Flat", "Every seat the same height"],
  ["margin", "Safe seats", "Taller blocks won by bigger margins at the last general election"],
  ["standing", "Standing", "Taller blocks for MPs with more standing"],
];

interface Block {
  i: number;
  party: string;
  x: number;
  z: number;
  base: number;
  rot: number;
  /** Angle round the half circle (π = far left of the chart, 0 = far right). */
  a: number;
  row: number;
}

const SHOT_LABELS: [keyof typeof SHOTS | "you", string][] = [
  ["overview", "Overview"],
  ["top", "Top-down"],
  ["government", "Government side"],
  ["opposition", "Opposition side"],
  ["you", "Your seat"],
];

const DIM = new THREE.Color("#1b2436");
const WHITE = new THREE.Color("#ffffff");
const GOLD = new THREE.Color("#e3c27a");

/** The seats: one rounded block per MP, instanced, rising to the chosen metric; the hovered party lifts and glows. */
function Seats({
  blocks,
  width,
  heights,
  colors,
  hotParty,
  selected,
  caps,
  onHot,
  onSelect,
  onFocus,
}: {
  blocks: Block[];
  width: number;
  heights: number[];
  colors: THREE.Color[];
  hotParty: string | null;
  selected: number | null;
  caps: Set<number>;
  onHot: (h: { seat: number; x: number; y: number } | null) => void;
  onSelect: (i: number) => void;
  onFocus: (party: string) => void;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const capMesh = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 2, 0.12).translate(0, 0.5, 0), []);
  const capGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), []);
  const capIdx = useMemo(() => blocks.map((b, k) => (caps.has(b.i) ? k : -1)).filter((k) => k >= 0), [blocks, caps]);
  // Animated state: the current height and lift of each block, easing toward its target.
  const cur = useRef<{ h: number[]; lift: number[] }>({ h: [], lift: [] });
  const dirty = useRef(true);
  useEffect(() => {
    dirty.current = true;
  }, [heights, hotParty, blocks]);

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    blocks.forEach((b, k) => {
      let c = colors[k].clone();
      if (hotParty !== null) c = b.party === hotParty ? c.lerp(WHITE, 0.16) : c.lerp(DIM, 0.72);
      if (b.i === selected) c = c.lerp(GOLD, 0.45);
      m.setColorAt(k, c);
    });
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [blocks, colors, hotParty, selected]);

  const o = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m || !dirty.current) return;
    const k = 1 - Math.pow(0.002, Math.min(dt, 0.05));
    const c = cur.current;
    let moving = false;
    blocks.forEach((b, n) => {
      const th = heights[n];
      const tl = hotParty !== null && b.party === hotParty ? 0.07 : 0;
      c.h[n] = c.h[n] === undefined ? 0.02 : c.h[n] + (th - c.h[n]) * k;
      c.lift[n] = (c.lift[n] ?? 0) + (tl - (c.lift[n] ?? 0)) * k;
      if (Math.abs(th - c.h[n]) > 0.001 || Math.abs(tl - c.lift[n]) > 0.001) moving = true;
      o.position.set(b.x, b.base + c.lift[n], b.z);
      o.rotation.set(0, b.rot, 0);
      o.scale.set(width, c.h[n], width);
      o.updateMatrix();
      m.setMatrixAt(n, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
    const cm = capMesh.current;
    if (cm) {
      capIdx.forEach((n, j) => {
        const b = blocks[n];
        o.position.set(b.x, b.base + c.lift[n] + c.h[n], b.z);
        o.rotation.set(0, b.rot, 0);
        o.scale.set(width * 0.9, 0.022, width * 0.9);
        o.updateMatrix();
        cm.setMatrixAt(j, o.matrix);
      });
      cm.instanceMatrix.needsUpdate = true;
    }
    if (!moving) dirty.current = false;
  });

  const pick = (e: ThreeEvent<PointerEvent | MouseEvent>) => (e.instanceId !== undefined ? blocks[e.instanceId] : undefined);
  return (
    <>
      <instancedMesh
        key={blocks.length}
        ref={mesh}
        args={[geo, undefined, blocks.length]}
        castShadow
        receiveShadow
        onPointerMove={(e) => {
          const b = pick(e);
          if (!b) return;
          e.stopPropagation();
          document.body.style.cursor = "pointer";
          onHot({ seat: b.i, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY });
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
          onHot(null);
        }}
        onClick={(e) => {
          const b = pick(e);
          if (!b || e.delta > 5) return;
          e.stopPropagation();
          onSelect(b.i);
        }}
        onDoubleClick={(e) => {
          const b = pick(e);
          if (b) onFocus(b.party);
        }}
      >
        <meshStandardMaterial roughness={0.42} metalness={0.05} />
      </instancedMesh>
      {capIdx.length > 0 && (
        <instancedMesh key={`cap-${capIdx.length}`} ref={capMesh} args={[capGeo, undefined, capIdx.length]} raycast={() => null}>
          <meshStandardMaterial color="#e3c27a" metalness={0.85} roughness={0.25} emissive="#7a5a1c" emissiveIntensity={0.35} />
        </instancedMesh>
      )}
    </>
  );
}

/** A half ring lifted to `height`: one tier of benches (or the floor's coloured sector). */
function halfRing(inner: number, outer: number, from = 0, to = Math.PI): THREE.Shape {
  const s = new THREE.Shape();
  s.absarc(0, 0, outer, from, to, false);
  s.absarc(0, 0, inner, to, from, true);
  return s;
}

function Tier({ inner, outer, height, shade }: { inner: number; outer: number; height: number; shade: string }) {
  const g = useMemo(() => new THREE.ExtrudeGeometry(halfRing(inner, outer, -0.06, Math.PI + 0.06), { depth: height, bevelEnabled: false, curveSegments: 72 }).rotateX(-Math.PI / 2), [inner, outer, height]);
  return (
    <mesh geometry={g} receiveShadow raycast={() => null}>
      <meshStandardMaterial color={shade} roughness={0.85} />
    </mesh>
  );
}

/** A flat coloured sector on the floor, marking one side of the House. */
function Sector({ inner, outer, from, to, color, opacity }: { inner: number; outer: number; from: number; to: number; color: THREE.Color; opacity: number }) {
  const g = useMemo(() => new THREE.ShapeGeometry(halfRing(inner, outer, from, to), 64).rotateX(-Math.PI / 2), [inner, outer, from, to]);
  return (
    <mesh geometry={g} position={[0, 0.006, 0]} raycast={() => null}>
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

/** A slowly pulsing gold ring round your seat. */
function YouRing({ x, y, z, r }: { x: number; y: number; z: number; r: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const m = ref.current;
    if (!m) return;
    const t = 1 + 0.18 * Math.sin(clock.elapsedTime * 3);
    m.scale.set(t, t, 1);
  });
  return (
    <mesh ref={ref} position={[x, y + 0.01, z]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <ringGeometry args={[r, r * 1.35, 40]} />
      <meshBasicMaterial color="#e3c27a" toneMapped={false} transparent opacity={0.95} />
    </mesh>
  );
}

/** A tall glowing pin over a seat: the Prime Minister, the Opposition Leader. */
function Pin({ x, y, z, color }: { x: number; y: number; z: number; color: string }) {
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.3, 0]} raycast={() => null}>
        <cylinderGeometry args={[0.008, 0.008, 0.6, 6]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.62, 0]} raycast={() => null}>
        <sphereGeometry args={[0.045, 16, 12]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  );
}

interface Props {
  geo: Geo;
  color: (seat: number) => string;
  selected: number | null;
  hotParty: string | null;
  onHot: (h: { seat: number; x: number; y: number } | null) => void;
  onSelect: (i: number) => void;
}

/**
 * The Dewan Rakyat as a 3D seat chart: one block per MP on rising tiers, in party colours, with the government and
 * opposition sides marked on the floor and the 112 line drawn where a majority is reached. Blocks can rise to show safe
 * seats or each MP's standing. Point at a seat to light up its party; double-click to fly to it; click for the seat.
 */
export function Hemicycle3D({ geo, color, selected, hotParty, onHot, onSelect }: Props) {
  const game = useGame((s) => s.game)!;
  const R = (geo.w - 28) / 2;
  const seating = useMemo(() => seatChamber(geo, game), [geo, game]);
  const [metric, setMetric] = useState<Metric>("flat");
  const rows = geo.rows;
  const gap = (SCALE * (1 - R0)) / Math.max(1, rows - 1);
  const rowR = (k: number) => SCALE * (R0 + ((1 - R0) * k) / Math.max(1, rows - 1));
  // Block width: a little under the spacing between seats.
  const width = Math.min(gap * 0.62, ((geo.size / 0.42 / R) * SCALE) * 0.8);

  const blocks: Block[] = useMemo(
    () =>
      seating.spots.map((sp) => {
        const x = ((sp.x - R - 14) / R) * SCALE;
        const z = -((R + 14 - sp.y) / R) * SCALE;
        return { i: sp.i, party: game.holderParties[sp.i], x, z, base: sp.row * RISE + PLINTH, rot: Math.atan2(x, z), a: sp.a, row: sp.row };
      }),
    [seating, R, game],
  );
  const bySeat = useMemo(() => new Map(blocks.map((b, k) => [b.i, k])), [blocks]);

  // Colours: party shades, or the vote when the chart is coloured by the last division.
  const colors = useMemo(() => {
    const coalitionMode = blocks.every((b) => /^var\(--c-/.test(color(b.i)));
    return blocks.map((b) => (coalitionMode ? partyShade(game, b.party) : resolve(color(b.i))));
  }, [blocks, color, game]);

  const heights = useMemo(
    () =>
      blocks.map((b) => {
        if (metric === "margin") return 0.06 + Math.min(1, marginOf(game, b.i) / 0.4) * 0.95;
        if (metric === "standing") return 0.06 + ((mpOf(game, b.i)?.influence ?? 25) / 100) * 0.95;
        return 0.13;
      }),
    [blocks, metric, game],
  );

  // The front benches: the cabinet wears a brass cap; the PM and the Opposition Leader get pins.
  const caps = useMemo(() => {
    const ids = new Set(Object.values(game.cabinet).filter((v): v is number => v !== undefined));
    return new Set(game.people.filter((p) => p.seat !== null && ids.has(p.id)).map((p) => p.seat!));
  }, [game]);
  const topOf = (i: number) => {
    const k = bySeat.get(i);
    return k === undefined ? null : { b: blocks[k], y: blocks[k].base + heights[k] };
  };
  const pm = seating.pm !== null ? topOf(seating.pm) : null;
  const opp = seating.oppLeader !== null ? topOf(seating.oppLeader) : null;
  const you = game.youId !== null ? game.people.find((p) => p.id === game.youId) : undefined;
  const mine = you?.seat != null ? topOf(you.seat) : null;

  // The sides of the House, on the floor.
  const govAngles = blocks.filter((b) => game.government.includes(game.holders[b.i])).map((b) => b.a);
  const govFrom = govAngles.length ? Math.min(...govAngles) : Math.PI;
  const inner = rowR(0) - gap / 2 - 0.25;
  const outer = rowR(rows - 1) + gap / 2 + 0.45;
  const govColor = useMemo(() => resolve(`var(--c-${game.parliament.pm})`), [game.parliament.pm]);
  // The 112 line: between the 112th and 113th seats counted from the government end.
  const byAngle = [...blocks].sort((p, q) => q.a - p.a);
  const line = byAngle.length > MAJORITY ? (byAngle[MAJORITY - 1].a + byAngle[MAJORITY].a) / 2 : null;

  // Labels: each party over the middle of its seats; the Speaker; the PM and Opposition Leader; you; the 112 line.
  const partyAnchors = useMemo(() => {
    const groups = new Map<string, Block[]>();
    for (const b of blocks) groups.set(b.party, [...(groups.get(b.party) ?? []), b]);
    return [...groups].map(([party, bs]) => {
      const ax = bs.reduce((s, b) => s + b.x, 0) / bs.length;
      const az = bs.reduce((s, b) => s + b.z, 0) / bs.length;
      const top = Math.max(...bs.map((b) => b.base)) + 0.5;
      return { party, n: bs.length, pos: new THREE.Vector3(ax, top + (metric === "flat" ? 0.1 : 0.9), az) };
    });
  }, [blocks, metric]);
  const anchors: Anchor[] = useMemo(() => {
    const out: Anchor[] = partyAnchors.map((p) => ({ id: `p-${p.party}`, pos: p.pos }));
    out.push({ id: "speaker", pos: new THREE.Vector3(0, 0.75, 1.05) });
    // Their pins stand side by side at the centre: the PM's label goes to the government's side, the Opposition Leader's to the other.
    if (pm) out.push({ id: "pm", pos: new THREE.Vector3(pm.b.x, pm.y + 0.66, pm.b.z), align: "left" });
    if (opp) out.push({ id: "opp", pos: new THREE.Vector3(opp.b.x, opp.y + 0.66, opp.b.z), align: "right" });
    if (mine) out.push({ id: "you", pos: new THREE.Vector3(mine.b.x, mine.y + 0.3, mine.b.z) });
    if (line !== null) out.push({ id: "line", pos: new THREE.Vector3(Math.cos(line) * (outer + 0.1), rows * RISE + 0.75, -Math.sin(line) * (outer + 0.1)) });
    return out;
  }, [partyAnchors, pm, opp, mine, line, outer, rows]);
  const els = useRef<Record<string, HTMLElement | null>>({});

  // Camera shots: the fly-in lands on the overview.
  const [shot, setShot] = useState<{ s: Shot; n: number; key: string }>({ s: SHOTS.overview, n: 0, key: "overview" });
  const [orbit, setOrbit] = useState(false);
  const go = (key: keyof typeof SHOTS | "you") => {
    setOrbit(false);
    if (key === "you") {
      if (!mine) return;
      const { x, z } = mine.b;
      setShot((v) => ({ s: { pos: [x * 0.25, mine.y + 2.4, z * 0.25 + 1.6], target: [x, mine.y, z] }, n: v.n + 1, key }));
    } else setShot((v) => ({ s: SHOTS[key], n: v.n + 1, key }));
  };
  const focus = (party: string) => {
    const p = partyAnchors.find((a) => a.party === party);
    if (!p) return;
    setOrbit(false);
    setShot((v) => ({ s: { pos: [p.pos.x * 0.3, 3.4, p.pos.z * 0.3 + 2.2], target: [p.pos.x, 0.3, p.pos.z] }, n: v.n + 1, key: `party-${party}` }));
  };
  const touched = useCallback(() => setOrbit((o) => o && false), []);
  useEffect(() => () => void (document.body.style.cursor = ""), []);

  const nameOf = (i: number) => mpOf(game, i)?.name ?? "";
  const dimmed = (id: string) => hotParty !== null && id !== `p-${hotParty}`;

  return (
    <div className="relative h-[520px] rounded-xl overflow-hidden select-none" style={{ background: "radial-gradient(120% 90% at 50% 15%, #1d2c4c 0%, #0b1322 55%, #060a13 100%)" }}>
      <Canvas
        shadows="soft"
        dpr={[1, 2]}
        camera={{ position: [0, 15, 9], fov: 42 }}
        gl={{ alpha: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
        onPointerMissed={() => onHot(null)}
      >
        <hemisphereLight args={["#e9efff", "#0a1222", 1.05]} />
        <ambientLight intensity={0.25} />
        <directionalLight position={[5, 12, 7]} intensity={1.7} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-radius={5}>
          <orthographicCamera attach="shadow-camera" args={[-9, 9, 9, -9, 0.5, 30]} />
        </directionalLight>
        <pointLight position={[0, 2.2, 1.4]} intensity={4} distance={5} color="#ffd9a0" />
        <CameraRig shot={shot.s} nonce={shot.n} orbit={orbit} onTouched={touched} />

        {/* The floor, its two sides tinted, and the tiers */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -0.6]} receiveShadow raycast={() => null}>
          <circleGeometry args={[SCALE + 2.4, 96]} />
          <meshStandardMaterial color="#0e1729" roughness={0.95} />
        </mesh>
        {[1.6, SCALE + 1.2, SCALE + 2.2].map((r) => (
          <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]} raycast={() => null}>
            <ringGeometry args={[r, r + 0.012, 128, 1, 0, Math.PI]} />
            <meshBasicMaterial color="#e3c27a" transparent opacity={0.22} />
          </mesh>
        ))}
        <Sector inner={inner} outer={outer} from={govFrom - 0.02} to={Math.PI + 0.06} color={govColor} opacity={0.2} />
        <Sector inner={inner} outer={outer} from={-0.06} to={govFrom - 0.02} color={new THREE.Color("#5a6a88")} opacity={0.12} />
        {Array.from({ length: rows }, (_, k) => (
          <Tier key={k} inner={rowR(k) - gap / 2} outer={rowR(k) + gap / 2} height={k * RISE + PLINTH} shade={k % 2 ? "#1a2843" : "#16233b"} />
        ))}

        {/* The Speaker's chair and the Clerk's table */}
        <mesh position={[0, 0.22, 1.05]} castShadow receiveShadow raycast={() => null}>
          <boxGeometry args={[1.1, 0.44, 0.45]} />
          <meshStandardMaterial color="#22314f" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.445, 1.05]} raycast={() => null}>
          <boxGeometry args={[1.12, 0.012, 0.47]} />
          <meshStandardMaterial color="#e3c27a" metalness={0.8} roughness={0.3} emissive="#7a5a1c" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[0, 0.1, 0.25]} castShadow receiveShadow raycast={() => null}>
          <boxGeometry args={[0.9, 0.2, 0.32]} />
          <meshStandardMaterial color="#1c2a45" roughness={0.6} />
        </mesh>

        {/* The 112 line */}
        {line !== null && (
          <mesh position={[Math.cos(line) * ((inner + outer) / 2), (rows * RISE + 0.6) / 2, -Math.sin(line) * ((inner + outer) / 2)]} rotation={[0, line, 0]} raycast={() => null}>
            <boxGeometry args={[outer - inner + 0.2, rows * RISE + 0.6, 0.012]} />
            <meshBasicMaterial color="#e3c27a" transparent opacity={0.16} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
        )}

        <Seats blocks={blocks} width={width} heights={heights} colors={colors} hotParty={hotParty} selected={selected} caps={caps} onHot={onHot} onSelect={onSelect} onFocus={focus} />
        {pm && <Pin x={pm.b.x} y={pm.y} z={pm.b.z} color="#ffe39a" />}
        {opp && <Pin x={opp.b.x} y={opp.y} z={opp.b.z} color="#cfd8ea" />}
        {mine && <YouRing x={mine.b.x} y={mine.b.base} z={mine.b.z} r={width * 0.9} />}
        <LabelProjector anchors={anchors} els={els} />
      </Canvas>

      {/* Labels that follow the chamber */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {partyAnchors.map((p) => (
          <div
            key={p.party}
            ref={(el) => void (els.current[`p-${p.party}`] = el)}
            className="absolute left-0 top-0 whitespace-nowrap text-[11px] font-semibold px-1.5 py-0.5 rounded"
            style={{
              background: "rgb(6 10 19 / 0.72)",
              color: "#eef1f8",
              border: hotParty === p.party ? "1px solid #e3c27a" : "1px solid rgb(255 255 255 / 0.12)",
              opacity: dimmed(`p-${p.party}`) ? 0.2 : p.n < 3 && hotParty !== p.party ? 0 : 1,
              transition: "opacity 0.2s",
            }}
          >
            {p.party} <span style={{ color: "#c9b892" }}>{p.n}</span>
          </div>
        ))}
        <div ref={(el) => void (els.current.speaker = el)} className="absolute left-0 top-0 text-[10px] uppercase tracking-[0.2em]" style={{ color: "#c9b892" }}>
          Speaker
        </div>
        {pm && (
          <div ref={(el) => void (els.current.pm = el)} className="absolute left-0 top-0 whitespace-nowrap text-[11px] px-1.5 py-0.5 rounded" style={{ background: "rgb(60 44 10 / 0.85)", color: "#ffe39a", border: "1px solid #e3c27a" }}>
            Prime Minister · {nameOf(pm.b.i)}
          </div>
        )}
        {opp && (
          <div ref={(el) => void (els.current.opp = el)} className="absolute left-0 top-0 whitespace-nowrap text-[11px] px-1.5 py-0.5 rounded" style={{ background: "rgb(20 28 44 / 0.88)", color: "#dfe6f5", border: "1px solid rgb(255 255 255 / 0.3)" }}>
            Opposition Leader · {nameOf(opp.b.i)}
          </div>
        )}
        {mine && (
          <div ref={(el) => void (els.current.you = el)} className="absolute left-0 top-0 text-[10px] font-bold px-1 rounded" style={{ background: "#e3c27a", color: "#1b1405" }}>
            YOU
          </div>
        )}
        {line !== null && (
          <div ref={(el) => void (els.current.line = el)} className="absolute left-0 top-0 whitespace-nowrap text-[10px] font-semibold" style={{ color: "#e3c27a" }}>
            {MAJORITY} · majority
          </div>
        )}
      </div>

      <div className="absolute top-2 left-2 right-2 flex flex-wrap gap-1.5 items-center">
        {SHOT_LABELS.map(([k, label]) =>
          k === "you" && !mine ? null : (
            <button key={k} className="chip chip-glass !py-1 !text-[11px]" aria-pressed={!orbit && shot.key === k} onClick={() => go(k)}>
              {label}
            </button>
          ),
        )}
        <button className="chip chip-glass !py-1 !text-[11px]" aria-pressed={orbit} onClick={() => setOrbit((o) => !o)}>
          {orbit ? "Stop turning" : "Slow orbit"}
        </button>
        <span className="ml-auto inline-flex gap-1 items-center text-[11px]" style={{ color: "#c9b892" }}>
          Height
          {METRICS.map(([m, label, hint]) => (
            <button key={m} className="chip chip-glass !py-1 !text-[11px]" aria-pressed={metric === m} title={hint} onClick={() => setMetric(m)}>
              {label}
            </button>
          ))}
        </span>
      </div>
      <div className="absolute bottom-2 left-3 right-3 text-[11px] flex flex-wrap gap-x-4" style={{ color: "#9aa6bf" }}>
        <span>Drag to orbit · scroll to zoom · right-drag to pan · double-click a party to fly to it</span>
        <span className="ml-auto">
          <span style={{ color: "#e3c27a" }}>▬</span> brass caps: the cabinet
        </span>
      </div>
    </div>
  );
}
