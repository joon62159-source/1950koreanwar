import type { GameState, Province, Side } from './types';
import { ECONOMY, UN_REPLACEMENT } from './balance';
import { clamp } from './util';
import { newFormation, reinforceUnit } from './units';
import { spendCP } from './economy';
import type { Result } from './orders';

const fail = (reason: string): Result => ({ ok: false, reason });

/**
 * 국가 징집 체계.
 *  - 국가의 징병 가능 인구 = 현재 통제 중인 프로빈스의 "남은 징병 가능 인구"를 행정 통제 효율로 보정해 합산한 값
 *  - 점령 직후(안정도 낮음)는 효율이 낮고, 안정도가 DRAFT_MIN 미만이면 0. 수복하면 남은 자원에 다시 접근한다.
 *  - 이미 징집된 인원(drafted)은 영구히 차감된다. 부상병 복귀는 징집이 아니므로 풀을 다시 깎지 않는다.
 */
export function draftEfficiency(p: Province): number {
  return p.controlStability < ECONOMY.draftMinStability ? 0 : clamp(p.controlStability / 100, 0, 1);
}

export function provinceDraftable(p: Province): number {
  return Math.floor(p.recruitablePopulation * draftEfficiency(p));
}

export function nationalDraftPool(state: GameState, side: Side): number {
  return Object.values(state.provinces)
    .filter((p) => p.owner === side)
    .reduce((s, p) => s + provinceDraftable(p), 0);
}

/** 통제 프로빈스에서 amount 명을 가용량에 비례해 차감한다. 실제 차감한 인원을 반환(가용량 초과 불가). */
export function drawFromProvinces(state: GameState, side: Side, amount: number): number {
  const owned = Object.values(state.provinces).filter((p) => p.owner === side);
  const avail = owned.map((p) => provinceDraftable(p));
  const total = avail.reduce((a, b) => a + b, 0);
  const take = Math.min(Math.floor(amount), total);
  if (take <= 0) return 0;
  const alloc = avail.map((a) => Math.floor((take * a) / total));
  let left = take - alloc.reduce((a, b) => a + b, 0);
  const order = avail.map((a, i) => i).sort((x, y) => avail[y] - avail[x]);
  for (const i of order) {
    if (left <= 0) break;
    if (alloc[i] < avail[i]) {
      alloc[i] += 1;
      left -= 1;
    }
  }
  owned.forEach((p, i) => {
    p.recruitablePopulation -= alloc[i];
    p.drafted += alloc[i];
  });
  return take;
}

/** 평상시 징집 (국가 관리 화면): 징병 가능 인구에서 훈련병 풀로 */
export function nationalDraft(state: GameState, side: Side, amount: number = ECONOMY.draftBatch): Result {
  const pool = nationalDraftPool(state, side);
  if (pool <= 0) return fail('징병 가능한 인구가 없습니다. (통제 지역 안정도·영토를 확인하세요)');
  const cp = spendCP(state, side);
  if (!cp.ok) return cp;
  const taken = drawFromProvinces(state, side, amount);
  const t = state.nations[side].trainees;
  const total = t.count + taken;
  t.training = (t.training * t.count + ECONOMY.draftTraining * taken) / Math.max(1, total);
  t.count = total;
  return { ok: true, reason: `${taken.toLocaleString('ko-KR')}명을 징집해 훈련병 풀에 편입했습니다.` };
}

/** 훈련병 훈련 (CP 1): 훈련병 풀의 평균 훈련도 상승 */
export function trainTrainees(state: GameState, side: Side): Result {
  const t = state.nations[side].trainees;
  if (t.count <= 0) return fail('훈련할 훈련병이 없습니다.');
  if (t.training >= ECONOMY.trainingCap.recruits) return fail('훈련병 훈련소의 한계에 도달했습니다. 부대에 편입해 훈련하세요.');
  const cp = spendCP(state, side);
  if (!cp.ok) return cp;
  t.training = Math.min(ECONOMY.trainingCap.recruits, t.training + ECONOMY.recruitTrainGain);
  return { ok: true };
}

/** 턴마다 훈련병이 자동으로 조금씩 훈련된다 */
export function autoTrainTrainees(state: GameState, days: number): void {
  for (const side of ['south', 'north'] as Side[]) {
    const t = state.nations[side].trainees;
    if (t.count > 0) t.training = Math.min(ECONOMY.trainingCap.recruits, t.training + ECONOMY.traineeAutoTrainPerWeek * (days / 7));
  }
}

/** UN군 보충병 하루 도착량: 미국 개입도·UN 지지·항만 접근에 비례 (순수 계산) */
export function unReplacementPerDay(state: GameState): number {
  const ports = Object.values(state.provinces).filter((p) => p.owner === 'south' && p.portCapacity > 0).reduce((s, p) => s + p.portCapacity, 0);
  const portF = clamp(ports / 12, 0, 1);
  const d = state.diplomacy;
  return UN_REPLACEMENT.perDayFull * (d.usCommitment / 100) * (0.5 + 0.5 * (d.unSupport / 100)) * portF;
}

/**
 * UN군 자동 보충. 보충병이 UN 보충 풀(nations.south.replacementPool)에 쌓이고, 이번 턴 전투하지 않았고
 * 보급이 연결된 UN군 부대 중 정원 충족률이 낮은 부대부터 채운다. 평균 훈련도·경험은 병력 가중으로 섞이며 장비는 자동 배분이 별도로 채운다.
 * 반환: 이번 턴 실제로 보충된 인원
 */
export function autoUnReplacements(state: GameState, days: number, fought: Set<string> = new Set()): number {
  const nat = state.nations.south;
  nat.replacementPool = Math.min(UN_REPLACEMENT.poolCap, nat.replacementPool + unReplacementPerDay(state) * days);
  const needy = Object.values(state.units)
    .filter((u) => u.faction === 'UN' && !fought.has(u.id) && u.strength < u.maxStrength * 0.95 && state.provinces[u.location].owner === 'south' && state.provinces[u.location].supplied)
    .sort((a, b) => a.strength / a.maxStrength - b.strength / b.maxStrength);
  let given = 0;
  for (const u of needy) {
    if (nat.replacementPool < 1) break;
    const want = Math.min(u.maxStrength - u.strength, u.maxStrength * UN_REPLACEMENT.maxPerUnitShare, nat.replacementPool);
    const add = reinforceUnit(u, want, UN_REPLACEMENT.training, { organization: UN_REPLACEMENT.organization, morale: UN_REPLACEMENT.morale });
    nat.replacementPool -= add;
    given += add;
  }
  return given;
}

/** 훈련병으로 기존 부대를 보충. 훈련병 풀에서 차감하며 부대 평균 숙련도가 섞인다. */
export function reinforceFromPool(state: GameState, side: Side, unitId: string): Result {
  const u = state.units[unitId];
  if (!u || u.side !== side) return fail('아군 부대가 아닙니다.');
  if (u.faction !== (side === 'south' ? 'ROK' : 'KPA')) return fail('국가 훈련병은 자국군(국군) 부대에만 보충할 수 있습니다. (UN군은 각자의 보충 체계 사용)');
  const prov = state.provinces[u.location];
  if (prov.owner !== side || !prov.supplied) return fail('보급이 연결된 아군 지역의 부대만 보충할 수 있습니다.');
  const t = state.nations[side].trainees;
  if (t.count <= 0) return fail('훈련병 풀이 비어 있습니다. 먼저 징집하세요.');
  if (u.strength >= u.maxStrength) return fail('이미 정원입니다.');
  const cp = spendCP(state, side);
  if (!cp.ok) return cp;
  const added = reinforceUnit(u, t.count, t.training, { organization: 55, morale: 55 });
  t.count -= added;
  return { ok: true, reason: `${u.name}에 ${added.toLocaleString('ko-KR')}명 보충 (훈련병 풀에서 차감)` };
}

/** 새 부대 창설: 총동원령 전에는 여단, 후에는 사단이 기본 편성 단위 */
export function createFormation(state: GameState, side: Side, provinceId: string): Result {
  const p = state.provinces[provinceId];
  if (!p || p.owner !== side) return fail('아군 통제 지역이 아닙니다.');
  const echelon = side === 'south' && state.flags.mobilized ? 'division' : 'brigade';
  const t = state.nations[side].trainees;
  const min = ECONOMY.formationMin[echelon];
  if (t.count < min) return fail(`${echelon === 'division' ? '사단' : '여단'} 창설에는 훈련병 ${min.toLocaleString('ko-KR')}명 이상이 필요합니다.`);
  const cp = spendCP(state, side, 2);
  if (!cp.ok) return cp;
  const count = Math.min(t.count, ECONOMY.formationMax[echelon]);
  const u = newFormation(state, side === 'south' ? 'ROK' : 'KPA', provinceId, count, t.training, echelon);
  t.count -= count;
  state.units[u.id] = u;
  return { ok: true, reason: `${u.name}을(를) 창설했습니다. (${count.toLocaleString('ko-KR')}명, 장비는 자동 배분으로 충당)` };
}

/** 인구 변동: 전쟁 피해와 피란으로 인구가 줄고 징병 대상도 함께 준다. 이미 징집된 인원은 되돌려지지 않는다. */
export function updatePopulation(state: GameState, days: number): void {
  for (const p of Object.values(state.provinces)) {
    if (p.warDamage > 0) p.population = Math.max(1000, Math.round(p.population * (1 - 0.0012 * (p.warDamage / 100) * (days / 7))));
    p.draftEligible = Math.round(p.population * ECONOMY.recruitableShare);
    p.recruitablePopulation = Math.max(0, p.draftEligible - p.drafted);
  }
}

