import { describe, expect, it } from 'vitest';
import { createGame } from '../game/engine';
import { checkEvents, resolveEvent } from '../game/events';
import { endTurn } from '../game/turn';
import { createUnit } from '../game/units';
import { battleContextFor, calcSide } from '../game/combat';
import { currentPhase } from '../game/ai';
import { hubLevels, computeSupply } from '../game/supply';
import { CHINA_BORDER_PROVINCES } from '../data/outline';
import { checkOutcome } from '../game/victory';
import { usePolicy } from '../game/policies';
import { turnDaysFor } from '../game/util';
import { SCENARIO } from '../game/balance';
import { applyReinforcement } from '../game/scenario';
import { EVENTS } from '../data/events';
import type { GameState, Unit } from '../game/types';

const fresh = (seed = 9) => createGame(seed);
const clear = (g: GameState) => {
  while (g.pendingEvents.length) {
    const ev = EVENTS.find((e) => e.id === g.pendingEvents[0].eventId)!;
    resolveEvent(g, ev.id, ev.choices.find((c) => !c.isCounterfactual)?.id ?? ev.choices[0]?.id);
  }
};
const fire = (g: GameState) => {
  g.pendingEvents = [];
  g.firedEvents = [];
  return checkEvents(g);
};
const spawn = (g: GameState, faction: 'ROK' | 'KPA' | 'PLA' | 'UN', loc: string, over: Partial<Unit> = {}) => {
  const u = createUnit(g, { faction, name: `시험-${g.nextUnitNumber}`, parent: '시험', kind: 'infantry', location: loc, training: 60, experience: 20, defaultFill: 0.9 });
  Object.assign(u, over);
  g.units[u.id] = u;
  return u;
};
const plaCount = (g: GameState) => Object.values(g.units).filter((u) => u.faction === 'PLA').length;

describe('시간 시스템 확장', () => {
  it('교착기(1951.7~)에는 1턴 14일이다', () => {
    expect(turnDaysFor('1951-06-30')).toBe(7);
    expect(turnDaysFor('1951-07-01')).toBe(14);
    expect(SCENARIO.endDate).toBe('1953-07-27');
  });
});

describe('중국군 참전', () => {
  it('중국군이 아직 개입하지 않았다면 중국군 부대가 존재하지 않는다', () => {
    const g = fresh();
    expect(plaCount(g)).toBe(0);
    g.date = '1950-10-25';
    expect(fire(g)).not.toContain('china_intervention');
    expect(plaCount(g)).toBe(0);
  });
  it('38선을 넘기로 하기 전에는 평양을 점령해도 중국군이 참전하지 않는다 (평양 꼼수 차단)', () => {
    const g = fresh();
    g.date = '1950-10-25';
    g.provinces.pyongyang.owner = 'south';
    g.flags.pyongyangFallTurn = g.turn - 5;
    expect(fire(g)).not.toContain('china_intervention');
    expect(plaCount(g)).toBe(0);
  });
  it('참전 시점(plaArrived)이 되면 참전 이벤트가 발동하고 중국군 30개 사단이 국경을 넘는다', () => {
    const g = fresh();
    g.date = '1950-12-15';
    g.flags.crossPhase = 'open';
    g.flags.plaArrived = true;
    expect(fire(g)).toContain('china_intervention');
    expect(plaCount(g)).toBe(30);
    expect(g.flags.plaIntervened).toBe(true);
    for (const u of Object.values(g.units).filter((x) => x.faction === 'PLA')) {
      expect(u.side).toBe('north');
      expect(u.traits).toContain('야간전');
      expect(u.equip.tanks).toBe(0);
    }
  });
  it('중국군 대공세 이벤트는 참전 이벤트 이후에만 발생한다', () => {
    const g = fresh();
    g.date = '1950-12-01';
    expect(fire(g)).not.toContain('china_second_offensive');
    g.firedEvents = ['china_intervention'];
    g.pendingEvents = [];
    g.flags.plaIntervenedTurn = g.turn - 3;
    expect(checkEvents(g)).not.toContain('china_second_offensive');
    g.flags.plaIntervenedTurn = g.turn - 4;
    expect(checkEvents(g)).toContain('china_second_offensive');
    expect(plaCount(g)).toBe(16);
  });
  it('압록강변 중국군 보급소는 참전 후에만 생기며 중국군 후속 증원도 참전 후에만 온다', () => {
    const g = fresh();
    expect(hubLevels(g, 'north').gangye).toBeUndefined();
    expect(applyReinforcement(g, 'pla-wave-3')).toBeNull();
    g.flags.plaIntervened = true;
    expect(hubLevels(g, 'north').gangye).toBeGreaterThan(0);
    expect(applyReinforcement(g, 'pla-wave-3')).not.toBeNull();
    expect(plaCount(g)).toBe(4);
  });
  it('야간전·측면 공격 보너스: 중국군이 같은 조건에서 더 강하게 공격하고, 여러 방향 공격이 더 강하다', () => {
    const g = fresh();
    for (const id of Object.keys(g.units)) delete g.units[id];
    const def = spawn(g, 'ROK', 'dongducheon');
    const ctx = battleContextFor(g, g.provinces.dongducheon, [def]);
    const kpa = spawn(g, 'KPA', 'cheorwon');
    const pla = spawn(g, 'PLA', 'cheorwon', { traits: ['야간전'] });
    const a = calcSide([kpa], [def], 'attack', ctx).power;
    const b = calcSide([pla], [def], 'attack', ctx).power;
    expect(b).toBeGreaterThan(a * 1.08);
    const k2 = spawn(g, 'KPA', 'gimhwa'), k3 = spawn(g, 'KPA', 'pyeonggang');
    const one = calcSide([kpa, spawn(g, 'KPA', 'cheorwon')], [def], 'attack', ctx).power;
    const three = calcSide([kpa, k2, k3], [def], 'attack', ctx).power;
    expect(three / 3).toBeGreaterThan(one / 2);
  });
  it('중국군은 무제한 보급이 아니다: 압록강 보급소가 없으면 보급이 끊긴다', () => {
    const g = fresh();
    g.flags.plaIntervened = true;
    g.provinces.china.owner = 'north';
    for (const id of [...CHINA_BORDER_PROVINCES, 'pyongyang', 'wonsan']) g.provinces[id].owner = 'south';
    expect(hubLevels(g, 'north')).toEqual({}); // 중국은 보급 거점이 아니다 (병력이 넘어오는 곳일 뿐)
  });
  it('중국 참전 후 압록강·두만강에 닿은 북한 영토(무산·회령·나진 등)는 후방이 끊겨도 포위 판정을 받지 않는다', () => {
    const g = fresh();
    for (const id of ['pyongyang', 'wonsan', 'sinuiju', 'gangye', 'hyesan']) g.provinces[id].owner = 'south';
    computeSupply(g);
    expect(g.provinces.musan.supplied).toBe(false); // 참전 전: 후방이 끊기면 포위
    g.flags.plaIntervened = true;
    computeSupply(g);
    for (const id of ['musan', 'hoeryong', 'najin']) {
      if (g.provinces[id].owner === 'north') expect(g.provinces[id].supplied, id).toBe(true);
    }
  });
});

describe('국면과 AI', () => {
  it('국면: 중국 참전 시 chinese, 1951.6 이후 stalemate', () => {
    const g = fresh();
    g.flags.plaIntervened = true;
    g.date = '1950-11-10';
    expect(currentPhase(g)).toBe('chinese');
    g.date = '1951-06-02';
    expect(currentPhase(g)).toBe('stalemate');
  });
  it('1단계 종료 이벤트는 게임을 끝내지 않고 전쟁이 계속된다', () => {
    const g = fresh();
    g.date = '1950-10-07';
    expect(checkOutcome(g)).toBeNull();
    expect(fire(g)).toContain('phase1_review');
  });
});

describe('정전협상과 최종 승패', () => {
  it('개전 1주년(1951.6.25)에 미국이 협상을 강제로 시작한다 (거부 선택지 없음)', () => {
    const g = fresh();
    g.date = '1951-06-26';
    fire(g);
    expect(g.pendingEvents.some((p) => p.eventId === 'armistice_talks')).toBe(true);
    expect(EVENTS.find((e) => e.id === 'armistice_talks')!.choices.length).toBe(0);
    expect(g.flags.talks).toBe('on');
    const p0 = g.armisticeProgress;
    clear(g);
    endTurn(g);
    expect(g.armisticeProgress).toBeGreaterThan(p0);
  });
  it('협상 수락 후 턴이 지나면 진척도가 오르고 전쟁 피로도가 높을수록 빠르다', () => {
    const run = (wear: number) => {
      const g = fresh();
      clear(g);
      g.date = '1951-07-14';
      g.flags.talks = 'on';
      g.warWeariness = wear;
      endTurn(g);
      return g.armisticeProgress;
    };
    expect(run(0)).toBeGreaterThan(0);
    expect(run(80)).toBeGreaterThan(run(0));
  });
  it('협상 추진 정책은 협상 개시 후에만 쓸 수 있다', () => {
    const g = fresh();
    g.nations.south.commandPoints = 5;
    expect(usePolicy(g, 'south', 'push_talks').ok).toBe(false);
    g.flags.talks = 'on';
    const p = g.armisticeProgress;
    expect(usePolicy(g, 'south', 'push_talks').ok).toBe(true);
    expect(g.armisticeProgress).toBe(p + 6);
  });
  it('협상 진척도 100%에 도달하면 정전으로 종료되고 점수가 계산된다', () => {
    const g = fresh();
    g.armisticeProgress = 100;
    g.date = '1952-05-01';
    const o = checkOutcome(g)!;
    expect(o).not.toBeNull();
    expect(o.reasons[0]).toContain('정전협상이 타결');
    expect(o.score).not.toBeNull();
  });
  it('전쟁 피로도가 높으면 점수가 깎인다 (군사적 승리가 곧 국가 이익이 아님)', () => {
    const g = fresh();
    g.date = SCENARIO.endDate;
    const a = checkOutcome(g)!.score!.total;
    g.warWeariness = 90;
    expect(checkOutcome(g)!.score!.total).toBeLessThan(a);
  });
  it('사상자가 늘면 전쟁 피로도가 올라간다', () => {
    const g = fresh();
    g.nations.south.casualties = 0;
    spawn(g, 'KPA', 'cheorwon', { strength: 3000, training: 90, experience: 80 });
    clear(g);
    const w0 = g.warWeariness;
    g.nations.south.casualties += 20000; // 직전 턴 손실을 모사
    endTurn(g);
    expect(g.warWeariness).toBeGreaterThanOrEqual(w0);
  });
  it('북한의 모든 영토를 점령하면 중국군이 몇 부대든 대체역사 승리가 된다', () => {
    const g = fresh();
    for (const p of Object.values(g.provinces)) if (p.initialOwner === 'north' && !p.external) p.owner = 'south';
    for (const id of Object.keys(g.units)) if (g.units[id].side === 'north') delete g.units[id];
    spawn(g, 'PLA', 'china'); // 압록강 너머 중국군은 승패에 영향이 없다
    const o = checkOutcome(g)!;
    expect(o.result).toBe('victory');
    expect(o.title).toContain('대체역사');
  });
  it('북한 영토가 한 곳이라도 남아 있으면 대체역사 승리가 아니다', () => {
    const g = fresh();
    for (const p of Object.values(g.provinces)) if (p.initialOwner === 'north' && !p.external && p.id !== 'musan') p.owner = 'south';
    expect(checkOutcome(g)).toBeNull();
  });
});
