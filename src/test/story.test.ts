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

describe('중국 프로빈스와 중공군 개입', () => {
  it('중국은 압록강·두만강 유역 북한 프로빈스 전부와 맞닿고 아군은 공격·진입할 수 없다', async () => {
    const { MAP } = await import('../game/map');
    const { CHINA_BORDER_PROVINCES } = await import('../data/outline');
    const { attackableTargets, validateOrder } = await import('../game/orders');
    for (const id of ['sinuiju', 'hyesan', 'gangye', 'musan', 'hoeryong', 'unsan', 'gusong']) expect(MAP.adjacency.china).toContain(id);
    expect([...MAP.adjacency.china].sort()).toEqual([...CHINA_BORDER_PROVINCES].sort());
    const g = createGame(3);
    g.provinces.sinuiju.owner = 'south';
    const u = Object.values(g.units).find((x) => x.side === 'south')!;
    u.location = 'sinuiju';
    u.order = null;
    expect(attackableTargets(g, u)).not.toContain('china');
    expect(validateOrder(g, u, 'attack', 'china').ok).toBe(false);
    expect(validateOrder(g, u, 'move', 'china').ok).toBe(false);
  });
  it('38선을 넘으면 중국 영내에 8개 사단이 집결하고, 평양 함락 2턴 뒤 20개 사단이 국경을 넘는다', () => {
    const g = createGame(3);
    g.pendingEvents = [];
    g.date = '1950-10-10';
    g.provinces.sariwon.owner = 'south';
    g.provinces.hwangju.owner = 'south';
    g.provinces.hwangju.initialOwner = 'north';
    g.provinces.sariwon.initialOwner = 'north';
    checkEvents(g);
    expect(g.pendingEvents.map((p) => p.eventId)).toContain('pla_massing');
    const pla = () => Object.values(g.units).filter((u) => u.faction === 'PLA');
    expect(pla().length).toBe(8);
    expect(pla().every((u) => u.location === 'china')).toBe(true);
    g.provinces.pyongyang.owner = 'south';
    g.flags.pyongyangFallTurn = g.turn - 2;
    g.pendingEvents = [];
    checkEvents(g);
    expect(pla().length).toBe(20);
    expect(pla().every((u) => u.location !== 'china' && g.provinces[u.location].owner === 'north')).toBe(true);
  });
});

describe('중국 프로빈스는 병력이 넘어오는 곳일 뿐이다', () => {
  it('북한군·중국군도 중국으로 이동할 수 없고, 중국 영내 부대는 포위·보급 단절 판정을 받지 않는다', async () => {
    const { validateOrder, findPath } = await import('../game/orders');
    const { computeSupply } = await import('../game/supply');
    const { endTurn } = await import('../game/turn');
    const g = createGame(3);
    const north = Object.values(g.units).find((u) => u.side === 'north')!;
    north.location = 'sinuiju';
    north.order = null;
    expect(validateOrder(g, north, 'move', 'china').ok).toBe(false);
    expect(findPath(g, 'north', 'sinuiju', 'china')).toBeNull();
    computeSupply(g);
    expect(g.provinces.china.supplied).toBe(true); // 포위 판정 대상이 아님
    expect(g.provinces.china.supplyLevel).toBe(100);
  });
  it('핵 투하: 중국군이 큰 타격을 입고 이후 회복·증원이 불가능하며, 소련 개입은 확률로 결정된다', async () => {
    const { applyEffect } = await import('../game/events');
    const { applyReinforcement } = await import('../game/scenario');
    const g = createGame(3);
    applyEffect(g, { kind: 'spawnPla', count: 4, label: '시험', provinces: ['china'] });
    const before = Object.values(g.units).filter((u) => u.faction === 'PLA').map((u) => u.strength);
    applyEffect(g, { kind: 'nuke' });
    const after = Object.values(g.units).filter((u) => u.faction === 'PLA').map((u) => u.strength);
    expect(after.reduce((a, b) => a + b, 0)).toBeLessThan(before.reduce((a, b) => a + b, 0) * 0.8);
    expect(g.flags.nukeUsed).toBe(true);
    g.flags.plaIntervened = true;
    expect(applyReinforcement(g, 'pla-wave-5')).toBeNull();
    let hits = 0;
    for (let i = 0; i < 400; i++) {
      const h = createGame(i + 1);
      applyEffect(h, { kind: 'chance', p: 0.4, then: [{ kind: 'flag', key: 'sovietPending', value: true }] });
      if (h.flags.sovietPending) hits++;
    }
    expect(hits).toBeGreaterThan(120);
    expect(hits).toBeLessThan(200);
  });
  it('핵 이벤트: 6월에 발동하며 거부하면 맥아더 해임, 소련 참전 시 40개 사단이 투입된다', () => {
    const g = createGame(3);
    g.pendingEvents = [];
    g.date = '1951-06-05';
    g.flags.plaIntervened = true;
    checkEvents(g);
    expect(g.pendingEvents.map((p) => p.eventId)).toContain('nuclear_debate');
    g.flags.sovietPending = true;
    g.pendingEvents = [];
    checkEvents(g);
    expect(Object.values(g.units).filter((u) => u.faction === 'SOV').length).toBe(40);
    expect(g.pendingEvents.map((p) => p.eventId)).toContain('soviet_intervention');
  });
});
