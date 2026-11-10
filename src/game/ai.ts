import type { GamePhase, GameState, Province, Side, Unit } from './types';
import { AI_BALANCE } from './balance';
import { MAP } from './map';
import { battleContextFor, calcSide, estimatePower, infantryPower } from './combat';
import { attackableTargets, findPath, issueOrder, movePoints, stepCost } from './orders';
import { hubsFor } from './supply';
import { unitsAt } from './units';
import { other } from './util';

/**
 * 규칙 기반 AI. 전황(국면)에 따라 서로 다른 전략을 쓴다. 난이도를 능력치 보정으로 올리지 않는다.
 *  - blitz   (초기 돌파): 주요 도시 점령을 위한 빠른 돌파. 약한 곳과 도로축선을 우선하고 부대를 넓게 투입
 *  - naktong (낙동강):   취약한 구역 몇 곳에 병력을 집중. 확실히 이길 때(전투력비)만 공격
 *  - counter (반격기):   후퇴와 보급로 방어. 고립 위험 부대 후퇴, 거점 지연전
 *  - chinese / stalemate 는 후속 단계(중국군 개입, 교착기)용 자리표시이며 이번 시나리오에서는 도달하지 않는다.
 */
export function currentPhase(state: GameState): GamePhase {
  if (state.date >= '1951-06-01') return 'stalemate';
  if (state.flags.plaIntervened) return 'chinese';
  if (state.flags.counteroffensive || state.flags.incheonHub) return 'counter';
  if (state.date >= '1950-08-01') return 'naktong';
  return 'blitz';
}

export type AIMode = 'offense' | 'defense' | 'withdraw';

const sideUnits = (state: GameState, side: Side) => Object.values(state.units).filter((u) => u.side === side);

function canAttackNow(u: Unit): boolean {
  return u.organization >= 25 && u.fatigue < 85 && u.strength >= u.maxStrength * 0.3;
}

/** 거점까지의 최단 거리(자국 영토 기준) */
function distanceToHubs(state: GameState, side: Side): Record<string, number> {
  const dist: Record<string, number> = {};
  const open: string[] = [];
  for (const h of hubsFor(state, side)) {
    dist[h] = 0;
    open.push(h);
  }
  while (open.length) {
    open.sort((a, b) => dist[b] - dist[a]);
    const cur = open.pop()!;
    for (const n of [...MAP.adjacency[cur], ...MAP.sea[cur]]) {
      if (state.provinces[n].owner !== side || state.provinces[n].external) continue;
      const nd = dist[cur] + stepCost(state, cur, n);
      if (dist[n] === undefined || nd < dist[n]) {
        dist[n] = nd;
        if (!open.includes(n)) open.push(n);
      }
    }
  }
  return dist;
}

function targetPriority(state: GameState, side: Side, t: Province, defPower: number): number {
  let v = t.strategicValue * 10;
  v += 60 / (1 + defPower / 6000); // 방어가 약할수록 가치
  const ownNeighbors = MAP.adjacency[t.id].filter((n) => state.provinces[n].owner === side).length;
  v += ownNeighbors * 3; // 아군에게 둘러싸인 지역(포위·돌출부 제거)
  if (t.supplied) v += 4;
  return v;
}

/** 후퇴/보급선 방어: 거점에 가까워지는 방향으로 한 번에 갈 수 있는 만큼 이동 */
function withdrawTarget(state: GameState, u: Unit, hubDist: Record<string, number>): string | null {
  let cur = u.location;
  let budget = movePoints(state, u);
  let moved = false;
  for (let i = 0; i < 4; i++) {
    const cands = [...MAP.adjacency[cur], ...MAP.sea[cur]].filter(
      (n) => state.provinces[n].owner === u.side && hubDist[n] !== undefined && hubDist[n] < (hubDist[cur] ?? Infinity) && unitsAt(state, n, other(u.side)).length === 0,
    );
    if (!cands.length) break;
    cands.sort((a, b) => hubDist[a] - hubDist[b]);
    const next = cands[0];
    const c = stepCost(state, cur, next);
    if (c > budget) break;
    budget -= c;
    cur = next;
    moved = true;
  }
  return moved ? cur : null;
}

export function planAIOrders(state: GameState, side: Side, modeOverride?: AIMode): void {
  const phase = side === 'north' ? currentPhase(state) : 'naktong';
  const mode: AIMode = modeOverride ?? (phase === 'counter' ? 'withdraw' : 'offense');
  // 중국군은 참전 전에는 중국 영내에서 집결만 한다 (AI 가 마음대로 내려보내지 않는다)
  const mine = sideUnits(state, side).filter((u) => !(u.faction === 'PLA' && !state.flags.plaIntervened));
  for (const u of mine) if (u.order?.issuedTurn !== state.turn) u.order = null; // 매 턴 새로 계획
  const free = new Set(mine.filter((u) => !u.order).map((u) => u.id));
  const ratioNeeded = mode === 'defense' ? 1.5 : mode === 'withdraw' ? AI_BALANCE.attackRatio.counter : AI_BALANCE.attackRatio[phase];
  // 돌파 국면에서는 확실한 우세를 만들 때까지 병력을 집중한다 (성공 확률↑, 대신 동시 공격 지점 수↓)
  const massRatio = phase === 'blitz' ? 1.45 : phase === 'naktong' ? 1.3 : phase === 'stalemate' ? 1.4 : 1.2;
  const maxTargets = phase === 'naktong' ? 4 : phase === 'blitz' || phase === 'chinese' ? 10 : phase === 'stalemate' ? 2 : 4;
  const hubDist = distanceToHubs(state, side);

  // ── 1. 고립·붕괴 위험 부대는 후퇴 ──
  const retreating = new Set<string>();
  for (const u of mine) {
    if (!free.has(u.id)) continue;
    const prov = state.provinces[u.location];
    const enemyAdjPower = MAP.adjacency[u.location]
      .filter((n) => state.provinces[n].owner !== side && !state.provinces[n].external)
      .reduce((s, n) => s + unitsAt(state, n, other(side)).reduce((a, e) => a + infantryPower(e), 0), 0);
    const ownLocal = unitsAt(state, u.location, side).reduce((a, e) => a + infantryPower(e), 0);
    const cutOff = !prov.supplied && u.supply < 20;
    const broken = u.strength < u.maxStrength * 0.35 || u.morale < 20 || u.organization < 20;
    const outgunned = mode === 'withdraw' ? enemyAdjPower > ownLocal * 0.9 : mode === 'defense' ? enemyAdjPower > ownLocal * 1.8 : false;
    if ((cutOff || broken || outgunned) && prov.owner === side) {
      const dest = withdrawTarget(state, u, hubDist);
      if (dest && issueOrder(state, u.id, 'move', dest).ok) {
        retreating.add(u.id);
        free.delete(u.id);
        continue;
      }
      if (broken) {
        issueOrder(state, u.id, 'rest');
        free.delete(u.id);
      }
    }
  }

  // ── 2. 공격 목표 선정 및 병력 집중 ──
  const enemyTargets = new Set<string>();
  for (const u of mine) {
    if (!free.has(u.id) || !canAttackNow(u)) continue;
    for (const t of attackableTargets(state, u)) enemyTargets.add(t);
  }
  const scored = [...enemyTargets].map((tid) => {
    const t = state.provinces[tid];
    const defenders = unitsAt(state, tid, other(side));
    const ctx = battleContextFor(state, t, defenders);
    const defPower = defenders.length ? estimatePower(defenders, [], 'defend', ctx) : 0;
    return { tid, t, defenders, ctx, defPower, prio: targetPriority(state, side, t, defPower) };
  });
  scored.sort((a, b) => b.prio - a.prio);
  const attacking = new Set<string>();
  let committed = 0;
  for (const s of scored) {
    if (committed >= maxTargets) break;
    const cands = mine
      .filter((u) => free.has(u.id) && canAttackNow(u) && attackableTargets(state, u).includes(s.tid))
      .sort((a, b) => infantryPower(b) - infantryPower(a));
    if (!cands.length) continue;
    if (!s.defenders.length) {
      // 무방비 지역은 한 개 부대만 보내 점령
      const u = cands[0];
      if (issueOrder(state, u.id, 'attack', s.tid).ok) {
        free.delete(u.id);
        attacking.add(u.id);
        committed++;
      }
      continue;
    }
    const chosen: Unit[] = [];
    let ratio = 0;
    for (const u of cands) {
      chosen.push(u);
      ratio = calcSide(chosen, s.defenders, 'attack', s.ctx).power / Math.max(1, s.defPower);
      if (ratio >= Math.max(ratioNeeded * 1.08, massRatio)) break;
    }
    const acceptable = ratio >= ratioNeeded || (mode === 'offense' && phase === 'blitz' && ratio >= 0.9 && s.t.strategicValue >= 3);
    if (!acceptable) continue;
    for (const u of chosen) {
      if (issueOrder(state, u.id, 'attack', s.tid).ok) {
        free.delete(u.id);
        attacking.add(u.id);
      }
    }
    committed++;
  }

  // ── 3. 남은 부대: 전선 부대는 방어, 후방 부대는 필요한 전선으로 이동 ──
  const frontNeed: Record<string, number> = {};
  for (const p of Object.values(state.provinces)) {
    if (p.owner !== side || p.external) continue;
    const enemyN = MAP.adjacency[p.id].filter((n) => state.provinces[n].owner !== side && !state.provinces[n].external);
    if (!enemyN.length) continue;
    frontNeed[p.id] = enemyN.reduce((s, n) => {
      const sc = scored.find((x) => x.tid === n);
      return s + (sc ? sc.prio : state.provinces[n].strategicValue * 10 + 30);
    }, 0);
  }
  const assigned: Record<string, number> = {};
  for (const u of mine) if (state.units[u.id].order?.type === 'attack') assigned[u.location] = (assigned[u.location] ?? 0) + 1;
  for (const u of mine) {
    if (!free.has(u.id)) continue;
    const here = u.location;
    const onFront = frontNeed[here] !== undefined;
    const prov = state.provinces[here];
    if (prov.owner !== side) {
      issueOrder(state, u.id, 'defend');
      continue;
    }
    if (u.strength < u.maxStrength * 0.5 || u.organization < 40) {
      issueOrder(state, u.id, 'rest');
      continue;
    }
    if (onFront || mode === 'withdraw') {
      issueOrder(state, u.id, 'defend');
      assigned[here] = (assigned[here] ?? 0) + 1;
      continue;
    }
    // 이동: 가장 필요한 전선 선택
    let best: { id: string; score: number } | null = null;
    for (const [fid, need] of Object.entries(frontNeed)) {
      if (fid === here) continue;
      const path = findPath(state, side, here, fid);
      if (!path) continue;
      const score = need / (1 + (assigned[fid] ?? 0) * 1.5) - path.cost * 0.35;
      if (!best || score > best.score) best = { id: fid, score };
    }
    if (best && issueOrder(state, u.id, 'move', best.id).ok) assigned[best.id] = (assigned[best.id] ?? 0) + 1;
    else issueOrder(state, u.id, 'defend');
  }
}
