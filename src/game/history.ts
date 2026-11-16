import type { GameState, HistoryEntry } from './types';
import { unitsOfSide } from './units';

/** 지역 통제 상태를 한 글자씩(s=남, n=북) 이어 붙인 문자열. 순서는 state.provinces 의 순서(중국 제외). */
function ownersString(state: GameState): string {
  return Object.values(state.provinces)
    .filter((p) => !p.external)
    .map((p) => (p.owner === 'south' ? 's' : 'n'))
    .join('');
}

/** 지금 상태를 진행 기록에 한 칸 덧붙인다 (게임 시작과 매 턴 끝에 호출). 진행 다시 보기에 쓰인다. */
export function recordHistory(state: GameState): void {
  const prev = state.history[state.history.length - 1];
  const owners = ownersString(state);
  state.history.push({
    turn: state.turn,
    date: state.date,
    owners,
    south: [...owners].filter((c) => c === 's').length,
    north: [...owners].filter((c) => c === 'n').length,
    killedS: state.nations.south.stats.killed,
    killedN: state.nations.north.stats.killed,
    strengthS: Math.round(unitsOfSide(state, 'south').reduce((a, u) => a + u.strength, 0)),
    strengthN: Math.round(unitsOfSide(state, 'north').reduce((a, u) => a + u.strength, 0)),
    fired: state.firedEvents.length,
    events: state.firedEvents.slice(prev?.fired ?? 0),
  });
}

/** 기록 한 칸과 바로 앞 칸을 비교해 바뀐 지역 id 를 돌려준다 */
export function ownerChanges(state: GameState, i: number): { id: string; to: 'south' | 'north' }[] {
  const ids = Object.values(state.provinces).filter((p) => !p.external).map((p) => p.id);
  const cur = state.history[i]?.owners;
  const prev = state.history[i - 1]?.owners;
  if (!cur || !prev) return [];
  const out: { id: string; to: 'south' | 'north' }[] = [];
  for (let k = 0; k < ids.length; k++) if (cur[k] !== prev[k]) out.push({ id: ids[k], to: cur[k] === 's' ? 'south' : 'north' });
  return out;
}

export type { HistoryEntry };
