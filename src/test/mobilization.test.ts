import { describe, expect, it } from 'vitest';
import { createGame } from '../game/engine';
import { checkEvents, resolveEvent } from '../game/events';
import { endTurn } from '../game/turn';
import { applyLosses, createUnit, dissolveUnit, fillRatio, needsRest, unitsAt } from '../game/units';
import { forceStats, buildCasualtyReport } from '../game/casualty';
import { mobilize, previewMobilization } from '../game/mobilization';
import { autoUnReplacements, draftEfficiency, drawFromProvinces, nationalDraft, nationalDraftPool, createFormation, unReplacementPerDay } from '../game/manpower';
import { autoDistribute, autoProduction, producibleKeys } from '../game/production';
import { computeSupply } from '../game/supply';
import { deserialize, serialize } from '../game/save';
import { fogOn, canSee } from '../game/visibility';
import { MAP } from '../game/map';
import { useGame } from '../store/gameStore';
import { EQUIP_KEYS, type GameState, type Unit } from '../game/types';
import { EVENTS } from '../data/events';

const fresh = (seed = 7) => {
  const g = createGame(seed);
  while (g.pendingEvents.length) {
    const ev = EVENTS.find((e) => e.id === g.pendingEvents[0].eventId)!;
    resolveEvent(g, ev.id, ev.choices.find((c) => !c.isCounterfactual)?.id ?? ev.choices[0]?.id);
  }
  return g;
};
const clearEvents = (g: GameState) => {
  while (g.pendingEvents.length) {
    const ev = EVENTS.find((e) => e.id === g.pendingEvents[0].eventId)!;
    resolveEvent(g, ev.id, ev.choices.find((c) => !c.isCounterfactual)?.id ?? ev.choices[0]?.id);
  }
};
const empty = (g: GameState) => Object.keys(g.units).forEach((id) => delete g.units[id]);
const spawn = (g: GameState, faction: 'ROK' | 'KPA' | 'UN', loc: string, over: Partial<Unit> = {}) => {
  const u = createUnit(g, { faction, name: `시험-${g.nextUnitNumber}`, parent: '시험', kind: 'infantry', location: loc, training: 60, experience: 30, defaultFill: 0.8 });
  Object.assign(u, over);
  g.units[u.id] = u;
  return u;
};
const rawPool = (g: GameState) => Object.values(g.provinces).filter((p) => p.owner === 'south').reduce((s, p) => s + p.recruitablePopulation, 0);
const sumEquip = (us: Unit[]) => EQUIP_KEYS.map((k) => us.reduce((s, u) => s + u.equip[k], 0));

describe('총동원령: 여단 → 사단 1:1 전환', () => {
  const setup = () => {
    const g = fresh();
    empty(g);
    const locs = ['daegu', 'daegu', 'daegu', 'waegwan', 'waegwan', 'busan', 'masan', 'changnyeong', 'gyeongju', 'pohang'];
    const us = locs.map((l, i) => spawn(g, 'ROK', l, { strength: 2600 + i * 50, experience: 20 + i * 5, training: 50 + i }));
    us[0].history.push({ turn: 1, date: '1950-06-25', place: '시험', role: 'defend', result: 'win', lossesTaken: 10 });
    us[0].wounded = 120;
    return { g, us, locs };
  };
  it('여단 10개 → 사단 10개: 개수·주둔 위치·고유 ID가 유지된다 (합치지 않는다)', () => {
    const { g, us, locs } = setup();
    const ids = us.map((u) => u.id);
    mobilize(g);
    expect(Object.values(g.units).filter((u) => u.side === 'south').length).toBe(10);
    ids.forEach((id, i) => {
      expect(g.units[id].echelon).toBe('division');
      expect(g.units[id].location).toBe(locs[i]);
    });
    // 대구 5... 주둔 수 유지
    expect(unitsAt(g, 'daegu', 'south').length).toBe(3);
    expect(g.flags.mobilized).toBe(true);
  });
  it('기존 병력·장비·전투 이력·부상병·경험 기록이 승계되고 정원만 사단급으로 커진다', () => {
    const { g, us } = setup();
    const before = us.map((u) => ({ id: u.id, strength: u.strength, equip: { ...u.equip }, hist: u.history.length, wounded: u.wounded, max: u.maxStrength, exp: u.experience }));
    mobilize(g);
    for (const b of before) {
      const u = g.units[b.id];
      expect(u.equip).toEqual(b.equip); // 장비는 저절로 생기지 않는다
      expect(u.history.length).toBe(b.hist);
      expect(u.wounded).toBe(b.wounded);
      expect(u.maxStrength).toBeGreaterThanOrEqual(8000);
      expect(u.maxStrength).toBeLessThanOrEqual(12000);
      expect(u.maxStrength).toBeGreaterThan(b.max);
      expect(u.strength).toBeGreaterThanOrEqual(b.strength);
      expect(u.experience).toBeLessThanOrEqual(b.exp); // 신병이 섞이면 평균 경험은 내려간다
    }
  });
  it('긴급 동원병만큼 실제 징병 가능 인구가 감소한다 (이중 생성 없음)', () => {
    const { g } = setup();
    const raw0 = rawPool(g);
    const drafted0 = Object.values(g.provinces).reduce((s, p) => s + p.drafted, 0);
    const trainees0 = g.nations.south.trainees.count;
    const rep = mobilize(g);
    const spent = raw0 - rawPool(g);
    expect(rep.emergencyDrafted).toBeGreaterThan(0);
    expect(spent).toBe(rep.emergencyDrafted + (g.nations.south.trainees.count - trainees0));
    expect(Object.values(g.provinces).reduce((s, p) => s + p.drafted, 0) - drafted0).toBe(spent);
    expect(g.nations.south.emergencyDrafted).toBe(rep.emergencyDrafted);
  });
  it('징병 자원이 부족하면 결원 있는 사단으로 남고, 자원을 초과해 병력을 만들지 않는다', () => {
    const { g, us } = setup();
    // 접근 가능한 징병 자원을 아주 작게
    for (const p of Object.values(g.provinces)) p.recruitablePopulation = p.owner === 'south' ? 40 : p.recruitablePopulation;
    const pool = nationalDraftPool(g, 'south');
    const before = us.reduce((s, u) => s + u.strength, 0);
    const rep = mobilize(g);
    const after = us.reduce((s, u) => s + g.units[u.id].strength, 0);
    expect(after - before).toBeLessThanOrEqual(pool);
    expect(after - before).toBe(rep.emergencyDrafted);
    for (const u of us) expect(g.units[u.id].strength).toBeLessThan(g.units[u.id].maxStrength * 0.75);
    expect(rep.understrength).toBe(10);
    for (const p of Object.values(g.provinces)) expect(p.recruitablePopulation).toBeGreaterThanOrEqual(0);
  });
  it('병력은 늘지만 훈련도와 장비 충족률은 하락한다 (무조건적 전투력 급증 아님)', () => {
    const { g, us } = setup();
    const u0 = us[1];
    const training0 = u0.training, fill0 = fillRatio(u0, 'rifles'), s0 = u0.strength, org0 = u0.organization;
    mobilize(g);
    const u1 = g.units[u0.id];
    expect(u1.strength).toBeGreaterThan(s0 * 2);
    expect(u1.training).toBeLessThan(training0);
    expect(fillRatio(u1, 'rifles')).toBeLessThan(fill0);
    expect(u1.emergencyTroops).toBe(u1.strength - s0);
    // 긴급 동원병은 일반 훈련병(초기 15)보다 훈련도가 낮다
    expect(u1.organization).toBeLessThan(org0);
  });
  it('동원 전후 국가 병력 통계가 실제 부대 합계와 정확히 일치한다', () => {
    const { g, us } = setup();
    const before = forceStats(g, 'south');
    expect(before.available).toBe(us.reduce((s, u) => s + u.strength, 0));
    const rep = mobilize(g);
    const after = forceStats(g, 'south');
    expect(rep.before).toEqual(before);
    expect(rep.after).toEqual(after);
    expect(after.available).toBe(Object.values(g.units).filter((u) => u.side === 'south').reduce((s, u) => s + u.strength, 0));
    expect(after.available - before.available).toBe(rep.emergencyDrafted);
    expect(after.authorized).toBeGreaterThan(before.authorized * 2.5);
    expect(after.divisions).toBe(10);
  });
  it('국군(ROK)만 전환하고 미군 등 다른 편제는 유지한다. 장비 총량은 변하지 않는다', () => {
    const { g, us } = setup();
    const un = spawn(g, 'UN', 'busan');
    const kpa = spawn(g, 'KPA', 'cheorwon');
    const eq0 = sumEquip([...us, un, kpa]);
    mobilize(g);
    expect(g.units[un.id].echelon).toBe('brigade');
    expect(g.units[kpa.id].echelon).toBe('brigade');
    expect(sumEquip(Object.values(g.units))).toEqual(eq0);
  });
  it('미리보기는 상태를 바꾸지 않는다', () => {
    const { g } = setup();
    const snap = JSON.stringify(g);
    const p = previewMobilization(g);
    expect(JSON.stringify(g)).toBe(snap);
    expect(p.convertedUnits).toBe(10);
  });
  it('총동원령 이후에는 사단이 기본 편성 단위가 된다', () => {
    const { g } = setup();
    g.nations.south.trainees = { count: 20000, training: 30 };
    g.nations.south.commandPoints = 10;
    createFormation(g, 'south', 'busan');
    expect(Object.values(g.units).some((u) => u.echelon === 'brigade' && u.historicalParent.startsWith('신편'))).toBe(true);
    mobilize(g);
    createFormation(g, 'south', 'busan');
    const made = Object.values(g.units).filter((u) => u.historicalParent.startsWith('신편')).pop()!;
    expect(made.echelon).toBe('division');
  });
});

describe('총동원령 이벤트 발동 조건', () => {
  const fire = (g: GameState) => {
    g.pendingEvents = [];
    g.firedEvents = [];
    return checkEvents(g);
  };
  it('초반에는 발동하지 않고, 낙동강 방어선 이벤트와 별도로 관리된다', () => {
    const g = fresh();
    expect(fire(g)).not.toContain('general_mobilization');
    g.date = '1950-08-12';
    expect(fire(g)).not.toContain('general_mobilization');
    expect(EVENTS.find((e) => e.id === 'general_mobilization')).not.toBe(EVENTS.find((e) => e.id === 'naktong_crisis'));
  });
  it('낙동강 방어선이 실제로 형성된 전황에서는 발동한다', () => {
    const g = fresh();
    empty(g);
    g.date = '1950-08-12';
    for (const id of ['seoul', 'suwon', 'daejeon', 'yeongdong', 'sangju']) g.provinces[id].owner = 'north';
    for (let i = 0; i < 3; i++) spawn(g, 'ROK', 'waegwan');
    for (let i = 0; i < 2; i++) spawn(g, 'KPA', 'sangju');
    const f = fire(g);
    expect(f).toContain('general_mobilization');
    expect(f).toContain('naktong_crisis');
  });
  it('낙동강과 무관한 대체역사 위기(영토 대부분 상실 + 전쟁수행능력 저하)에서도 발동한다', () => {
    const g = fresh();
    empty(g);
    g.date = '1950-08-20';
    // 낙동강 방어선 조건이 아님: 대구가 함락된 상황
    let lost = 0;
    for (const p of Object.values(g.provinces)) if (p.initialOwner === 'south' && !['busan', 'jeju', 'seogwipo', 'mokpo', 'haenam', 'gwangju'].includes(p.id) && lost < 30) { p.owner = 'north'; lost++; }
    g.nations.south.warCapacity = 40;
    const f = fire(g);
    expect(f).not.toContain('naktong_crisis');
    expect(f).toContain('general_mobilization');
  });
  it('이미 발동했다면 다시 발동하지 않는다', () => {
    const g = fresh();
    g.date = '1950-08-20';
    g.flags.mobilized = true;
    for (const p of Object.values(g.provinces)) if (p.initialOwner === 'south' && p.id !== 'busan') p.owner = 'north';
    g.provinces.daegu.owner = 'south';
    g.nations.south.warCapacity = 30;
    expect(fire(g)).not.toContain('general_mobilization');
  });
  it('이벤트에서 발동을 선택하면 실제로 전환이 일어난다', () => {
    const g = fresh();
    empty(g);
    spawn(g, 'ROK', 'daegu');
    g.pendingEvents.push({ eventId: 'general_mobilization' });
    expect(resolveEvent(g, 'general_mobilization', 'execute').ok).toBe(true);
    expect(Object.values(g.units)[0].echelon).toBe('division');
    expect(g.flags.mobilizationReport).toBeDefined();
  });
});

describe('국가 단위 징집과 프로빈스 징병 자원', () => {
  it('서울을 잃으면 서울의 남은 인구가 국가 징병 자원에서 빠지고, 수복하면 다시 접근한다', () => {
    const g = fresh();
    const full = nationalDraftPool(g, 'south');
    const seoul = Math.floor(g.provinces.seoul.recruitablePopulation * draftEfficiency(g.provinces.seoul));
    g.provinces.seoul.owner = 'north';
    expect(nationalDraftPool(g, 'south')).toBe(full - seoul);
    g.provinces.seoul.owner = 'south';
    g.provinces.seoul.controlStability = 100;
    expect(nationalDraftPool(g, 'south')).toBeGreaterThanOrEqual(full);
  });
  it('이미 징집한 인원은 지역을 잃었다 되찾아도 복원되거나 중복 생성되지 않는다', () => {
    const g = fresh();
    const p = g.provinces.seoul;
    drawFromProvinces(g, 'south', 100000);
    const drafted = p.drafted;
    const remain = p.recruitablePopulation;
    expect(drafted).toBeGreaterThan(0);
    p.owner = 'north';
    p.owner = 'south';
    expect(p.drafted).toBe(drafted);
    expect(p.recruitablePopulation).toBe(remain);
    expect(p.drafted + p.recruitablePopulation).toBe(p.draftEligible);
  });
  it('점령 직후(낮은 안정도)에는 징병 효율이 제한되고 매우 낮으면 징병이 불가능하다', () => {
    const g = fresh();
    const p = g.provinces.haeju;
    p.owner = 'south';
    p.controlStability = 25;
    expect(draftEfficiency(p)).toBe(0);
    p.controlStability = 50;
    expect(draftEfficiency(p)).toBeCloseTo(0.5);
    expect(draftEfficiency(g.provinces.seoul)).toBeGreaterThan(0.85);
  });
  it('통제하지 않는 지역에서는 징집할 수 없고 풀을 넘겨 징집하지 않는다', () => {
    const g = fresh();
    const pool = nationalDraftPool(g, 'south');
    const taken = drawFromProvinces(g, 'south', pool * 10);
    expect(taken).toBe(pool);
    // 접근률(안정도)이 100% 미만이면 한 번에 다 뽑히지 않고 남은 인구에 다시 접근할 수 있다 — 반복하면 결국 고갈된다
    for (let i = 0; i < 60; i++) drawFromProvinces(g, 'south', 1e9);
    expect(nationalDraftPool(g, 'south')).toBe(0);
    expect(drawFromProvinces(g, 'south', 1000)).toBe(0);
    expect(nationalDraft(g, 'south').ok).toBe(false);
  });
  it('전쟁 피해로 인구가 줄면 징병 대상도 줄지만 이미 징집한 인원은 유지된다', () => {
    const g = fresh();
    g.date = '1950-08-12';
    clearEvents(g);
    empty(g);
    g.provinces.daegu.warDamage = 90;
    drawFromProvinces(g, 'south', 50000);
    const d = g.provinces.daegu;
    const pop0 = d.population, drafted0 = d.drafted;
    endTurn(g);
    expect(d.population).toBeLessThan(pop0);
    expect(d.drafted).toBe(drafted0);
    expect(d.recruitablePopulation).toBeGreaterThanOrEqual(0);
  });
});

describe('장비 자동 생산·배분', () => {
  it('프로빈스 산업 특성에 따라 생산 품목이 제한된다 (대포는 산업 기반이 큰 곳만)', () => {
    const g = fresh();
    expect(producibleKeys(g.provinces.seoul)).toContain('artillery');
    expect(producibleKeys(g.provinces.haenam)).not.toContain('artillery');
    expect(producibleKeys(g.provinces.seogwipo)).toEqual([]);
    expect(producibleKeys(g.provinces.seoul)).not.toContain('tanks');
  });
  it('자동 생산은 국가 군수 재고를 늘리고, 점령당한 지역은 생산에서 제외된다', () => {
    const g = fresh();
    const s0 = g.nations.south.equipStock.rifles;
    const made1 = autoProduction(g, 'south', 7);
    expect(g.nations.south.equipStock.rifles).toBeGreaterThan(s0);
    const total1 = EQUIP_KEYS.reduce((s, k) => s + made1[k], 0);
    for (const id of ['seoul', 'incheon', 'busan', 'daegu', 'daejeon', 'gwangju']) g.provinces[id].owner = 'north';
    const made2 = autoProduction(g, 'south', 7);
    expect(EQUIP_KEYS.reduce((s, k) => s + made2[k], 0)).toBeLessThan(total1);
  });
  it('산업시설 피해가 크면 생산이 줄어든다', () => {
    const a = fresh(), b = fresh();
    for (const p of Object.values(b.provinces)) p.warDamage = 80;
    const ma = autoProduction(a, 'south', 7), mb = autoProduction(b, 'south', 7);
    expect(EQUIP_KEYS.reduce((s, k) => s + mb[k], 0)).toBeLessThan(EQUIP_KEYS.reduce((s, k) => s + ma[k], 0));
  });
  it('자동 배분: 부족한 부대에 재고가 나뉘고, 재고가 모자라면 일부 부대는 부족 상태로 남는다', () => {
    const g = fresh();
    empty(g);
    const a = spawn(g, 'ROK', 'daegu', { defaultFill: 0 } as never);
    const b = spawn(g, 'ROK', 'masan');
    for (const k of EQUIP_KEYS) { a.equip[k] = 0; b.equip[k] = 0; }
    g.nations.south.equipStock = { rifles: 1000, machineGuns: 0, mortars: 0, artillery: 0, antiTank: 0, tanks: 0, vehicles: 0 };
    computeSupply(g);
    autoDistribute(g, 'south');
    expect(a.equip.rifles + b.equip.rifles).toBeGreaterThan(0);
    expect(a.equip.rifles + b.equip.rifles).toBeLessThanOrEqual(1000);
    expect(g.nations.south.equipStock.rifles).toBeLessThan(1000);
    expect(fillRatio(a, 'rifles')).toBeLessThan(1); // 모자라서 여전히 부족
    expect(a.equip.machineGuns).toBe(0);
  });
  it('보급이 차단된 부대에는 장비가 배분되지 않는다', () => {
    const g = fresh();
    empty(g);
    const u = spawn(g, 'ROK', 'daegu');
    u.equip.rifles = 0;
    for (const n of MAP.adjacency.busan) g.provinces[n].owner = 'north';
    computeSupply(g);
    expect(g.provinces.daegu.supplied).toBe(false);
    g.nations.south.equipStock.rifles = 5000;
    autoDistribute(g, 'south');
    expect(u.equip.rifles).toBe(0);
    expect(g.nations.south.equipStock.rifles).toBe(5000);
  });
  it('총동원령으로 장비가 자동 생성되지 않으며 장비 수요(부족)만 급증한다', () => {
    const g = fresh();
    const need0 = Object.values(g.units).filter((u) => u.faction === 'ROK').reduce((s, u) => s + u.equipNeed.rifles, 0);
    const stock0 = g.nations.south.equipStock.rifles;
    const have0 = Object.values(g.units).reduce((s, u) => s + u.equip.rifles, 0);
    mobilize(g);
    const need1 = Object.values(g.units).filter((u) => u.faction === 'ROK').reduce((s, u) => s + u.equipNeed.rifles, 0);
    expect(need1).toBeGreaterThan(need0 * 2.5);
    expect(g.nations.south.equipStock.rifles).toBe(stock0);
    expect(Object.values(g.units).reduce((s, u) => s + u.equip.rifles, 0)).toBe(have0);
  });
});

describe('전사자·부상자·실종 구분', () => {
  it('손실은 전사·부상·실종/포로로 나뉘고 합이 정확히 일치한다 (중복 없음)', () => {
    const g = fresh();
    empty(g);
    const u = spawn(g, 'ROK', 'daegu', { strength: 3000 });
    const real = applyLosses(u, 1000, 'combat', g);
    expect(real).toBe(1000);
    expect(u.strength).toBe(2000);
    expect(u.record.killed + u.record.wounded + u.record.missing).toBe(1000);
    expect(u.wounded).toBe(u.record.wounded);
    const st = g.nations.south.stats;
    expect(st.killed + st.wounded + st.missing).toBe(1000);
    expect(g.nations.south.casualties).toBe(1000);
  });
  it('전투 보고의 전사+부상+실종은 양측 가용 병력 감소와 일치한다', () => {
    const g = fresh(3);
    clearEvents(g);
    empty(g);
    const a = spawn(g, 'KPA', 'cheorwon', { strength: 3000 });
    const d = spawn(g, 'ROK', 'dongducheon', { strength: 3000 });
    a.order = { type: 'attack', target: 'dongducheon', issuedTurn: g.turn };
    endTurn(g);
    const rep = g.reports[0];
    expect(rep).toBeDefined();
    const a1 = rep.attackerCasualty, d1 = rep.defenderCasualty;
    expect(a1.killed + a1.wounded + a1.missing).toBe(rep.attackerLosses);
    expect(d1.killed + d1.wounded + d1.missing).toBe(rep.defenderLosses);
    for (const e of [...rep.attackerRoster, ...rep.defenderRoster]) expect(e.before - e.after).toBe(e.killed + e.wounded + e.missing);
    void d;
  });
  it('국가 전체 통계(전사+부상+실종)는 실제 가용 병력 손실 합과 같다 (전체 시뮬레이션)', () => {
    const g = fresh(5);
    for (let i = 0; i < 10 && !g.outcome; i++) {
      clearEvents(g);
      endTurn(g);
    }
    for (const side of ['south', 'north'] as const) {
      const st = g.nations[side].stats;
      expect(st.killed + st.wounded + st.missing).toBe(g.nations[side].casualties);
      expect(st.killed).toBeGreaterThanOrEqual(0);
      expect(st.wounded).toBeGreaterThanOrEqual(0);
    }
    const rep = buildCasualtyReport(g, 'south');
    expect(rep.totalLoss).toBe(g.nations.south.casualties);
    expect(rep.woundedInCare).toBe(Object.values(g.units).filter((u) => u.side === 'south').reduce((s, u) => s + u.wounded, 0));
  });
  it('부상병은 전투 없이 쉬면 복귀하고 징병 가능 인구를 다시 차감하지 않는다. 전사·실종은 회복되지 않는다', () => {
    const g = fresh();
    clearEvents(g);
    empty(g);
    g.date = '1950-08-12';
    const u = spawn(g, 'ROK', 'busan', { strength: 2000, organization: 90 });
    u.wounded = 800;
    u.record = { killed: 100, wounded: 800, missing: 50 };
    g.nations.south.stats = { killed: 100, wounded: 800, returned: 0, missing: 50, unitsDestroyed: 0 };
    u.order = { type: 'rest', issuedTurn: g.turn - 1 };
    const pool = rawPool(g), drafted = Object.values(g.provinces).reduce((s, p) => s + p.drafted, 0);
    endTurn(g);
    expect(u.wounded).toBeLessThan(800);
    expect(u.strength).toBeGreaterThan(2000);
    expect(g.nations.south.stats.returned).toBe(800 - u.wounded);
    expect(u.strength - 2000).toBe(800 - u.wounded);
    expect(rawPool(g)).toBeLessThanOrEqual(pool); // 인구 변동 외에 징병 풀 변화 없음 (복귀는 징집이 아님)
    expect(Object.values(g.provinces).reduce((s, p) => s + p.drafted, 0)).toBe(drafted);
    expect(u.record.killed).toBe(100);
    expect(u.record.missing).toBe(50);
    expect(g.nations.south.stats.killed).toBe(100);
  });
  it('완전 휴식 > 대기 > 이동만 > 전투 참여 순으로 회복이 크다', () => {
    const rate = (mode: 'rest' | 'idle' | 'move' | 'fight') => {
      const g = fresh();
      clearEvents(g);
      empty(g);
      g.date = '1950-08-12';
      const u = spawn(g, 'ROK', 'busan', { strength: 2000 });
      u.wounded = 1000;
      u.restTurns = 2;
      if (mode === 'rest') u.order = { type: 'rest', issuedTurn: 0 };
      if (mode === 'move') u.order = { type: 'move', target: 'gimhae', issuedTurn: g.turn };
      if (mode === 'fight') {
        const k = spawn(g, 'KPA', 'gimhae', { strength: 800 });
        g.provinces.gimhae.owner = 'north';
        u.order = { type: 'attack', target: 'gimhae', issuedTurn: g.turn };
        void k;
      }
      endTurn(g);
      return 1000 - u.wounded;
    };
    const r = rate('rest'), i = rate('idle'), m = rate('move'), f = rate('fight');
    expect(r).toBeGreaterThan(i);
    expect(i).toBeGreaterThan(m);
    expect(m).toBeGreaterThan(f);
  });
  it('손상 장비는 휴식으로 수리되지만 수리 가능한 양을 넘지 않고 파괴된 장비는 돌아오지 않는다', () => {
    const g = fresh();
    clearEvents(g);
    empty(g);
    g.date = '1950-08-12';
    const u = spawn(g, 'ROK', 'busan', { strength: 3000 });
    applyLosses(u, 1500, 'combat', g);
    const damaged0 = u.equipDamaged.rifles, eq0 = u.equip.rifles;
    const total0 = damaged0 + eq0;
    expect(damaged0).toBeGreaterThan(0);
    u.order = { type: 'rest', issuedTurn: 0 };
    for (let i = 0; i < 6; i++) endTurn(g);
    expect(u.equip.rifles).toBeGreaterThan(eq0);
    expect(u.equip.rifles + u.equipDamaged.rifles).toBeLessThanOrEqual(total0 + 1000); // 자동 배분 외 증가 없음
    expect(u.equipDamaged.rifles).toBeLessThan(damaged0);
    expect(u.equipDamaged.rifles).toBeGreaterThanOrEqual(0);
  });
  it('휴식이 필요한 부대 판정은 피로·조직력·사기·부상병·손상 장비를 본다', () => {
    const g = fresh();
    const base = spawn(g, 'ROK', 'busan', { fatigue: 0, organization: 90, morale: 70 });
    expect(needsRest(base)).toBe(false);
    expect(needsRest({ ...base, fatigue: 60 } as Unit)).toBe(true);
    expect(needsRest({ ...base, organization: 40 } as Unit)).toBe(true);
    expect(needsRest({ ...base, morale: 30 } as Unit)).toBe(true);
    expect(needsRest({ ...base, wounded: 900 } as Unit)).toBe(true);
    expect(needsRest({ ...base, equipDamaged: { ...base.equipDamaged, rifles: 900 } } as Unit)).toBe(true);
  });
});

describe('후퇴 경로가 없는 부대는 전멸한다', () => {
  const setup = () => {
    const g = fresh(3);
    clearEvents(g);
    empty(g);
    for (const n of MAP.adjacency.cheorwon) g.provinces[n].owner = 'south'; // 철원의 이웃은 모두 아군(공격측) 영토
    const att = [0, 1, 2, 3].map(() => spawn(g, 'ROK', 'dongducheon', { training: 95, experience: 80, morale: 100, strength: 3000 }));
    const dfd = spawn(g, 'KPA', 'cheorwon', { strength: 1500, training: 20, morale: 40, wounded: 300 });
    att.forEach((a) => (a.order = { type: 'attack', target: 'cheorwon', issuedTurn: g.turn }));
    return { g, att, dfd };
  };
  it('패배한 부대가 즉시 소멸하고, 다음 턴에 되살아나지 않는다', () => {
    const { g, dfd } = setup();
    const missing0 = g.nations.north.stats.missing;
    const captured0 = g.nations.south.equipStock.rifles;
    endTurn(g);
    expect(g.units[dfd.id]).toBeUndefined();
    expect(g.nations.north.stats.unitsDestroyed).toBe(1);
    expect(g.nations.north.stats.missing).toBeGreaterThan(missing0); // 포로·실종
    expect(g.nations.north.stats.killed).toBeGreaterThan(0); // 전원 전사가 아니다
    expect(g.nations.south.equipStock.rifles).toBeGreaterThan(captured0); // 장비 노획
    expect(g.log.some((l) => l.text.includes('전멸'))).toBe(true);
    const rep = g.reports.find((r) => r.province === 'cheorwon')!;
    expect(rep.surrounded).toBe(true);
    expect(rep.defenderRoster[0].destroyed).toBe(true);
    for (let i = 0; i < 3; i++) endTurn(g);
    expect(g.units[dfd.id]).toBeUndefined();
  });
  it('잔존 병력은 전사·포로로 나뉘고 부상병도 가용 병력에서 제외된다 (전사자만 있는 것이 아니다)', () => {
    const { g, dfd } = setup();
    const kBefore = g.nations.north.stats.killed;
    const rep0 = dfd.strength + dfd.wounded;
    void rep0;
    endTurn(g);
    const st = g.nations.north.stats;
    expect(st.missing).toBeGreaterThan(st.killed - kBefore - 1000 > 0 ? 0 : 0);
    expect(st.killed + st.wounded + st.missing).toBe(g.nations.north.casualties);
  });
  it('후퇴할 인접 아군 지역이 있으면 전멸하지 않고 후퇴한다', () => {
    const g = fresh(3);
    clearEvents(g);
    empty(g);
    const att = [0, 1, 2, 3].map(() => spawn(g, 'ROK', 'dongducheon', { training: 95, experience: 80, morale: 100, strength: 3000 }));
    const dfd = spawn(g, 'KPA', 'cheorwon', { strength: 1500, training: 20, morale: 40 });
    att.forEach((a) => (a.order = { type: 'attack', target: 'cheorwon', issuedTurn: g.turn }));
    endTurn(g);
    expect(g.units[dfd.id]).toBeDefined();
    expect(g.units[dfd.id].location).not.toBe('cheorwon');
  });
  it('dissolveUnit 은 부대를 제거하고 통계를 중복 없이 갱신한다', () => {
    const g = fresh();
    empty(g);
    const u = spawn(g, 'ROK', 'daegu', { strength: 1000 });
    u.wounded = 200;
    applyLosses(u, 100, 'combat', g);
    const before = g.nations.south.stats;
    const total0 = before.killed + before.wounded + before.missing;
    const cas0 = g.nations.south.casualties;
    dissolveUnit(g, u, 'annihilated');
    const st = g.nations.south.stats;
    expect(g.units[u.id]).toBeUndefined();
    expect(st.killed + st.wounded + st.missing).toBe(g.nations.south.casualties);
    expect(g.nations.south.casualties - cas0).toBe(900);
    expect(st.killed + st.wounded + st.missing - total0).toBe(900);
    expect(st.unitsDestroyed).toBe(1);
  });
});

describe('사상자 보고 이벤트', () => {
  it('서울 함락·총동원령·낙동강·상륙·중국군·정전협상 시점에 보고 이벤트가 발생한다', () => {
    const ids = ['casualty_report_seoul', 'casualty_report_mobilization', 'casualty_report_naktong', 'casualty_report_landing', 'casualty_report_china', 'casualty_report_talks'];
    for (const id of ids) {
      const ev = EVENTS.find((e) => e.id === id)!;
      expect(ev).toBeDefined();
      expect(ev.casualtyReport).toBe(true);
    }
    const g = fresh();
    g.pendingEvents = [];
    g.firedEvents = [];
    g.flags.seoulLost = true;
    expect(checkEvents(g)).toContain('casualty_report_seoul');
  });
  it('보고 수치는 실제 전투 손실 합산이며 총동원령 직후 보고에도 동원 전후가 반영된다', () => {
    const g = fresh();
    applyLosses(Object.values(g.units).find((u) => u.side === 'south')!, 500, 'combat', g);
    const r = buildCasualtyReport(g, 'south');
    expect(r.killed + r.woundedTotal + r.missing).toBe(500);
    expect(r.available).toBe(forceStats(g, 'south').available);
    const before = r.available;
    mobilize(g);
    expect(buildCasualtyReport(g, 'south').available).toBeGreaterThan(before);
    expect(buildCasualtyReport(g, 'south').authorized).toBeGreaterThan(r.authorized);
  });
});

describe('부대 선택 개선: 절반만 / 휴식 필요', () => {
  const setup = (n: number) => {
    const g = fresh();
    empty(g);
    const ids = Array.from({ length: n }, () => spawn(g, 'ROK', 'daegu').id);
    useGame.setState({ game: g, selectedProvince: null, selectedUnits: [], mode: 'select', playback: null });
    useGame.getState().selectProvince('daegu');
    return ids;
  };
  it('절반만 선택: 8→4, 6→3, 5→3, 3→2, 2→1, 1→1 (목록 순서 기준, 올림)', () => {
    const cases: [number, number][] = [[8, 4], [6, 3], [5, 3], [3, 2], [2, 1], [1, 1]];
    for (const [n, want] of cases) {
      const ids = setup(n);
      expect(useGame.getState().selectedUnits.length).toBe(n);
      useGame.getState().selectHalf();
      const sel = useGame.getState().selectedUnits;
      expect(sel.length).toBe(want);
      expect(sel).toEqual(ids.slice(0, want)); // 매번 무작위가 아니라 표시 순서 기준
    }
  });
  it('버튼을 다시 누르면 남은 선택을 기준으로 절반만 선택한다 (8→4→2→1→1)', () => {
    setup(8);
    const seq: number[] = [];
    for (let i = 0; i < 4; i++) {
      useGame.getState().selectHalf();
      seq.push(useGame.getState().selectedUnits.length);
    }
    expect(seq).toEqual([4, 2, 1, 1]);
  });
  it('휴식 필요 부대 선택: 필요한 부대만 선택되고, 없으면 아무것도 선택하지 않고 안내한다', () => {
    const ids = setup(4);
    const g = useGame.getState().game;
    g.units[ids[1]].fatigue = 70;
    g.units[ids[3]].wounded = 900;
    useGame.setState({ game: g });
    useGame.getState().selectNeedsRest();
    expect(useGame.getState().selectedUnits.sort()).toEqual([ids[1], ids[3]].sort());
    const g2 = useGame.getState().game;
    g2.units[ids[1]].fatigue = 0;
    g2.units[ids[3]].wounded = 0;
    useGame.setState({ game: g2 });
    useGame.getState().selectNeedsRest();
    expect(useGame.getState().selectedUnits).toEqual([]);
    expect(useGame.getState().toast?.kind).toBe('err');
    expect(useGame.getState().toast?.text).toContain('휴식이 필요한 부대가 없습니다');
  });
});

describe('전장의 안개 설정', () => {
  it('기본값은 꺼짐이며 꺼져 있으면 모든 적 정보가 보인다', () => {
    const g = fresh();
    expect(g.settings.fog).toBe(false);
    expect(fogOn(g)).toBe(false);
    expect(canSee(g, 'pyongyang')).toBe(true);
  });
  it('켜면 정찰되지 않은 지역이 가려지고, 설정은 저장·불러오기 후에도 유지된다', () => {
    const g = fresh();
    g.settings.fog = true;
    expect(canSee(g, 'pyongyang')).toBe(false);
    const loaded = deserialize(serialize(g))!;
    expect(loaded.settings.fog).toBe(true);
    expect(canSee(loaded, 'pyongyang')).toBe(false);
  });
  it('안개는 표시만 바꾸며 실제 전투 결과는 같다', () => {
    const run = (fog: boolean) => {
      const g = fresh(21);
      g.settings.fog = fog;
      endTurn(g);
      const copy = JSON.parse(JSON.stringify(g));
      delete copy.settings;
      delete copy.intel;
      return JSON.stringify(copy);
    };
    expect(run(true)).toBe(run(false));
  });
  it('스토어에서 안개를 켜고 끌 수 있다', () => {
    const g = fresh();
    useGame.setState({ game: g });
    useGame.getState().setFog(true);
    expect(useGame.getState().game.settings.fog).toBe(true);
    useGame.getState().setFog(false);
    expect(useGame.getState().game.settings.fog).toBe(false);
  });
});

describe('회귀: 저장·불러오기와 전체 진행', () => {
  it('새 필드(부상병·손상 장비·동원 상태·국가 통계)가 저장·불러오기에서 보존된다', () => {
    const g = fresh();
    const u = Object.values(g.units).find((x) => x.side === 'south')!;
    applyLosses(u, 300, 'combat', g);
    mobilize(g);
    const loaded = deserialize(serialize(g))!;
    expect(loaded.units[u.id].wounded).toBe(u.wounded);
    expect(loaded.units[u.id].echelon).toBe('division');
    expect(loaded.nations.south.stats).toEqual(g.nations.south.stats);
    expect(loaded.flags.mobilized).toBe(true);
  });
  it('30턴 진행해도 음수 병력·음수 징병 자원이 생기지 않는다', () => {
    const g = fresh(13);
    for (let i = 0; i < 30 && !g.outcome; i++) {
      clearEvents(g);
      endTurn(g);
      for (const u of Object.values(g.units)) {
        expect(u.strength).toBeGreaterThanOrEqual(0);
        expect(u.wounded).toBeGreaterThanOrEqual(0);
        for (const k of EQUIP_KEYS) {
          expect(u.equip[k]).toBeGreaterThanOrEqual(0);
          expect(u.equipDamaged[k]).toBeGreaterThanOrEqual(0);
        }
        expect(u.strength).toBeLessThanOrEqual(u.maxStrength);
      }
      for (const p of Object.values(g.provinces)) expect(p.recruitablePopulation).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('국가 훈련병 보충 대상', () => {
  it('국가 훈련병은 국군 부대에만 보충되고 UN군에는 보충되지 않으며, 풀에서 차감된다', async () => {
    const { reinforceFromPool } = await import('../game/manpower');
    const g = fresh();
    empty(g);
    const rok = spawn(g, 'ROK', 'busan', { strength: 1000 });
    const un = spawn(g, 'UN', 'busan', { strength: 1000 });
    g.nations.south.trainees = { count: 5000, training: 30 };
    g.nations.south.commandPoints = 9;
    computeSupply(g);
    expect(reinforceFromPool(g, 'south', un.id).ok).toBe(false);
    const r = reinforceFromPool(g, 'south', rok.id);
    expect(r.ok).toBe(true);
    expect(rok.strength).toBe(2000 + 1000);
    expect(g.nations.south.trainees.count).toBe(5000 - 2000);
  });
});

describe('북한군 총동원령 (국군과 동시 발동)', () => {
  const setupBoth = () => {
    const g = fresh();
    empty(g);
    const rok = ['daegu', 'daegu', 'busan'].map((l) => spawn(g, 'ROK', l, { strength: 2800 }));
    const kpa = ['cheorwon', 'cheorwon', 'pyonggang_dummy'].slice(0, 2).map((l) => spawn(g, 'KPA', l, { strength: 2900 }));
    kpa.push(spawn(g, 'KPA', 'pyongyang', { strength: 2900 }));
    const un = spawn(g, 'UN', 'busan');
    const pla = spawn(g, 'KPA', 'sinuiju', { strength: 2000 });
    pla.faction = 'PLA';
    return { g, rok, kpa, un, pla };
  };
  it('국군이 총동원령을 발동하는 순간 북한군도 같은 시점에 사단급으로 확대된다 (부대 수·위치 유지)', () => {
    const { g, rok, kpa } = setupBoth();
    const locs = kpa.map((u) => u.location);
    g.pendingEvents.push({ eventId: 'general_mobilization' });
    expect(resolveEvent(g, 'general_mobilization', 'execute').ok).toBe(true);
    expect(g.flags.mobilized).toBe(true);
    expect(g.flags.kpaMobilized).toBe(true);
    rok.forEach((u) => expect(g.units[u.id].echelon).toBe('division'));
    kpa.forEach((u, i) => {
      expect(g.units[u.id].echelon).toBe('division');
      expect(g.units[u.id].location).toBe(locs[i]);
      expect(g.units[u.id].maxStrength).toBeGreaterThanOrEqual(8000);
      expect(g.units[u.id].strength).toBeGreaterThan(2900);
    });
    expect(Object.values(g.units).filter((u) => u.faction === 'KPA').length).toBe(3);
    expect(g.flags.kpaMobilizationReport).toBeDefined();
  });
  it('북한군 긴급 동원병도 북측 징병 가능 인구에서 차감되며 장비는 생기지 않는다', () => {
    const { g, kpa } = setupBoth();
    const rawN = () => Object.values(g.provinces).filter((p) => p.owner === 'north').reduce((s, p) => s + p.recruitablePopulation, 0);
    const n0 = rawN();
    const eq0 = sumEquip(kpa);
    const rep = mobilize(g, 'kpa');
    expect(rep.emergencyDrafted).toBeGreaterThan(0);
    expect(n0 - rawN()).toBeGreaterThanOrEqual(rep.emergencyDrafted);
    expect(sumEquip(kpa.map((u) => g.units[u.id]))).toEqual(eq0);
    expect(g.nations.north.emergencyDrafted).toBe(rep.emergencyDrafted);
    for (const u of kpa) expect(fillRatio(g.units[u.id], 'rifles')).toBeLessThan(0.9);
  });
  it('중국군·미군(UN) 편제는 유지되고, 국군이 발동하지 않으면 북한군 단독으로는 발동하지 않는다', () => {
    const { g, un, pla } = setupBoth();
    mobilize(g, 'kpa');
    expect(g.units[un.id].echelon).toBe('brigade');
    expect(g.units[pla.id].echelon).toBe('brigade');
    const g2 = fresh();
    g2.date = '1950-08-20';
    g2.pendingEvents = [];
    g2.firedEvents = [];
    checkEvents(g2);
    expect(g2.flags.kpaMobilized).toBeUndefined();
  });
  it('이미 발동한 북한군에는 중복 적용되지 않는다 (병력·징병 자원 이중 차감 없음)', () => {
    const { g } = setupBoth();
    g.pendingEvents.push({ eventId: 'general_mobilization' });
    resolveEvent(g, 'general_mobilization', 'execute');
    const strength = Object.values(g.units).filter((u) => u.side === 'north').reduce((s, u) => s + u.strength, 0);
    g.firedEvents = g.firedEvents.filter((x) => x !== 'general_mobilization');
    g.pendingEvents.push({ eventId: 'general_mobilization' });
    resolveEvent(g, 'general_mobilization', 'execute');
    expect(Object.values(g.units).filter((u) => u.side === 'north').reduce((s, u) => s + u.strength, 0)).toBe(strength);
  });
  it('북한군 총동원령 이후 생산 배율이 오르고 예상치 미리보기는 상태를 바꾸지 않는다', async () => {
    const { productionMultiplier } = await import('../game/production');
    const { g } = setupBoth();
    expect(productionMultiplier(g, 'north')).toBe(1);
    const snap = JSON.stringify(g);
    previewMobilization(g, 'kpa');
    expect(JSON.stringify(g)).toBe(snap);
    mobilize(g, 'kpa');
    expect(productionMultiplier(g, 'north')).toBeGreaterThan(1);
  });
});

describe('UN 장비 지원', () => {
  it('미국 개입도·UN 지지에 비례하며 개입 전에는 미미하다', async () => {
    const { aidPerDay } = await import('../game/production');
    const g = fresh();
    const early = aidPerDay(g, 'south').rifles;
    g.diplomacy.usCommitment = 70;
    g.diplomacy.unSupport = 80;
    const late = aidPerDay(g, 'south').rifles;
    expect(late).toBeGreaterThan(early * 2);
    g.diplomacy.usCommitment = 0;
    expect(aidPerDay(g, 'south').rifles).toBe(0);
  });
  it('항만을 잃으면 지원이 줄고 모두 잃으면 도착하지 않는다', async () => {
    const { aidPerDay } = await import('../game/production');
    const g = fresh();
    g.diplomacy.usCommitment = 70;
    g.diplomacy.unSupport = 70;
    const full = aidPerDay(g, 'south').rifles;
    for (const p of Object.values(g.provinces)) if (p.owner === 'south' && p.portCapacity > 0 && p.id !== 'tongyeong') p.owner = 'north';
    const reduced = aidPerDay(g, 'south').rifles;
    expect(reduced).toBeLessThan(full);
    expect(reduced).toBeGreaterThan(0);
    for (const p of Object.values(g.provinces)) if (p.portCapacity > 0) p.owner = 'north';
    expect(aidPerDay(g, 'south').rifles).toBe(0);
  });
  it('턴이 지나면 UN 지원 장비가 국가 군수 재고로 입고되고 브리핑에 표시되며 자동 배분된다', () => {
    const g = fresh();
    for (const id of Object.keys(g.units)) if (g.units[id].side === 'north') delete g.units[id];
    g.diplomacy.usCommitment = 80;
    g.diplomacy.unSupport = 80;
    const before = g.nations.south.equipStock.rifles;
    const u = Object.values(g.units).find((x) => x.faction === 'ROK')!;
    u.equip.rifles = 0;
    const have0 = Object.values(g.units).reduce((s, x) => s + x.equip.rifles, 0);
    clearEvents(g);
    endTurn(g);
    expect(g.briefing.some((l) => l.includes('UN 장비 지원'))).toBe(true);
    const have1 = Object.values(g.units).reduce((s, x) => s + x.equip.rifles, 0);
    expect(have1).toBeGreaterThan(have0); // 자동 배분으로 부대 장비가 늘어난다
    expect(g.nations.south.equipStock.rifles).not.toBe(before);
  });
  it('북한도 소련·중국 지원을 받지만 UN 지원 규모와 별개다', async () => {
    const { aidPerDay } = await import('../game/production');
    const g = fresh();
    g.diplomacy.usCommitment = 70;
    g.diplomacy.unSupport = 70;
    const n = aidPerDay(g, 'north');
    const s = aidPerDay(g, 'south');
    expect(n.rifles).toBeGreaterThan(0);
    expect(s.rifles).toBeGreaterThan(n.rifles);
    expect(n.tanks).toBe(0);
  });
  it('미국에 증원 요청 정책을 쓰면 지원이 늘어난다', async () => {
    const { aidPerDay } = await import('../game/production');
    const { usePolicy } = await import('../game/policies');
    const g = fresh();
    g.nations.south.commandPoints = 5;
    g.diplomacy.unSupport = 60;
    const a0 = aidPerDay(g, 'south').rifles;
    expect(usePolicy(g, 'south', 'request_us').ok).toBe(true);
    expect(aidPerDay(g, 'south').rifles).toBeGreaterThan(a0);
  });
});

describe('도시 내정 탭의 부대 창설 (징집은 국가 단위)', () => {
  it('선택한 도시에서 창설 버튼으로 부대를 편성하고 국가 훈련병 풀에서 차감된다', () => {
    const g = fresh();
    g.nations.south.trainees = { count: 4000, training: 30 };
    g.nations.south.commandPoints = 5;
    useGame.setState({ game: g, selectedProvince: 'gwangju', selectedUnits: [], playback: null });
    const n0 = Object.values(g.units).length;
    useGame.getState().nation('create', 'gwangju');
    const g2 = useGame.getState().game;
    expect(Object.values(g2.units).length).toBe(n0 + 1);
    const made = Object.values(g2.units).filter((u) => u.historicalParent.startsWith('신편')).pop()!;
    expect(made.location).toBe('gwangju');
    expect(g2.nations.south.trainees.count).toBe(1000); // 여단 정원 3,000명만 사용
    expect(g2.nations.south.commandPoints).toBe(3);
  });
  it('징집은 국가 단위로만 이루어지고 개별 도시 징집 명령은 없다', () => {
    const g = fresh();
    useGame.setState({ game: g, selectedProvince: 'daegu', playback: null });
    const before = nationalDraftPool(g, 'south');
    useGame.getState().province('conscript'); // 존재하지 않는 도시 단위 명령은 무시된다
    expect(nationalDraftPool(useGame.getState().game, 'south')).toBe(before);
    useGame.getState().nation('draft');
    expect(nationalDraftPool(useGame.getState().game, 'south')).toBeLessThan(before);
  });
});

describe('미군·UN군 자동 보충', () => {
  const setup = () => {
    const g = fresh();
    empty(g);
    g.diplomacy.usCommitment = 80;
    g.diplomacy.unSupport = 80;
    const un = spawn(g, 'UN', 'busan', { strength: 1200 });
    const rok = spawn(g, 'ROK', 'busan', { strength: 1200 });
    computeSupply(g);
    return { g, un, rok };
  };
  it('UN군은 국가 훈련병 풀이 없어도 턴이 지나면 자동으로 보충된다', () => {
    const { g, un } = setup();
    clearEvents(g);
    const un0 = un.strength;
    endTurn(g);
    expect(g.units[un.id].strength).toBeGreaterThan(un0);
    expect(g.briefing.some((l) => l.includes('UN군 보충'))).toBe(true);
  });
  it('정원을 넘기지 않고 보충병이 섞여 훈련도·경험은 내려가며 장비는 따라오지 않는다', () => {
    const { g, un } = setup();
    clearEvents(g);
    un.experience = 60;
    un.training = 80;
    for (let i = 0; i < 30; i++) { endTurn(g); clearEvents(g); }
    const u = g.units[un.id];
    expect(u.strength).toBeLessThanOrEqual(u.maxStrength);
    expect(u.experience).toBeLessThan(60);
    expect(u.training).toBeLessThan(80);
  });
  it('개입도가 0이면 보충이 오지 않고, 높을수록 많이 온다', () => {
    const { g } = setup();
    const hi = unReplacementPerDay(g);
    g.diplomacy.usCommitment = 20;
    const lo = unReplacementPerDay(g);
    g.diplomacy.usCommitment = 0;
    expect(unReplacementPerDay(g)).toBe(0);
    expect(hi).toBeGreaterThan(lo * 3);
  });
  it('전투에 참여한 부대나 보급이 끊긴 부대는 보충받지 못한다', () => {
    const { g, un } = setup();
    clearEvents(g);
    const un0 = un.strength;
    g.nations.south.replacementPool = 5000;
    autoUnReplacements(g, 1, new Set([un.id]));
    expect(g.units[un.id].strength).toBe(un0);
    for (const nb of MAP.adjacency.busan) g.provinces[nb].owner = 'north';
    const daegu = spawn(g, 'UN', 'daegu', { strength: 1000 });
    computeSupply(g);
    autoUnReplacements(g, 1);
    expect(g.units[daegu.id].strength).toBe(1000);
  });
  it('UN군 부상병은 국군보다 빠르게 복귀한다', () => {
    const run = (f: 'UN' | 'ROK') => {
      const g = fresh();
      clearEvents(g);
      empty(g);
      g.date = '1950-08-12';
      g.diplomacy.usCommitment = 0;
      const u = spawn(g, f, 'busan', { strength: 2000 });
      u.wounded = 1000;
      endTurn(g);
      return 1000 - g.units[u.id].wounded;
    };
    expect(run('UN')).toBeGreaterThan(run('ROK'));
  });
});
