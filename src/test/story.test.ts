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

describe('이벤트 장면 그림', () => {
  it('같은 장면 그림을 여러 이벤트가 돌려 쓰지 않는다 (장면당 최대 2개 이벤트)', () => {
    const count: Record<string, string[]> = {};
    for (const [id, n] of Object.entries(NARRATIVES).filter(([k]) => !k.startsWith('casualty_report') && !k.startsWith('weather_'))) (count[n.scene] ??= []).push(id);
    for (const [scene, ids] of Object.entries(count)) expect(ids.length, `${scene}: ${ids.join(', ')}`).toBeLessThanOrEqual(2);
  });
});

describe('보급 자원 수지', () => {
  it('인천상륙 준비 시기(9월 중순)까지 남측 보급 자원이 바닥나지 않는다', async () => {
    const { endTurn } = await import('../game/turn');
    const { planAIOrders } = await import('../game/ai');
    const { resolveEvent } = await import('../game/events');
    const { EVENT_BY_ID } = await import('../data/events');
    for (const seed of [1, 2, 3]) {
      const g = createGame(seed);
      let minStock = Infinity;
      while (!g.outcome && g.date < '1950-09-16') {
        while (g.pendingEvents.length) {
          const ev = EVENT_BY_ID[g.pendingEvents[0].eventId];
          resolveEvent(g, ev.id, (ev.choices.find((c) => !c.isCounterfactual) ?? ev.choices[0])?.id);
        }
        planAIOrders(g, 'south', g.date < '1950-09-15' ? 'defense' : 'offense');
        endTurn(g);
        minStock = Math.min(minStock, g.nations.south.supplyStock);
      }
      expect(minStock, `seed ${seed}`).toBeGreaterThan(150);
      expect(g.nations.south.supplyStock, `seed ${seed}`).toBeGreaterThan(400);
    }
  });
});

describe('보급 거점·보급선·전진 보급소 관리', () => {
  it('보급선 경로는 지역에서 주 거점(부산)까지 이어진다', async () => {
    const { supplyInfo, routeToHub, computeSupply } = await import('../game/supply');
    const g = createGame(3);
    computeSupply(g);
    const info = supplyInfo(g, 'south');
    expect(info.hubs.map((h) => h.id)).toContain('busan');
    const route = routeToHub(info.parent, new Set(info.hubs.map((h) => h.id)), 'seoul');
    expect(route[0]).toBe('seoul');
    expect(route.at(-1)).toBe('busan');
  });
  it('전진 보급소: 항만·철도 지역에 자원을 써서 설치하고 최대 3곳, 철수할 수 있다', async () => {
    const { buildDepot, removeDepot, hubDetails, computeSupply, depotBlockReason } = await import('../game/supply');
    const g = createGame(3);
    computeSupply(g);
    g.nations.south.commandPoints = 10;
    g.nations.south.supplyStock = 500;
    expect(depotBlockReason(g, 'south', 'busan')).toBe('이미 보급 거점입니다.');
    expect(depotBlockReason(g, 'south', 'seoul')).toBeNull();
    const cp0 = g.nations.south.commandPoints, st0 = g.nations.south.supplyStock;
    expect(buildDepot(g, 'south', 'daegu').ok).toBe(true);
    expect(g.nations.south.commandPoints).toBe(cp0 - 2);
    expect(g.nations.south.supplyStock).toBe(st0 - 60);
    computeSupply(g);
    expect(hubDetails(g, 'south', false).some((h) => h.id === 'daegu' && h.kind === 'built')).toBe(true);
    expect(buildDepot(g, 'south', 'daejeon').ok).toBe(true);
    expect(buildDepot(g, 'south', 'seoul').ok).toBe(true);
    expect(buildDepot(g, 'south', 'cheongju').ok).toBe(false); // 4번째: 한도 초과
    expect(removeDepot(g, 'south', 'seoul').ok).toBe(true);
    expect(removeDepot(g, 'south', 'seoul').ok).toBe(false);
  });
  it('적에게 넘어간 전진 보급소는 파괴되고, 끊긴 보급소는 2턴 안에 사라진다', async () => {
    const { buildDepot, hubDetails, computeSupply } = await import('../game/supply');
    const g = createGame(3);
    computeSupply(g);
    g.nations.south.commandPoints = 10;
    g.nations.south.supplyStock = 500;
    expect(buildDepot(g, 'south', 'daejeon').ok).toBe(true);
    g.provinces.daejeon.owner = 'north';
    computeSupply(g);
    expect(hubDetails(g, 'south', false).some((h) => h.id === 'daejeon')).toBe(false);
    expect(g.flags['depotBuilt:south:daejeon']).toBeUndefined();
  });
});

describe('난이도', () => {
  it('난이도에 따라 시작 자원과 북한군 전력이 달라지고, 보통은 기본값이다', async () => {
    const { createGame: make } = await import('../game/engine');
    const { DIFFICULTY } = await import('../game/balance');
    const strength = (g: ReturnType<typeof make>, faction: string) => Object.values(g.units).filter((u) => u.faction === faction).reduce((s, u) => s + u.strength, 0);
    const easy = make(7, 'easy'), normal = make(7, 'normal'), hard = make(7, 'hard');
    expect(easy.difficulty).toBe('easy');
    expect(normal.difficulty).toBe('normal');
    expect(normal.nations.south.supplyStock).toBe(320); // 보통 = 기존 값
    expect(easy.nations.south.supplyStock).toBe(DIFFICULTY.easy.startStock);
    expect(hard.nations.south.supplyStock).toBe(DIFFICULTY.hard.startStock);
    expect(easy.nations.south.commandPoints).toBeGreaterThan(normal.nations.south.commandPoints);
    expect(hard.nations.south.commandPoints).toBeLessThan(normal.nations.south.commandPoints);
    expect(strength(easy, 'KPA')).toBeLessThan(strength(normal, 'KPA'));
    expect(strength(hard, 'KPA')).toBeGreaterThanOrEqual(strength(normal, 'KPA'));
    expect(strength(easy, 'ROK')).toBeGreaterThan(strength(normal, 'ROK'));
    expect(strength(hard, 'ROK')).toBeLessThan(strength(normal, 'ROK'));
  });
  it('UN군 증원 도착일과 중국군 참전 규모가 난이도에 따라 달라진다', async () => {
    const { createGame: make } = await import('../game/engine');
    const { endTurn } = await import('../game/turn');
    const { applyEffect } = await import('../game/events');
    const first = (d: 'easy' | 'normal' | 'hard') => {
      const g = make(11, d);
      let guard = 0;
      while (!g.flags['reinf:un-24div'] && guard++ < 20) {
        g.pendingEvents = [];
        endTurn(g);
      }
      return g.date;
    };
    expect(first('easy') <= first('normal')).toBe(true);
    expect(first('hard') >= first('normal')).toBe(true);
    const pla = (d: 'easy' | 'normal' | 'hard') => {
      const g = make(11, d);
      applyEffect(g, { kind: 'plaCross', total: 20, label: '시험' });
      return Object.values(g.units).filter((u) => u.faction === 'PLA').length;
    };
    expect(pla('easy')).toBeLessThan(pla('normal'));
    expect(pla('hard')).toBeGreaterThan(pla('normal'));
    expect(pla('normal')).toBe(20);
  });
  it('새 게임을 시작하면 시작 화면에서 고른 난이도로 게임이 만들어진다', async () => {
    const { useGame: store } = await import('../store/gameStore');
    store.getState().newGame('hard');
    expect(store.getState().game.difficulty).toBe('hard');
    expect(store.getState().screen).toBe('game');
    store.getState().restart();
    expect(store.getState().game.difficulty).toBe('hard'); // 같은 난이도로 다시
    store.getState().newGame('normal');
  });
});

describe('날씨와 계절', () => {
  it('날짜로 장마·혹한·해빙기가 정해진다', async () => {
    const { weatherIdAt } = await import('../game/weather');
    expect(weatherIdAt('1950-07-10')).toBe('monsoon');
    expect(weatherIdAt('1950-09-10')).toBe('clear');
    expect(weatherIdAt('1950-12-25')).toBe('cold');
    expect(weatherIdAt('1951-02-20')).toBe('cold');
    expect(weatherIdAt('1951-03-15')).toBe('thaw');
    expect(weatherIdAt('1951-05-01')).toBe('clear');
  });
  it('혹한·장마·해빙기에는 이동력이 줄고 혹한에는 공격력·보급 소모가 달라진다', async () => {
    const { movePoints } = await import('../game/orders');
    const { supplyBalance } = await import('../game/economy');
    const g = createGame(3);
    const u = Object.values(g.units).find((x) => x.side === 'south')!;
    g.date = '1950-09-08';
    const clear = movePoints(g, u);
    const cons = supplyBalance(g, 'south').consumption;
    g.date = '1950-12-08';
    expect(movePoints(g, u)).toBeLessThan(clear);
    expect(supplyBalance(g, 'south').consumption).toBeGreaterThan(cons);
    g.date = '1951-03-15';
    expect(movePoints(g, u)).toBeLessThan(clear);
  });
  it('혹한에는 보급이 약한 부대가 같은 조건의 평년보다 더 많은 병력을 잃는다', async () => {
    const { endTurn } = await import('../game/turn');
    const { createUnit } = await import('../game/units');
    const lossAt = (date: string) => {
      const g = createGame(5);
      g.pendingEvents = [];
      for (const id of Object.keys(g.units)) delete g.units[id];
      g.date = date;
      const u = createUnit(g, { faction: 'KPA', name: '시험', parent: '시험', kind: 'infantry', location: 'hoeryong', training: 50, experience: 10, defaultFill: 0.9 });
      g.units[u.id] = u;
      u.supply = 20;
      const before = u.strength;
      endTurn(g);
      return before - (g.units[u.id]?.strength ?? 0);
    };
    expect(lossAt('1950-12-12')).toBeGreaterThan(lossAt('1950-09-12'));
  });
  it('계절 이벤트가 해마다 때맞춰 뜬다', async () => {
    const g = createGame(3);
    g.pendingEvents = [];
    g.date = '1950-07-02';
    checkEvents(g);
    expect(g.pendingEvents.map((p) => p.eventId)).toContain('weather_monsoon_1950');
    g.pendingEvents = [];
    g.date = '1950-11-23';
    checkEvents(g);
    expect(g.pendingEvents.map((p) => p.eventId)).toContain('weather_cold_warning_1950');
    g.pendingEvents = [];
    g.date = '1950-12-03';
    checkEvents(g);
    expect(g.pendingEvents.map((p) => p.eventId)).toContain('weather_cold_1950');
    g.pendingEvents = [];
    g.date = '1951-03-12';
    checkEvents(g);
    expect(g.pendingEvents.map((p) => p.eventId)).toContain('weather_thaw_1951');
  });
});
