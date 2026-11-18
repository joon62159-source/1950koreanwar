import { describe, expect, it } from 'vitest';
import { createGame } from '../game/engine';
import { applyEffect, checkEvents, resolveEvent } from '../game/events';
import { endTurn } from '../game/turn';
import { usePolicy } from '../game/policies';
import { issueOrder, attackableTargets } from '../game/orders';
import { applyReinforcement } from '../game/scenario';
import { createUnit, needsRest } from '../game/units';
import { ECONOMY, PLA, NUKE } from '../game/balance';
import { mobilize } from '../game/mobilization';
import { planAIOrders } from '../game/ai';
import { computeSupply } from '../game/supply';
import { endingFor, endingKey, endingMood } from '../data/endings';
import { EVENT_BY_ID } from '../data/events';
import type { GameOutcome, GameState } from '../game/types';

const fresh = (seed = 5) => {
  const g = createGame(seed);
  g.pendingEvents = [];
  return g;
};
const spawn = (g: GameState, loc: string, over: Record<string, unknown> = {}) => {
  const u = createUnit(g, { faction: 'ROK', name: '시험', parent: '시험', kind: 'infantry', location: loc, training: 40, experience: 5, defaultFill: 0.9 });
  Object.assign(u, over);
  g.units[u.id] = u;
  return u;
};

describe('정책·보급', () => {
  it('후방 보급 집중은 보급 자원을 +50 올린다', () => {
    const g = fresh();
    g.nations.south.commandPoints = 5;
    const before = g.nations.south.supplyStock;
    expect(usePolicy(g, 'south', 'rear_supply').ok).toBe(true);
    expect(g.nations.south.supplyStock - before).toBe(50);
  });
  it('정전협상 추진은 국민 지지를 깎지 않는다', () => {
    const g = fresh();
    g.flags.talks = 'on';
    g.nations.south.commandPoints = 5;
    const sup = g.nations.south.popularSupport;
    expect(usePolicy(g, 'south', 'push_talks').ok).toBe(true);
    expect(g.nations.south.popularSupport).toBe(sup);
    expect(g.armisticeProgress).toBe(6);
  });
});

describe('훈련·휴식', () => {
  it('훈련 명령을 내리면 1주(7일)에 훈련도가 +15 오른다', () => {
    const g = fresh();
    g.date = '1950-08-01';
    const u = spawn(g, 'busan', { training: 30 });
    issueOrder(g, u.id, 'train');
    const t0 = u.training;
    endTurn(g);
    expect(g.units[u.id].training - t0).toBeCloseTo(ECONOMY.unitTrainPerWeek, 5);
  });
  it('전투를 치르면 훈련도가 오른다', () => {
    const g = fresh();
    g.date = '1950-08-01';
    g.flags.crossPhase = 'open'; // 38선 월경 허용
    const a = spawn(g, 'daegu', { training: 40 });
    const t0 = a.training;
    // 인접한 북측 지역을 공격시킨다
    const enemy = Object.values(g.provinces).find((p) => p.owner === 'north' && !p.external && attackableTargets(g, a).includes(p.id));
    const target = enemy ?? Object.values(g.provinces).find((p) => p.owner === 'north' && !p.external)!;
    a.location = Object.values(g.provinces).find((p) => p.owner === 'south' && !p.external && attackableTargets(g, { ...a, location: p.id }).includes(target.id))!.id;
    issueOrder(g, a.id, 'attack', target.id);
    endTurn(g);
    expect(g.units[a.id]?.training ?? t0).toBeGreaterThan(t0);
  });
  it('휴식 필요 부대는 휴식 명령으로 3주(3턴) 안에 회복된다', () => {
    const g = fresh();
    g.date = '1950-08-01';
    // 보급이 연결된 지역에 지치고 부상병이 많은 부대를 둔다 (병력의 절반이 부상)
    const front = g.provinces.busan;
    const u = spawn(g, front.id, { fatigue: 80, organization: 40, morale: 35, wounded: 1500, strength: 1500 });
    for (let i = 0; i < 3; i++) {
      for (const x of Object.values(g.units)) if (x.id === u.id) { x.order = null; }
      issueOrder(g, u.id, 'rest');
      endTurn(g);
      if (g.outcome) break;
    }
    const after = g.units[u.id];
    expect(after).toBeTruthy();
    expect(needsRest(after)).toBe(false);
  });
});

describe('총동원령 이후 증원', () => {
  it('총동원령 뒤에 도착하는 국군 신편·UN군 증원은 사단급이다', () => {
    const g = fresh();
    mobilize(g, 'rok');
    g.flags.mobilized = true;
    const before = new Set(Object.keys(g.units));
    applyReinforcement(g, 'rok-new-1');
    applyReinforcement(g, 'un-late-1');
    const added = Object.values(g.units).filter((u) => !before.has(u.id));
    expect(added.length).toBeGreaterThanOrEqual(7);
    expect(added.every((u) => u.echelon === 'division')).toBe(true);
    expect(added.every((u) => /사단/.test(u.name))).toBe(true);
  });
  it('총동원령 전에는 여단급으로 도착한다', () => {
    const g = fresh();
    const before = new Set(Object.keys(g.units));
    applyReinforcement(g, 'rok-new-1');
    expect(Object.values(g.units).filter((u) => !before.has(u.id)).every((u) => u.echelon === 'brigade')).toBe(true);
  });
});

describe('중국군', () => {
  it('압록강 너머 아군 지역을 중국 영내에서 곧바로 공격한다', () => {
    const g = fresh();
    g.date = '1950-12-01';
    for (const id of ['sinuiju', 'gusong', 'unsan', 'huichon', 'gangye', 'hyesan', 'gapsan', 'musan', 'hoeryong', 'najin']) g.provinces[id].owner = 'south';
    spawn(g, 'sinuiju', { strength: 3000 });
    g.flags.plaIntervened = true;
    applyEffect(g, { kind: 'plaCross', total: 6, label: '시험' });
    const pla = Object.values(g.units).filter((u) => u.faction === 'PLA');
    expect(pla.length).toBe(6);
    expect(pla.every((u) => u.location === 'china')).toBe(true); // 북측 국경 지역이 없으니 모두 강 너머에 남는다
    expect(pla.every((u) => attackableTargets(g, u).length > 0)).toBe(true);
    planAIOrders(g, 'north');
    expect(pla.some((u) => u.order?.type === 'attack')).toBe(true);
  });
  it('북측이 쥔 국경 지역이 있으면 일부는 들어가고 일부는 강 너머에 남는다', () => {
    const g = fresh();
    for (const id of ['sinuiju', 'gusong', 'unsan']) g.provinces[id].owner = 'south';
    applyEffect(g, { kind: 'plaCross', total: 10, label: '시험' });
    const loc = Object.values(g.units).filter((u) => u.faction === 'PLA').map((u) => u.location);
    expect(loc.includes('china')).toBe(true);
    expect(loc.some((l) => l !== 'china')).toBe(true);
  });
  it('공세(인해전술) 부대는 숫자는 많지만 훈련도·조직력이 낮다', () => {
    const g = fresh();
    g.flags.plaIntervened = true;
    applyEffect(g, { kind: 'spawnPla', count: 4, label: '시험', provinces: ['gangye'], mass: true });
    applyEffect(g, { kind: 'spawnPla', count: 4, label: '시험2', provinces: ['gangye'] });
    const us = Object.values(g.units).filter((u) => u.faction === 'PLA');
    const mass = us.filter((u) => u.traits.includes('인해전술'));
    const std = us.filter((u) => !u.traits.includes('인해전술'));
    expect(mass.length).toBe(4);
    expect(mass[0].training).toBeLessThan(std[0].training);
    expect(mass[0].organization).toBeLessThan(std[0].organization);
  });
  it('중국군 공세 이벤트는 참전 뒤 정해진 시기에 발동하고 핵 투하 뒤에는 발동하지 않는다', () => {
    const g = fresh();
    g.date = '1951-04-25';
    expect(checkEvents(g)).not.toContain('pla_spring_offensive');
    g.flags.plaIntervened = true;
    g.flags.plaIntervenedTurn = g.turn - 10;
    const fired = checkEvents(g);
    expect(fired).toContain('pla_spring_offensive');
    expect(Number(g.flags.plaOffensiveUntil)).toBeGreaterThanOrEqual(g.turn);
    const h = fresh();
    h.date = '1951-04-25';
    h.flags.plaIntervened = true;
    h.flags.nukeUsed = true;
    expect(checkEvents(h)).not.toContain('pla_spring_offensive');
  });
  it('압록강·두만강에 닿은 북한 영토는 중국 참전 후 포위 판정을 받지 않는다 (무산·회령·나진)', () => {
    const g = fresh();
    for (const id of ['pyongyang', 'wonsan', 'sinuiju', 'hamhung', 'gangye', 'hyesan']) if (g.provinces[id]) g.provinces[id].owner = 'south';
    g.flags.plaIntervened = true;
    computeSupply(g);
    for (const id of ['musan', 'hoeryong', 'najin']) if (g.provinces[id].owner === 'north') expect(g.provinces[id].supplied, id).toBe(true);
  });
  it('핵 투하 뒤 소련은 60개 사단으로 참전한다', () => {
    expect(NUKE.sovietDivisions).toBe(60);
    expect(PLA.invasionTotal).toBeGreaterThan(20);
  });
});

describe('엔딩과 거제도', () => {
  const o = (title: string, result: 'victory' | 'defeat' = 'victory'): GameOutcome => ({ turn: 1, date: '1953-07-27', result, grade: 'A', title, reasons: [], score: null });
  it('결과마다 서로 다른 엔딩 장면과 음악이 있다', () => {
    const g = fresh();
    const titles = ['한반도 전역 확보 (대체역사)', '북진 성과 속에 정전', '서울을 지킨 채 정전', '서울을 잃은 채 정전', '명목상의 생존 — 국가 기능 상실', '부산 함락', '전쟁수행능력 붕괴', '전 부대 소멸', '세계대전으로 확대'];
    const keys = titles.map((t) => endingKey(o(t)));
    expect(new Set(keys).size).toBe(titles.length);
    for (const t of titles) {
      const e = endingFor(o(t), g);
      expect(e.paragraphs.length).toBeGreaterThanOrEqual(3);
      expect(e.scene).toBeTruthy();
    }
    const moods = new Set(titles.map((t) => endingMood(o(t))));
    expect(moods.size).toBeGreaterThanOrEqual(4);
  });
  it('엔딩 후일담에는 핵·포로 석방 같은 중대한 선택이 반영된다', () => {
    const g = fresh();
    g.flags.powReleased = true;
    g.flags.nukeUsed = true;
    const text = endingFor(o('서울을 지킨 채 정전'), g).paragraphs.join(' ');
    expect(text).toContain('거제도');
    expect(text).toContain('핵');
  });
  it('거제도 포로 석방 이벤트: 협상 중인 1953년 6월에 뜨며 석방·송환 선택이 협상과 국민 지지를 바꾼다', () => {
    const g = fresh();
    g.date = '1953-06-01';
    g.firedEvents.push('armistice_talks'); // 협상이 시작되지 않은 상태
    expect(checkEvents(g)).not.toContain('geoje_pow_release');
    g.flags.talks = 'on';
    g.armisticeProgress = 50;
    expect(checkEvents(g)).toContain('geoje_pow_release');
    const ev = EVENT_BY_ID.geoje_pow_release;
    expect(ev.choices.map((c) => c.id).sort()).toEqual(['comply', 'release']);
    const a = structuredClone(g);
    resolveEvent(a, 'geoje_pow_release', 'release');
    expect(a.flags.powReleased).toBe(true);
    expect(a.armisticeProgress).toBeLessThan(50);
    const b = structuredClone(g);
    resolveEvent(b, 'geoje_pow_release', 'comply');
    expect(b.armisticeProgress).toBeGreaterThan(50);
  });
});
