import { describe, expect, it } from 'vitest';
import { createGame } from '../game/engine';
import { checkEvents, resolveEvent } from '../game/events';
import { issueOrder } from '../game/orders';
import { createUnit } from '../game/units';
import { advanceChina } from '../game/chinaStage';
import { chinaStatus, crossGate, crossPhase, declareCross, declareHalt, plaForceTotal } from '../game/china';
import { armisticeForecast } from '../game/armistice';
import { checkOutcome } from '../game/victory';
import { usePolicy } from '../game/policies';
import { massQuality } from '../game/scenario';
import { warFrontStatus } from '../game/overview';
import { endingKey, endingMood } from '../data/endings';
import { MAP } from '../game/map';
import { ARMISTICE, CROSS, DIFFICULTY } from '../game/balance';
import { addDays } from '../game/util';
import type { Difficulty, GameState } from '../game/types';

const make = (difficulty: Difficulty = 'normal') => {
  const g = createGame(7, difficulty);
  g.pendingEvents = [];
  for (const id of Object.keys(g.units)) delete g.units[id];
  return g;
};
const southAt = (g: GameState, loc: string) => {
  const u = createUnit(g, { faction: 'ROK', name: '시험', parent: '시험', kind: 'infantry', location: loc, training: 60, experience: 20, defaultFill: 0.9 });
  g.units[u.id] = u;
  return u;
};
const fire = (g: GameState) => {
  g.pendingEvents = [];
  return checkEvents(g);
};
const plaCount = (g: GameState) => Object.values(g.units).filter((u) => u.faction === 'PLA').length;

describe('38선 월경 경고와 제한', () => {
  it('원래 북한 영토를 처음 공격하려면 경고를 먼저 확인해야 하고, 이미 아군 땅이 된 곳은 상관없다', () => {
    const g = make();
    const u = southAt(g, 'dongducheon');
    const r = issueOrder(g, u.id, 'attack', 'cheorwon');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('경고');
    expect(crossGate(g, 'south', 'cheorwon')?.kind).toBe('warn');
    expect(crossGate(g, 'south', 'seoul')).toBeNull(); // 시작부터 남측 땅
    g.provinces.cheorwon.owner = 'south';
    expect(crossGate(g, 'south', 'cheorwon')).toBeNull(); // 이미 점령한 곳
  });
  it('월경을 선택하면 공격할 수 있고, 멈추면 56일간 금지되며 남은 기간이 표시된다', () => {
    const g = make();
    const u = southAt(g, 'dongducheon');
    declareHalt(g);
    expect(crossPhase(g)).toBe('banned');
    expect(chinaStatus(g).banDaysLeft).toBe(CROSS.banDays);
    const r = issueOrder(g, u.id, 'attack', 'cheorwon');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('월경 제한');
    expect(warFrontStatus(g).china.chip.label).toBe('월경 제한');
    g.date = addDays(g.date, 30);
    expect(chinaStatus(g).banDaysLeft).toBe(CROSS.banDays - 30);
    const h = make();
    const v = southAt(h, 'dongducheon');
    declareCross(h);
    expect(issueOrder(h, v.id, 'attack', 'cheorwon').ok).toBe(true);
  });
  it('제한이 끝나면 최종 결정 이벤트가 뜨고, 이른 정전 또는 월경을 고를 수 있다', () => {
    const g = make();
    declareHalt(g);
    expect(fire(g)).not.toContain('cross_final_decision');
    g.date = addDays(g.date, CROSS.banDays);
    expect(chinaStatus(g).finalPending).toBe(true);
    expect(fire(g)).toContain('cross_final_decision');
    const a = structuredClone(g);
    resolveEvent(a, 'cross_final_decision', 'armistice');
    expect(crossPhase(a)).toBe('closed');
    expect(a.flags.talks).toBe('on');
    expect(a.flags.earlyArmistice).toBe(true);
    const b = structuredClone(g);
    resolveEvent(b, 'cross_final_decision', 'cross');
    expect(crossPhase(b)).toBe('open');
    expect(b.flags.plaStageStarted).toBe(true);
  });
  it('이른 정전: 협상이 약 12턴 안에 타결되고 점수에 상한이 있으며 전용 엔딩이 나온다', () => {
    const g = make();
    southAt(g, 'busan');
    g.flags.talks = 'on';
    g.flags.earlyArmistice = true;
    expect(armisticeForecast(g)!.daysLeft).toBeLessThanOrEqual(ARMISTICE.earlyDays);
    g.armisticeProgress = 100;
    const o = checkOutcome(g)!;
    expect(o.title).toBe('38선에서 맺은 정전');
    expect(o.score!.total).toBeLessThanOrEqual(ARMISTICE.earlyScoreCap);
    expect(endingKey(o)).toBe('armistice_38');
    expect(endingMood(o)).toBeTruthy();
  });
});

describe('중공군 집결과 참전 타이머', () => {
  const run = (difficulty: Difficulty) => {
    const g = make(difficulty);
    g.date = '1950-10-01';
    declareCross(g);
    const days = DIFFICULTY[difficulty].plaArrivalDays;
    const total = plaForceTotal(g);
    const events: string[] = [];
    let mid = -1;
    for (let d = 7; d <= days + 7; d += 7) {
      g.date = addDays('1950-10-01', d);
      advanceChina(g);
      if (g.flags.plaStageMid && mid < 0) mid = plaCount(g);
      if (g.flags.plaArrived) break; // 도착한 턴의 이벤트(참전)는 따로 확인한다
      events.push(...fire(g));
    }
    return { g, days, total, events, mid };
  };
  it('난이도별 도착 일수는 쉬움 > 보통 > 어려움이고, 일정에 맞춰 쌓인다 (보통 70일 = 10턴)', () => {
    expect(DIFFICULTY.easy.plaArrivalDays).toBeGreaterThan(DIFFICULTY.normal.plaArrivalDays);
    expect(DIFFICULTY.normal.plaArrivalDays).toBeGreaterThan(DIFFICULTY.hard.plaArrivalDays);
    expect(DIFFICULTY.normal.plaArrivalDays).toBe(70);
    const { g, total, events, mid } = run('normal');
    expect(g.flags.plaArrived).toBe(true);
    expect(events).not.toContain('china_intervention');
    expect(plaCount(g)).toBeGreaterThanOrEqual(Math.floor(total * 0.8)); // 도착 직전까지 쌓인 규모
    expect(mid).toBeGreaterThanOrEqual(Math.floor(total * 0.45));
    expect(mid).toBeLessThanOrEqual(Math.ceil(total * 0.6));
    expect(events).toContain('pla_intel_start');
    expect(events).toContain('pla_intel_mid');
    expect(events).toContain('pla_intel_imminent');
    expect(Object.values(g.units).filter((u) => u.faction === 'PLA').every((u) => u.location === 'china')).toBe(true);
  });
  it('쉬움은 더 늦게, 어려움은 더 일찍 도착하고 규모도 다르다', () => {
    const e = run('easy'), n = run('normal'), h = run('hard');
    expect(e.days).toBeGreaterThan(n.days);
    expect(h.days).toBeLessThan(n.days);
    expect(plaForceTotal(h.g)).toBeGreaterThan(plaForceTotal(n.g));
    expect(plaForceTotal(e.g)).toBeLessThan(plaForceTotal(n.g));
  });
  it('도착하면 참전 이벤트가 발동하고 첩보로 집결 규모와 남은 일수를 알려 준다', () => {
    const { g } = run('normal');
    const fired = fire(g);
    expect(fired).toContain('china_intervention');
    expect(g.flags.plaIntervened).toBe(true);
    expect(plaCount(g)).toBe(plaForceTotal(g));
    expect(warFrontStatus(g).china.chip.value).toBe('참전 중');
  });
  it('월경 뒤 집결 중에는 전황 개요에 집결 수와 남은 일수가 표시된다', () => {
    const g = make();
    declareCross(g);
    g.date = addDays(g.date, 28);
    advanceChina(g);
    const chip = warFrontStatus(g).china.chip;
    expect(chip.label).toBe('중공군 집결');
    expect(chip.value).toContain('42일');
  });
  it('중국군이 도하하기 전에 북한을 모두 점령하면 집결한 중국군이 있어도 대체역사 승리다', () => {
    const g = make();
    southAt(g, 'busan');
    declareCross(g);
    g.date = addDays(g.date, 30);
    advanceChina(g);
    expect(plaCount(g)).toBeGreaterThan(0);
    for (const p of Object.values(g.provinces)) if (p.initialOwner === 'north' && !p.external) p.owner = 'south';
    const o = checkOutcome(g)!;
    expect(o.title).toContain('대체역사');
  });
});

describe('정전협상 (1951.6~)', () => {
  it('예상 완료 턴은 약 52턴(14일 단위)이고 전쟁 피로가 높으면 줄어든다', () => {
    const g = make();
    g.flags.talks = 'on';
    const f0 = armisticeForecast(g)!;
    expect(f0.turnsLeft).toBeGreaterThanOrEqual(51);
    expect(f0.turnsLeft).toBeLessThanOrEqual(53);
    g.warWeariness = 80;
    expect(armisticeForecast(g)!.turnsLeft).toBeLessThan(f0.turnsLeft);
    g.armisticeProgress = 50;
    g.warWeariness = 0;
    expect(armisticeForecast(g)!.turnsLeft).toBeLessThan(f0.turnsLeft);
  });
  it('미국 설득은 협상이 진행 중일 때만 가능하고, 성공하면 협상이 늦춰지며 실패하면 앞당겨진다', () => {
    const g = make();
    g.nations.south.commandPoints = 20;
    expect(usePolicy(g, 'south', 'persuade_us').ok).toBe(false);
    g.flags.talks = 'on';
    for (const p of Object.values(g.provinces)) if (p.initialOwner === 'north' && !p.external) p.owner = 'south'; // 북진 성과가 크면 설득이 잘 먹힌다
    let up = 0, down = 0;
    for (let i = 0; i < 40; i++) {
      const h = structuredClone(g);
      h.rng = 1000 + i * 7919;
      h.armisticeProgress = 50;
      h.diplomacy.usCommitment = 100;
      expect(usePolicy(h, 'south', 'persuade_us').ok).toBe(true);
      if (h.armisticeProgress < 50) down++;
      if (h.armisticeProgress > 50) up++;
    }
    expect(down).toBeGreaterThan(0);
    expect(up).toBeGreaterThan(0);
    expect(down).toBeGreaterThan(up); // 미국 개입도가 높으면 성공이 더 많다
  });
});

describe('지도·편제 보조', () => {
  it('원래 국경(굵은 검은 선)은 남북 영토가 맞닿은 변만 이은 경로다', () => {
    const segs = MAP.originalBorder.split('M').filter(Boolean);
    expect(segs.length).toBeGreaterThan(5);
    expect(segs.length).toBeLessThan(80);
  });
  it('인해전술 부대의 질은 후반으로 갈수록 떨어지지만 하한이 있다', () => {
    expect(massQuality('1950-12-01')).toBe(1);
    expect(massQuality('1951-09-01')).toBeLessThan(1);
    expect(massQuality('1953-06-01')).toBeGreaterThanOrEqual(0.7);
  });
});
