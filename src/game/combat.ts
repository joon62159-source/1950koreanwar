import type { BattleReport, GameState, Province, Side, Unit } from './types';
import { COMBAT, PLA } from './balance';
import { applyLosses, fillRatio } from './units';
import { clamp, formatDate, rand, turnDaysFor } from './util';

/**
 * 전투력 = f(병력, 훈련도, 경험, 장비, 조직력, 피로, 보급, 사기, 지형, 방어시설, 병종 상성)
 *
 *  보병 전투력 = 병력 × 숙련(훈련·경험) × 장비(화력 장비 충족률) × 상태(조직·피로·사기·보급·회복)
 *   - 훈련·경험은 "숙련" 항에만, 장비는 "장비" 항에만 반영되어 같은 효과가 두 번 계산되지 않는다.
 *   - 상태 항은 곱이 아니라 "가산 페널티"(최대 70%)라서 한 가지가 낮다고 전투력이 0에 수렴하지 않는다.
 *  전차 전투력 = 전차수 × 환산병력 × 승무원 숙련 × 상태 × 지형 효율 × (1 - 상대 대전차 커버율 × 최대감소)
 *  방어 보정 = 지형 × 방어시설 × 참호 × 항공지원
 */

export function troopQuality(u: Unit): number {
  const q = COMBAT.quality;
  return q.floor + q.training * (u.training / 100) + q.experience * (u.experience / 100);
}

export function equipmentFactor(u: Unit): number {
  const e = COMBAT.equipment;
  const f =
    e.rifles * fillRatio(u, 'rifles') +
    e.machineGuns * fillRatio(u, 'machineGuns') +
    e.mortars * fillRatio(u, 'mortars') +
    e.artillery * fillRatio(u, 'artillery');
  return e.floor + (1 - e.floor) * f;
}

export function stateFactor(u: Unit): number {
  const p = COMBAT.statePenalty;
  const morale = clamp(u.morale / 100, 0, 1);
  const penalty =
    p.organization * (1 - u.organization / 100) +
    p.fatigue * (u.fatigue / 100) +
    p.morale * (1 - morale) +
    p.supply * (1 - u.supply / 100) +
    p.recovery * (1 - u.recovery / 100);
  return 1 - penalty;
}

export function traitFactor(u: Unit): number {
  return 1 + Math.min(2, u.traits.length) * COMBAT.traitBonus * 0.5;
}

/** 단일 부대의 보병 전투력(지형 보정 전) */
export function infantryPower(u: Unit): number {
  return u.strength * troopQuality(u) * equipmentFactor(u) * stateFactor(u) * traitFactor(u);
}

export interface SideCalc {
  units: Unit[];
  men: number;
  quality: number; // 병력 가중 평균 숙련
  equipment: number;
  state: number;
  infantry: number;
  tanks: number; // 전차 전투력(대전차 반영 후)
  tankCount: number;
  antiArmorCover: number; // 상대 전차를 막는 비율(0~1)
  multiplier: number; // 지형·방어시설·참호·항공
  luck: number;
  power: number;
}

export interface BattleContext {
  terrain: Province['terrain'];
  fortification: number;
  entrenched: boolean;
  airSupport: number; // 0~1, 방어측에 적용(제공권을 가진 쪽)
  airSide: Side | null;
}

function weightedAvg(units: Unit[], f: (u: Unit) => number): number {
  const total = units.reduce((s, u) => s + u.strength, 0) || 1;
  return units.reduce((s, u) => s + f(u) * u.strength, 0) / total;
}

export function calcSide(
  units: Unit[],
  enemy: Unit[],
  role: 'attack' | 'defend',
  ctx: BattleContext,
  luck = 1,
): SideCalc {
  const men = units.reduce((s, u) => s + u.strength, 0);
  const myTanks = units.reduce((s, u) => s + u.equip.tanks, 0);
  const enemyAT = enemy.reduce((s, u) => s + u.equip.antiTank, 0);
  const enemyTanks = enemy.reduce((s, u) => s + u.equip.tanks, 0);
  const enemyGuns = enemy.reduce((s, u) => s + u.equip.artillery, 0);
  const cover = myTanks > 0
    ? clamp(
        (enemyAT + enemyTanks * COMBAT.antiArmorTankWeight + enemyGuns * COMBAT.antiArmorGunWeight) /
          (myTanks * COMBAT.antiArmorPerTank),
        0,
        1,
      )
    : 0;
  const infantry = units.reduce((s, u) => s + infantryPower(u), 0);
  const tankTerrain = COMBAT.terrainTank[ctx.terrain] * (role === 'defend' ? 0.85 : 1);
  const tanks = units.reduce((s, u) => {
    if (u.equip.tanks <= 0) return s;
    const crew = COMBAT.tankCrewFloor + (1 - COMBAT.tankCrewFloor) * (u.training / 100);
    return (
      s +
      u.equip.tanks * COMBAT.tankMenEquivalent * crew * stateFactor(u) * tankTerrain * (1 - COMBAT.antiArmorMaxReduction * cover)
    );
  }, 0);
  let multiplier = 1;
  if (role === 'defend') {
    multiplier =
      COMBAT.terrainDefense[ctx.terrain] *
      (1 + COMBAT.fortificationPerLevel * ctx.fortification) *
      (1 + (ctx.entrenched ? COMBAT.entrenchBonus : 0));
  }
  if (role === 'attack' && men > 0) {
    // 야간전 특성(중국군 등): 병력 가중 공격 보너스
    const night = units.reduce((s, u) => s + (u.traits.includes('야간전') ? u.strength : 0), 0) / men;
    multiplier *= 1 + PLA.nightAttackBonus * night;
    // 측면 공격: 서로 다른 출발지에서 동시에 공격
    const origins = new Set(units.map((u) => u.location)).size;
    if (origins >= 3) multiplier *= 1 + PLA.flankBonus[1];
    else if (origins === 2) multiplier *= 1 + PLA.flankBonus[0];
  }
  const side = units[0]?.side;
  if (ctx.airSide && side === ctx.airSide) multiplier *= 1 + COMBAT.airSupportBonus * ctx.airSupport;
  const raw = (infantry + tanks) * multiplier;
  return {
    units,
    men,
    quality: weightedAvg(units, troopQuality),
    equipment: weightedAvg(units, equipmentFactor),
    state: weightedAvg(units, stateFactor),
    infantry,
    tanks,
    tankCount: myTanks,
    antiArmorCover: cover,
    multiplier,
    luck,
    power: raw * luck,
  };
}

/** AI·UI용 추정 전투력(무작위 제외) */
export function estimatePower(
  units: Unit[],
  enemy: Unit[],
  role: 'attack' | 'defend',
  ctx: BattleContext,
): number {
  return calcSide(units, enemy, role, ctx, 1).power;
}

export function battleContextFor(state: GameState, province: Province, defenders: Unit[]): BattleContext {
  const entrenched = defenders.some((u) => u.order?.type === 'defend');
  const airSide: Side | null = state.airSupport > 0 ? 'south' : null;
  return {
    terrain: province.terrain,
    fortification: province.fortification,
    entrenched,
    airSupport: state.airSupport,
    airSide,
  };
}

export interface BattleOutcome {
  report: BattleReport;
  decision: 'attacker_win' | 'defender_win' | 'draw';
  attackerCalc: SideCalc;
  defenderCalc: SideCalc;
}

function describeFactors(a: SideCalc, d: SideCalc, ctx: BattleContext, aLabel: string, dLabel: string): string[] {
  const out: { w: number; text: string }[] = [];
  const add = (label: string, ratio: number, fmt: string) => {
    out.push({ w: Math.abs(Math.log(ratio || 1)), text: `${label}: ${fmt}` });
  };
  const ratio = (x: number, y: number) => (y > 0 ? x / y : x > 0 ? 3 : 1);
  add('병력', ratio(a.men, d.men), `${aLabel} ${Math.round(a.men)}명 vs ${dLabel} ${Math.round(d.men)}명`);
  add('훈련·경험', ratio(a.quality, d.quality), `숙련도 ${aLabel} ${(a.quality * 100).toFixed(0)} vs ${dLabel} ${(d.quality * 100).toFixed(0)}`);
  add('장비', ratio(a.equipment, d.equipment), `장비 화력 ${aLabel} ${(a.equipment * 100).toFixed(0)} vs ${dLabel} ${(d.equipment * 100).toFixed(0)}`);
  add('조직·사기·보급', ratio(a.state, d.state), `상태 ${aLabel} ${(a.state * 100).toFixed(0)} vs ${dLabel} ${(d.state * 100).toFixed(0)}`);
  if (a.tankCount + d.tankCount > 0) {
    const tr = ratio(a.tanks + 50, d.tanks + 50);
    const coverNote = a.tankCount > 0 && a.antiArmorCover < 0.3 ? ` (${dLabel}의 대전차 수단 부족)` : d.tankCount > 0 && d.antiArmorCover < 0.3 ? ` (${aLabel}의 대전차 수단 부족)` : '';
    add('전차·대전차', tr, `전차 전투력 ${aLabel} ${Math.round(a.tanks)} vs ${dLabel} ${Math.round(d.tanks)}${coverNote}`);
  }
  add('지형·방어시설', ratio(a.multiplier, d.multiplier), `방어 보정 ×${d.multiplier.toFixed(2)} (지형 ${terrainKo(ctx.terrain)}, 방어시설 ${ctx.fortification}단계${ctx.entrenched ? ', 참호' : ''})`);
  out.sort((x, y) => y.w - x.w);
  return out.slice(0, 4).map((o) => o.text);
}

export const terrainKo = (t: string) =>
  ({ plain: '평지', paddy: '논', hills: '구릉', mountain: '산악', urban: '도시', river: '하천', coastal: '해안' } as Record<string, string>)[t] ?? t;

/** 한 프로빈스에 대한 하나의 전투를 해결하고 부대를 갱신한다. 후퇴·점령 처리는 turn.ts. */
export function resolveBattle(
  state: GameState,
  province: Province,
  attackers: Unit[],
  defenders: Unit[],
  idSuffix: string,
): BattleOutcome {
  const days = turnDaysFor(state.date);
  const ctx = battleContextFor(state, province, defenders);
  const aLuck = 1 + rand(state, -COMBAT.luckSpread, COMBAT.luckSpread);
  const dLuck = 1 + rand(state, -COMBAT.luckSpread, COMBAT.luckSpread);
  const a = calcSide(attackers, defenders, 'attack', ctx, aLuck);
  const d = calcSide(defenders, attackers, 'defend', ctx, dLuck);
  const R = a.power / Math.max(1, d.power);
  const decision: BattleOutcome['decision'] =
    R >= COMBAT.winRatio ? 'attacker_win' : R <= COMBAT.repulseRatio ? 'defender_win' : 'draw';

  const dayFactor = 0.55 + 0.45 * (days / 7);
  const [lo, hi] = COMBAT.lossClamp;
  const attLossRate = COMBAT.baseLoss * dayFactor * clamp(Math.pow(1 / R, COMBAT.lossExponent), lo, hi);
  const defLossRate = COMBAT.baseLoss * dayFactor * clamp(Math.pow(R, COMBAT.lossExponent), lo, hi) * 0.95;
  const drawMult = decision === 'draw' ? 0.8 : 1;

  let attLoss = 0, defLoss = 0;
  const tankShock = (u: Unit, enemy: SideCalc, own: SideCalc) =>
    enemy.tanks > COMBAT.tankShockThreshold * own.infantry && own.antiArmorCover < 0.3 && u.equip.tanks === 0;

  for (const u of attackers) {
    const shock = tankShock(u, d, a);
    const loss = u.strength * attLossRate * drawMult * (shock ? COMBAT.tankShockLossMult : 1) * rand(state, 0.85, 1.15);
    attLoss += applyLosses(u, loss, 'combat', state);
  }
  for (const u of defenders) {
    const shock = tankShock(u, a, d);
    const loss = u.strength * defLossRate * drawMult * (shock ? COMBAT.tankShockLossMult : 1) * rand(state, 0.85, 1.15);
    defLoss += applyLosses(u, loss, 'combat', state);
  }

  // 사기·조직·피로·경험
  const aMorale = decision === 'attacker_win' ? 5 : decision === 'draw' ? -3 : -(8 + Math.min(8, (1 / R - 1) * 8));
  const dMorale = decision === 'defender_win' ? 5 : decision === 'draw' ? -3 : -(8 + Math.min(10, (R - 1) * 8));
  const shockD = tankShock(defenders[0] ?? attackers[0], a, d) && a.tanks > 0 ? COMBAT.tankShockMorale : 0;
  const shockA = tankShock(attackers[0] ?? defenders[0], d, a) && d.tanks > 0 ? COMBAT.tankShockMorale : 0;
  for (const u of attackers) {
    u.morale = clamp(u.morale + aMorale - (u.equip.tanks === 0 ? shockA : 0), 0, 100);
    u.organization = clamp(u.organization - (decision === 'attacker_win' ? 8 : 16), 0, 100);
    u.fatigue = clamp(u.fatigue + 10, 0, 100);
    u.recovery = clamp(u.recovery - 18, 0, 100);
    u.experience = clamp(u.experience + 2.5 * (1 - u.experience / 100) + (decision === 'attacker_win' ? 1 : 0), 0, 100);
    u.history.push({ turn: state.turn, date: state.date, place: province.name, role: 'attack', result: decision === 'attacker_win' ? 'win' : decision === 'draw' ? 'draw' : 'lose', lossesTaken: 0 });
  }
  for (const u of defenders) {
    u.morale = clamp(u.morale + dMorale - (u.equip.tanks === 0 ? shockD : 0), 0, 100);
    u.organization = clamp(u.organization - (decision === 'defender_win' ? 7 : 18), 0, 100);
    u.fatigue = clamp(u.fatigue + 8, 0, 100);
    u.recovery = clamp(u.recovery - 14, 0, 100);
    u.experience = clamp(u.experience + 2.5 * (1 - u.experience / 100) + (decision === 'defender_win' ? 1 : 0), 0, 100);
    u.history.push({ turn: state.turn, date: state.date, place: province.name, role: 'defend', result: decision === 'defender_win' ? 'win' : decision === 'draw' ? 'draw' : 'lose', lossesTaken: 0 });
  }
  if (attackers[0]) attackers.forEach((u) => (u.history[u.history.length - 1].lossesTaken = Math.round(attLoss / attackers.length)));
  if (defenders[0]) defenders.forEach((u) => (u.history[u.history.length - 1].lossesTaken = Math.round(defLoss / defenders.length)));

  const aSide = attackers[0]?.side ?? 'north';
  const aLabel = aSide === 'north' ? '북한군' : '아군';
  const dLabel = aSide === 'north' ? '아군' : '북한군';
  const reasons = describeFactors(a, d, ctx, aLabel, dLabel);
  reasons.unshift(
    `전투력 ${aLabel}(공격) ${Math.round(a.power)} vs ${dLabel}(방어) ${Math.round(d.power)} — 비율 ${R.toFixed(2)} (지휘 변수: 공격 ×${aLuck.toFixed(2)}, 방어 ×${dLuck.toFixed(2)})`,
  );

  const report: BattleReport = {
    id: `${state.turn}-${province.id}-${idSuffix}`,
    turn: state.turn,
    date: state.date,
    province: province.id,
    provinceName: province.name,
    attackerSide: aSide,
    attackerPower: Math.round(a.power),
    defenderPower: Math.round(d.power),
    attackerUnits: attackers.map((u) => u.id),
    defenderUnits: defenders.map((u) => u.id),
    outcome: decision,
    attackerLosses: attLoss,
    defenderLosses: defLoss,
    retreated: false,
    captured: false,
    surrounded: false,
    moraleChange: { attacker: Math.round(aMorale), defender: Math.round(dMorale) },
    supplyUsed: {
      attacker: Math.round(attackers.reduce((s, u) => s + u.strength, 0) / 1000 * 1.6 * days / 3),
      defender: Math.round(defenders.reduce((s, u) => s + u.strength, 0) / 1000 * 1.2 * days / 3),
    },
    reasons,
    attackerCasualty: { killed: 0, wounded: 0, missing: 0 },
    defenderCasualty: { killed: 0, wounded: 0, missing: 0 },
    attackerRoster: [],
    defenderRoster: [],
    retreatTo: null,
    stepId: '',
  };
  void formatDate;
  return { report, decision, attackerCalc: a, defenderCalc: d };
}
