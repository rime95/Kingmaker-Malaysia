"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Geo } from "./Dewan";

/** Drag to orbit, scroll or pinch to zoom, right-drag to pan. */
function Controls() {
  const { camera, gl } = useThree();
  const ref = useRef<OrbitControls | null>(null);
  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement);
    c.enableDamping = true;
    c.target.set(0, 0.5, -2.2);
    c.minDistance = 3;
    c.maxDistance = 18;
    c.maxPolarAngle = Math.PI * 0.47;
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

interface SeatProps {
  pos: [number, number, number];
  rot: number;
  color: string;
  on: boolean;
  onOver: (e: { clientX: number; clientY: number }) => void;
  onOut: () => void;
  onClick: () => void;
}

/** One MP's seat: a bench with a backrest, coloured by party or by vote, raised by row. */
function SeatMesh({ pos, rot, color, on, onOver, onOut, onClick }: SeatProps) {
  const [hot, setHot] = useState(false);
  const c = useMemo(() => new THREE.Color(color), [color]);
  const glow = hot || on ? 0.6 : 0.12;
  return (
    <group
      position={pos}
      rotation={[0, rot, 0]}
      scale={hot || on ? 1.3 : 1}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHot(true);
        onOver(e.nativeEvent);
      }}
      onPointerMove={(e) => onOver(e.nativeEvent)}
      onPointerOut={() => {
        setHot(false);
        onOut();
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <mesh position={[0, 0.09, 0]} castShadow>
        <boxGeometry args={[0.2, 0.08, 0.18]} />
        <meshStandardMaterial color={c} emissive={c} emissiveIntensity={glow} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.2, 0.08]} castShadow>
        <boxGeometry args={[0.2, 0.2, 0.04]} />
        <meshStandardMaterial color={c} emissive={c} emissiveIntensity={glow} roughness={0.5} />
      </mesh>
    </group>
  );
}

/** The chamber in 3D: tiered benches in a half circle, the Speaker's chair and the Clerk's table with the mace. */
export function Hemicycle3D({ geo, color, selected, onHover, onSelect }: Props) {
  const R = (geo.w - 28) / 2;
  const seats = useMemo(
    () =>
      geo.dots.map((d) => {
        // The flat chart mapped into the room: the Speaker at the origin, benches rising row by row, facing the chair.
        const x = ((d.x - R - 14) / R) * 5;
        const z = -((R + 14 - d.y) / R) * 5;
        const y = d.row * 0.22;
        return { i: d.seatIndex, pos: [x, y, z] as [number, number, number], rot: Math.atan2(x, z) };
      }),
    [geo, R],
  );
  return (
    <div className="relative h-[440px] rounded-xl overflow-hidden" style={{ background: "radial-gradient(ellipse at 50% 30%, #1b2440, #0a0e1a)" }}>
      <Canvas shadows camera={{ position: [0, 6, 4.5], fov: 45 }} onPointerMissed={() => onHover(null)}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[4, 10, 6]} intensity={1.1} castShadow />
        <pointLight position={[0, 4, -2]} intensity={12} color="#ffd9a0" />
        <Controls />
        {/* Tiers of green benches */}
        {Array.from({ length: geo.rows }, (_, k) => {
          const r = (0.38 + ((1 - 0.38) * k) / (geo.rows - 1)) * 5;
          return (
            <mesh key={k} position={[0, k * 0.22 - 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <ringGeometry args={[r - 0.24, r + 0.24, 64, 1, 0, Math.PI]} />
              <meshStandardMaterial color="#1f5b3c" roughness={0.9} side={THREE.DoubleSide} />
            </mesh>
          );
        })}
        {/* The floor of the House */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, -1.5]} receiveShadow>
          <circleGeometry args={[7.5, 64]} />
          <meshStandardMaterial color="#123526" roughness={1} />
        </mesh>
        {/* The Clerk's table and the mace */}
        <mesh position={[0, 0.15, -0.8]} castShadow>
          <boxGeometry args={[1.1, 0.3, 0.5]} />
          <meshStandardMaterial color="#5a3b22" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.34, -0.8]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.03, 0.03, 0.8, 12]} />
          <meshStandardMaterial color="#e5b84a" metalness={0.9} roughness={0.25} />
        </mesh>
        {/* The Speaker's chair, facing the House */}
        <mesh position={[0, 0.45, 0.5]} castShadow>
          <boxGeometry args={[0.6, 0.9, 0.4]} />
          <meshStandardMaterial color="#6b4423" roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.05, 0.62]} castShadow>
          <boxGeometry args={[0.7, 0.5, 0.12]} />
          <meshStandardMaterial color="#c9a24a" metalness={0.6} roughness={0.3} />
        </mesh>
        {seats.map((s) => (
          <SeatMesh
            key={s.i}
            pos={s.pos}
            rot={s.rot}
            color={color(s.i)}
            on={selected === s.i}
            onOver={(e) => onHover({ i: s.i, x: e.clientX, y: e.clientY })}
            onOut={() => onHover(null)}
            onClick={() => onSelect(s.i)}
          />
        ))}
      </Canvas>
      <div className="absolute bottom-2 left-3 text-[11px]" style={{ color: "var(--muted)" }}>
        Drag to orbit · scroll to zoom · right-drag to pan
      </div>
    </div>
  );
}
