import type { GameState, Side } from './types';
import { PLA, SUPPLY } from './balance';
import { MAP } from './map';
import { clamp } from './util';

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
      if (!seen.has(n) && state.provinces[n].owner === side) {
        seen.add(n);
        stack.push(n);
      }
    }
  }
  return seen;
}

/**
 * 현재 유효한 보급 거점과 거점별 보급 수준.
 *  - 주 거점(남: 부산 / 북: 평양·원산·신의주, 중국군 참전 후 압록강변 보급소)은 소유하고 있으면 항상 유효하다.
 *  - 전진 보급소(남: 인천·서울 / 북: 서울·대전)는 주 거점과 자국 영토로 이어져 있을 때만 완전하게 작동한다.
 *    주 거점에서 끊기면 SUPPLY.depotGraceTurns 턴은 비축분으로 버티고, 이후 턴마다 SUPPLY.depotDecayPerTurn 비율씩 약해져 사라진다.
 *    (끊긴 시점은 flags["depotCut:<side>:<id>"] 에 기록되며 다시 이어지거나 잃으면 지워진다.)
 */
export function hubLevels(state: GameState, side: Side): Record<string, number> {
  const out: Record<string, number> = {};
  for (const h of SUPPLY.hubs[side]) out[h] = SUPPLY.hubLevel;
  if (side === 'north' && state.flags.plaIntervened) for (const [id, lv] of Object.entries(PLA.depots)) out[id] = lv;
  for (const id of Object.keys(out)) if (state.provinces[id]?.owner !== side) delete out[id];

  const forward: Record<string, number> = {};
  if (side === 'south') {
    if (state.flags.incheonHub) forward.incheon = 70;
    if (state.flags.seoulHub) forward.seoul = 70;
  } else {
    forward.seoul = 70;
    forward.daejeon = 50;
  }
  const connected = connectedFrom(state, side, Object.keys(out));
  for (const [id, lv] of Object.entries(forward)) {
    const key = `depotCut:${side}:${id}`;
    if (state.provinces[id]?.owner !== side) {
      delete state.flags[key];
      continue;
    }
    if (connected.has(id)) {
      delete state.flags[key];
      out[id] = lv;
      continue;
    }
    if (state.flags[key] === undefined) state.flags[key] = state.turn;
    const age = state.turn - (state.flags[key] as number);
    const factor = age <= SUPPLY.depotGraceTurns ? 1 : 1 - SUPPLY.depotDecayPerTurn * (age - SUPPLY.depotGraceTurns);
    if (factor > 0) out[id] = Math.round(lv * factor);
  }
  return out;
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
  if (side === 'north') cost *= rail ? 1 + 2.4 * state.interdiction : 1 + 0.9 * state.interdiction;
  return cost;
}

/**
 * 보급선: 거점에서 "자국이 통제 중인" 프로빈스를 따라 연결되어야 한다 (그래프 탐색, 다익스트라).
 * 적이 중간 프로빈스를 점령하면 그 너머는 연결이 끊겨 supplied=false 가 된다.
 */
export function computeSupply(state: GameState): void {
  for (const side of ['south', 'north'] as Side[]) {
    const dist: Record<string, number> = {};
    const open: string[] = [];
    for (const [h, lv] of Object.entries(hubLevels(state, side))) {
      dist[h] = SUPPLY.hubLevel - lv;
      open.push(h);
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
        if (pn.owner !== side) continue;
        const nd = dist[cur] + hopCost(state, side, cur, n, sea);
        if (dist[n] === undefined || nd < dist[n]) {
          dist[n] = nd;
          if (!open.includes(n)) open.push(n);
        }
      }
    }
    for (const p of Object.values(state.provinces)) {
      if (p.owner !== side) continue;
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
