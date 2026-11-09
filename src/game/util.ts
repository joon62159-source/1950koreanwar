import type { GameState } from './types';
import { SCENARIO } from './balance';

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** 상태에 저장되는 시드 기반 난수 (mulberry32). 같은 저장 데이터는 같은 결과를 낸다. */
export function nextRandom(state: GameState): number {
  let t = (state.rng += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  state.rng = state.rng >>> 0;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const rand = (state: GameState, lo: number, hi: number) => lo + (hi - lo) * nextRandom(state);

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function turnDaysFor(iso: string): number {
  if (iso < SCENARIO.shortTurnUntil) return SCENARIO.shortTurnDays;
  return iso >= SCENARIO.longTurnFrom ? SCENARIO.longTurnDays : SCENARIO.normalTurnDays;
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${y}년 ${m}월 ${d}일`;
}

export const sideOfFaction = (f: string): 'south' | 'north' => (f === 'ROK' || f === 'UN' ? 'south' : 'north');
export const other = (s: 'south' | 'north'): 'south' | 'north' => (s === 'south' ? 'north' : 'south');

export function addLog(state: GameState, kind: 'info' | 'battle' | 'event' | 'warn' | 'good', text: string) {
  state.log.push({ turn: state.turn, date: state.date, kind, text });
  if (state.log.length > 400) state.log.splice(0, state.log.length - 400);
}
