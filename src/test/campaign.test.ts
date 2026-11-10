import { describe, expect, it } from 'vitest';
import { createGame } from '../game/engine';
import { checkEvents, resolveEvent } from '../game/events';
import { endTurn } from '../game/turn';
import { createUnit } from '../game/units';
import { battleContextFor, calcSide } from '../game/combat';
import { currentPhase } from '../game/ai';
import { hubLevels } from '../game/supply';
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
  it('평양을 함락하지 않았다면(북진만 했어도) 중국군이 참전하지 않는다 (대체역사)', () => {
    const g = fresh();
    g.date = '1950-10-25';
    g.diplomacy.chinaThreat = 90;
    g.provinces.haeju.owner = 'south';
    g.provinces.sariwon.owner = 'south';
    expect(fire(g)).not.toContain('china_intervention');
  });
  it('평양 함락 직후(1턴 뒤)에는 참전하지 않고, 함락 2턴 뒤에 참전하며 중국군 20개 사단이 국경을 넘는다', () => {
    const g = fresh();
    g.date = '1950-10-25';
    g.provinces.pyongyang.owner = 'south';
    g.flags.pyongyangFallTurn = g.turn - 1;
    expect(fire(g)).not.toContain('china_intervention');
    g.flags.pyongyangFallTurn = g.turn - 2;
    expect(fire(g)).toContain('china_intervention');
    expect(plaCount(g)).toBe(20);
    expect(g.flags.plaIntervened).toBe(true);
    expect(Object.values(g.units).some((u) => u.faction === 'PLA' && u.location === 'china')).toBe(false); // 모두 국경을 넘었다
    for (const u of Object.values(g.units).filter((x) => x.faction === 'PLA')) {
      expect(u.side).toBe('north');
      expect(g.provinces[u.location].owner).toBe('north');
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
    expect(plaCount(g)).toBe(18);
  });
  it('압록강변 중국군 보급소는 참전 후에만 생기며 중국군 후속 증원도 참전 후에만 온다', () => {
    const g = fresh();
    expect(hubLevels(g, 'north').gangye).toBeUndefined();
    expect(applyReinforcement(g, 'pla-wave-3')).toBeNull();
    g.flags.plaIntervened = true;
    expect(hubLevels(g, 'north').gangye).toBeGreaterThan(0);
    expect(applyReinforcement(g, 'pla-wave-3')).not.toBeNull();
    expect(plaCount(g)).toBe(8);
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
    for (const id of ['sinuiju', 'gangye', 'hyesan', 'pyongyang', 'wonsan']) g.provinces[id].owner = 'south';
    expect(hubLevels(g, 'north')).toEqual({}); // 중국은 보급 거점이 아니다 (병력이 넘어오는 곳일 뿐)
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
  it('협상을 수락해야 진척도가 오른다 (거부하면 오르지 않고 제안이 다시 온다)', () => {
    const g = fresh();
    g.date = '1951-07-14';
    fire(g);
    expect(g.pendingEvents.some((p) => p.eventId === 'armistice_talks')).toBe(true);
    resolveEvent(g, 'armistice_talks', 'refuse');
    expect(g.flags.talks).toBe('refused');
    expect(g.firedEvents).not.toContain('armistice_talks');
    expect(g.warWeariness).toBeGreaterThan(0);
    const p0 = g.armisticeProgress;
    clear(g);
    endTurn(g);
    expect(g.armisticeProgress).toBe(p0);
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
  it('북한 체제가 사실상 붕괴하고 중국군이 없으면 대체역사 승리가 된다', () => {
    const g = fresh();
    for (const p of Object.values(g.provinces)) if (p.initialOwner === 'north' && !['hoeryong', 'musan', 'hyesan', 'najin'].includes(p.id)) p.owner = 'south';
    for (const id of Object.keys(g.units)) if (g.units[id].side === 'north') delete g.units[id];
    const o = checkOutcome(g)!;
    expect(o.result).toBe('victory');
    expect(o.title).toContain('대체역사');
  });
});

describe('평양 함락 → 2턴 후 중국군 참전 (실제 턴 진행)', () => {
  it('평양을 점령하는 턴 기록 후 2턴이 지나면 중국군이 나타난다', () => {
    const g = fresh();
    clear(g);
    // 평양 인접 지역에 아군을 두고 무방비 평양을 점령
    for (const id of Object.keys(g.units)) delete g.units[id];
    g.provinces.pyongyang.owner = 'north';
    const u = spawn(g, 'ROK', 'sunchon_n');
    g.provinces.sunchon_n.owner = 'south';
    u.order = { type: 'attack', target: 'pyongyang', issuedTurn: g.turn };
    endTurn(g);
    expect(g.provinces.pyongyang.owner).toBe('south');
    expect(g.flags.pyongyangFallTurn).toBeDefined();
    clear(g);
    const inKorea = () => Object.values(g.units).filter((x) => x.faction === 'PLA' && x.location !== 'china').length;
    expect(inKorea()).toBe(0); // 함락 직후 1턴 시점: 중국군은 중국 영내에서 집결만 한다
    endTurn(g);
    clear(g);
    expect(inKorea()).toBeGreaterThan(0); // 2턴 후 압록강을 건넌다
  });
});
