import type { GameState, Side } from './types';
import { PLA, SUPPLY } from './balance';
import { CHINA_BORDER_PROVINCES } from '../data/outline';
import { MAP } from './map';
import { clamp } from './util';
import { weatherAt } from './weather';
import { spendCP } from './economy';
import type { Result } from './orders';

/** 자국 영토만 따라 starts 에서 닿을 수 있는 프로빈스 집합 (육로 + 양쪽 항구 해상) */
function connectedFrom(state: GameState, side: Side, starts: string[]): Set<string> {
  const seen = new Set(starts);
  const stack = [...starts];
  while (stack.length) {
    const cur = stack.pop()!;
    const edges = [
      ...MAP.adjacency[cur],
      ...MAP.sea[cur].filter((n) => state.provinces[cur].portCapacity > 0 && state.provinces[n].portCapacity > 0),
    ];
    for (const n of edges) {
      if (!seen.has(n) && state.provinces[n].owner === side && !state.provinces[n].external) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  return seen;
}

/** 보급 거점 한 곳의 상태 */
export interface HubInfo {
  id: string;
  /** main: 주 거점(항상 유효) · depot: 자동 전진 보급소(인천·서울·대전 등) · built: 플레이어가 설치한 보급소 */
  kind: 'main' | 'depot' | 'built';
  /** 현재 유효한 보급 수준 (끊긴 보급소는 점점 약해진다) */
  level: number;
  /** 원래 수준 */
  baseLevel: number;
  /** 주 거점과 이어져 있지 않아 비축분으로 버티는 중 */
  cut: boolean;
  /** 끊긴 보급소가 사라질 때까지 남은 턴 수 */
  turnsLeft: number | null;
}

/** 플레이어(남측)가 설치한 보급소 목록 */
export function builtDepots(state: GameState, side: Side): string[] {
  const pre = `depotBuilt:${side}:`;
  return Object.keys(state.flags).filter((k) => k.startsWith(pre)).map((k) => k.slice(pre.length));
}

/**
 * 현재 유효한 보급 거점과 거점별 보급 수준.
 *  - 주 거점(남: 부산 / 북: 평양·원산·신의주, 중국군 참전 후 압록강변 보급소)은 소유하고 있으면 항상 유효하다.
 *  - 전진 보급소(남: 인천·서울과 플레이어가 설치한 보급소 / 북: 서울·대전)는 주 거점과 자국 영토로 이어져 있을 때만 완전하게 작동한다.
 *    주 거점에서 끊기면 SUPPLY.depotGraceTurns 턴은 비축분으로 버티고, 이후 턴마다 SUPPLY.depotDecayPerTurn 비율씩 약해져 사라진다.
 *    (끊긴 시점은 flags["depotCut:<side>:<id>"] 에 기록되며 다시 이어지거나 잃으면 지워진다.)
 * record=false 이면 상태를 바꾸지 않고 읽기만 한다(화면 표시용).
 */
export function hubDetails(state: GameState, side: Side, record = true): HubInfo[] {
  const out: HubInfo[] = [];
  const main: string[] = [...SUPPLY.hubs[side]];
  // 중국군 참전 후에는 압록강·두만강에 닿은 북한 영토 전체가 중국에서 직접 보급을 받는다 (포위 판정을 받지 않는다)
  if (side === 'north' && state.flags.plaIntervened) for (const id of CHINA_BORDER_PROVINCES) if (!main.includes(id)) main.push(id);
  for (const id of main) {
    if (state.provinces[id]?.owner !== side) continue;
    const lv = side === 'north' && CHINA_BORDER_PROVINCES.includes(id) && !SUPPLY.hubs[side].includes(id) ? PLA.depots[id] ?? PLA.borderHubLevel : SUPPLY.hubLevel;
    out.push({ id, kind: 'main', level: lv, baseLevel: lv, cut: false, turnsLeft: null });
  }

  const forward: [string, number, 'depot' | 'built'][] = [];
  if (side === 'south') {
    if (state.flags.incheonHub) forward.push(['incheon', 70, 'depot']);
    if (state.flags.seoulHub) forward.push(['seoul', 70, 'depot']);
    for (const id of builtDepots(state, side)) {
      if (state.provinces[id]?.owner !== side) {
        if (record) delete state.flags[`depotBuilt:${side}:${id}`]; // 적에게 넘어가면 보급소는 파괴된다
        continue;
      }
      if (!forward.some((f) => f[0] === id)) forward.push([id, SUPPLY.builtDepotLevel, 'built']);
    }
  } else {
    forward.push(['seoul', 70, 'depot'], ['daejeon', 50, 'depot']);
  }
  const connected = connectedFrom(state, side, out.map((h) => h.id));
  for (const [id, lv, kind] of forward) {
    const key = `depotCut:${side}:${id}`;
    if (state.provinces[id]?.owner !== side) {
      if (record) delete state.flags[key];
      continue;
    }
    if (connected.has(id)) {
      if (record) delete state.flags[key];
      out.push({ id, kind, level: lv, baseLevel: lv, cut: false, turnsLeft: null });
      continue;
    }
    let cutAt = state.flags[key] as number | undefined;
    if (cutAt === undefined) {
      cutAt = state.turn;
      if (record) state.flags[key] = cutAt;
    }
    const age = state.turn - cutAt;
    const factor = age <= SUPPLY.depotGraceTurns ? 1 : 1 - SUPPLY.depotDecayPerTurn * (age - SUPPLY.depotGraceTurns);
    const turnsLeft = Math.max(0, Math.ceil(SUPPLY.depotGraceTurns + 1 / SUPPLY.depotDecayPerTurn - age));
    if (factor > 0) out.push({ id, kind, level: Math.round(lv * factor), baseLevel: lv, cut: true, turnsLeft });
  }
  return out;
}

export function hubLevels(state: GameState, side: Side): Record<string, number> {
  return Object.fromEntries(hubDetails(state, side).map((h) => [h.id, h.level]));
}

export function hubsFor(state: GameState, side: Side): string[] {
  return Object.keys(hubLevels(state, side));
}

function hopCost(state: GameState, side: Side, a: string, b: string, sea: boolean): number {
  const pb = state.provinces[b];
  const rail = MAP.rail[a]?.includes(b);
  let cost = sea ? 10 : rail ? SUPPLY.hopCostRail : SUPPLY.hopCostRoad;
  cost *= 1 + SUPPLY.infraAdjust * (1 - pb.infrastructure / 100);
  cost *= 1 + 0.3 * (pb.warDamage / 100);
  if (!sea && !rail) cost *= weatherAt(state.date).roadSupplyMult; // 장마·해빙기·혹한에는 도로 보급이 느려진다
  if (side === 'north') cost *= rail ? 1 + 2.4 * state.interdiction : 1 + 0.9 * state.interdiction;
  return cost;
}

/** 보급선 탐색: dist 는 거점에서의 "비용", parent 는 보급이 흘러오는 바로 앞 지역 (거점은 parent 없음) */
function runSupply(state: GameState, side: Side, hubs: HubInfo[]): { dist: Record<string, number>; parent: Record<string, string> } {
  const dist: Record<string, number> = {};
  const parent: Record<string, string> = {};
  const open: string[] = [];
  for (const h of hubs) {
    dist[h.id] = SUPPLY.hubLevel - h.level;
    open.push(h.id);
  }
  while (open.length) {
    open.sort((x, y) => dist[y] - dist[x]);
    const cur = open.pop()!;
    const prov = state.provinces[cur];
    const edges: [string, boolean][] = [
      ...MAP.adjacency[cur].map((n) => [n, false] as [string, boolean]),
      ...MAP.sea[cur].filter((n) => prov.portCapacity > 0 && state.provinces[n].portCapacity > 0).map((n) => [n, true] as [string, boolean]),
    ];
    for (const [n, sea] of edges) {
      const pn = state.provinces[n];
      if (pn.owner !== side || pn.external) continue;
      const nd = dist[cur] + hopCost(state, side, cur, n, sea);
      if (dist[n] === undefined || nd < dist[n]) {
        dist[n] = nd;
        parent[n] = cur;
        if (!open.includes(n)) open.push(n);
      }
    }
  }
  return { dist, parent };
}

/**
 * 보급선: 거점에서 "자국이 통제 중인" 프로빈스를 따라 연결되어야 한다 (그래프 탐색, 다익스트라).
 * 적이 중간 프로빈스를 점령하면 그 너머는 연결이 끊겨 supplied=false 가 된다.
 */
export function computeSupply(state: GameState): void {
  for (const side of ['south', 'north'] as Side[]) {
    const { dist } = runSupply(state, side, hubDetails(state, side));
    for (const p of Object.values(state.provinces)) {
      if (p.owner !== side || p.external) continue; // 중국은 보급·포위 판정에 포함하지 않는다
      const d = dist[p.id];
      if (d === undefined) {
        p.supplied = false;
        p.supplyLevel = 0;
      } else {
        // 거점과 이어져 있으면(포위 아님) 멀어도 최저 보급은 유지된다. 단절된 지역만 0이 된다.
        p.supplyLevel = Math.round(clamp(SUPPLY.hubLevel - d, SUPPLY.minConnectedLevel, 100));
        p.supplied = true;
      }
    }
  }
}

/** 화면 표시용: 거점 목록과 보급선(트리). 게임 상태를 바꾸지 않는다. */
export function supplyInfo(state: GameState, side: Side): { hubs: HubInfo[]; parent: Record<string, string> } {
  const hubs = hubDetails(state, side, false);
  return { hubs, parent: runSupply(state, side, hubs).parent };
}

/** 지역에서 보급 거점까지 이어진 경로 (지역 → … → 거점). 보급이 끊긴 지역은 빈 배열 */
export function routeToHub(parent: Record<string, string>, hubIds: Set<string>, id: string): string[] {
  const path = [id];
  let cur = id;
  for (let i = 0; i < 200 && !hubIds.has(cur); i++) {
    const p = parent[cur];
    if (!p) return [];
    path.push(p);
    cur = p;
  }
  return path;
}

/** 플레이어 전진 보급소 설치: 행정 점수·보급 자원을 쓰고, 항만이나 철도가 있는 보급 연결 지역에만 둘 수 있다 */
export function depotBlockReason(state: GameState, side: Side, id: string): string | null {
  const p = state.provinces[id];
  if (!p || p.external) return '설치할 수 없는 지역입니다.';
  if (p.owner !== side) return '아군이 통제하는 지역에만 설치할 수 있습니다.';
  if (!p.supplied) return '보급이 끊긴 지역에는 설치할 수 없습니다.';
  if (hubDetails(state, side, false).some((h) => h.id === id)) return '이미 보급 거점입니다.';
  if (p.portCapacity <= 0 && MAP.rail[id].length === 0) return '항만이나 철도가 있는 지역에만 설치할 수 있습니다.';
  if (builtDepots(state, side).length >= SUPPLY.maxBuiltDepots) return `전진 보급소는 최대 ${SUPPLY.maxBuiltDepots}곳까지 설치할 수 있습니다.`;
  if (state.nations[side].supplyStock < SUPPLY.builtDepotStock) return `보급 자원이 부족합니다. (필요 ${SUPPLY.builtDepotStock})`;
  if (state.nations[side].commandPoints < SUPPLY.builtDepotCP) return '행정 점수(명령권)가 부족합니다.';
  return null;
}

export function buildDepot(state: GameState, side: Side, id: string): Result {
  const why = depotBlockReason(state, side, id);
  if (why) return { ok: false, reason: why };
  const p = state.provinces[id];
  const n = state.nations[side];
  const cp = spendCP(state, side, SUPPLY.builtDepotCP);
  if (!cp.ok) return cp;
  n.supplyStock -= SUPPLY.builtDepotStock;
  state.flags[`depotBuilt:${side}:${id}`] = state.turn;
  state.flags['stat:depotsBuilt'] = Number(state.flags['stat:depotsBuilt'] ?? 0) + 1; // 업적용 누적 설치 횟수
  return { ok: true, reason: `${p.name}에 전진 보급소를 설치했습니다. 보급 수준 ${SUPPLY.builtDepotLevel}의 보급이 주변으로 퍼집니다.` };
}

/** 설치한 전진 보급소 철수 (자원은 돌려받지 않는다) */
export function removeDepot(state: GameState, side: Side, id: string): Result {
  const key = `depotBuilt:${side}:${id}`;
  if (state.flags[key] === undefined) return { ok: false, reason: '설치한 보급소가 아닙니다.' };
  delete state.flags[key];
  delete state.flags[`depotCut:${side}:${id}`];
  return { ok: true, reason: '전진 보급소를 철수했습니다.' };
}

/** 그 부대 위치의 보급 접근 수준 (자국 영토가 아니면 적진 속 → 낮음) */
export function localSupplyLevel(state: GameState, unitSide: Side, provinceId: string): number {
  const p = state.provinces[provinceId];
  if (p.owner !== unitSide) return 25;
  return p.supplyLevel;
}

export function isCutOff(state: GameState, side: Side, provinceId: string): boolean {
  const p = state.provinces[provinceId];
  return p.owner !== side || !p.supplied;
}
