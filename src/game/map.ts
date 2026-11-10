import { Delaunay } from 'd3-delaunay';
import { CHINA_SEED, PROVINCE_SEEDS } from '../data/provinceSeeds';
import { CHINA_BORDER_PROVINCES, CHINA_OUTLINE, JEJU_OUTLINE, PENINSULA_OUTLINE, FORCED_LINKS, RAIL_LINES, RIDGES, SEA_LINKS } from '../data/outline';

/** 지도 좌표계: 경도/위도 → SVG 좌표 (단순 등각 투영) */
export const MAP_SCALE = 100;
const LON0 = 124.0;
const LAT0 = 44.3; // 지도 위쪽에 중국 영역을 그릴 여백 포함
const COS = 0.79;
export const MAP_WIDTH = Math.round(7.2 * COS * MAP_SCALE);
export const MAP_HEIGHT = Math.round(11.6 * MAP_SCALE);

export function project(lon: number, lat: number): [number, number] {
  return [(lon - LON0) * COS * MAP_SCALE, (LAT0 - lat) * MAP_SCALE];
}

export interface Geometry {
  id: string;
  seat: [number, number];
  lon: number;
  lat: number;
  polygon: [number, number][];
}

export interface MapData {
  geometry: Record<string, Geometry>;
  adjacency: Record<string, string[]>; // 육로 인접
  rail: Record<string, string[]>;
  sea: Record<string, string[]>;
  distKm: (a: string, b: string) => number;
  outlinePath: string;
  jejuPath: string;
  parallel38: [number, number][];
}

function pointInPoly(x: number, y: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const segIntersect = (a: [number, number], b: [number, number], c: [number, number], d: [number, number]) => {
  const cross = (p: [number, number], q: [number, number], r: [number, number]) =>
    (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
};

export const isLand = (lon: number, lat: number) =>
  pointInPoly(lon, lat, PENINSULA_OUTLINE) || pointInPoly(lon, lat, JEJU_OUTLINE);

/** 두 지점 사이 선분이 전부 육지 위에 있는지 (같은 육괴 안) */
export function segmentOnLand(a: [number, number], b: [number, number], steps = 24): boolean {
  const poly = pointInPoly(a[0], a[1], JEJU_OUTLINE) ? JEJU_OUTLINE : PENINSULA_OUTLINE;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (!pointInPoly(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, poly)) return false;
  }
  return true;
}

export function kmBetween(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const dx = (lon2 - lon1) * 88.8;
  const dy = (lat2 - lat1) * 111;
  return Math.hypot(dx, dy);
}

const toPath = (poly: [number, number][]) =>
  poly.map(([lo, la], i) => `${i ? 'L' : 'M'}${project(lo, la).map((v) => v.toFixed(1)).join(',')}`).join(' ') + ' Z';

function build(): MapData {
  const seeds = PROVINCE_SEEDS;
  const pts = seeds.map((s) => project(s.lon, s.lat));
  const del = Delaunay.from(pts);
  const vor = del.voronoi([-20, -20, MAP_WIDTH + 20, MAP_HEIGHT + 20]);

  const geometry: Record<string, Geometry> = {};
  seeds.forEach((s, i) => {
    const cell = vor.cellPolygon(i);
    geometry[s.id] = {
      id: s.id,
      seat: pts[i] as [number, number],
      lon: s.lon,
      lat: s.lat,
      polygon: (cell ? (cell.slice(0, -1) as [number, number][]) : []),
    };
  });

  geometry[CHINA_SEED.id] = {
    id: CHINA_SEED.id,
    seat: project(CHINA_SEED.lon, CHINA_SEED.lat),
    lon: CHINA_SEED.lon,
    lat: CHINA_SEED.lat,
    polygon: CHINA_OUTLINE.map(([lo, la]) => project(lo, la)),
  };

  const idx: Record<string, number> = {};
  seeds.forEach((s, i) => (idx[s.id] = i));
  const adj: Record<string, Set<string>> = {};
  seeds.forEach((s) => (adj[s.id] = new Set()));
  const link = (a: string, b: string, into: Record<string, Set<string>>) => {
    into[a].add(b);
    into[b].add(a);
  };

  const ridgeBlocks = (a: string, b: string): boolean => {
    const A = seeds[idx[a]], B = seeds[idx[b]];
    for (const r of RIDGES) {
      for (let k = 0; k < r.line.length - 1; k++) {
        if (segIntersect([A.lon, A.lat], [B.lon, B.lat], r.line[k], r.line[k + 1])) {
          const allowed = r.passes.some(([p, q]) => (p === a && q === b) || (p === b && q === a));
          if (!allowed) return true;
        }
      }
    }
    return false;
  };

  // 델로네 삼각분할의 변 → 후보 인접. 육지 위 직선·산맥 장벽·거리 조건으로 걸러낸다.
  const { triangles } = del;
  const seen = new Set<string>();
  for (let t = 0; t < triangles.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const i = triangles[t + k], j = triangles[t + ((k + 1) % 3)];
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const A = seeds[i], B = seeds[j];
      if (kmBetween(A.lon, A.lat, B.lon, B.lat) > 85) continue;
      if (!segmentOnLand([A.lon, A.lat], [B.lon, B.lat])) continue;
      if (ridgeBlocks(A.id, B.id)) continue;
      link(A.id, B.id, adj);
    }
  }
  // 고갯길은 델로네에 없어도 강제로 연결
  for (const r of RIDGES) for (const [a, b] of r.passes) if (idx[a] !== undefined && idx[b] !== undefined) link(a, b, adj);

  for (const [a, b] of FORCED_LINKS) link(a, b, adj);
  adj[CHINA_SEED.id] = new Set();
  for (const b of CHINA_BORDER_PROVINCES) link(CHINA_SEED.id, b, adj); // 압록강·두만강 유역 전부와 맞닿음

  const rail: Record<string, Set<string>> = {};
  seeds.forEach((s) => (rail[s.id] = new Set()));
  for (const line of RAIL_LINES) {
    for (let k = 0; k < line.chain.length - 1; k++) {
      const a = line.chain[k], b = line.chain[k + 1];
      if (idx[a] === undefined || idx[b] === undefined) throw new Error(`철도 노선에 없는 프로빈스: ${a}-${b}`);
      link(a, b, rail);
      link(a, b, adj); // 철도 연결은 반드시 육로 인접이기도 하다
    }
  }

  rail[CHINA_SEED.id] = new Set();
  const sea: Record<string, Set<string>> = {};
  seeds.forEach((s) => (sea[s.id] = new Set()));
  sea[CHINA_SEED.id] = new Set();
  for (const [a, b] of SEA_LINKS) {
    if (adj[a].has(b)) continue; // 이미 육로로 연결되어 있으면 해상 연결 불필요
    link(a, b, sea);
  }

  const toArr = (m: Record<string, Set<string>>) =>
    Object.fromEntries(Object.entries(m).map(([k, v]) => [k, [...v].sort()]));

  const p38: [number, number][] = [project(124.2, 38.0), project(129.2, 38.0)];
  return {
    geometry,
    adjacency: toArr(adj),
    rail: toArr(rail),
    sea: toArr(sea),
    distKm: (a, b) => {
      const A = a === CHINA_SEED.id ? CHINA_SEED : seeds[idx[a]], B = b === CHINA_SEED.id ? CHINA_SEED : seeds[idx[b]];
      return kmBetween(A.lon, A.lat, B.lon, B.lat);
    },
    outlinePath: toPath(PENINSULA_OUTLINE),
    jejuPath: toPath(JEJU_OUTLINE),
    parallel38: p38,
  };
}

export const MAP: MapData = build();

/** 육로·해상 모두 포함한 이웃 */
export function neighbors(id: string): string[] {
  return [...MAP.adjacency[id], ...MAP.sea[id]];
}
export function areAdjacent(a: string, b: string): boolean {
  return MAP.adjacency[a]?.includes(b) || MAP.sea[a]?.includes(b) || false;
}
