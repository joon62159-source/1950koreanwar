import {
  EQUIP_KEYS,
  type CasualtyTally,
  type Echelon,
  type Equip,
  type EquipKey,
  type Faction,
  type GameState,
  type Side,
  type Unit,
  type UnitKind,
} from './types';
import { CASUALTY, DIVISION_TOE, MOVEMENT, UNIT_TOE } from './balance';
import { clamp, other, sideOfFaction } from './util';

export const emptyEquip = (): Equip => ({ rifles: 0, machineGuns: 0, mortars: 0, artillery: 0, antiTank: 0, tanks: 0, vehicles: 0 });
export const emptyTally = (): CasualtyTally => ({ killed: 0, wounded: 0, missing: 0 });

export interface UnitSpec {
  id?: string;
  faction: Faction;
  name: string;
  parent: string;
  kind: UnitKind;
  echelon?: Echelon;
  location: string;
  strengthPct?: number; // 최대병력 대비 시작 병력
  training: number;
  experience: number;
  morale?: number;
  /** 장비 충족률(0~1): 키별. 생략 시 defaultFill */
  fill?: Partial<Record<EquipKey, number>>;
  defaultFill?: number;
  traits?: string[];
}

/** 사단급 정원: 여단급 장비 정원을 병력 비율만큼 키운다 (장비가 저절로 생기지는 않는다) */
export function scaledNeed(kind: UnitKind, echelon: Echelon): { maxStrength: number; need: Equip } {
  const brigade = UNIT_TOE[kind];
  if (echelon === 'brigade') return { maxStrength: brigade.maxStrength, need: { ...brigade.need } };
  const max = DIVISION_TOE[kind].maxStrength;
  const ratio = max / brigade.maxStrength;
  const need = emptyEquip();
  for (const k of EQUIP_KEYS) need[k] = Math.round(brigade.need[k] * ratio);
  return { maxStrength: max, need };
}

export function createUnit(state: GameState, spec: UnitSpec): Unit {
  const echelon = spec.echelon ?? 'brigade';
  const toe = scaledNeed(spec.kind, echelon);
  const equip = emptyEquip();
  for (const k of EQUIP_KEYS) {
    const f = spec.fill?.[k] ?? spec.defaultFill ?? 0.8;
    equip[k] = Math.round(toe.need[k] * f);
  }
  const id = spec.id ?? `${sideOfFaction(spec.faction) === 'south' ? 'S' : 'N'}${String(state.nextUnitNumber++).padStart(3, '0')}`;
  return {
    id,
    faction: spec.faction,
    side: sideOfFaction(spec.faction),
    name: spec.name,
    historicalParent: spec.parent,
    kind: spec.kind,
    echelon,
    location: spec.location,
    maxStrength: toe.maxStrength,
    strength: Math.round(toe.maxStrength * (spec.strengthPct ?? 1)),
    wounded: 0,
    record: emptyTally(),
    emergencyTroops: 0,
    restTurns: 0,
    equipDamaged: emptyEquip(),
    training: spec.training,
    experience: spec.experience,
    morale: spec.morale ?? 65,
    fatigue: 0,
    organization: 90,
    recovery: 100,
    supply: 85,
    equip,
    equipNeed: toe.need,
    traits: spec.traits ?? [],
    history: [],
    speed: MOVEMENT.speedByKind[spec.kind],
    order: null,
    acted: false,
  };
}

/** 장비 충족률 0~1 (정상 장비만 센다. 손상 장비는 수리되기 전까지 쓸 수 없다) */
export function fillRatio(u: Unit, k: EquipKey): number {
  const need = u.equipNeed[k];
  if (need <= 0) return 1;
  // 병력이 줄면 필요 장비도 비례해서 줄어든다
  const scaled = need * (u.strength / u.maxStrength);
  return clamp(u.equip[k] / Math.max(1, scaled), 0, 1);
}

export function unitsAt(state: GameState, provinceId: string, side?: Side): Unit[] {
  return Object.values(state.units).filter((u) => u.location === provinceId && (!side || u.side === side));
}

export function unitsOfSide(state: GameState, side: Side): Unit[] {
  return Object.values(state.units).filter((u) => u.side === side);
}

/** 현재 가용 병력 합계 (부상병·실종·포로 제외) */
export function totalStrength(state: GameState, side: Side): number {
  return unitsOfSide(state, side).reduce((s, u) => s + u.strength, 0);
}

export interface ReinforceOpts {
  /** 신병의 조직력 (기존 병력과 가중 평균) */
  organization?: number;
  morale?: number;
  emergency?: boolean;
}

/**
 * 병력 보충. 평균 훈련도·경험이 병력 가중 평균으로 변한다.
 * 신병은 경험 0이므로 경험 많은 기존 병력과 섞이면 부대 평균 경험이 낮아진다. 장비는 따라오지 않는다.
 */
export function reinforceUnit(u: Unit, count: number, recruitTraining: number, opts: ReinforceOpts = {}): number {
  const room = u.maxStrength - u.strength;
  const add = Math.max(0, Math.min(Math.floor(count), room));
  if (add <= 0) return 0;
  const total = u.strength + add;
  u.training = (u.training * u.strength + recruitTraining * add) / total;
  u.experience = (u.experience * u.strength) / total;
  u.morale = clamp((u.morale * u.strength + (opts.morale ?? 50) * add) / total, 0, 100);
  if (opts.organization !== undefined) u.organization = clamp((u.organization * u.strength + opts.organization * add) / total, 0, 100);
  if (opts.emergency) u.emergencyTroops += add;
  u.strength = total;
  return add;
}

export type LossKind = keyof typeof CASUALTY.splits;

/**
 * 손실 적용. 병력은 0 미만이 되지 않는다.
 * 손실은 전사(영구)·부상(치료 후 복귀 가능, 가용 병력이 아님)·실종/포로로 나뉘어 부대 기록과 국가 통계에 함께 반영된다.
 * 장비도 같은 비율로 잃으며, 그중 일부는 수리 가능한 "손상" 상태로 남는다. 반환값은 가용 병력 감소량.
 */
export function applyLosses(u: Unit, lost: number, kind: LossKind = 'combat', state?: GameState): number {
  const real = clamp(Math.round(lost), 0, u.strength);
  if (real === 0) return 0;
  const keep = (u.strength - real) / u.strength;
  u.strength -= real;
  const sp = CASUALTY.splits[kind];
  const killed = Math.round(real * sp.killed);
  const wounded = Math.round(real * sp.wounded);
  const missing = real - killed - wounded;
  u.wounded += wounded;
  u.record.killed += killed;
  u.record.wounded += wounded;
  u.record.missing += missing;
  const nat = state?.nations[u.side];
  if (nat) {
    nat.stats.killed += killed;
    nat.stats.wounded += wounded;
    nat.stats.missing += missing;
    nat.casualties += real;
  }
  for (const k of EQUIP_KEYS) {
    const lostEq = Math.round(u.equip[k] * (1 - keep));
    u.equip[k] = Math.max(0, u.equip[k] - lostEq);
    u.equipDamaged[k] += Math.round(lostEq * CASUALTY.equipDamagedShare);
  }
  return real;
}

export interface DissolveResult {
  killed: number;
  missing: number;
  equipCaptured: number;
}

/**
 * 부대 소멸(전멸·해체). 부대 조직이 사라지는 것이지 전원 전사가 아니다.
 *  - 잔존 가용 병력: 일부는 전사, 나머지는 포로·실종
 *  - 치료 중이던 부상병: 후송 경로가 끊겨 포로·실종 처리 (가용 병력 아님)
 *  - 장비: 일부는 적이 노획(상대 국가 군수 재고), 나머지는 파괴·유실
 * 소멸한 부대는 되살아나지 않는다.
 */
export function dissolveUnit(state: GameState, u: Unit, kind: 'annihilated' | 'disbanded'): DissolveResult {
  const rem = u.strength;
  const killed = kind === 'annihilated' ? Math.round(rem * CASUALTY.annihilatedKilledShare) : 0;
  const missing = rem - killed + u.wounded;
  const nat = state.nations[u.side];
  nat.stats.killed += killed;
  nat.stats.missing += missing;
  nat.stats.wounded -= u.wounded; // 부상으로 집계된 인원이 포로·실종으로 재분류됨 (중복 집계 방지)
  nat.stats.unitsDestroyed += 1;
  nat.casualties += rem;
  u.record.killed += killed;
  u.record.missing += missing;
  u.record.wounded -= u.wounded;
  let captured = 0;
  if (kind === 'annihilated') {
    const enemy = state.nations[other(u.side)];
    for (const k of EQUIP_KEYS) {
      const got = Math.round(u.equip[k] * CASUALTY.capturedEquipShare);
      enemy.equipStock[k] += got;
      captured += got;
    }
  }
  u.strength = 0;
  u.wounded = 0;
  delete state.units[u.id];
  return { killed, missing, equipCaptured: captured };
}

/** 새 편성 부대(신병으로 창설). 장비는 없다 — 자동 배분으로 나중에 채워진다. */
export function newFormation(
  state: GameState,
  faction: Faction,
  provinceId: string,
  count: number,
  training: number,
  echelon: Echelon,
  kind: UnitKind = 'infantry',
): Unit {
  const label = echelon === 'division' ? '사단' : '여단';
  const u = createUnit(state, {
    faction,
    name: `신편 제${state.nextUnitNumber}${label}`,
    parent: '신편(게임 내 창설)',
    kind,
    echelon,
    location: provinceId,
    training,
    experience: 0,
    morale: 55,
    defaultFill: 0,
  });
  u.strength = Math.min(u.maxStrength, count);
  u.organization = 55;
  u.recovery = 60;
  u.supply = 60;
  return u;
}

/** 자동 회복 후보 판정용: 부상병 비율 */
export const woundedRatio = (u: Unit) => u.wounded / Math.max(1, u.maxStrength);
/** 손상(수리 대기) 장비 비율 */
export function damagedEquipRatio(u: Unit): number {
  let dmg = 0, tot = 0;
  for (const k of EQUIP_KEYS) {
    dmg += u.equipDamaged[k];
    tot += u.equipDamaged[k] + u.equip[k];
  }
  return tot > 0 ? dmg / tot : 0;
}

/** 휴식이 필요한 부대인가: 피로·조직력·사기·부상병·손상 장비 */
export function needsRest(u: Unit): boolean {
  return u.fatigue >= 35 || u.organization < 60 || u.morale < 50 || woundedRatio(u) >= 0.06 || damagedEquipRatio(u) >= 0.1;
}
