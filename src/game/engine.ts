import { newGame } from './scenario';
import { checkEvents } from './events';

/** 새 게임을 만들고 시작 시점의 이벤트(남침)를 발동시킨다 */
export function createGame(seed = 1950) {
  const s = newGame(seed);
  checkEvents(s);
  return s;
}
