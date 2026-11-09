import { describe, expect, it, beforeEach } from 'vitest';
import { createGame } from '../game/engine';
import { MAP, neighbors } from '../game/map';
import { findPath, issueOrder } from '../game/orders';
import { endTurn } from '../game/turn';
import { computeSupply, hubLevels } from '../game/supply';
import { checkEvents, resolveEvent } from '../game/events';
import { createUnit, unitsAt } from '../game/units';
import { buildLandingPlan, LANDING_OPS } from '../game/amphibious';
import { viewAt } from '../game/record';
import { useGame } from '../store/gameStore';
import { EVENTS } from '../data/events';
import type { GameState, Unit } from '../game/types';

const fresh = (seed = 3) => createGame(seed);
const clearEvents = (g: GameState) => {
  while (g.pendingEvents.length) {
    const ev = EVENTS.find((e) => e.id === g.pendingEvents[0].eventId)!;
    resolveEvent(g, ev.id, ev.choices.find((c) => !c.isCounterfactual)?.id ?? ev.choices[0]?.id);
  }
};
const clearBoard = (g: GameState) => Object.keys(g.units).forEach((id) => delete g.units[id]);
const spawn = (g: GameState, faction: 'ROK' | 'KPA' | 'UN', loc: string, over: Partial<Unit> = {}) => {
  const u = createUnit(g, { faction, name: `시험-${g.nextUnitNumber}`, parent: '시험', kind: 'infantry', location: loc, training: 60, experience: 20, defaultFill: 0.9 });
  Object.assign(u, over);
  g.units[u.id] = u;
  return u;
};
const firedAfterCheck = (g: GameState) => {
  g.pendingEvents = [];
  g.firedEvents = [];
  return checkEvents(g);
};

describe('부대 선택 자동화', () => {
  let ids: string[];
  beforeEach(() => {
    const g = fresh();
    clearEvents(g);
    clearBoard(g);
    ids = Array.from({ length: 5 }, () => spawn(g, 'ROK', 'daegu').id);
    spawn(g, 'KPA', 'cheorwon');
    useGame.setState({ game: g, selectedProvince: null, selectedUnits: [], mode: 'select', playback: null });
  });
  it('5개 여단이 있는 프로빈스를 클릭하면 5개가 모두 선택된다', () => {
    useGame.getState().selectProvince('daegu');
    expect(useGame.getState().selectedUnits.sort()).toEqual([...ids].sort());
  });
  it('5개 선택 상태에서 2개 여단에만 이동 명령을 내리면 2개는 선택 해제되고 3개는 선택이 유지된다 (실제 이동은 턴 종료 시)', () => {
    useGame.getState().selectProvince('daegu');
    expect(useGame.getState().selectedUnits.length).toBe(5);
    useGame.getState().setMode('move', ids.slice(0, 2));
    useGame.getState().mapClick('busan');
    const st = useGame.getState();
    expect(st.selectedUnits.length).toBe(3);
    expect(st.selectedUnits.sort()).toEqual(ids.slice(2).sort());
    expect(st.game.units[ids[0]].order?.type).toBe('move');
    expect(st.game.units[ids[0]].location).toBe('daegu');
    // 이미 명령받은 2개는 다음 일괄 명령에 포함되지 않는다
    useGame.getState().orderUnits('defend');
    const g = useGame.getState().game;
    expect(g.units[ids[0]].order?.type).toBe('move');
    expect(g.units[ids[1]].order?.type).toBe('move');
    expect(g.units[ids[2]].order?.type).toBe('defend');
    expect(useGame.getState().selectedUnits.length).toBe(0);
  });
  it('전체 선택 후 일부만 해제해 명령하면 명령받은 부대만 해제되고 나머지는 선택 유지', () => {
    const s = useGame.getState();
    s.selectProvince('daegu');
    s.toggleUnit(ids[2]);
    s.toggleUnit(ids[3]);
    s.toggleUnit(ids[4]); // 3개 해제 → 2개 선택
    expect(useGame.getState().selectedUnits.length).toBe(2);
    useGame.getState().orderUnits('move', 'busan');
    const after = useGame.getState();
    expect(after.selectedUnits.length).toBe(0);
    // 명령받은 2개는 이동 명령 상태이며 부대는 아직 대구에 있다 (턴 종료 전에는 이동하지 않음)
    expect(after.game.units[ids[0]].order?.type).toBe('move');
    expect(after.game.units[ids[0]].location).toBe('daegu');
  });
  it('5개 중 2개에 명령하면 선택이 5→3으로 줄고, 명령받은 부대는 다음 명령에 포함되지 않는다', () => {
    const s = useGame.getState();
    s.selectProvince('daegu');
    expect(useGame.getState().selectedUnits.length).toBe(5);
    // 2개만 명령: 선택을 2개로 잠시 줄여 명령한 뒤 나머지 3개를 되돌려 선택
    useGame.setState({ selectedUnits: ids.slice(0, 2) });
    useGame.getState().orderUnits('move', 'busan');
    useGame.setState({ selectedUnits: [] });
    useGame.getState().selectProvince('daegu'); // 다시 클릭하면 아직 명령 안 받은 부대만 자동 선택
    expect(useGame.getState().selectedUnits.sort()).toEqual(ids.slice(2).sort());
    useGame.getState().orderUnits('defend');
    const g = useGame.getState().game;
    expect(g.units[ids[0]].order?.type).toBe('move'); // 두 번째 명령이 덮어쓰지 않음
    expect(g.units[ids[1]].order?.type).toBe('move');
    expect(g.units[ids[2]].order?.type).toBe('defend');
  });
  it('선택된 부대에 같은 턴에 명령이 이미 있으면 중복 명령이 거부되고 선택이 유지된다', () => {
    const s = useGame.getState();
    s.selectProvince('daegu');
    useGame.getState().orderUnits('defend');
    // 강제로 명령받은 부대를 선택 목록에 넣어도 중복 명령은 막힌다
    useGame.setState({ selectedUnits: [ids[0], ids[1]] });
    useGame.getState().orderUnits('rest');
    const g = useGame.getState().game;
    expect(g.units[ids[0]].order?.type).toBe('defend');
    expect(useGame.getState().selectedUnits.length).toBe(2); // 실패한 부대는 선택 유지
  });
  it('명령을 취소하면 다시 선택할 수 있다', () => {
    const s = useGame.getState();
    s.selectProvince('daegu');
    useGame.getState().orderUnits('defend');
    expect(useGame.getState().selectedUnits.length).toBe(0);
    useGame.getState().cancelUnits([ids[0], ids[1]]);
    expect(useGame.getState().selectedUnits.sort()).toEqual([ids[0], ids[1]].sort());
    expect(useGame.getState().game.units[ids[0]].order).toBeNull();
  });
  it('적군이 있는 프로빈스를 클릭하면 적 부대는 선택되지 않는다', () => {
    useGame.getState().selectProvince('cheorwon');
    expect(useGame.getState().selectedUnits).toEqual([]);
    const enemy = Object.values(useGame.getState().game.units).find((u) => u.side === 'north')!;
    useGame.getState().toggleUnit(enemy.id);
    expect(useGame.getState().selectedUnits).toEqual([]);
    useGame.getState().setUnits([enemy.id]);
    expect(useGame.getState().selectedUnits).toEqual([]);
  });
  it('전체 선택/전체 해제가 동작한다', () => {
    const s = useGame.getState();
    s.selectProvince('daegu');
    s.setUnits([]);
    expect(useGame.getState().selectedUnits.length).toBe(0);
    useGame.getState().selectAllHere();
    expect(useGame.getState().selectedUnits.length).toBe(5);
  });
});

describe('지도 연결선 = 실제 이동 관계', () => {
  it('철도·해상 연결은 모두 이동 가능한 인접 관계와 일치한다', () => {
    for (const a of Object.keys(MAP.rail)) for (const b of MAP.rail[a]) expect(MAP.adjacency[a]).toContain(b);
    for (const a of Object.keys(MAP.adjacency)) for (const b of MAP.adjacency[a]) expect(neighbors(b)).toContain(a);
  });
  it('이동 경로는 항상 인접 관계(도로·철도·항구 해상)만 따른다', () => {
    const g = fresh();
    const ids = Object.keys(g.provinces).filter((id) => g.provinces[id].owner === 'south');
    for (const to of ids.slice(0, 25)) {
      const r = findPath(g, 'south', 'busan', to);
      if (!r) continue;
      for (let i = 1; i < r.path.length; i++) expect(neighbors(r.path[i - 1])).toContain(r.path[i]);
    }
  });
  it('지도가 표시하는 도로 연결 수 = 인접 데이터의 간선 수', () => {
    let edges = 0;
    for (const a of Object.keys(MAP.adjacency)) for (const b of MAP.adjacency[a]) if (a < b) edges++;
    const total = Object.values(MAP.adjacency).reduce((s, v) => s + v.length, 0) / 2;
    expect(edges).toBe(total);
  });
});

describe('이벤트는 날짜와 실제 전황이 모두 맞아야 발생한다', () => {
  const base = () => {
    const g = fresh();
    clearEvents(g);
    g.date = '1950-08-12';
    return g;
  };
  it('낙동강 방어선 이벤트: 방어선이 없으면 발생하지 않는다', () => {
    const g = base();
    expect(firedAfterCheck(g)).not.toContain('naktong_crisis');
    // 북한군이 아직 서울 부근에 있는 전황
    for (const id of ['seoul', 'suwon', 'osan']) g.provinces[id].owner = 'north';
    spawn(g, 'KPA', 'suwon');
    expect(firedAfterCheck(g)).not.toContain('naktong_crisis');
  });
  it('낙동강 방어선 이벤트: 북한군이 남부에 진출하고 방어선에 양측 병력이 있으면 발생한다', () => {
    const g = base();
    clearBoard(g);
    for (const id of ['seoul', 'suwon', 'daejeon', 'yeongdong', 'sangju']) g.provinces[id].owner = 'north';
    for (let i = 0; i < 3; i++) spawn(g, 'ROK', 'waegwan');
    for (let i = 0; i < 2; i++) spawn(g, 'KPA', 'sangju');
    const fired = firedAfterCheck(g);
    expect(fired).toContain('naktong_crisis');
    expect(fired).not.toContain('front_crisis');
  });
  it('방어선이 아닌 전선에서 대구가 위협받으면 일반 방어전 이벤트가 대신 발생한다', () => {
    const g = base();
    clearBoard(g);
    spawn(g, 'KPA', 'yeongcheon'); // 대구 인접
    spawn(g, 'ROK', 'busan');
    const fired = firedAfterCheck(g);
    expect(fired).not.toContain('naktong_crisis');
    expect(fired).toContain('front_crisis');
  });
  it('국군이 서울을 계속 방어하고 있으면 서울 수복 이벤트가 발생하지 않는다', () => {
    const g = base();
    g.date = '1950-09-26';
    expect(g.provinces.seoul.owner).toBe('south');
    expect(firedAfterCheck(g)).not.toContain('seoul_recaptured');
    g.flags.seoulLost = true;
    expect(firedAfterCheck(g)).toContain('seoul_recaptured');
  });
  it('반격 개시 이벤트는 상륙 성공·낙동강 방어 등 선행 조건이 없으면 발생하지 않는다', () => {
    const g = base();
    g.date = '1950-09-20';
    expect(firedAfterCheck(g)).not.toContain('naktong_breakout');
  });
  it('중국 경고는 아군이 38선 이북에 진출하지 않았다면 발생하지 않는다', () => {
    const g = base();
    g.date = '1950-10-01';
    expect(firedAfterCheck(g)).not.toContain('china_warning');
    g.provinces.haeju.owner = 'south';
    expect(firedAfterCheck(g)).toContain('china_warning');
  });
  it('이미 인천을 아군이 확보했거나 북한군이 남진하지 않았다면 인천상륙 준비 이벤트는 없다', () => {
    const g = base();
    expect(firedAfterCheck(g)).not.toContain('incheon_preparation');
    g.provinces.suwon.owner = 'north';
    g.provinces.incheon.owner = 'south';
    expect(firedAfterCheck(g)).not.toContain('incheon_preparation');
    g.provinces.incheon.owner = 'north';
    expect(firedAfterCheck(g)).toContain('incheon_preparation');
  });
});

describe('인천상륙작전', () => {
  /** 전선과 예비대가 있는 상황을 구성 */
  const setup = () => {
    const g = fresh(11);
    clearEvents(g);
    g.date = '1950-09-16';
    for (const id of ['seoul', 'suwon', 'osan', 'daejeon']) g.provinces[id].owner = 'north';
    g.provinces.incheon.owner = 'north';
    g.flags.incheonPlan = 'incheon';
    // 예비대(부산 주변)와 전선(대구 근처) 구성
    for (let i = 0; i < 4; i++) spawn(g, 'UN', 'busan');
    for (let i = 0; i < 4; i++) spawn(g, 'ROK', 'waegwan');
    spawn(g, 'KPA', 'yeongcheon'); // 전선을 만든다
    return g;
  };
  const southCount = (g: GameState) => Object.values(g.units).filter((u) => u.side === 'south').length;

  it('계획: 11개 여단급이며 현지 차출 4 + 외부 도착 7이다', () => {
    const g = setup();
    const plan = buildLandingPlan(g, 'incheon_landing');
    expect(plan.brigadesTotal).toBe(11);
    expect(plan.drawnCount).toBe(4);
    expect(plan.externalCount).toBe(7);
    expect(plan.entries.filter((e) => e.source === 'external').length).toBe(plan.externalCount);
    // 후보는 실제 존재하는 부대
    for (const e of plan.entries.filter((x) => x.unitId)) expect(g.units[e.unitId!]).toBeDefined();
  });
  it('실행: 차출 부대는 출발지에서 사라지고 인천에 나타나며, 외부 증원만 새로 생성된다 (중복 생성 없음)', () => {
    const g = setup();
    const before = southCount(g);
    const plan = buildLandingPlan(g, 'incheon_landing');
    const drawnIds = plan.entries.filter((e) => e.selected && e.unitId).map((e) => e.unitId!);
    const originOf = Object.fromEntries(drawnIds.map((i) => [i, g.units[i].location]));
    const frontBefore = unitsAt(g, 'waegwan', 'south').length;
    g.pendingEvents.push({ eventId: 'incheon_landing' });
    g.firedEvents.push('incheon_landing');
    expect(resolveEvent(g, 'incheon_landing', 'execute').ok).toBe(true);
    const rep = JSON.parse(g.flags.landingReport as string);
    expect(g.flags.landingResult).toBe('success');
    expect(g.provinces.incheon.owner).toBe('south');
    // 병력 보존: 기존 + 외부 증원 = 현재 (전멸 해체가 없다고 가정한 경우 일치)
    expect(rep.total).toBe(11);
    expect(rep.fromReserve.length + rep.fromFront.length).toBe(plan.drawnCount);
    expect(rep.external.length).toBe(plan.externalCount);
    expect(southCount(g)).toBeLessThanOrEqual(before + plan.externalCount);
    expect(southCount(g)).toBeGreaterThanOrEqual(before + plan.externalCount - 2);
    // 차출 부대는 더 이상 원래 전선에 남아 있지 않다
    for (const id of drawnIds) if (g.units[id]) expect(g.units[id].location).toBe('incheon');
    const frontAfter = unitsAt(g, 'waegwan', 'south').length;
    const drawnFromFront = drawnIds.filter((i) => originOf[i] === 'waegwan').length;
    expect(frontAfter).toBe(frontBefore - drawnFromFront);
    // 지도상 인천 주둔 여단 수 = 보고된 생존 수
    expect(unitsAt(g, 'incheon', 'south').length).toBe(rep.survivors);
    expect(g.flags.incheonHub).toBe(true);
    expect(g.log.some((l) => l.text.includes('상륙 성공'))).toBe(true);
  });
  it('실패: 상륙부대가 출발지로 후퇴하고 목표 지역은 북한군 통제로 남는다 (군산 가상 작전, 강한 방어군)', () => {
    const g = setup();
    g.flags.incheonPlan = 'gunsan';
    g.provinces.gunsan.owner = 'north';
    for (let i = 0; i < 8; i++) spawn(g, 'KPA', 'gunsan', { training: 100, experience: 100, strength: 3000, morale: 100, organization: 100, defaultFill: 1 } as never);
    g.pendingEvents.push({ eventId: 'gunsan_landing' });
    g.firedEvents.push('gunsan_landing');
    const before = southCount(g);
    resolveEvent(g, 'gunsan_landing', 'execute');
    expect(g.flags.landingResult).toBe('failure');
    expect(g.provinces.gunsan.owner).toBe('north');
    expect(unitsAt(g, 'gunsan', 'south').length).toBe(0);
    expect(g.log.some((l) => l.text.includes('상륙 실패'))).toBe(true);
    // 외부 증원은 새로 생성되어 부산 등으로 후퇴했으므로 아군 부대 수는 증가하거나 같다
    expect(southCount(g)).toBeGreaterThanOrEqual(before);
  });
  it('같은 작전은 한 번만 실행된다 (중복 실행 방지)', () => {
    const g = setup();
    g.pendingEvents.push({ eventId: 'incheon_landing' });
    resolveEvent(g, 'incheon_landing', 'execute');
    const n = southCount(g);
    g.provinces.incheon.owner = 'north';
    g.pendingEvents.push({ eventId: 'incheon_landing' });
    resolveEvent(g, 'incheon_landing', 'execute');
    expect(southCount(g)).toBe(n);
  });
  it('연기를 선택하면 다음 턴에 이벤트가 다시 발생한다', () => {
    const g = setup();
    g.pendingEvents = [];
    g.firedEvents = [];
    checkEvents(g);
    expect(g.pendingEvents.some((p) => p.eventId === 'incheon_landing')).toBe(true);
    resolveEvent(g, 'incheon_landing', 'postpone');
    expect(g.firedEvents).not.toContain('incheon_landing');
    expect(g.provinces.incheon.owner).toBe('north');
    checkEvents(g);
    expect(g.pendingEvents.some((p) => p.eventId === 'incheon_landing')).toBe(true);
  });
  it('사용자가 확인 화면에서 차출 대상을 바꾸면 외부 증원 수가 그만큼 조정되어 총합은 11로 유지된다', () => {
    const g = setup();
    const p0 = buildLandingPlan(g, 'incheon_landing');
    const first = p0.entries.find((e) => e.selected && e.unitId)!;
    const p1 = buildLandingPlan(g, 'incheon_landing', new Set([first.key]));
    expect(p1.drawnCount).toBe(p0.drawnCount - 1);
    expect(p1.drawnCount + p1.externalCount).toBe(11);
    expect(LANDING_OPS.incheon_landing.brigades).toBe(11);
  });
});

describe('턴 진행 기록과 순차 재생', () => {
  it('한 턴의 전투들이 순서 있는 단계로 기록되고 마지막 단계의 표시 상태가 최종 상태와 일치한다', () => {
    const g = fresh(5);
    clearEvents(g);
    endTurn(g);
    const rec = g.lastTurn!;
    const battles = rec.steps.filter((s) => s.kind !== 'movement');
    expect(battles.length).toBeGreaterThanOrEqual(2);
    expect(battles.length).toBe(g.reports.length + rec.steps.filter((s) => s.kind === 'occupy').length);
    const last = viewAt(g, rec.steps.length - 1);
    for (const p of Object.values(g.provinces)) expect(last.owners[p.id]).toBe(p.owner);
    for (const u of last.units) expect(g.units[u.id]?.location).toBe(u.loc);
    // 모든 초기 부대는 최종 상태에서도 존재하거나 제거 기록이 있다
    const removed = new Set(rec.steps.flatMap((s) => s.unitsRemoved));
    for (const id of Object.keys(rec.initialUnits)) expect(Boolean(g.units[id]) || removed.has(id)).toBe(true);
  });
  it('중간 단계에서는 이전 전투까지의 소유권만 반영된다', () => {
    const g = fresh(5);
    clearEvents(g);
    endTurn(g);
    const rec = g.lastTurn!;
    const withChange = rec.steps.findIndex((s) => s.ownerChanges.length > 0);
    expect(withChange).toBeGreaterThanOrEqual(0);
    const ch = rec.steps[withChange].ownerChanges[0];
    expect(viewAt(g, withChange - 1).owners[ch.province]).toBe(ch.from);
    expect(viewAt(g, withChange).owners[ch.province]).toBe(ch.to);
  });
  it('각 전투 보고에 전투 전·후 병력과 후퇴 지역이 기록된다', () => {
    const g = fresh(5);
    clearEvents(g);
    endTurn(g);
    for (const r of g.reports) {
      expect(r.attackerRoster.length).toBe(r.attackerUnits.length);
      for (const e of [...r.attackerRoster, ...r.defenderRoster]) {
        expect(e.before).toBeGreaterThanOrEqual(e.after);
        expect(e.after).toBeGreaterThanOrEqual(0);
      }
      if (r.retreated) expect(r.retreatTo).not.toBeNull();
    }
  });
  it('재생·일시정지·건너뛰기는 게임 상태를 바꾸지 않으며 전투가 중복 처리되지 않는다', () => {
    const g = fresh(8);
    clearEvents(g);
    useGame.setState({ game: g, playback: null, modal: null, selectedProvince: null, selectedUnits: [] });
    useGame.getState().endTurn();
    const afterTurn = JSON.stringify(useGame.getState().game);
    const turn = useGame.getState().game.turn;
    expect(useGame.getState().playback).not.toBeNull();
    // 재생 중 턴 종료를 다시 눌러도 무시된다
    useGame.getState().endTurn();
    expect(useGame.getState().game.turn).toBe(turn);
    for (let i = 0; i < 3; i++) useGame.getState().playToResult();
    useGame.getState().setAuto(true);
    useGame.getState().setAuto(false);
    useGame.getState().playNext();
    expect(JSON.stringify(useGame.getState().game)).toBe(afterTurn);
    useGame.getState().skipPlayback();
    expect(useGame.getState().playback).toBeNull();
    expect(JSON.stringify(useGame.getState().game)).toBe(afterTurn);
  });
  it('끝까지 하나씩 재생한 결과와 건너뛴 결과의 최종 게임 상태가 같다', () => {
    const run = (skip: boolean) => {
      const g = fresh(21);
      clearEvents(g);
      useGame.setState({ game: g, playback: null, modal: null, selectedProvince: null, selectedUnits: [] });
      useGame.getState().endTurn();
      if (skip) useGame.getState().skipPlayback();
      else {
        let guard = 0;
        while (useGame.getState().playback && guard++ < 100) useGame.getState().playNext();
      }
      return JSON.stringify(useGame.getState().game);
    };
    expect(run(true)).toBe(run(false));
  });
  it('재생이 끝나면 턴 종합 보고(브리핑)가 열린다', () => {
    const g = fresh(2);
    clearEvents(g);
    useGame.setState({ game: g, playback: null, modal: null });
    useGame.getState().endTurn();
    useGame.getState().skipPlayback();
    expect(useGame.getState().modal).toBe('briefing');
  });
  it('명령을 이미 내린 이동은 턴 종료 시에만 실제 이동한다', () => {
    const g = fresh(4);
    clearEvents(g);
    const u = Object.values(g.units).find((x) => x.side === 'south' && x.location === 'daejeon')!;
    expect(issueOrder(g, u.id, 'move', 'cheongju').ok).toBe(true);
    expect(g.units[u.id].location).toBe('daejeon');
  });
});

describe('이동 명령 오류 수정과 포위 효과', () => {
  const emptyG = () => {
    const g = fresh(6);
    clearEvents(g);
    for (const id of Object.keys(g.units)) delete g.units[id];
    return g;
  };
  it('한 칸 이동 비용이 한 턴 이동력보다 커도 명령이 사라지지 않고 몇 턴 뒤 도착한다', () => {
    const g = emptyG();
    const u = spawn(g, 'ROK', 'gangneung', { speed: 10 } as never); // 느린 부대 (한 칸 비용이 한 턴 이동력보다 큼)
    expect(issueOrder(g, u.id, 'move', 'hoengseong').ok).toBe(true);
    let arrived = false;
    for (let i = 0; i < 40 && !arrived; i++) {
      clearEvents(g);
      endTurn(g);
      const cur = g.units[u.id];
      if (cur.location === 'hoengseong') arrived = true;
      else expect(cur.order?.type).toBe('move'); // 도착 전에는 명령 유지
    }
    expect(arrived).toBe(true);
  });
  it('이동력이 충분하면 같은 턴에 여러 칸을 이동하고 도착하면 명령이 해제된다', () => {
    const g = emptyG();
    g.date = '1950-07-08';
    const u = spawn(g, 'ROK', 'daejeon');
    issueOrder(g, u.id, 'move', 'jochiwon');
    endTurn(g);
    expect(g.units[u.id].location).toBe('jochiwon');
    expect(g.units[u.id].order).toBeNull();
  });
  it('경로가 막히면 명령이 취소되고 전황 기록에 남는다', () => {
    const g = emptyG();
    g.date = '1950-07-08';
    const u = spawn(g, 'ROK', 'busan');
    issueOrder(g, u.id, 'move', 'daegu');
    for (const n of MAP.adjacency.busan) g.provinces[n].owner = 'north';
    endTurn(g);
    expect(g.units[u.id].order).toBeNull();
    expect(g.log.some((l) => l.text.includes('이동 명령이 취소'))).toBe(true);
  });
  it('포위가 완료되면 조직력이 20% 줄고, 턴이 지날수록 병력·조직력·장비가 더 나빠진다', () => {
    const g = emptyG();
    g.date = '1950-07-08';
    const u = spawn(g, 'ROK', 'daegu', { organization: 100, strength: 3000, morale: 70, supply: 90 });
    for (const n of MAP.adjacency.busan) g.provinces[n].owner = 'north'; // 보급 거점 부산과 단절
    const s0 = u.strength, e0 = u.equip.rifles;
    endTurn(g);
    let cur = g.units[u.id];
    expect(cur.encircledTurns).toBe(1);
    expect(cur.organization).toBeLessThanOrEqual(80);
    const s1 = cur.strength, o1 = cur.organization, e1 = cur.equip.rifles;
    expect(s1).toBeLessThan(s0);
    expect(e1).toBeLessThan(e0);
    clearEvents(g);
    endTurn(g);
    cur = g.units[u.id];
    expect(cur.encircledTurns).toBe(2);
    expect(s1 - cur.strength).toBeGreaterThan(s0 - s1); // 손실이 더 커진다
    expect(cur.organization).toBeLessThan(o1);
    expect(cur.equip.rifles).toBeLessThan(e1);
  });
  it('포위가 풀려 보급이 이어지면 포위 상태가 해제된다', () => {
    const g = emptyG();
    g.date = '1950-07-08';
    const u = spawn(g, 'ROK', 'daegu');
    for (const n of MAP.adjacency.busan) g.provinces[n].owner = 'north';
    endTurn(g);
    expect(g.units[u.id].encircledTurns).toBe(1);
    for (const n of MAP.adjacency.busan) g.provinces[n].owner = 'south';
    clearEvents(g);
    endTurn(g);
    expect(g.units[u.id].encircledTurns).toBe(0);
  });
  it('보급 거점이 있는 지역의 부대는 주위가 막혀도 포위로 보지 않는다', () => {
    const g = emptyG();
    g.date = '1950-07-08';
    const u = spawn(g, 'ROK', 'busan');
    for (const n of MAP.adjacency.busan) g.provinces[n].owner = 'north';
    endTurn(g);
    expect(g.units[u.id].encircledTurns ?? 0).toBe(0);
  });
});

describe('전진 보급소는 주 거점과 이어질 때만 유효하다', () => {
  const setup = () => {
    const g = fresh(4);
    clearEvents(g);
    for (const id of Object.keys(g.units)) delete g.units[id];
    // 북한이 대전과 주변(청주·논산·영동)만 소유한 고립 지대 — 나머지 중부는 아군 소유
    for (const id of Object.keys(g.provinces)) if (g.provinces[id].owner === 'north' && g.provinces[id].initialOwner === 'south') g.provinces[id].owner = 'south';
    for (const id of ['daejeon', 'cheongju', 'nonsan', 'yeongdong']) g.provinces[id].owner = 'north';
    return g;
  };
  it('주 거점에서 끊긴 대전 지대는 처음 1턴은 보급이 유지되고 이후 점차 약해져 단절된다', () => {
    const g = setup();
    computeSupply(g);
    const lv0 = g.provinces.cheongju.supplyLevel;
    expect(g.provinces.cheongju.supplied).toBe(true); // 비축분
    g.turn += 1;
    computeSupply(g);
    expect(g.provinces.cheongju.supplyLevel).toBe(lv0); // 아직 유예
    g.turn += 1;
    computeSupply(g);
    expect(g.provinces.cheongju.supplyLevel).toBeLessThan(lv0);
    g.turn += 4;
    computeSupply(g);
    expect(g.provinces.cheongju.supplied).toBe(false);
    expect(g.provinces.daejeon.supplied).toBe(false);
  });
  it('끊긴 지대의 북한군은 보급이 완전히 소진되면 포위 효과를 받는다', () => {
    const g = setup();
    const u = spawn(g, 'KPA', 'cheongju', { organization: 100, strength: 3000, supply: 80 });
    computeSupply(g);
    g.turn += 6; // 비축 소진 후
    g.date = '1950-08-12';
    computeSupply(g);
    endTurn(g);
    const cur = g.units[u.id];
    expect(cur.encircledTurns).toBe(1);
    expect(cur.organization).toBeLessThanOrEqual(80);
    expect(cur.strength).toBeLessThan(3000);
  });
  it('주 거점과 이어져 있으면 전진 보급소는 계속 유효하다', () => {
    const g = fresh(4);
    clearEvents(g);
    // 평양~서울~대전 경로를 북한이 모두 소유
    for (const id of ['paju', 'gaeseong', 'seoul', 'suwon', 'osan', 'pyeongtaek', 'cheonan', 'jochiwon', 'daejeon']) g.provinces[id].owner = 'north';
    computeSupply(g);
    g.turn += 10;
    computeSupply(g);
    expect(hubLevels(g, 'north').daejeon).toBe(50);
    expect(g.provinces.cheonan.supplied).toBe(true);
  });
  it('끊겼던 전진 보급소가 다시 이어지면 즉시 회복된다', () => {
    const g = setup();
    computeSupply(g);
    g.turn += 8;
    computeSupply(g);
    expect(g.provinces.daejeon.supplied).toBe(false);
    for (const id of ['paju', 'gaeseong', 'seoul', 'suwon', 'osan', 'pyeongtaek', 'cheonan', 'jochiwon']) g.provinces[id].owner = 'north';
    computeSupply(g);
    expect(hubLevels(g, 'north').daejeon).toBe(50);
    expect(g.provinces.daejeon.supplied).toBe(true);
  });
  it('아군(남) 전진 보급소 서울도 부산과 이어질 때만 유효하다', () => {
    const g = fresh(4);
    clearEvents(g);
    g.flags.seoulHub = true;
    for (const n of MAP.adjacency.seoul) g.provinces[n].owner = 'north'; // 서울을 완전히 고립
    computeSupply(g);
    g.turn += 8;
    computeSupply(g);
    expect(hubLevels(g, 'south').seoul).toBeUndefined();
    expect(g.provinces.seoul.supplied).toBe(false);
  });
});
