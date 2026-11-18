import type { GameState, Side } from './types';
import { CROSS, DIFFICULTY, PLA } from './balance';
import { addDays, addLog, daysBetween, turnDaysFor } from './util';

/**
 * 38선 월경과 중국의 개입.
 *  - 남한군이 "원래 북한 영토"를 처음 공격하려 하면 중국의 경고가 뜬다 (명령 확정 전에 확인 창).
 *  - '멈춘다'를 고르면 CROSS.banDays 일 동안 월경이 금지되고, 끝나면 '최종 결정'(이른 정전 / 월경) 이벤트가 뜬다.
 *  - '넘는다'를 고르면(처음이든 최종 결정이든) 그날부터 중공군이 압록강 너머에 쌓이고, 난이도별 일수 뒤에 참전한다.
 *  상태는 flags 에 담는다: crossPhase('idle'|'banned'|'open'|'closed'), banUntil, crossDate, plaArrivalDate, plaStageStarted/Mid, plaImminent, plaArrived
 */
export type CrossPhase = 'idle' | 'banned' | 'open' | 'closed';

export const crossPhase = (s: GameState): CrossPhase => (s.flags.crossPhase as CrossPhase | undefined) ?? 'idle';

/** 시작 때 북측 땅이던 곳을 지금도 북측이 쥐고 있는가 (이곳을 치는 것이 '월경') */
export function isCrossTarget(state: GameState, targetId: string): boolean {
  const p = state.provinces[targetId];
  return !!p && !p.external && p.initialOwner === 'north' && p.owner === 'north';
}

export type CrossGate = { kind: 'warn' } | { kind: 'banned'; daysLeft: number; final: boolean } | { kind: 'closed' };

/** side 가 target 을 공격하기 전에 막히는지: null 이면 자유 */
export function crossGate(state: GameState, side: Side, targetId: string): CrossGate | null {
  if (side !== 'south' || !isCrossTarget(state, targetId)) return null;
  const ph = crossPhase(state);
  if (ph === 'open') return null;
  if (ph === 'idle') return { kind: 'warn' };
  if (ph === 'closed') return { kind: 'closed' };
  const until = String(state.flags.banUntil ?? state.date);
  const daysLeft = Math.max(0, daysBetween(state.date, until));
  return { kind: 'banned', daysLeft, final: daysLeft <= 0 };
}

/** 일수를 '약 N턴 · D일' 문구로 */
export function daysToTurnText(state: GameState, days: number): string {
  const per = turnDaysFor(state.date);
  return `${Math.max(1, Math.ceil(days / per))}턴 · ${days}일`;
}

export function crossGateReason(state: GameState, gate: CrossGate): string {
  if (gate.kind === 'warn') return '38선을 넘으려면 먼저 중국의 경고를 확인해야 합니다.';
  if (gate.kind === 'closed') return '정전협상을 선택해 38선을 넘을 수 없습니다.';
  if (gate.final) return '월경 제한 기간이 끝났습니다. 최종 결정(이른 정전 / 월경)을 내려야 합니다.';
  return `38선 월경 제한 중입니다. (${daysToTurnText(state, gate.daysLeft)} 남음)`;
}

/** 참전 시 투입되는 중국군 총 규모 (난이도 반영) */
export function plaForceTotal(state: GameState): number {
  return Math.max(0, PLA.invasionTotal + DIFFICULTY[state.difficulty ?? 'normal'].plaExtra);
}

export const plaArrivalDays = (state: GameState): number => DIFFICULTY[state.difficulty ?? 'normal'].plaArrivalDays;

/** 월경한다: 그날부터 중공군이 쌓이기 시작한다 */
export function declareCross(state: GameState): void {
  if (crossPhase(state) === 'open') return;
  state.flags.crossPhase = 'open';
  state.flags.crossDate = state.date;
  state.flags.plaArrivalDate = addDays(state.date, plaArrivalDays(state));
  state.flags.plaStageStarted = true;
  delete state.flags.banUntil;
  addLog(state, 'warn', '38선을 넘기로 결정했습니다. 중국군이 압록강 너머에 집결하기 시작할 것입니다.');
}

/** 38선에서 멈춘다: 일정 기간 월경 금지, 끝나면 최종 결정 */
export function declareHalt(state: GameState): void {
  state.flags.crossPhase = 'banned';
  state.flags.banUntil = addDays(state.date, CROSS.banDays);
  addLog(state, 'info', `38선에서 멈추기로 했습니다. ${CROSS.banDays}일간 원래 국경을 넘을 수 없습니다.`);
}

/** 최종 결정에서 정전협상을 택한다 (이른 정전) */
export function declareEarlyArmistice(state: GameState): void {
  state.flags.crossPhase = 'closed';
  state.flags.talks = 'on';
  state.flags.earlyArmistice = true;
  addLog(state, 'info', '38선에서 정전협상을 시작하기로 했습니다.');
}

export interface ChinaStatus {
  phase: CrossPhase;
  /** 월경 제한이 끝나기까지 남은 일수 (banned 일 때) */
  banDaysLeft: number;
  /** 제한이 끝나 최종 결정을 기다리는 중 */
  finalPending: boolean;
  /** 압록강 너머에 쌓인 중공군 사단 수 / 참전 때 총 규모 */
  staged: number;
  total: number;
  arrivalDaysLeft: number;
  arrived: boolean;
}

export function chinaStatus(state: GameState): ChinaStatus {
  const phase = crossPhase(state);
  const arrived = !!state.flags.plaIntervened;
  const banDaysLeft = phase === 'banned' ? Math.max(0, daysBetween(state.date, String(state.flags.banUntil ?? state.date))) : 0;
  const staged = Object.values(state.units).filter((u) => u.faction === 'PLA' && u.location === 'china').length;
  const arrivalDaysLeft = phase === 'open' && !arrived ? Math.max(0, daysBetween(state.date, String(state.flags.plaArrivalDate ?? state.date))) : 0;
  return { phase, banDaysLeft, finalPending: phase === 'banned' && banDaysLeft <= 0, staged, total: plaForceTotal(state), arrivalDaysLeft, arrived };
}
