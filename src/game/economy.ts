import type { GameState, Province, Side } from './types';
import { ECONOMY } from './balance';
import { clamp } from './util';
import { unitsOfSide } from './units';
import type { Result } from './orders';

const fail = (reason: string): Result => ({ ok: false, reason });

/** 안정도·전쟁피해를 반영한 실질 산업 능력 */
export function effectiveIndustry(p: Province): number {
  return p.industrialCapacity * (p.controlStability / 100) * (1 - p.warDamage / 200);
}

/** 일일 장비 생산 점수(표시용) */
export function dailyProduction(p: Province): number {
  return effectiveIndustry(p) / 100;
}

export function spendCP(state: GameState, side: Side, cost = 1): Result {
  const n = state.nations[side];
  if (n.commandPoints < cost) return fail('행정 점수(명령권)가 부족합니다.');
  n.commandPoints -= cost;
  return { ok: true };
}

function ownProvince(state: GameState, side: Side, id: string): Province | Result {
  const p = state.provinces[id];
  if (!p) return fail('존재하지 않는 지역입니다.');
  if (p.owner !== side) return fail('아군이 통제하는 지역이 아닙니다.');
  return p;
}
const isResult = (x: Province | Result): x is Result => (x as Result).ok !== undefined;

export function repairInfrastructure(state: GameState, side: Side, id: string): Result {
  const p = ownProvince(state, side, id);
  if (isResult(p)) return p;
  if (p.infrastructure >= 100 && p.warDamage <= 0) return fail('복구할 피해가 없습니다.');
  const cp = spendCP(state, side);
  if (!cp.ok) return cp;
  p.infrastructure = clamp(p.infrastructure + ECONOMY.repairInfraGain, 0, 100);
  p.warDamage = clamp(p.warDamage - ECONOMY.repairDamageGain, 0, 100);
  p.industrialCapacity = Math.min(p.industrialBase, p.industrialCapacity + ECONOMY.repairDamageGain * 0.3);
  return { ok: true };
}

export function fortify(state: GameState, side: Side, id: string): Result {
  const p = ownProvince(state, side, id);
  if (isResult(p)) return p;
  if (p.fortification >= 5) return fail('방어시설이 최대 단계입니다.');
  const cost = ECONOMY.fortifyCost;
  const n = state.nations[side];
  if (n.supplyStock < 12) return fail('방어시설 강화에 필요한 보급 자원(12)이 부족합니다.');
  const cp = spendCP(state, side, cost);
  if (!cp.ok) return cp;
  n.supplyStock -= 12;
  p.fortification += 1;
  return { ok: true };
}

/** 1턴치 안정도·산업 회복 (장비 생산은 production.ts 에서 자동 처리) */
export function advanceEconomy(state: GameState, days: number): void {
  for (const p of Object.values(state.provinces)) {
    const home = p.owner === p.initialOwner;
    const cap = home ? 100 : 85;
    p.controlStability = clamp(p.controlStability + ECONOMY.stabilityRecoveryPerDay * days * (home ? 1 : 0.6), 0, cap);
    p.industrialCapacity = Math.min(p.industrialBase * (1 - p.warDamage / 150), p.industrialCapacity + days * 0.08);
    p.equipmentProduction = Math.round(dailyProduction(p) * 100) / 100;
  }
}

/** 보급 자원 수지 */
export function advanceNations(state: GameState, days: number): void {
  for (const side of ['south', 'north'] as Side[]) {
    const n = state.nations[side];
    let production = 0;
    for (const p of Object.values(state.provinces)) if (p.owner === side) production += effectiveIndustry(p) * ECONOMY.stockPerIndustryDay;
    const aid = side === 'south' ? 7 * state.diplomacy.usCommitment / 100 * 3 : 5 * state.diplomacy.sovietSupport / 100 * 3;
    const consumption = (unitsOfSide(state, side).reduce((s, u) => s + u.strength, 0) / 1000) * ECONOMY.consumptionPerThousandDay;
    n.supplyStock = Math.max(0, n.supplyStock + (production + aid - consumption) * days);
  }
}

export function computeWarCapacity(state: GameState, side: Side): number {
  const n = state.nations[side];
  const init = state.initialTotals;
  let industry = 0;
  for (const p of Object.values(state.provinces)) if (p.owner === side) industry += effectiveIndustry(p);
  const iBase = side === 'south' ? init.southIndustry : init.northIndustry;
  const fBase = side === 'south' ? init.southStrength : init.northStrength;
  const force = unitsOfSide(state, side).reduce((s, u) => s + u.strength, 0);
  const A = clamp(industry / Math.max(1, iBase), 0, 1);
  const B = clamp(force / Math.max(1, fBase * 0.8), 0, 1);
  const C = clamp(n.supplyStock / 250, 0, 1);
  const D = clamp(n.popularSupport / 100, 0, 1);
  return Math.round(100 * (0.3 * A + 0.3 * B + 0.2 * C + 0.2 * D));
}
