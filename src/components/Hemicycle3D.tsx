"use client";

import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useGame } from "@/store/gameStore";
import { mpOf } from "@/game/systems/people";
import { attireOf } from "@/game/systems/gender";
import type { Geo } from "./Dewan";
import { Benches, Ceiling, Galleries, RISE, SCALE, SpeakersEnd, Walls, roomDims } from "./chamber/Room";
import { Figures, type Sitter } from "./chamber/Figures";
import { seatChamber } from "./chamber/seating";
import { CameraRig, SHOTS, type Shot } from "./chamber/camera";
import { plateTexture } from "./chamber/textures";

/** A CSS colour (including `var(--c-PH)`) as a three.js colour. */
function resolve(css: string): THREE.Color {
  const m = css.match(/^var\((--[^)]+)\)$/);
  const v = m ? getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() : css;
  return new THREE.Color(v || "#8a8f9c");
}

/** A small stable hash in [0, 1000). */
const hashOf = (i: number) => (((i + 1) * 2654435761) >>> 0) % 1000;

interface Props {
  geo: Geo;
  color: (seat: number) => string;
  selected: number | null;
  onHover: (h: { i: number; x: number; y: number } | null) => void;
  onSelect: (i: number) => void;
}

/** A brass nameplate on a front-bench desk, facing the Speaker. */
function Plate({ s, title, name }: { s: Sitter; title: string; name: string }) {
  const tex = useMemo(() => plateTexture(title, name), [title, name]);
  return (
    <group position={s.pos} rotation={[0, s.rot, 0]}>
      <mesh position={[0, 0.235, -0.215]} rotation={[-0.35, Math.PI, 0]} raycast={() => null}>
        <planeGeometry args={[0.28, 0.07]} />
        <meshStandardMaterial map={tex} metalness={0.6} roughness={0.35} />
      </mesh>
    </group>
  );
}

const SHOT_LABELS: [keyof typeof SHOTS | "you", string][] = [
  ["speaker", "Speaker's view"],
  ["gallery", "From the gallery"],
  ["government", "Government bench"],
  ["opposition", "Opposition bench"],
  ["you", "Your seat"],
];

/**
 * The Dewan Rakyat in 3D: tiered benches in a half circle under a stepped ceiling, public galleries round the back,
 * the Speaker's canopied chair at the head. The Prime Minister and cabinet hold the government front bench; the
 * Opposition Leader and their front bench sit opposite. Every MP is dressed as they would be.
 */
export function Hemicycle3D({ geo, color, selected, onHover, onSelect }: Props) {
  const game = useGame((s) => s.game)!;
  const R = (geo.w - 28) / 2;
  const d = useMemo(() => roomDims(geo.rows), [geo.rows]);
  const seating = useMemo(() => seatChamber(geo, game), [geo, game]);
  const [hot, setHot] = useState<number | null>(null);

  const sitters: Sitter[] = useMemo(
    () =>
      seating.spots.map((sp) => {
        const x = ((sp.x - R - 14) / R) * SCALE;
        const z = -((R + 14 - sp.y) / R) * SCALE;
        const mp = mpOf(game, sp.i);
        return { i: sp.i, pos: [x, sp.row * RISE, z], rot: Math.atan2(x, z), attire: mp ? attireOf(mp) : null, party: resolve(color(sp.i)), h: hashOf(mp?.id ?? sp.i) };
      }),
    [seating, R, game, color],
  );
  const bySeat = useMemo(() => new Map(sitters.map((s) => [s.i, s])), [sitters]);
  const you = game.youId !== null ? game.people.find((p) => p.id === game.youId) : undefined;
  const yourSpot = you?.seat !== null && you?.seat !== undefined ? bySeat.get(you.seat) : undefined;

  // Camera shots: the fly-in lands on the Speaker's view.
  const [shot, setShot] = useState<{ s: Shot; n: number; key: string }>({ s: SHOTS.speaker, n: 0, key: "speaker" });
  const [orbit, setOrbit] = useState(false);
  const go = (key: keyof typeof SHOTS | "you") => {
    setOrbit(false);
    if (key === "you") {
      if (!yourSpot) return;
      const [x, y, z] = yourSpot.pos;
      const len = Math.hypot(x, z) || 1;
      const out = [x / len, z / len];
      setShot((v) => ({ s: { pos: [x + out[0] * 1.5, y + 1.3, z + out[1] * 1.5], target: [x - out[0] * 1.6, y + 0.3, z - out[1] * 1.6] }, n: v.n + 1, key }));
    } else setShot((v) => ({ s: SHOTS[key], n: v.n + 1, key }));
  };
  const touched = useCallback(() => setOrbit((o) => o && false), []);

  const over = (s: Sitter, e: ThreeEvent<PointerEvent>) => {
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
  const pm = seating.pm !== null ? bySeat.get(seating.pm) : undefined;
  const opp = seating.oppLeader !== null ? bySeat.get(seating.oppLeader) : undefined;
  const nameOf = (i: number) => mpOf(game, i)?.name ?? "";

  return (
    <div className="relative h-[480px] rounded-xl overflow-hidden" style={{ background: "#120d09" }}>
      <Canvas
        shadows="soft"
        dpr={[1, 2]}
        camera={{ position: [0, 5.2, -4.8], fov: 50 }}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        onPointerMissed={out}
      >
        <color attach="background" args={["#120d09"]} />
        <fog attach="fog" args={["#120d09", 14, 26]} />
        {/* Warm light from the ceiling, a green bounce off the carpet, the Speaker in a pool of light */}
        <hemisphereLight args={["#ffe9c2", "#1d3a2c", 0.75]} />
        <directionalLight position={[2.5, 10, -1]} intensity={1.6} color="#ffe2b0" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-radius={4}>
          <orthographicCamera attach="shadow-camera" args={[-8, 8, 8, -8, 0.5, 25]} />
        </directionalLight>
        {[-0.8, -0.35, 0.35, 0.8].map((f) => (
          <pointLight key={f} position={[Math.sin(f) * 4, 5, -Math.cos(f) * 3]} intensity={6} distance={9} color="#ffd59a" />
        ))}
        <spotLight position={[0, 4.6, 0.4]} target-position={[0, 0.6, 1.75]} angle={0.5} penumbra={0.6} intensity={18} distance={8} color="#fff0cc" />
        <CameraRig shot={shot.s} nonce={shot.n} orbit={orbit} onTouched={touched} />

        {/* The floor of the House */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0.6]} receiveShadow raycast={() => null}>
          <planeGeometry args={[2 * d.radius + 1, d.radius + 3]} />
          <meshStandardMaterial color="#1f5a43" roughness={1} />
        </mesh>
        <Benches d={d} />
        <Walls d={d} />
        <Galleries d={d} />
        <Ceiling d={d} />
        <SpeakersEnd d={d} />

        <Figures sitters={sitters} onOver={over} onOut={out} onPick={(s) => onSelect(s.i)} />
        {pm && <Plate s={pm} title="Perdana Menteri" name={nameOf(pm.i)} />}
        {opp && <Plate s={opp} title="Ketua Pembangkang" name={nameOf(opp.i)} />}

        {/* You: a column of gold light over your seat */}
        {yourSpot && (
          <group position={yourSpot.pos}>
            <mesh position={[0, 0.9, 0]} raycast={() => null}>
              <cylinderGeometry args={[0.03, 0.22, 1.5, 24, 1, true]} />
              <meshBasicMaterial color="#e3c27a" transparent opacity={0.16} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
            </mesh>
            <pointLight position={[0, 0.8, 0]} intensity={1.2} distance={1.4} color="#e3c27a" />
          </group>
        )}

        {/* A glowing ring under the seat you're pointing at, and the one you picked */}
        {marks.map((i) => {
          const s = bySeat.get(i);
          if (!s) return null;
          return (
            <mesh key={i} position={[s.pos[0], s.pos[1] + 0.012, s.pos[2]]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
              <ringGeometry args={[0.13, 0.17, 32]} />
              <meshBasicMaterial color={i === selected ? "#e3c27a" : "#ffffff"} toneMapped={false} />
            </mesh>
          );
        })}
      </Canvas>

      <div className="absolute top-2 left-2 right-2 flex flex-wrap gap-1.5">
        {SHOT_LABELS.map(([k, label]) =>
          k === "you" && !yourSpot ? null : (
            <button key={k} className="chip !py-1 !text-[11px]" data-on={!orbit && shot.key === k} onClick={() => go(k)} style={{ background: "rgb(10 17 32 / 0.75)" }}>
              {label}
            </button>
          ),
        )}
        <button className="chip !py-1 !text-[11px]" data-on={orbit} onClick={() => setOrbit((o) => !o)} style={{ background: "rgb(10 17 32 / 0.75)" }}>
          {orbit ? "Stop turning" : "Slow orbit"}
        </button>
      </div>
      <div className="absolute bottom-2 left-3 text-[11px]" style={{ color: "#c9b892" }}>
        Drag to orbit · scroll to zoom · right-drag to pan · front benches: the Prime Minister and cabinet, the Opposition Leader opposite
      </div>
    </div>
  );
}
