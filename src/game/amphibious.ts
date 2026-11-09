import type { GameState, Side, Unit } from './types';
import type { UnitTemplate } from '../data/orbat';
import { MAP } from './map';
import { applyLosses, dissolveUnit, unitsAt } from './units';
import { battleContextFor, calcSide, infantryPower, resolveBattle } from './combat';
import { spawnTemplate } from './scenario';
import { addLog, clamp, other } from './util';
import { ECONOMY } from './balance';

/**
 * 상륙작전 시스템.
 * ⚠ "사단급 N개"는 이 게임에서 정한 가상의 작전 규모이며 실제 역사적 상륙부대 편제가 아니다.
 *   인천 상륙은 총 11개 여단급(외부 도착 7 + 현지 차출 4)으로 정했다. (약 3.7개 사단급에 해당하는 게임 규모)
 */
export const DIVISION_BRIGADES = 3; // 사단급 환산 표시용

export interface LandingOp {
  id: string; // 이벤트 id
  target: string;
  name: string;
  brigades: number; // 총 투입 여단 수
  drawn: number; // 현지(기존 부대)에서 차출하는 여단 수 (나머지는 외부 증원)
}

export const LANDING_OPS: Record<string, LandingOp> = {
  incheon_landing: { id: 'incheon_landing', target: 'incheon', name: '인천 상륙', brigades: 11, drawn: 4 },
  gunsan_landing: { id: 'gunsan_landing', target: 'gunsan', name: '군산 상륙(가상)', brigades: 5, drawn: 2 },
};

export interface LandingEntry {
  key: string;
  unitId: string | null; // 외부 증원은 null
  name: string;
  source: 'reserve' | 'front' | 'external';
  origin: string | null; // 출발 프로빈스 (외부 증원은 null)
  strength: number;
  selectable: boolean;
  selected: boolean;
}

export interface FrontEffect {
  province: string;
  before: number;
  after: number;
  powerBefore: number;
  powerAfter: number;
  enemyAdjacent: number;
}

export interface LandingPlan {
  op: LandingOp;
  brigadesTotal: number;
  entries: LandingEntry[]; // 후보 전체(차출 후보 + 외부 증원)
  drawnCount: number;
  externalCount: number;
  totalStrength: number;
  fronts: FrontEffect[];
  garrison: { count: number; virtual: boolean };
  ratio: number;
  benefits: string[];
  risks: string[];
}

const isFrontProvince = (state: GameState, id: string) => MAP.adjacency[id].some((n) => state.provinces[n].owner !== state.provinces[id].owner);

function externalTemplates(op: LandingOp, count: number): UnitTemplate[] {
  const out: UnitTemplate[] = [];
  const fill = { rifles: 0.95, machineGuns: 0.95, mortars: 0.95, artillery: 0.9, antiTank: 0.8, tanks: 0, vehicles: 0.85 };
  for (let i = 0; i < count; i++) {
    const marine = i < 3;
    out.push({
      faction: 'UN',
      name: `[외부 도착] 상륙군 ${i + 1}여단`,
      parent: '상륙 증원 (가상 편성 · 실제 편제 아님)',
      kind: marine ? 'marine' : 'motorized',
      location: op.target,
      training: marine ? 76 : 62,
      experience: marine ? 36 : 22,
      morale: 84,
      strengthPct: 0.9,
      fill,
      traits: marine ? ['상륙 돌격'] : [],
    });
  }
  return out;
}

function candidateUnits(state: GameState): { reserve: Unit[]; front: Unit[] } {
  const reserve: Unit[] = [];
  const front: Unit[] = [];
  const south = Object.values(state.units).filter((u) => u.side === 'south' && u.strength >= u.maxStrength * 0.4 && state.provinces[u.location].owner === 'south');
  for (const u of south) {
    if (!isFrontProvince(state, u.location)) reserve.push(u);
    else if (unitsAt(state, u.location, 'south').length >= 2) front.push(u); // 전선 지역을 텅 비우게 하는 차출은 불가
  }
  const q = (a: Unit, b: Unit) => infantryPower(b) - infantryPower(a);
  reserve.sort(q);
  // 전선 후보: 한 프로빈스에서 한 개 부대만 후보로 (가장 약한 부대부터)
  const seen = new Set<string>();
  const f: Unit[] = [];
  for (const u of front.sort((a, b) => infantryPower(a) - infantryPower(b))) if (!seen.has(u.location)) { seen.add(u.location); f.push(u); }
  return { reserve, front: f.slice(0, 12) };
}

/** toggled: 기본 선택을 사용자가 뒤집은 후보 key 들 (기본 선택이면 해제, 기본 미선택이면 선택) */
export function buildLandingPlan(state: GameState, opId: string, toggled: Set<string> = new Set()): LandingPlan {
  const op = LANDING_OPS[opId];
  const total = op.brigades;
  const { reserve, front } = candidateUnits(state);
  const entries: LandingEntry[] = [];
  // 후보 순서: 예비대(후방) → 전선. 기본 선택은 앞에서 op.drawn 개 (현지 차출 4개)
  const ordered: [Unit, 'reserve' | 'front'][] = [...reserve.slice(0, 16).map((u) => [u, 'reserve'] as [Unit, 'reserve']), ...front.map((u) => [u, 'front'] as [Unit, 'front'])];
  ordered.forEach(([u, src], i) => {
    entries.push({ key: u.id, unitId: u.id, name: u.name, source: src, origin: u.location, strength: u.strength, selectable: true, selected: (i < op.drawn) !== toggled.has(u.id) });
  });
  // 현지 차출은 최대 op.drawn 개까지만 인정 (초과 선택은 뒤에서부터 해제)
  let drawn = entries.filter((e) => e.selected);
  if (drawn.length > op.drawn) {
    drawn.slice(op.drawn).forEach((e) => (e.selected = false));
    drawn = drawn.slice(0, op.drawn);
  }
  const externalCount = total - drawn.length;
  const ext = externalTemplates(op, externalCount);
  const extEntries: LandingEntry[] = ext.map((t, i) => ({ key: `ext-${i}`, unitId: null, name: t.name, source: 'external', origin: null, strength: Math.round(3000 * (t.strengthPct ?? 1)), selectable: false, selected: true }));

  // 차출로 인한 전선 변화
  const byProv: Record<string, number> = {};
  for (const e of drawn) if (e.source === 'front') byProv[e.origin!] = (byProv[e.origin!] ?? 0) + 1;
  const fronts: FrontEffect[] = Object.entries(byProv).map(([province, n]) => {
    const here = unitsAt(state, province, 'south');
    const left = here.filter((u) => !drawn.some((e) => e.unitId === u.id));
    const adjEnemy = MAP.adjacency[province].reduce((s, a) => s + unitsAt(state, a, 'north').length, 0);
    const ctx = battleContextFor(state, state.provinces[province], here);
    return { province, before: here.length, after: left.length, powerBefore: Math.round(calcSide(here, [], 'defend', ctx).power), powerAfter: Math.round(calcSide(left, [], 'defend', ctx).power), enemyAdjacent: adjEnemy };
  });

  // 예상 전투력비
  const sim = structuredClone(state);
  const landers: Unit[] = [
    ...drawn.map((e) => sim.units[e.unitId!]).filter(Boolean),
    ...ext.map((t) => spawnTemplate(sim, t)),
  ];
  const defInfo = collectDefenders(sim, op.target);
  const simGarrison = defInfo.units;
  const ctx = battleContextFor(sim, sim.provinces[op.target], simGarrison);
  const ratio = calcSide(landers, simGarrison, 'attack', ctx).power / Math.max(1, calcSide(simGarrison, landers, 'defend', ctx).power);

  const totalStrength = drawn.reduce((s, e) => s + e.strength, 0) + extEntries.reduce((s, e) => s + e.strength, 0);
  const benefits = [
    `${state.provinces[op.target].name} 점령 → 북한군 후방 보급선 차단 위협 (전진 보급소로 활용)`,
    '북한군 전 부대 사기 저하, 제공권 폭격 효과 강화',
    '국민 지지·UN 지지 상승',
  ];
  const risks = [
    ratio >= COMBAT_WIN() ? `예상 전투력비 ${ratio.toFixed(1)} — 유리하지만 지휘 변수에 따라 실패할 수 있음` : `예상 전투력비 ${ratio.toFixed(1)} — 실패 가능성이 높음`,
    '실패 시 상륙부대는 추가 손실을 입고 출발지(외부 증원은 부산)로 후퇴',
    fronts.length ? `차출한 전선 ${fronts.length}곳의 방어력이 실제로 감소 (북한군 공세 시 돌파 위험)` : '전선 부대는 차출하지 않아 방어선은 유지됨',
  ];
  return {
    op, brigadesTotal: total, entries: [...entries, ...extEntries], drawnCount: drawn.length, externalCount, totalStrength, fronts,
    garrison: { count: simGarrison.length, virtual: defInfo.virtual }, ratio, benefits, risks,
  };
}

const COMBAT_WIN = () => 1.08;

/** 방어측: 목표 지역의 북한군 + 인접 지역의 북한군 증원(최대 8개). 목표에 아무도 없으면 해안 수비대 2개 여단을 가상 편성한다. */
function collectDefenders(state: GameState, target: string): { units: Unit[]; virtual: boolean } {
  const here = unitsAt(state, target, 'north');
  const near = MAP.adjacency[target]
    .flatMap((n) => unitsAt(state, n, 'north'))
    .filter((u) => u.strength >= u.maxStrength * 0.4)
    .sort((a, b) => b.strength - a.strength);
  const units = [...here, ...near].slice(0, 8);
  if (!here.length) {
    return { units: [...units, makeGarrison(state, target), makeGarrison(state, target)], virtual: true };
  }
  return { units, virtual: false };
}

function makeGarrison(state: GameState, target: string): Unit {
  return spawnTemplate(state, {
    faction: 'KPA', name: `${state.provinces[target].name} 해안 수비대(가상 편성)`, parent: '북한군 후방 수비대', kind: 'infantry',
    location: target, training: 35, experience: 5, morale: 60, strengthPct: 0.6,
    fill: { rifles: 0.8, machineGuns: 0.5, mortars: 0.4, artillery: 0.3, antiTank: 0.1, tanks: 0, vehicles: 0.1 },
  });
}

export interface LandingReport {
  opId: string;
  name: string;
  target: string;
  success: boolean;
  total: number;
  fromReserve: { name: string; origin: string }[];
  fromFront: { name: string; origin: string }[];
  external: string[];
  fronts: FrontEffect[];
  battleReportId: string;
  survivors: number;
  lines: string[];
}

function retreatNorth(state: GameState, from: string): string | null {
  const c = MAP.adjacency[from].filter((n) => state.provinces[n].owner === 'north' && unitsAt(state, n, 'south').length === 0);
  c.sort((a, b) => state.provinces[b].supplyLevel - state.provinces[a].supplyLevel);
  return c[0] ?? null;
}

/** 상륙작전 실행. 부대를 실제로 차출·생성하고 전투를 해결한다. 같은 작전은 한 번만 실행된다. */
export function executeLanding(state: GameState, opId: string, toggled: Set<string>): LandingReport | null {
  const op = LANDING_OPS[opId];
  const flagKey = `landingDone:${opId}`;
  if (state.flags[flagKey]) return null;
  const prov = state.provinces[op.target];
  if (prov.owner !== 'north') return null;
  state.flags[flagKey] = true;
  const plan = buildLandingPlan(state, opId, toggled);
  const drawn = plan.entries.filter((e) => e.selected && e.unitId);
  const landers: Unit[] = [];
  const origins: Record<string, string> = {};
  // 1. 차출: 출발 프로빈스에서 실제로 이동시킨다 (복제 생성 없음)
  for (const e of drawn) {
    const u = state.units[e.unitId!];
    origins[u.id] = u.location;
    u.location = op.target;
    u.order = null;
    u.acted = true;
    landers.push(u);
  }
  // 2. 외부 증원은 새로 생성 (기존 부대 이동이 아님)
  const ext = externalTemplates(op, plan.externalCount).map((t) => spawnTemplate(state, t));
  ext.forEach((u) => (origins[u.id] = 'busan'));
  landers.push(...ext);

  const defenders = collectDefenders(state, op.target).units;
  const out = resolveBattle(state, prov, landers, defenders, 'landing');
  const rep = out.report;
  rep.attackerRoster = landers.map((u) => ({ id: u.id, name: u.name, from: origins[u.id], before: u.strength, after: u.strength, killed: 0, wounded: 0, missing: 0 }));
  const success = out.decision === 'attacker_win';
  const lines: string[] = [];
  const names = (es: LandingEntry[]) => es.map((e) => ({ name: e.name, origin: state.provinces[e.origin!].name }));
  const report: LandingReport = {
    opId, name: op.name, target: op.target, success, total: plan.brigadesTotal,
    fromReserve: names(drawn.filter((e) => e.source === 'reserve')),
    fromFront: names(drawn.filter((e) => e.source === 'front')),
    external: ext.map((u) => u.name),
    fronts: plan.fronts, battleReportId: rep.id, survivors: 0, lines,
  };
  lines.push(`${op.name} 작전 실행: 총 ${plan.brigadesTotal}개 여단급(가상 작전 규모) 투입 — 기존 부대 차출 ${drawn.length}개, 외부 증원 ${ext.length}개`);
  for (const f of plan.fronts) lines.push(`전선 차출: ${state.provinces[f.province].name} 주둔 ${f.before}→${f.after}개 여단, 방어력 ${f.powerBefore}→${f.powerAfter}`);

  if (success) {
    // 방어군 후퇴 또는 소멸
    const dest = retreatNorth(state, op.target);
    rep.captured = true;
    for (const d of defenders) {
      applyLosses(d, d.strength * 0.1, 'combat', state);
      if (d.location !== op.target) continue; // 인접 지역에서 증원한 부대는 제자리에 남는다
      if (dest && d.strength >= 200) { d.location = dest; d.order = null; rep.retreated = true; rep.retreatTo = dest; d.morale = clamp(d.morale - 15, 0, 100); }
      else dissolveUnit(state, d, 'disbanded');
    }
    prov.owner = 'south';
    prov.controlStability = Math.min(prov.controlStability, 45);
    prov.warDamage = clamp(prov.warDamage + 6, 0, 100);
    state.flags.landingResult = 'success';
    if (op.target === 'incheon') state.flags.incheonHub = true;
    for (const u of Object.values(state.units)) if (u.side === 'north') u.morale = clamp(u.morale - (op.target === 'incheon' ? 10 : 4), 0, 100);
    state.interdiction = clamp(state.interdiction + (op.target === 'incheon' ? 0.1 : 0.03), 0, 0.9);
    state.diplomacy.unSupport = clamp(state.diplomacy.unSupport + 8, 0, 100);
    state.nations.south.popularSupport = clamp(state.nations.south.popularSupport + 8, 0, 100);
    report.survivors = landers.filter((u) => state.units[u.id]).length;
    lines.push(`상륙 성공: ${prov.name} 점령. 상륙부대 ${report.survivors}개 여단이 ${prov.name}에 주둔 (손실 ${rep.attackerLosses}명, 적 손실 ${rep.defenderLosses}명)`);
    lines.push('북한군 보급선이 위협받고 사기가 저하되었습니다.');
  } else {
    state.flags.landingResult = 'failure';
    // 실패: 추가 손실 후 후퇴
    for (const u of landers) {
      applyLosses(u, u.strength * 0.25, 'rout', state);
      u.morale = clamp(u.morale - 20, 0, 100);
      u.organization = clamp(u.organization - 30, 0, 100);
      const home = origins[u.id];
      u.location = state.provinces[home]?.owner === 'south' ? home : 'busan';
    }
    state.nations.south.popularSupport = clamp(state.nations.south.popularSupport - 5, 0, 100);
    report.survivors = landers.filter((u) => state.units[u.id] && state.units[u.id].strength >= 1).length;
    lines.push(`상륙 실패: ${prov.name} 확보에 실패하고 출발지로 후퇴했습니다. (손실 ${rep.attackerLosses}명 + 후퇴 손실)`);
  }
  for (const u of [...landers, ...defenders]) {
    if (state.units[u.id] && u.strength < 120) dissolveUnit(state, u, 'disbanded');
  }
  rep.attackerRoster.forEach((e) => (e.after = state.units[e.id]?.strength ?? 0));
  rep.defenderRoster = defenders.map((d) => ({ id: d.id, name: d.name, from: op.target, before: d.strength, after: state.units[d.id]?.strength ?? 0, killed: 0, wounded: 0, missing: 0 }));
  state.reports.push(rep);
  for (const l of lines) addLog(state, success ? 'good' : 'warn', l);
  state.flags.landingReport = JSON.stringify(report);
  void ECONOMY;
  void other;
  return report;
}

export type { Side };
