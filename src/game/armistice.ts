import type { GameState } from './types';
import { ARMISTICE } from './balance';
import { clamp } from './util';

/** 하루 정전협상 진척 (%/일). 계획 일수에 100%가 되는 속도에 전쟁 피로 보정을 곱한다. */
export function armisticeRatePerDay(state: GameState): number {
  const delay = Number(state.flags.armisticeDelayDays ?? 0); // 미국 설득으로 늘어난(+) 또는 줄어든(−) 일수
  const planned = state.flags.earlyArmistice ? ARMISTICE.earlyDays : Math.max(ARMISTICE.plannedDays * 0.5, ARMISTICE.plannedDays + delay);
  return (100 / planned) * (1 + (ARMISTICE.wearinessBoost * state.warWeariness) / 100);
}

/** 협상 진척을 days 일만큼 진행 */
export function advanceArmistice(state: GameState, days: number): void {
  if (state.flags.talks !== 'on') return;
  state.armisticeProgress = clamp(state.armisticeProgress + armisticeRatePerDay(state) * days, 0, 100);
}

/** 예상 완료: 지금 속도가 유지될 때 남은 턴 수(14일 턴 기준, 이른 정전은 7일 턴)와 일수 */
export function armisticeForecast(state: GameState): { turnsLeft: number; daysLeft: number } | null {
  if (state.flags.talks !== 'on') return null;
  const rate = armisticeRatePerDay(state);
  const daysLeft = Math.ceil(Math.max(0, 100 - state.armisticeProgress) / Math.max(1e-6, rate));
  const perTurn = state.flags.earlyArmistice ? 7 : 14;
  return { turnsLeft: Math.ceil(daysLeft / perTurn), daysLeft };
}
