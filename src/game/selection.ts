import type { GameState } from './types';
import { unitsAt } from './units';

/**
 * 해당 프로빈스에서 플레이어가 명령을 내릴 수 있는 부대 id.
 * 플레이어 소속 부대만, 그리고 이번 턴에 아직 명령을 받지 않은 부대만 포함한다
 * (이미 명령받은 부대는 명령을 취소해야 다시 선택 가능).
 */
export function selectableUnitIds(state: GameState, provinceId: string): string[] {
  return unitsAt(state, provinceId, state.playerSide)
    .filter((u) => !(u.order && u.order.issuedTurn === state.turn))
    .map((u) => u.id);
}
