import { EQUIP_KEYS, type Equip, type EquipKey, type GameState, type Province, type Side, type Unit } from './types';
import { AID, COMBAT, ECONOMY } from './balance';
import { MOBILIZATION_PROFILES } from '../data/mobilization';
import { MAP } from './map';
import { clamp } from './util';
import { effectiveIndustry } from './economy';
import { emptyEquip, unitsOfSide } from './units';

/**
 * 군수 자동 생산·배분.
 *  - 각 프로빈스는 산업 특성에 따라 만들 수 있는 장비가 제한되고, 국가 전체의 부족 현황에 맞춰 생산 비중이 자동 결정된다.
 *  - 생산품은 국가 군수 재고에 합산된다. 점령당한 지역은 더 이상 국가 생산에 기여하지 않는다.
 *  - 재고는 장비가 부족한 부대에 자동 배분된다. 보급이 끊긴 부대는 배분 대상이 아니다.
 *  - 사단 편제 확대로 병력이 늘어도 장비는 저절로 생기지 않는다: 정원(수요)이 늘어 부족이 커질 뿐이다.
 */

/** 프로빈스 산업 능력에 따른 생산 가능 품목 (전차는 국내 생산 불가) */
export function producibleKeys(p: Province): EquipKey[] {
  const ind = p.industrialBase / 10; // 0~9
  const keys: EquipKey[] = [];
  if (ind >= 1) keys.push('rifles');
  if (ind >= 2) keys.push('machineGuns', 'mortars');
  if (ind >= 3) keys.push('antiTank', 'vehicles');
  if (ind >= 4) keys.push('artillery');
  return keys.filter((k) => ECONOMY.productionPerDay[k] > 0);
}

/** 국가 전체 장비 정원(수요)·보유·재고 */
export function nationalEquip(state: GameState, side: Side): { need: Equip; have: Equip; damaged: Equip; stock: Equip; shortage: Equip } {
  const need = emptyEquip(), have = emptyEquip(), damaged = emptyEquip(), shortage = emptyEquip();
  for (const u of unitsOfSide(state, side)) {
    const f = u.strength / u.maxStrength;
    for (const k of EQUIP_KEYS) {
      need[k] += u.equipNeed[k] * f;
      have[k] += u.equip[k];
      damaged[k] += u.equipDamaged[k];
    }
  }
  const stock = state.nations[side].equipStock;
  for (const k of EQUIP_KEYS) shortage[k] = Math.max(0, need[k] - have[k] - damaged[k] - stock[k]);
  return { need, have, damaged, stock, shortage };
}

export function productionMultiplier(state: GameState, side: Side): number {
  const prof = side === 'south' ? MOBILIZATION_PROFILES.rok : MOBILIZATION_PROFILES.kpa;
  return state.flags[prof.doneFlag] ? prof.productionBoost : 1;
}

/** 외부 장비 지원 하루 도착량 (남: UN 지원, 북: 소련·중국 지원). 상태를 바꾸지 않는 순수 계산 */
export function aidPerDay(state: GameState, side: Side): Equip {
  const out = emptyEquip();
  const ports = Object.values(state.provinces).filter((p) => p.owner === side && p.portCapacity > 0).reduce((s, p) => s + p.portCapacity, 0);
  const portF = clamp(ports / AID.portCapacityFull, 0, 1);
  let f: number;
  let table: Record<EquipKey, number>;
  if (side === 'south') {
    const d = state.diplomacy;
    f = (d.usCommitment / 100) * (0.5 + 0.5 * (d.unSupport / 100)) * portF * (state.flags.mobilized ? AID.mobilizationSurge : 1);
    table = AID.un;
  } else {
    // 북측은 육로(만주) 보급선도 있어 항만이 없어도 일부 도착한다. 제공권 폭격(차단)에 약해진다.
    f = (state.diplomacy.sovietSupport / 100) * (0.6 + 0.4 * portF) * (1 - 0.5 * state.interdiction) * (state.flags.kpaMobilized ? AID.mobilizationSurge : 1) * (state.flags.plaIntervened ? AID.plaSurge : 1);
    table = AID.soviet;
  }
  for (const k of EQUIP_KEYS) out[k] = table[k] * f;
  return out;
}

/** 이번 턴 외부 장비 지원을 국가 군수 재고에 합산한다 (이후 자동 배분) */
export function autoExternalAid(state: GameState, side: Side, days: number): Equip {
  const per = aidPerDay(state, side);
  const got = emptyEquip();
  const stock = state.nations[side].equipStock;
  for (const k of EQUIP_KEYS) {
    got[k] = per[k] * days;
    stock[k] += got[k];
  }
  return got;
}

/** 이번 턴 자동 생산: 각 통제 프로빈스의 산업력을 부족 비율에 따라 허용 품목에 나눠 쓴다 */
export function autoProduction(state: GameState, side: Side, days: number): Equip {
  const made = emptyEquip();
  const nat = state.nations[side];
  const { need, shortage } = nationalEquip(state, side);
  const ratio = (k: EquipKey) => clamp(shortage[k] / Math.max(1, need[k]), 0, 1.5);
  const mult = productionMultiplier(state, side);
  for (const p of Object.values(state.provinces)) {
    if (p.owner !== side) continue;
    const keys = producibleKeys(p);
    if (!keys.length) continue;
    const points = (effectiveIndustry(p) / 100) * days * mult;
    if (points <= 0) continue;
    const weights = keys.map((k) => ratio(k) + 0.1);
    const wsum = weights.reduce((a, b) => a + b, 0);
    keys.forEach((k, i) => {
      const out = ECONOMY.productionPerDay[k] * points * (weights[i] / wsum) * keys.length;
      nat.equipStock[k] += out;
      made[k] += out;
    });
  }
  return made;
}

/** 배분 우선순위: 장비 충족률 · 전선 중요도 · 전투 투입 여부 · 보급 경로 · 전투력 기여 */
export function distributionPriority(state: GameState, u: Unit, fought: Set<string>): number {
  const prov = state.provinces[u.location];
  const enemyNear = MAP.adjacency[u.location].some((n) => state.provinces[n].owner !== u.side);
  const frontImportance = prov.strategicValue / 10 + (enemyNear ? 1 : 0);
  return 1 + frontImportance + (fought.has(u.id) ? 0.5 : 0);
}

const WEIGHT: Record<EquipKey, number> = {
  rifles: COMBAT.equipment.rifles,
  machineGuns: COMBAT.equipment.machineGuns,
  mortars: COMBAT.equipment.mortars,
  artillery: COMBAT.equipment.artillery,
  antiTank: 0.2,
  tanks: 0.3,
  vehicles: 0.05,
};

/** 국가 재고를 장비가 부족한 부대에 자동 배분. 보급이 끊기거나 적 영토에 있는 부대는 제외. */
export function autoDistribute(state: GameState, side: Side, fought: Set<string> = new Set()): void {
  const stock = state.nations[side].equipStock;
  const eligible = unitsOfSide(state, side).filter((u) => {
    const p = state.provinces[u.location];
    return p.owner === side && p.supplied;
  });
  for (const k of EQUIP_KEYS) {
    const avail = Math.floor(stock[k]);
    if (avail <= 0) continue;
    const gaps = eligible.map((u) => {
      const scaled = u.equipNeed[k] * (u.strength / u.maxStrength);
      return Math.max(0, Math.floor(scaled - u.equip[k] - u.equipDamaged[k]));
    });
    // 충족률이 낮은 부대·전선 부대일수록 가중치가 크다
    const w = eligible.map((u, i) => {
      if (gaps[i] <= 0) return 0;
      const scaled = Math.max(1, u.equipNeed[k] * (u.strength / u.maxStrength));
      const lack = 1 - clamp(u.equip[k] / scaled, 0, 1);
      return gaps[i] * (0.3 + lack) * distributionPriority(state, u, fought) * (0.5 + WEIGHT[k]);
    });
    const wsum = w.reduce((a, b) => a + b, 0);
    if (wsum <= 0) continue;
    let given = 0;
    eligible.forEach((u, i) => {
      if (w[i] <= 0) return;
      const share = Math.min(gaps[i], Math.floor((avail * w[i]) / wsum));
      u.equip[k] += share;
      given += share;
    });
    stock[k] -= given;
  }
}
