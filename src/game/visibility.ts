import type { GameState, Side } from './types';
import { MAP } from './map';
import { other } from './util';

/** 전장의 안개가 켜져 있는가 (기본값: 꺼짐). 정보 표시만 바꾸며 실제 전투력·병력에는 영향이 없다. */
export const fogOn = (state: GameState): boolean => !!state.settings?.fog;

/** 지금 이 프로빈스의 적 정보를 볼 수 있는가 (안개가 꺼져 있으면 항상 보인다) */
export function canSee(state: GameState, provinceId: string, side: Side = state.playerSide, vis?: Set<string>): boolean {
  if (!fogOn(state)) return true;
  return (vis ?? visibleProvinces(state, side)).has(provinceId);
}

/** 정찰 범위: 아군 부대가 있는 지역과 그 인접 지역(정찰 1칸). 자국 영토 안의 적 부대도 보인다. */
export function visibleProvinces(state: GameState, side: Side): Set<string> {
  const vis = new Set<string>();
  for (const u of Object.values(state.units)) {
    if (u.side !== side) continue;
    vis.add(u.location);
    for (const n of MAP.adjacency[u.location]) vis.add(n);
    for (const n of MAP.sea[u.location]) vis.add(n);
  }
  for (const p of Object.values(state.provinces)) if (p.owner === side) vis.add(p.id);
  return vis;
}

/** 플레이어 측이 파악한 적 정보를 갱신한다. 정찰된 지역은 정확한 부대 수, 아닌 곳은 마지막으로 본 정보(오래됨)를 유지한다. */
export function updateIntel(state: GameState, side: Side = state.playerSide): void {
  const vis = visibleProvinces(state, side);
  const enemy = other(side);
  const counts: Record<string, number> = {};
  for (const u of Object.values(state.units)) if (u.side === enemy) counts[u.location] = (counts[u.location] ?? 0) + 1;
  for (const id of Object.keys(state.provinces)) {
    if (vis.has(id)) {
      if (counts[id]) state.intel[id] = { count: counts[id], turn: state.turn };
      else delete state.intel[id];
    }
  }
}
