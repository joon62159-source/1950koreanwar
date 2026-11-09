import type { GameOutcome, GameState, ScoreBreakdown } from './types';
import { ARMISTICE, SCENARIO, SCORE } from './balance';
import { totalStrength } from './units';
import { clamp, formatDate } from './util';
import { MAP } from './map';

/**
 * 승패 조건 (초기 프로토타입: 대한민국 플레이)
 *  패배: (1) 부산이 북한군에 점령됨  (2) 전쟁수행능력이 붕괴(< COLLAPSE_THRESHOLD)  (3) 남측 부대가 전부 소멸
 *  승리: 시나리오 종료일(SCENARIO.endDate)까지 위 패배 조건 없이 생존하고 종합 점수가 MIN_VICTORY_SCORE 이상 → 등급 평가
 *  종료일까지 살아남았으나 점수가 미달이면 "국가 기능 상실" 패배
 */
export const COLLAPSE_THRESHOLD = 10;
/** 종료일까지 버텨도 종합 점수가 이 값 미만이면 "명목상의 생존"으로 보아 패배 처리한다 */
export const MIN_VICTORY_SCORE = 35;

export function computeScore(state: GameState): ScoreBreakdown {
  const init = state.initialTotals;
  const strength = totalStrength(state, 'south');
  const owned = Object.values(state.provinces).filter((p) => p.owner === 'south');
  // 총동원령 이후에는 정원이 사단급으로 커지므로 기준 병력도 정원 증가분만큼 키운다
  const authorized = Object.values(state.units).filter((u) => u.side === 'south').reduce((s, u) => s + u.maxStrength, 0);
  const baseline = state.flags.mobilized ? Math.max(init.southStrength * 1.8, authorized * 0.6) : init.southStrength * 1.8;
  const remainingForce = SCORE.maxForce * clamp(strength / baseline, 0, 1);
  const territory = SCORE.maxTerritory * clamp(owned.length / (init.southProvinces + 15), 0, 1);
  const popularSupport = SCORE.maxSupport * (state.nations.south.popularSupport / 100);
  const popSum = owned.reduce((a, p) => a + p.population, 0) || 1;
  const avgDamage = owned.reduce((a, p) => a + p.warDamage * p.population, 0) / popSum;
  const warDamage = SCORE.maxDamage * (1 - clamp(avgDamage / 100, 0, 1));
  const casualtyPenalty = Math.min(SCORE.casualtyCap, (state.nations.south.casualties / 1000) * SCORE.casualtyPerThousand) + state.warWeariness * 0.08;
  let bonus = 0;
  if (state.provinces.seoul.owner === 'south') bonus += SCORE.bonusSeoul;
  const beyond38 = Object.values(state.provinces).some((p) => p.owner === 'south' && p.initialOwner === 'north' && MAP.geometry[p.id].lat >= 38.2);
  if (beyond38 && state.diplomacy.chinaThreat < 60 && state.warWeariness < 70) bonus += SCORE.bonusBeyond38;
  const total = clamp(Math.round(remainingForce + territory + popularSupport + warDamage - casualtyPenalty + bonus), 0, 100);
  return { remainingForce, territory, popularSupport, warDamage, casualtyPenalty, bonus, total };
}

export function gradeFor(total: number): string {
  const [s, a, b, c] = SCORE.gradeCuts;
  return total >= s ? 'S' : total >= a ? 'A' : total >= b ? 'B' : total >= c ? 'C' : 'D';
}

export function checkOutcome(state: GameState): GameOutcome | null {
  const base = { turn: state.turn, date: state.date };
  if (state.provinces.busan.owner === 'north') {
    return { ...base, result: 'defeat', grade: '-', title: '부산 함락', reasons: ['북한군이 핵심 보급 거점 부산을 점령했습니다.', '대한민국은 더 이상 조직적으로 저항할 수 없습니다.'], score: null };
  }
  if (state.nations.south.warCapacity < COLLAPSE_THRESHOLD) {
    return { ...base, result: 'defeat', grade: '-', title: '전쟁수행능력 붕괴', reasons: ['병력·산업·보급·국민 지지를 종합한 전쟁수행능력이 한계 아래로 떨어졌습니다.'], score: null };
  }
  if (totalStrength(state, 'south') <= 0) {
    return { ...base, result: 'defeat', grade: '-', title: '전 부대 소멸', reasons: ['더 이상 운용할 수 있는 부대가 없습니다.'], score: null };
  }
  // 북한 체제 붕괴: 북측 지역이 거의 없고 중국군도 없음
  const northOwned = Object.values(state.provinces).filter((p) => p.owner === 'north').length;
  const plaLeft = Object.values(state.units).some((u) => u.faction === 'PLA');
  if (northOwned <= 4 && !plaLeft && state.provinces.pyongyang.owner === 'south') {
    const score = computeScore(state);
    return { ...base, result: 'victory', grade: 'S', title: '한반도 전역 확보 (대체역사)', reasons: ['북한 지역 대부분을 확보하고 중국군 개입도 없었습니다. 실제 역사와 다른 결과입니다.'], score };
  }
  const armistice = state.armisticeProgress >= ARMISTICE.signAt;
  if (state.date >= SCENARIO.endDate || armistice) {
    const score = computeScore(state);
    if (score.total < MIN_VICTORY_SCORE) {
      return { ...base, result: 'defeat', grade: '-', title: '명목상의 생존 — 국가 기능 상실', reasons: [`부산은 지켰지만 종합 점수 ${score.total}점으로 최소 기준(${MIN_VICTORY_SCORE}점)에 미달했습니다.`, '병력·영토·국민 지지·전쟁 피해를 종합하면 국가가 전쟁을 지속할 수 없는 상태입니다.'], score };
    }
    const grade = gradeFor(score.total);
    const seoul = state.provinces.seoul.owner === 'south';
    const gained = Object.values(state.provinces).filter((p) => p.owner === 'south' && p.initialOwner === 'north').length;
    return {
      ...base,
      result: 'victory',
      grade,
      title: gained >= 10 ? '북진 성과 속에 정전' : seoul ? '서울을 지킨 채 정전' : '서울을 잃은 채 정전',
      reasons: [
        armistice ? `${formatDate(state.date)} 정전협상이 타결되었습니다.` : `${formatDate(SCENARIO.endDate)} 정전 시점까지 대한민국이 존속했습니다.`,
        `전쟁 피로도 ${Math.round(state.warWeariness)} · 북측에서 확보한 지역 ${gained}곳 — 군사적 성과가 곧 국가 이익은 아닙니다.`,
        seoul ? '수도 서울을 수복했습니다.' : '서울은 아직 적의 손에 있습니다.',
        state.diplomacy.chinaThreat >= 60 ? '북진은 중국 개입 위험을 크게 높였습니다. 다음 단계의 전쟁이 기다리고 있습니다.' : '중국 개입 위험은 아직 관리 가능한 수준입니다.',
      ],
      score,
    };
  }
  return null;
}
