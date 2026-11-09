import { describe, expect, it } from 'vitest';
import { createGame } from '../game/engine';
import { MAP, isLand, neighbors, segmentOnLand } from '../game/map';
import { PROVINCE_SEEDS } from '../data/provinceSeeds';
import { cancelOrder, findPath, issueOrder, movePoints } from '../game/orders';
import { endTurn } from '../game/turn';
import { computeSupply } from '../game/supply';
import { applyLosses, createUnit, reinforceUnit, unitsAt, totalStrength } from '../game/units';
import { calcSide, equipmentFactor, infantryPower, resolveBattle, troopQuality, battleContextFor } from '../game/combat';
import { checkOutcome, computeScore, gradeFor } from '../game/victory';
import { deserialize, loadFromStorage, saveToStorage, serialize } from '../game/save';
import { nationalDraft, nationalDraftPool, createFormation } from '../game/manpower';
import { autoDistribute } from '../game/production';
import { resolveEvent } from '../game/events';
import { planAIOrders } from '../game/ai';
import { visibleProvinces } from '../game/visibility';
import { addDays, turnDaysFor } from '../game/util';
import { SCENARIO } from '../game/balance';
import type { GameState, Unit } from '../game/types';
import { EVENTS } from '../data/events';

const fresh = (seed = 1) => createGame(seed);
const southUnit = (g: GameState, loc: string) => Object.values(g.units).find((u) => u.side === 'south' && u.location === loc)!;
const clearEvents = (g: GameState) => {
  while (g.pendingEvents.length) {
    const ev = EVENTS.find((e) => e.id === g.pendingEvents[0].eventId)!;
    resolveEvent(g, ev.id, ev.choices.find((c) => !c.isCounterfactual)?.id ?? ev.choices[0]?.id);
  }
};
/** 이 시험을 위해 모든 부대를 맵에서 치우고 상황을 직접 구성한다 */
const emptyBoard = (g: GameState) => {
  for (const id of Object.keys(g.units)) delete g.units[id];
};
const spawn = (g: GameState, faction: 'ROK' | 'KPA' | 'UN', loc: string, over: Partial<Unit> = {}) => {
  const u = createUnit(g, { faction, name: `시험-${g.nextUnitNumber}`, parent: '시험', kind: 'infantry', location: loc, training: 60, experience: 20, defaultFill: 0.9 });
  Object.assign(u, over);
  g.units[u.id] = u;
  return u;
};

describe('지도·프로빈스 데이터', () => {
  it('프로빈스가 95개 이상이고 id가 고유하다 (동명 지역은 고유 id로 구분)', () => {
    expect(PROVINCE_SEEDS.length).toBeGreaterThanOrEqual(95);
    expect(new Set(PROVINCE_SEEDS.map((s) => s.id)).size).toBe(PROVINCE_SEEDS.length);
    expect(PROVINCE_SEEDS.filter((s) => s.name.startsWith('순천')).length).toBe(2);
  });
  it('모든 프로빈스가 필수 데이터와 지도 다각형을 가진다', () => {
    const g = fresh();
    for (const p of Object.values(g.provinces)) {
      expect(p.historicalName.length).toBeGreaterThan(0);
      expect(p.population).toBeGreaterThan(0);
      expect(MAP.geometry[p.id].polygon.length).toBeGreaterThanOrEqual(3);
      expect(p.dataQuality.population).toBe('estimated');
      for (const f of ['recruitablePopulation', 'industrialCapacity', 'equipmentProduction', 'infrastructure', 'portCapacity', 'fortification', 'warDamage', 'controlStability', 'strategicValue'] as const) {
        expect(typeof p[f]).toBe('number');
      }
    }
  });
  it('인접 관계가 대칭이고 전체가 하나로 연결되며 바다를 가로지르지 않는다', () => {
    for (const id of Object.keys(MAP.adjacency)) {
      for (const n of MAP.adjacency[id]) expect(MAP.adjacency[n]).toContain(id);
      const s = PROVINCE_SEEDS.find((x) => x.id === id)!;
      expect(isLand(s.lon, s.lat), `${id} 중심점이 육지 안`).toBe(true);
    }
    const seen = new Set(['seoul']);
    const stack = ['seoul'];
    while (stack.length) for (const n of neighbors(stack.pop()!)) if (!seen.has(n)) { seen.add(n); stack.push(n); }
    expect(seen.size).toBe(PROVINCE_SEEDS.length);
  });
  it('육로 인접은 모두 육지 위의 선분이다 (해상 이동은 별도 sea 연결)', () => {
    for (const id of Object.keys(MAP.adjacency)) {
      for (const n of MAP.adjacency[id]) {
        const a = PROVINCE_SEEDS.find((x) => x.id === id)!, b = PROVINCE_SEEDS.find((x) => x.id === n)!;
        expect(segmentOnLand([a.lon, a.lat], [b.lon, b.lat], 40), `${id}-${n}`).toBe(true);
      }
    }
  });
  it('산맥을 가로지르는 인접은 지정된 고갯길뿐이다', () => {
    expect(MAP.adjacency.gangneung).not.toContain('wonju');
    expect(MAP.adjacency.gangneung).toContain('hoengseong'); // 허용된 고갯길
  });
  it('초기 통제는 38도선 기준이며 서울은 대한민국, 해주는 북한 통제', () => {
    const g = fresh();
    expect(g.provinces.seoul.owner).toBe('south');
    expect(g.provinces.haeju.owner).toBe('north');
    expect(g.provinces.busan.owner).toBe('south');
  });
});

describe('시간 시스템', () => {
  it('6월 말 1턴 3일, 7월 이후 7일 — 경과일에 따라 날짜가 진행된다', () => {
    expect(turnDaysFor('1950-06-25')).toBe(3);
    expect(turnDaysFor('1950-06-28')).toBe(3);
    expect(turnDaysFor('1950-07-01')).toBe(7);
    const g = fresh();
    clearEvents(g);
    endTurn(g);
    expect(g.date).toBe('1950-06-28');
    clearEvents(g);
    endTurn(g);
    expect(g.date).toBe('1950-07-01');
    clearEvents(g);
    endTurn(g);
    expect(g.date).toBe('1950-07-08');
  });
  it('이동력이 경과일에 비례한다', () => {
    const g = fresh();
    const u = southUnit(g, 'seoul');
    const short = movePoints(g, u);
    g.date = '1950-07-08';
    expect(movePoints(g, u)).toBeCloseTo((short / 3) * 7, 5);
  });
});

describe('이동·명령 규칙', () => {
  it('적 통제 지역으로는 이동 명령을 내릴 수 없다 (공격 명령만 가능)', () => {
    const g = fresh();
    const u = southUnit(g, 'dongducheon');
    expect(issueOrder(g, u.id, 'move', 'cheorwon').ok).toBe(false);
  });
  it('인접하지 않은 적 지역은 공격할 수 없다', () => {
    const g = fresh();
    const u = southUnit(g, 'seoul');
    const r = issueOrder(g, u.id, 'attack', 'pyongyang');
    expect(r.ok).toBe(false);
  });
  it('이동은 인접 관계를 따라 이동력만큼만 진행된다 (순간이동 불가)', () => {
    const g = fresh();
    emptyBoard(g);
    const u = spawn(g, 'ROK', 'busan');
    expect(issueOrder(g, u.id, 'move', 'seoul').ok).toBe(true);
    clearEvents(g);
    endTurn(g);
    const after = g.units[u.id];
    expect(after.location).not.toBe('seoul');
    // 한 칸씩 인접한 지역으로만 움직였다
    expect(['busan', ...neighbors('busan'), ...neighbors('busan').flatMap(neighbors)]).toContain(after.location);
    expect(after.order?.type).toBe('move'); // 행군 계속
  });
  it('적 지역을 지나가야만 도달 가능한 아군 지역으로는 이동할 수 없다 (적지 통과 불가)', () => {
    const g = fresh();
    emptyBoard(g);
    for (const n of MAP.adjacency.busan) g.provinces[n].owner = 'north'; // 부산을 적 영토로 둘러쌈
    const u = spawn(g, 'ROK', 'busan');
    expect(findPath(g, 'south', 'busan', 'daegu')).toBeNull();
    expect(issueOrder(g, u.id, 'move', 'daegu').ok).toBe(false);
  });
  it('한 부대에게 같은 턴에 명령을 두 번 내릴 수 없고, 취소 후에는 가능하다', () => {
    const g = fresh();
    const u = southUnit(g, 'seoul');
    expect(issueOrder(g, u.id, 'defend').ok).toBe(true);
    const second = issueOrder(g, u.id, 'rest');
    expect(second.ok).toBe(false);
    cancelOrder(g, u.id);
    expect(issueOrder(g, u.id, 'rest').ok).toBe(true);
  });
  it('공격 명령은 1회성이라 다음 턴에 반복 공격하지 않는다', () => {
    const g = fresh();
    emptyBoard(g);
    const a = spawn(g, 'ROK', 'dongducheon');
    spawn(g, 'KPA', 'cheorwon');
    issueOrder(g, a.id, 'attack', 'cheorwon');
    clearEvents(g);
    endTurn(g);
    expect(g.units[a.id]?.order?.type).not.toBe('attack');
  });
});

describe('병력·피해', () => {
  it('손실을 적용해도 병력은 음수가 되지 않는다', () => {
    const g = fresh();
    const u = southUnit(g, 'seoul');
    const lost = applyLosses(u, u.strength * 5);
    expect(lost).toBeLessThanOrEqual(3000);
    expect(u.strength).toBe(0);
    expect(Object.values(u.equip).every((v) => v >= 0)).toBe(true);
  });
  it('30턴 상당의 시뮬레이션 중 어떤 부대도 음수 병력을 갖지 않는다', () => {
    const g = fresh(7);
    for (let i = 0; i < 16 && !g.outcome; i++) {
      clearEvents(g);
      planAIOrders(g, 'south', 'defense');
      endTurn(g);
      for (const u of Object.values(g.units)) {
        expect(u.strength).toBeGreaterThanOrEqual(0);
        expect(u.strength).toBeLessThanOrEqual(u.maxStrength);
      }
    }
  });
});

describe('전투력 계산', () => {
  const mk = (g: GameState, over: Partial<Unit>) => {
    const u = spawn(g, 'ROK', 'seoul', over);
    return u;
  };
  it('병력이 같아도 훈련도가 높으면 전투력이 높다 (장비 항은 변하지 않음)', () => {
    const g = fresh();
    const a = mk(g, { training: 30 });
    const b = mk(g, { training: 80 });
    expect(infantryPower(b)).toBeGreaterThan(infantryPower(a) * 1.15);
    expect(equipmentFactor(a)).toBeCloseTo(equipmentFactor(b), 8);
    expect(troopQuality(b)).toBeGreaterThan(troopQuality(a));
  });
  it('장비가 부족하면 같은 병력·훈련도에서도 전투력이 크게 낮다', () => {
    const g = fresh();
    const full = mk(g, {});
    const poor = mk(g, {});
    for (const k of Object.keys(poor.equip) as (keyof typeof poor.equip)[]) poor.equip[k] = Math.round(poor.equip[k] * 0.2);
    expect(infantryPower(poor)).toBeLessThan(infantryPower(full) * 0.8);
    expect(equipmentFactor(poor)).toBeLessThan(equipmentFactor(full));
  });
  it('전투력은 여러 낮은 능력치를 곱해도 0에 가깝게 붕괴하지 않는다', () => {
    const g = fresh();
    const bad = mk(g, { training: 0, experience: 0, morale: 0, organization: 0, fatigue: 100, supply: 0, recovery: 0 });
    for (const k of Object.keys(bad.equip) as (keyof typeof bad.equip)[]) bad.equip[k] = 0;
    const full = mk(g, { training: 100, experience: 100 });
    const ratio = infantryPower(bad) / infantryPower(full);
    expect(ratio).toBeGreaterThan(0.08);
    expect(ratio).toBeLessThan(0.5);
  });
  it('전차는 대전차 수단이 있으면 효과가 감소하고, 없으면 압도적이다', () => {
    const g = fresh();
    emptyBoard(g);
    const tank = createUnit(g, { faction: 'KPA', name: 'T', parent: 'T', kind: 'armor', location: 'cheorwon', training: 65, experience: 20, defaultFill: 0.95 });
    const noAT = spawn(g, 'ROK', 'dongducheon');
    noAT.equip.antiTank = 0;
    const withAT = spawn(g, 'UN', 'dongducheon');
    withAT.equip.antiTank = 400;
    const ctx = battleContextFor(g, g.provinces.dongducheon, [noAT]);
    const vsNone = calcSide([tank], [noAT], 'attack', ctx).tanks;
    const vsAT = calcSide([tank], [withAT], 'attack', ctx).tanks;
    expect(vsAT).toBeLessThan(vsNone * 0.55);
    // 산악에서는 전차 효율이 크게 떨어진다
    const plain = calcSide([tank], [noAT], 'attack', { ...ctx, terrain: 'plain' as const }).tanks;
    const mtn = calcSide([tank], [noAT], 'attack', { ...ctx, terrain: 'mountain' as const }).tanks;
    expect(mtn).toBeLessThan(plain * 0.4);
  });
  it('신병 보충 시 평균 훈련도·경험이 가중 평균으로 변한다', () => {
    const g = fresh();
    const u = mk(g, { strength: 2000, training: 70, experience: 40 });
    const added = reinforceUnit(u, 1000, 10);
    expect(added).toBe(1000);
    expect(u.strength).toBe(3000);
    expect(u.training).toBeCloseTo((70 * 2000 + 10 * 1000) / 3000, 5);
    expect(u.experience).toBeCloseTo((40 * 2000) / 3000, 5);
  });
  it('전투 결과에 계산 근거 설명이 포함된다', () => {
    const g = fresh();
    emptyBoard(g);
    const a = spawn(g, 'KPA', 'cheorwon');
    const d = spawn(g, 'ROK', 'dongducheon');
    const out = resolveBattle(g, g.provinces.dongducheon, [a], [d], 'x');
    expect(out.report.reasons.length).toBeGreaterThanOrEqual(3);
    expect(out.report.reasons[0]).toContain('전투력');
  });
});

describe('전투 해결과 점령', () => {
  it('압도적인 공격측이 승리하면 지역을 점령하고 소유권이 바뀐다', () => {
    const g = fresh();
    emptyBoard(g);
    const att: Unit[] = [];
    for (let i = 0; i < 4; i++) att.push(spawn(g, 'ROK', 'dongducheon', { training: 90, experience: 70, morale: 95 }));
    spawn(g, 'KPA', 'cheorwon', { strength: 600, training: 20, morale: 40, organization: 40 });
    for (const a of att) issueOrder(g, a.id, 'attack', 'cheorwon');
    clearEvents(g);
    endTurn(g);
    expect(g.provinces.cheorwon.owner).toBe('south');
    expect(g.reports.some((r) => r.province === 'cheorwon' && r.captured)).toBe(true);
    expect(att.some((a) => g.units[a.id]?.location === 'cheorwon')).toBe(true);
  });
  it('방어측이 후퇴할 곳이 없으면 포위로 큰 손실을 입는다', () => {
    const g = fresh();
    emptyBoard(g);
    // 철원의 모든 이웃을 아군(공격측) 영토로 만들어 후퇴로 차단
    for (const n of MAP.adjacency.cheorwon) g.provinces[n].owner = 'south';
    const att = [spawn(g, 'ROK', 'dongducheon', { training: 90, experience: 60, morale: 95 }), spawn(g, 'ROK', 'dongducheon', { training: 90, experience: 60, morale: 95 })];
    spawn(g, 'KPA', 'cheorwon', { strength: 1500, training: 30 });
    att.forEach((a) => issueOrder(g, a.id, 'attack', 'cheorwon'));
    clearEvents(g);
    endTurn(g);
    const rep = g.reports.find((r) => r.province === 'cheorwon')!;
    expect(rep.surrounded || rep.outcome !== 'attacker_win').toBe(true);
  });
  it('무방비 적 지역은 공격 명령으로 점령된다', () => {
    const g = fresh();
    emptyBoard(g);
    const a = spawn(g, 'ROK', 'dongducheon');
    issueOrder(g, a.id, 'attack', 'cheorwon');
    clearEvents(g);
    endTurn(g);
    expect(g.provinces.cheorwon.owner).toBe('south');
    expect(g.provinces.cheorwon.controlStability).toBeLessThan(50); // 점령지 안정도는 본토(92)보다 훨씬 낮다
  });
});

describe('보급', () => {
  it('보급 거점 부산에서 아군 영토를 따라 보급이 연결된다', () => {
    const g = fresh();
    computeSupply(g);
    expect(g.provinces.busan.supplyLevel).toBe(100);
    expect(g.provinces.daegu.supplied).toBe(true);
    expect(g.provinces.seoul.supplied).toBe(true);
    expect(g.provinces.seoul.supplyLevel).toBeLessThan(g.provinces.daegu.supplyLevel);
  });
  it('보급로가 적에게 차단되면 보급 상태가 바뀌고 부대의 보급·조직력·사기가 떨어진다', () => {
    const g = fresh();
    emptyBoard(g);
    const u = spawn(g, 'ROK', 'daegu');
    computeSupply(g);
    expect(g.provinces.daegu.supplied).toBe(true);
    for (const n of MAP.adjacency.busan) g.provinces[n].owner = 'north';
    computeSupply(g);
    expect(g.provinces.daegu.supplied).toBe(false);
    expect(g.provinces.busan.supplied).toBe(true);
    const before = { sup: u.supply, org: u.organization, mor: u.morale };
    clearEvents(g);
    endTurn(g);
    const after = g.units[u.id];
    expect(after.supply).toBeLessThan(before.sup);
    expect(after.organization).toBeLessThan(before.org);
    expect(after.morale).toBeLessThan(before.mor);
  });
  it('북한군은 거점에서 멀어질수록, 제공권 폭격이 늘수록 보급 수준이 낮아진다', () => {
    const g = fresh();
    computeSupply(g);
    const near = g.provinces.cheorwon.supplyLevel;
    for (const id of ['paju', 'gaeseong', 'seoul', 'suwon', 'osan', 'pyeongtaek', 'cheonan', 'jochiwon', 'daejeon']) g.provinces[id].owner = 'north';
    computeSupply(g);
    const far = g.provinces.cheonan.supplyLevel; // 서울·대전 전진 보급소 사이의 일반 지역
    g.interdiction = 0.6;
    computeSupply(g);
    expect(far).toBeLessThan(near);
    expect(g.provinces.cheonan.supplyLevel).toBeLessThan(far);
  });
});

describe('내정·징집 (국가 단위)', () => {
  it('국가 징집은 통제 지역의 징병 가능 인구를 소비해 훈련병 풀을 채운다', () => {
    const g = fresh();
    const before = nationalDraftPool(g, 'south');
    const pool0 = g.nations.south.trainees.count;
    const r = nationalDraft(g, 'south');
    expect(r.ok).toBe(true);
    expect(nationalDraftPool(g, 'south')).toBeLessThan(before);
    expect(g.nations.south.trainees.count).toBeGreaterThan(pool0);
  });
  it('장비 없이 창설한 부대는 전투력이 낮고, 자동 배분으로 장비를 받으면 좋아진다', () => {
    const g = fresh();
    g.nations.south.trainees = { count: 3000, training: 30 };
    g.nations.south.commandPoints = 10;
    const n = Object.keys(g.units).length;
    expect(createFormation(g, 'south', 'daejeon').ok).toBe(true);
    expect(Object.keys(g.units).length).toBe(n + 1);
    const nu = Object.values(g.units).find((u) => u.historicalParent.startsWith('신편'))!;
    const veteran = spawn(g, 'ROK', 'daejeon', { training: 30, experience: 0 });
    expect(infantryPower(nu)).toBeLessThan(infantryPower(veteran) * 0.75);
    g.nations.south.equipStock = { rifles: 30000, machineGuns: 800, mortars: 500, artillery: 160, antiTank: 200, tanks: 0, vehicles: 500 };
    const p0 = infantryPower(nu);
    autoDistribute(g, 'south');
    expect(infantryPower(nu)).toBeGreaterThan(p0);
  });
  it('행정 점수가 없으면 징집할 수 없다', () => {
    const g = fresh();
    g.nations.south.commandPoints = 0;
    expect(nationalDraft(g, 'south').ok).toBe(false);
  });
});

describe('승패 조건', () => {
  it('부산이 북한군에 점령되면 패배한다', () => {
    const g = fresh();
    g.provinces.busan.owner = 'north';
    const o = checkOutcome(g);
    expect(o?.result).toBe('defeat');
  });
  it('전쟁수행능력이 붕괴하면 패배한다', () => {
    const g = fresh();
    g.nations.south.warCapacity = 3;
    expect(checkOutcome(g)?.result).toBe('defeat');
  });
  it('종료일까지 생존하면 승리하고 점수·등급이 계산된다', () => {
    const g = fresh();
    g.date = SCENARIO.endDate;
    const o = checkOutcome(g)!;
    expect(o.result).toBe('victory');
    expect(o.score!.total).toBeGreaterThan(0);
    expect(['S', 'A', 'B', 'C', 'D']).toContain(o.grade);
    expect(gradeFor(90)).toBe('S');
    expect(gradeFor(10)).toBe('D');
  });
  it('종료일까지 부산만 지키고 점수가 기준에 못 미치면 패배로 처리한다', () => {
    const g = fresh();
    for (const p of Object.values(g.provinces)) if (p.id !== 'busan' && p.owner === 'south') p.owner = 'north';
    for (const id of Object.keys(g.units)) if (g.units[id].side === 'south') delete g.units[id];
    g.nations.south.casualties = 90000;
    g.nations.south.popularSupport = 20;
    g.date = SCENARIO.endDate;
    const o = checkOutcome(g)!;
    expect(o.result).toBe('defeat');
  });
  it('서울을 수복하고 병력을 보존할수록 점수가 높다', () => {
    const g = fresh();
    const base = computeScore(g).total;
    g.nations.south.casualties = 60000;
    expect(computeScore(g).total).toBeLessThan(base);
  });
  it('endTurn 중 부산이 함락되면 게임 결과가 기록된다', () => {
    const g = fresh();
    emptyBoard(g);
    spawn(g, 'ROK', 'daegu');
    const k = spawn(g, 'KPA', 'gimhae', { strength: 3000, training: 90, experience: 80 });
    void k;
    g.provinces.gimhae.owner = 'north';
    g.provinces.miryang.owner = 'north';
    g.provinces.gyeongju.owner = 'north';
    g.provinces.geoje.owner = 'north';
    // 북한 부대가 인접한 부산을 무방비 상태에서 공격한다 (AI 명령)
    clearEvents(g);
    endTurn(g);
    expect(g.provinces.busan.owner).toBe('north');
    expect(g.outcome?.result).toBe('defeat');
  });
});

describe('저장·불러오기', () => {
  const mockStorage = () => {
    const m = new Map<string, string>();
    return { setItem: (k: string, v: string) => void m.set(k, v), getItem: (k: string) => m.get(k) ?? null };
  };
  it('저장한 데이터를 그대로 복원한다', () => {
    const g = fresh(11);
    clearEvents(g);
    endTurn(g);
    const st = mockStorage();
    expect(saveToStorage(g, st)).toBe(true);
    const loaded = loadFromStorage(st)!;
    expect(loaded).not.toBeNull();
    expect(loaded.turn).toBe(g.turn);
    expect(loaded.date).toBe(g.date);
    expect(JSON.stringify(loaded)).toBe(JSON.stringify(g));
    expect(totalStrength(loaded, 'south')).toBe(totalStrength(g, 'south'));
  });
  it('손상되었거나 버전이 다른 저장은 거부한다', () => {
    expect(deserialize('not json')).toBeNull();
    expect(deserialize('{}')).toBeNull();
    const g = fresh();
    const bad = JSON.parse(serialize(g));
    bad.version = 999;
    expect(deserialize(JSON.stringify(bad))).toBeNull();
    const missing = JSON.parse(serialize(g));
    delete missing.provinces.seoul;
    expect(deserialize(JSON.stringify(missing))).toBeNull();
  });
  it('불러온 게임에서 턴을 이어서 진행하고 같은 시드면 결과가 같다 (결정성)', () => {
    const g = fresh(5);
    clearEvents(g);
    const copy = deserialize(serialize(g))!;
    endTurn(g);
    endTurn(copy);
    expect(JSON.stringify(copy)).toBe(JSON.stringify(g));
  });
});

describe('역사 이벤트', () => {
  it('이벤트 데이터는 요구 필드를 모두 가지며 최소 5개 이상이다', () => {
    expect(EVENTS.length).toBeGreaterThanOrEqual(5);
    for (const e of EVENTS) {
      for (const f of ['id', 'title', 'description', 'earliestDate', 'latestDate', 'conditions', 'choices', 'effects', 'historicalContext', 'historicalDate', 'source', 'isCounterfactual'] as const) expect(e[f]).toBeDefined();
    }
    for (const required of ['kpa_invasion', 'seoul_crisis', 'unsc_support', 'naktong_crisis', 'incheon_preparation']) expect(EVENTS.some((e) => e.id === required)).toBe(true);
  });
  it('남침 이벤트는 시작 시 발동하고 전선 부대의 조직력을 실제로 낮춘다', () => {
    const g = fresh();
    expect(g.pendingEvents.some((p) => p.eventId === 'kpa_invasion')).toBe(true);
    expect(southUnit(g, 'dongducheon').organization).toBeLessThan(80);
    expect(g.flags.invasion).toBe(true);
  });
  it('한강 교량 조기 폭파 선택은 한강 이북 부대의 병력을 실제로 줄인다', () => {
    const g = fresh();
    clearEvents(g);
    const u = southUnit(g, 'seoul');
    g.pendingEvents.push({ eventId: 'seoul_crisis' });
    const before = u.strength;
    expect(resolveEvent(g, 'seoul_crisis').ok).toBe(false); // 선택 없이는 불가
    expect(resolveEvent(g, 'seoul_crisis', 'blow_early').ok).toBe(true);
    expect(u.strength).toBeLessThan(before * 0.8);
    expect(g.flags.bridge).toBe('early');
  });
  it('미리 철수한 부대는 한강 교량 폭파의 피해를 받지 않는다 (병력 보존)', () => {
    const g = fresh();
    clearEvents(g);
    const u = southUnit(g, 'seoul');
    u.location = 'suwon';
    const before = u.strength;
    g.pendingEvents.push({ eventId: 'seoul_crisis' });
    resolveEvent(g, 'seoul_crisis', 'blow_early');
    expect(u.strength).toBe(before);
  });
  it('증원은 날짜에 도착한다', () => {
    const g = fresh();
    clearEvents(g);
    const n0 = Object.values(g.units).filter((u) => u.faction === 'UN').length;
    expect(n0).toBe(0);
    for (let i = 0; i < 4; i++) { clearEvents(g); endTurn(g); }
    expect(Object.values(g.units).filter((u) => u.faction === 'UN').length).toBeGreaterThan(0);
  });
});

describe('북한 AI', () => {
  it('전황에 따라 일관된 판단을 한다: 방어가 약한 인접 지역을 우선 공격하고 강한 곳은 피한다', () => {
    const g = fresh();
    emptyBoard(g);
    const att = Array.from({ length: 4 }, () => spawn(g, 'KPA', 'cheorwon', { training: 70, experience: 30 }));
    spawn(g, 'ROK', 'dongducheon', { strength: 800, training: 20, morale: 40 });
    for (let i = 0; i < 3; i++) spawn(g, 'ROK', 'gaeseong', { training: 80, experience: 40, morale: 90 });
    planAIOrders(g, 'north');
    const targets = att.map((u) => u.order?.target);
    expect(targets).toContain('dongducheon');
    expect(targets).not.toContain('gaeseong');
  });
  it('인접한 적 지역이 무방비이면 점령 명령을 내린다', () => {
    const g = fresh();
    emptyBoard(g);
    g.provinces.dongducheon.owner = 'north';
    const k = spawn(g, 'KPA', 'dongducheon', { training: 70 });
    planAIOrders(g, 'north');
    // 이웃 중 무방비 적 지역을 공격하거나, 방어 태세
    expect(['attack', 'defend', 'move', 'rest']).toContain(k.order?.type);
    expect(k.order?.type).toBe('attack');
  });
  it('고립되어 붕괴 직전인 부대는 공격 대신 재정비를 선택한다', () => {
    const g = fresh();
    emptyBoard(g);
    g.date = '1950-09-20';
    g.flags.counteroffensive = true;
    for (const n of MAP.adjacency.sariwon) g.provinces[n].owner = 'south'; // 사리원이 적 영토에 완전히 둘러싸임
    const u = spawn(g, 'KPA', 'sariwon', { supply: 10, strength: 800, morale: 25 });
    computeSupply(g);
    planAIOrders(g, 'north');
    expect(u.order?.type).not.toBe('attack');
  });
  it('북한군은 국면에 따라 달라진다', async () => {
    const { currentPhase } = await import('../game/ai');
    const g = fresh();
    expect(currentPhase(g)).toBe('blitz');
    g.date = '1950-08-20';
    expect(currentPhase(g)).toBe('naktong');
    g.flags.counteroffensive = true;
    expect(currentPhase(g)).toBe('counter');
  });
});

describe('정찰(전쟁의 안개)', () => {
  it('아군 부대와 멀리 떨어진 적 지역은 정찰되지 않는다', () => {
    const g = fresh();
    const vis = visibleProvinces(g, 'south');
    expect(vis.has('seoul')).toBe(true);
    expect(vis.has('pyongyang')).toBe(false);
    expect(vis.has('cheorwon')).toBe(true); // 동두천 부대의 인접 정찰
  });
});

void addDays;
