import type { GameState } from './types';
import { plaBrigades } from '../data/orbat';
import { spawnTemplate } from './scenario';
import { crossPhase, plaArrivalDays, plaForceTotal } from './china';
import { clamp, daysBetween } from './util';

/**
 * 월경 뒤 참전 전까지 매 턴: 중공군을 압록강 너머(중국 영내)에 쌓고, 첩보 이벤트용 표식을 세운다.
 * 도착 날짜가 되면 plaArrived 를 켠다 (실제 도하는 '중국군 참전' 이벤트가 처리한다).
 * 핵 투하 이후에는 더 쌓이지 않는다.
 */
export function advanceChina(state: GameState): void {
  if (crossPhase(state) !== 'open' || state.flags.plaIntervened || state.flags.plaArrived) return;
  const start = String(state.flags.crossDate ?? state.date);
  const arrival = String(state.flags.plaArrivalDate ?? state.date);
  const total = plaArrivalDays(state);
  const frac = clamp(daysBetween(start, state.date) / Math.max(1, total), 0, 1);
  if (!state.flags.nukeUsed) {
    const want = Math.floor(plaForceTotal(state) * frac);
    const have = Object.values(state.units).filter((u) => u.faction === 'PLA').length;
    const add = want - have;
    if (add > 0) plaBrigades(add, '집결군', 'china').forEach((t) => spawnTemplate(state, t));
  }
  if (frac >= 0.5 && !state.flags.plaStageMid) state.flags.plaStageMid = true;
  if (daysBetween(state.date, arrival) <= 7 && !state.flags.plaImminent) state.flags.plaImminent = true;
  if (state.date >= arrival) state.flags.plaArrived = true;
}
