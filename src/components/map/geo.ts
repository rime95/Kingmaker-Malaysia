"use client";

// Loads the real constituency map (public/data/malaysia.topo.json, built from DOSM open data by scripts/build-map.mjs)
// and projects it once into a fixed drawing space. Everything the map draws is precomputed here: SVG path strings,
// centroids and bounds for all 222 parliamentary seats, 600 state seats and 16 states.

import { geoMercator, geoPath } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { Feature, Geometry } from "geojson";
import { useEffect, useState } from "react";
import { DUNS } from "@/game/systems/dun";
import { SEATS, STATES } from "@/game/world";

/** The drawing space (SVG viewBox). The map is scaled to fit whatever screen it's on. */
export const MAP_W = 1600;
export const MAP_H = 720;

export interface Shape {
  d: string;
  cx: number;
  cy: number;
  /** [[x0, y0], [x1, y1]] in drawing space. */
  bounds: [[number, number], [number, number]];
}

export interface MapGeometry {
  /** Indexed like SEATS. */
  seats: Shape[];
  /** Indexed like DUNS. */
  duns: Shape[];
  /** Keyed by game state id. */
  states: Record<string, Shape>;
  /** Lines between states, and between parliamentary seats. */
  stateBorders: string;
  seatBorders: string;
}

// DOSM numeric state codes → game state ids.
const STATE_CODE: Record<number, string> = { 1: "JHR", 2: "KDH", 3: "KTN", 4: "MLK", 5: "NSN", 6: "PHG", 7: "PNG", 8: "PRK", 9: "PLS", 10: "SGR", 11: "TRG", 12: "SBH", 13: "SWK", 14: "KUL", 15: "LBN", 16: "PJY" };

let cache: Promise<MapGeometry> | null = null;

function build(topo: Topology): MapGeometry {
  type Props = { code_parlimen?: string; code_state_dun?: string; code_state?: number };
  const obj = (name: string) => topo.objects[name] as GeometryCollection<Props>;
  const parlimen = feature(topo, obj("parlimen")).features as Feature<Geometry, Props>[];
  const dun = feature(topo, obj("dun")).features as Feature<Geometry, Props>[];
  const states = feature(topo, obj("states")).features as Feature<Geometry, Props>[];

  const projection = geoMercator().fitExtent(
    [
      [20, 20],
      [MAP_W - 20, MAP_H - 20],
    ],
    // Mainland Peninsula and Borneo (far-off islands would shrink everything else).
    { type: "MultiPoint", coordinates: [[99.6, 1.2], [119.3, 1.2], [99.6, 7.4], [119.3, 7.4]] },
  );
  const path = geoPath(projection);
  const shape = (f: Feature<Geometry, Props>): Shape => {
    const [cx, cy] = path.centroid(f);
    return { d: path(f) ?? "", cx, cy, bounds: path.bounds(f) };
  };

  const byP = new Map(parlimen.map((f) => [f.properties.code_parlimen!, f]));
  const byD = new Map(dun.map((f) => [f.properties.code_state_dun!, f]));
  const empty: Shape = { d: "", cx: 0, cy: 0, bounds: [[0, 0], [0, 0]] };
  return {
    seats: SEATS.map((s) => (byP.has(s.code) ? shape(byP.get(s.code)!) : empty)),
    duns: DUNS.map((d) => (byD.has(d.mapKey) ? shape(byD.get(d.mapKey)!) : empty)),
    states: Object.fromEntries(states.filter((f) => STATE_CODE[f.properties.code_state!]).map((f) => [STATE_CODE[f.properties.code_state!], shape(f)])),
    stateBorders: path(mesh(topo, obj("states"), (a, b) => a !== b)) ?? "",
    seatBorders: path(mesh(topo, obj("parlimen"), (a, b) => a !== b)) ?? "",
  };
}

export function loadMap(): Promise<MapGeometry> {
  cache ??= fetch("/data/malaysia.topo.json")
    .then((r) => {
      if (!r.ok) throw new Error(`Map data: HTTP ${r.status}`);
      return r.json() as Promise<Topology>;
    })
    .then(build)
    .catch((e) => {
      cache = null;
      throw e;
    });
  return cache;
}

/** The map geometry, or null while it loads. */
export function useMapGeometry(): { geo: MapGeometry | null; error: string | null } {
  const [geo, setGeo] = useState<MapGeometry | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    loadMap().then(
      (g) => live && setGeo(g),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, []);
  return { geo, error };
}

export const STATE_IDS = STATES.map((s) => s.id);
