import type { GameState, Order, OrderType, Side, Unit } from './types';
import { MAP } from './map';
import { MOVEMENT } from './balance';
import { clamp, turnDaysFor } from './util';

export interface Result {
  ok: boolean;
  reason?: string;
}
const fail = (reason: string): Result => ({ ok: false, reason });

/** 이번 턴 이동력(km). 피로와 조직력이 낮으면 줄어든다. */
export function movePoints(state: GameState, u: Unit): number {
  const days = turnDaysFor(state.date);
  return u.speed * days * (1 - 0.3 * (u.fatigue / 100)) * (0.7 + 0.3 * (u.organization / 100));
}

/** 인접한 두 프로빈스 사이의 이동 비용(km 환산) */
export function stepCost(state: GameState, a: string, b: string): number {
  const pb = state.provinces[b];
  const pa = state.provinces[a];
  if (MAP.adjacency[a].includes(b)) {
    const rail = MAP.rail[a].includes(b);
    const infra = (pa.infrastructure + pb.infrastructure) / 200;
    return MAP.distKm(a, b) * MOVEMENT.terrainCost[pb.terrain] * (rail ? MOVEMENT.railDiscount : 1) * (1.25 - 0.35 * infra);
  }
  return MOVEMENT.seaCostKm;
}

function canStep(state: GameState, side: Side, a: string, b: string): boolean {
  const pb = state.provinces[b];
  if (pb.owner !== side) return false; // 적 지역은 통과할 수 없다 (공격으로만 진입)
  if (MAP.adjacency[a].includes(b)) return true;
  // 해상 이동은 양쪽 항구 필요
  return MAP.sea[a].includes(b) && state.provinces[a].portCapacity > 0 && pb.portCapacity > 0;
}

/** 자국 영토만 지나는 최단 경로(다익스트라). 경로가 없으면 null */
export function findPath(state: GameState, side: Side, from: string, to: string): { path: string[]; cost: number } | null {
  if (from === to) return { path: [from], cost: 0 };
  const dist: Record<string, number> = { [from]: 0 };
  const prev: Record<string, string> = {};
  const open = [from];
  while (open.length) {
    open.sort((x, y) => dist[y] - dist[x]);
    const cur = open.pop()!;
    if (cur === to) break;
    for (const n of [...MAP.adjacency[cur], ...MAP.sea[cur]]) {
      if (!canStep(state, side, cur, n)) continue;
      const nd = dist[cur] + stepCost(state, cur, n);
      if (dist[n] === undefined || nd < dist[n]) {
        dist[n] = nd;
        prev[n] = cur;
        if (!open.includes(n)) open.push(n);
      }
    }
  }
  if (dist[to] === undefined) return null;
  const path = [to];
  while (path[0] !== from) path.unshift(prev[path[0]]);
  return { path, cost: dist[to] };
}

export function attackableTargets(state: GameState, u: Unit): string[] {
  const from = u.location;
  const out: string[] = [];
  for (const n of MAP.adjacency[from]) if (state.provinces[n].owner !== u.side) out.push(n);
  for (const n of MAP.sea[from]) {
    if (state.provinces[n].owner !== u.side && state.provinces[from].portCapacity > 0 && state.provinces[n].portCapacity > 0) out.push(n);
  }
  return out;
}

export function reachableTargets(state: GameState, u: Unit): { id: string; cost: number; turns: number }[] {
  const mp = Math.max(1, movePoints(state, u));
  const out: { id: string; cost: number; turns: number }[] = [];
  for (const id of Object.keys(state.provinces)) {
    if (id === u.location || state.provinces[id].owner !== u.side) continue;
    const r = findPath(state, u.side, u.location, id);
    if (r) out.push({ id, cost: r.cost, turns: Math.ceil(r.cost / mp) });
  }
  return out;
}

export function validateOrder(state: GameState, u: Unit, type: OrderType, target?: string): Result {
  if (u.strength <= 0) return fail('전멸한 부대입니다.');
  if (u.order && u.order.issuedTurn === state.turn) return fail('이 부대는 이번 턴에 이미 명령을 받았습니다. 명령을 취소한 뒤 다시 지시하세요.');
  switch (type) {
    case 'move': {
      if (!target || !state.provinces[target]) return fail('목적지가 올바르지 않습니다.');
      if (target === u.location) return fail('이미 그 지역에 있습니다.');
      if (state.provinces[target].owner !== u.side) return fail('적 통제 지역으로는 이동할 수 없습니다. 공격 명령을 사용하세요.');
      if (!findPath(state, u.side, u.location, target)) return fail('아군 통제 지역만 지나서 도달할 수 있는 경로가 없습니다.');
      return { ok: true };
    }
    case 'attack': {
      if (!target || !state.provinces[target]) return fail('공격 목표가 올바르지 않습니다.');
      if (!attackableTargets(state, u).includes(target)) return fail('인접한 적 통제 지역만 공격할 수 있습니다.');
      if (u.organization < 15) return fail('조직력이 너무 낮아 공격할 수 없습니다.');
      if (u.fatigue > 92) return fail('피로가 극심해 공격할 수 없습니다.');
      return { ok: true };
    }
    default:
      return { ok: true };
  }
}

export function issueOrder(state: GameState, unitId: string, type: OrderType, target?: string): Result {
  const u = state.units[unitId];
  if (!u) return fail('존재하지 않는 부대입니다.');
  const v = validateOrder(state, u, type, target);
  if (!v.ok) return v;
  const order: Order = { type, target, issuedTurn: state.turn };
  u.order = order;
  u.moveCarry = 0;
  return { ok: true };
}

export function cancelOrder(state: GameState, unitId: string): void {
  const u = state.units[unitId];
  if (u) u.order = null;
}

/** 지정된 경로를 이동력만큼 따라가 실제 이동한 마지막 프로빈스를 돌려준다 (도중에 적에게 빼앗기면 멈춤) */
export function advanceAlongPath(state: GameState, u: Unit, target: string): { moved: number; arrived: boolean; noPath: boolean } {
  const r = findPath(state, u.side, u.location, target);
  if (!r) return { moved: 0, arrived: false, noPath: true };
  // 한 칸의 비용이 한 턴 이동력보다 크면 남은 이동력을 쌓아 다음 턴에 이어서 간다 (명령이 소실되지 않음)
  let budget = movePoints(state, u) + (u.moveCarry ?? 0);
  let moved = 0;
  for (let i = 1; i < r.path.length; i++) {
    const c = stepCost(state, r.path[i - 1], r.path[i]);
    if (c > budget) break;
    budget -= c;
    u.location = r.path[i];
    moved++;
  }
  const arrived = u.location === target;
  u.moveCarry = arrived ? 0 : budget;
  return { moved, arrived, noPath: false };
}

export function orderLabel(o: Order | null, state: GameState): string {
  if (!o) return '대기';
  const t = o.target ? state.provinces[o.target]?.name : '';
  return { move: `이동 → ${t}`, attack: `공격 → ${t}`, defend: '방어선 강화', rest: '휴식·재정비', train: '훈련' }[o.type];
}

export const orderClamp = clamp;
