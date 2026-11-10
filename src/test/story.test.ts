import { describe, expect, it } from 'vitest';
import { createGame } from '../game/engine';
import { checkEvents } from '../game/events';
import { EVENTS } from '../data/events';
import { NARRATIVES, situationLines } from '../data/eventNarrative';
import { STORY_EVENTS } from '../data/eventsStory';

const ready = () => {
  const g = createGame(3);
  g.pendingEvents = [];
  g.date = '1950-08-01';
  return g;
};
const fire = (g: ReturnType<typeof ready>) => {
  g.pendingEvents = [];
  checkEvents(g);
  return g.pendingEvents.map((p) => p.eventId);
};

describe('전황 연동 스토리 이벤트', () => {
  it('모든 스토리 이벤트는 연출 문구를 가지고 등록되어 있다', () => {
    for (const e of STORY_EVENTS) {
      expect(EVENTS.some((x) => x.id === e.id)).toBe(true);
      expect(NARRATIVES[e.id]?.paragraphs.length).toBeGreaterThanOrEqual(2);
    }
  });
  it('수도방어전은 승패에 따라 서로 다른 이벤트가 뜬다', () => {
    const win = ready();
    win.flags.seoulBattle = 'held';
    expect(fire(win)).toContain('seoul_defense_held');
    expect(fire(win)).not.toContain('seoul_fall_battle');

    const lose = ready();
    lose.flags.seoulBattle = 'fell';
    lose.flags.seoulLost = true;
    lose.provinces.seoul.owner = 'north';
    const ids = fire(lose);
    expect(ids).toContain('seoul_fall_battle');
    expect(ids).not.toContain('seoul_defense_held');
    expect(ids).not.toContain('seoul_fall');
  });
  it('대전 함락, 평양 함락, 혈투, 압록강 도달은 상태에 반응한다', () => {
    const g = ready();
    g.provinces.daejeon.owner = 'north';
    expect(fire(g)).toContain('daejeon_fall');
    const p = ready();
    p.provinces.pyongyang.owner = 'south';
    p.flags.pyongyangFallTurn = p.turn;
    expect(fire(p)).toContain('pyongyang_fall');
    const b = ready();
    b.flags.bloodyBattle = '대전';
    b.flags.bloodyBattleInfo = JSON.stringify({ a: 12, d: 10, side: 'north', killed: 3000 });
    expect(fire(b)).toContain('bloody_battle');
    expect(situationLines(b, 'bloody_battle')[0]).toContain('격전지: 대전');
  });
  it('인천상륙 성공은 교두보 확보 시 발동한다', () => {
    const g = ready();
    g.flags.incheonHub = true;
    expect(fire(g)).toContain('incheon_success');
  });
});
