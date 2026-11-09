import type { BattleReport, GameState, PlaybackStep, RosterEntry, Side, TurnRecord, Unit } from './types';
import { diffSnap, takeSnap } from './record';
import { AI_BALANCE, ARMISTICE, ATTRITION, ENCIRCLE, COMBAT, ECONOMY, MEDICAL, RECOVERY, SUPPLY } from './balance';
import { MAP } from './map';
import { resolveBattle } from './combat';
import { advanceAlongPath, attackableTargets } from './orders';
import { computeSupply, localSupplyLevel } from './supply';
import { advanceEconomy, advanceNations, computeWarCapacity } from './economy';
import { applyLosses, dissolveUnit, reinforceUnit, unitsAt } from './units';
import { autoDistribute, autoExternalAid, autoProduction } from './production';
import { autoTrainTrainees, updatePopulation } from './manpower';
import { checkEvents } from './events';
import { applyReinforcement } from './scenario';
import { REINFORCEMENTS } from '../data/orbat';
import { planAIOrders } from './ai';
import { checkOutcome } from './victory';
import { updateIntel } from './visibility';
import { addDays, addLog, clamp, formatDate, other, turnDaysFor } from './util';

const SEOUL_HOLD = ['seoul', 'uijeongbu', 'gimpo'];
const PERIMETER_RETREAT_PENALTY = ['daegu', 'waegwan', 'masan', 'changnyeong', 'yeongcheon', 'pohang'];

function enemyUnitsPresent(state: GameState, id: string, side: Side) {
  return unitsAt(state, id, other(side)).length > 0;
}

/** 후퇴 지점: 이웃한 자국 영토 중 적 부대가 없고 보급이 좋은 곳 */
function pickRetreat(state: GameState, from: string, side: Side, avoid: Set<string>): string | null {
  const cands = [...MAP.adjacency[from], ...MAP.sea[from].filter(() => state.provinces[from].portCapacity > 0)]
    .filter((n) => !avoid.has(n) && state.provinces[n].owner === side && !enemyUnitsPresent(state, n, side));
  if (!cands.length) return null;
  const score = (n: string) => {
    const enemyNeighbors = MAP.adjacency[n].filter((m) => state.provinces[m].owner !== side).length;
    return state.provinces[n].supplyLevel - enemyNeighbors * 12 + (state.provinces[n].portCapacity > 0 ? 2 : 0);
  };
  cands.sort((a, b) => score(b) - score(a));
  return cands[0];
}

interface AttackGroup {
  target: string;
  side: Side;
  attackers: Unit[];
}

function groupAttacks(state: GameState): AttackGroup[] {
  const groups = new Map<string, AttackGroup>();
  const ids = Object.keys(state.units).sort();
  for (const id of ids) {
    const u = state.units[id];
    if (u.order?.type !== 'attack' || !u.order.target) continue;
    const key = `${u.side}:${u.order.target}`;
    if (!groups.has(key)) groups.set(key, { target: u.order.target, side: u.side, attackers: [] });
    groups.get(key)!.attackers.push(u);
  }
  // 전략가치가 높은 목표부터 처리(결정적 순서)
  return [...groups.values()].sort((a, b) => state.provinces[b.target].strategicValue - state.provinces[a.target].strategicValue || a.target.localeCompare(b.target));
}

function capture(state: GameState, target: string, side: Side, summary: string[]) {
  const p = state.provinces[target];
  const prev = p.owner;
  p.owner = side;
  if (target === 'pyongyang' && side === 'south') state.flags.pyongyangFallTurn = state.turn; // 중국군 참전 타이머
  if (target === 'seoul' && side === 'north') state.flags.seoulLost = true;
  p.controlStability = Math.min(p.controlStability, ECONOMY.stabilityOccupiedStart);
  p.industrialCapacity *= 0.85;
  p.warDamage = clamp(p.warDamage + 8, 0, 100);
  state.nations[prev].popularSupport = clamp(state.nations[prev].popularSupport - p.strategicValue * 0.35, 0, 100);
  state.nations[side].popularSupport = clamp(state.nations[side].popularSupport + p.strategicValue * 0.15, 0, 100);
  const ours = side === state.playerSide;
  summary.push(`${ours ? '【점령】' : '【함락】'} ${p.name} — ${ours ? '아군이' : '적이'} 점령했습니다.`);
  addLog(state, ours ? 'good' : 'warn', `${p.name}이(가) ${side === 'north' ? '북한군' : '아군'}에게 넘어갔습니다.`);
}

function resolveAttacks(state: GameState, summary: string[], rec: TurnRecord) {
  const groups = groupAttacks(state);
  let n = 0;
  for (const g of groups) {
    const attackers = g.attackers.filter((u) => u.strength > 0 && u.organization >= 15 && attackableTargets(state, u).includes(g.target));
    for (const u of g.attackers) if (!attackers.includes(u)) u.order = null;
    if (!attackers.length) continue;
    const prov = state.provinces[g.target];
    if (prov.owner === g.side) {
      attackers.forEach((u) => (u.order = null));
      continue; // 이미 아군 영토(다른 전투에서 점령됨)
    }
    const snapBefore = takeSnap(state);
    const defenders = unitsAt(state, g.target, other(g.side));
    const origins = new Set(attackers.map((u) => u.location));
    for (const u of attackers) u.acted = true;
    if (!defenders.length) {
      // 무방비 점령
      capture(state, g.target, g.side, summary);
      for (const u of attackers) {
        u.location = g.target;
        u.order = null;
        u.fatigue = clamp(u.fatigue + 3, 0, 100);
      }
      rec.steps.push({ id: `${state.turn}-occ-${g.target}`, kind: 'occupy', province: g.target, title: `${prov.name} 무저항 점령`, ...diffSnap(snapBefore, takeSnap(state)) });
      continue;
    }
    const rec0 = new Map([...attackers, ...defenders].map((u) => [u.id, { ...u.record }]));
    const roster = (us: Unit[]): RosterEntry[] => us.map((u) => ({ id: u.id, name: u.name, from: u.location, before: u.strength, after: u.strength, killed: 0, wounded: 0, missing: 0 }));
    const aRoster = roster(attackers), dRoster = roster(defenders);
    const out = resolveBattle(state, prov, attackers, defenders, String(n++));
    const rep: BattleReport = out.report;
    const defSide = other(g.side);
    if (out.decision === 'attacker_win') {
      const holdDoctrine = defSide === 'south' && state.flags.seoulHold && SEOUL_HOLD.includes(g.target);
      const dest = holdDoctrine ? null : pickRetreat(state, g.target, defSide, origins);
      if (dest) {
        rep.retreated = true;
        rep.retreatTo = dest;
        for (const d of defenders) {
          applyLosses(d, d.strength * COMBAT.pursuitLoss, 'rout', state);
          d.location = dest;
          d.order = null;
          d.morale = clamp(d.morale - 6, 0, 100);
          d.organization = clamp(d.organization - 10, 0, 100);
        }
      } else {
        // 후퇴할 수 있는 인접 프로빈스(아군 통제·적에게 차단되지 않음)가 없으면 반드시 전멸한다.
        rep.surrounded = true;
        rep.reasons.push(holdDoctrine ? '사수 명령으로 후퇴하지 않고 끝까지 싸우다 전멸했습니다.' : '후퇴할 수 있는 길이 없어 포위·전멸했습니다.');
        for (const d of defenders) {
          const r = dissolveUnit(state, d, 'annihilated');
          addLog(state, d.side === state.playerSide ? 'warn' : 'info', `${d.name} 전멸 (${prov.name}) — 후퇴로 없음. 전사 ${r.killed.toLocaleString('ko-KR')}, 포로·실종 ${r.missing.toLocaleString('ko-KR')}, 장비 노획 ${r.equipCaptured.toLocaleString('ko-KR')}점 (나머지 파괴·유실)`);
          summary.push(`【전멸】 ${d.name} — ${prov.name}에서 후퇴로가 막혀 소멸했습니다.`);
        }
      }
      capture(state, g.target, g.side, summary);
      rep.captured = true;
      for (const u of attackers) {
        if (u.strength <= 0) continue;
        if (u.organization >= 20 || attackers.length === 1) {
          u.location = g.target;
        }
        u.order = null;
      }
    } else {
      // 공격 실패 또는 교착: 출발지에 머무름
      for (const u of attackers) {
        u.order = null;
        if (out.decision === 'defender_win') u.morale = clamp(u.morale - 2, 0, 100);
      }
      const dp = state.provinces[g.target];
      dp.warDamage = clamp(dp.warDamage + 3, 0, 100);
    }
    // 전투력을 상실한 부대 해체
    for (const u of [...attackers, ...defenders]) {
      if (state.units[u.id] && u.strength < COMBAT.disbandBelow) {
        dissolveUnit(state, u, 'disbanded');
        addLog(state, 'warn', `${u.name}이(가) 전투력을 상실하고 해체되었습니다.`);
      }
    }
    // 전투 후 가용 병력과 사상자(전사·부상·실종/포로) 집계: 부대 기록의 차이를 합산 (중복 계산 없음)
    const settle = (us: Unit[], list: RosterEntry[]) => {
      const tally = { killed: 0, wounded: 0, missing: 0 };
      list.forEach((e, i) => {
        const u = us[i];
        const r0 = rec0.get(u.id)!;
        e.after = state.units[u.id]?.strength ?? 0;
        e.killed = u.record.killed - r0.killed;
        e.missing = u.record.missing - r0.missing;
        e.wounded = Math.max(0, u.record.wounded - r0.wounded);
        e.destroyed = !state.units[u.id];
        tally.killed += e.killed;
        tally.wounded += e.wounded;
        tally.missing += e.missing;
      });
      return tally;
    };
    rep.attackerCasualty = settle(attackers, aRoster);
    rep.defenderCasualty = settle(defenders, dRoster);
    rep.attackerLosses = aRoster.reduce((s, e) => s + (e.before - e.after), 0);
    rep.defenderLosses = dRoster.reduce((s, e) => s + (e.before - e.after), 0);
    rep.attackerRoster = aRoster;
    rep.defenderRoster = dRoster;
    rep.stepId = `${state.turn}-battle-${rep.id}`;
    state.reports.push(rep);
    const ours = g.side === state.playerSide;
    const verdict = out.decision === 'attacker_win' ? (ours ? '승리' : '패배') : out.decision === 'defender_win' ? (ours ? '격퇴당함' : '방어 성공') : '교착';
    summary.push(`【전투】 ${rep.provinceName} — ${verdict} (손실 아군 ${ours ? rep.attackerLosses : rep.defenderLosses} / 적 ${ours ? rep.defenderLosses : rep.attackerLosses})`);
    addLog(state, 'battle', `${rep.provinceName} 전투: ${verdict}. ${rep.reasons[0]}`);
    rec.steps.push({ id: rep.stepId, kind: 'battle', province: g.target, reportId: rep.id, title: `${rep.provinceName} 전투`, ...diffSnap(snapBefore, takeSnap(state)) });
  }
}

function resolveMoves(state: GameState) {
  const ids = Object.keys(state.units).sort();
  for (const id of ids) {
    const u = state.units[id];
    if (!u || u.order?.type !== 'move' || !u.order.target) continue;
    const tname = state.provinces[u.order.target].name;
    if (state.provinces[u.order.target].owner !== u.side) {
      addLog(state, u.side === state.playerSide ? 'warn' : 'info', `${u.name}: 목적지 ${tname}이(가) 적에게 넘어가 이동 명령이 취소되었습니다.`);
      u.order = null;
      u.moveCarry = 0;
      continue;
    }
    const r = advanceAlongPath(state, u, u.order.target);
    u.acted = true;
    if (r.moved > 0) u.fatigue = clamp(u.fatigue + RECOVERY.fatigueMovePerDay * turnDaysFor(state.date), 0, 100);
    if (r.arrived) u.order = null;
    else if (r.noPath) {
      addLog(state, u.side === state.playerSide ? 'warn' : 'info', `${u.name}: ${tname}(으)로 가는 아군 경로가 막혀 이동 명령이 취소되었습니다.`);
      u.order = null;
      u.moveCarry = 0;
    }
  }
}

function updateUnits(state: GameState, foughtIds: Set<string>) {
  const days = turnDaysFor(state.date);
  const dug = new Set<string>();
  for (const u of Object.values(state.units)) {
    const fought = foughtIds.has(u.id);
    const prov = state.provinces[u.location];
    const cutOff = prov.owner !== u.side || !prov.supplied;
    // 포위: 자국 영토 안에서 보급 거점과 단절됨. 완료 시점에 조직력 -20%, 이후 턴마다 병력·조직력·장비가 악화된다.
    const encircled = prov.owner === u.side && !prov.supplied;
    if (encircled) {
      const prev = u.encircledTurns ?? 0;
      const n = prev + 1;
      u.encircledTurns = n;
      const k = days / 7;
      if (prev === 0) {
        u.organization = clamp(u.organization * ENCIRCLE.organizationFactor, 0, 100);
        if (u.side === state.playerSide) addLog(state, 'warn', `${u.name}이(가) ${prov.name}에서 포위되었습니다. (조직력 -20%)`);
      }
      applyLosses(u, u.strength * Math.min(ENCIRCLE.lossCap, ENCIRCLE.lossPerTurn * n) * k, 'attrition', state);
      u.organization = clamp(u.organization - Math.min(ENCIRCLE.orgLossCap, ENCIRCLE.orgLossPerTurn * n) * k, 0, 100);
      const keep = 1 - Math.min(ENCIRCLE.equipLossCap, ENCIRCLE.equipLossPerTurn * n) * k;
      for (const key of Object.keys(u.equip) as (keyof typeof u.equip)[]) u.equip[key] = Math.round(u.equip[key] * keep);
      if (u.strength < COMBAT.disbandBelow) {
        addLog(state, 'warn', `${u.name}이(가) 포위 속에서 전투력을 상실하고 해체되었습니다.`);
        dissolveUnit(state, u, 'disbanded');
        continue;
      }
    } else u.encircledTurns = 0;
    // 보급: 보급 수준을 향해 이동, 포위되면 감소
    const target = localSupplyLevel(state, u.side, u.location);
    if (cutOff) {
      u.supply = clamp(u.supply - SUPPLY.unitDecayCutOffPerDay * days, 0, 100);
      u.organization = clamp(u.organization - SUPPLY.cutOffOrgLoss * days, 0, 100);
      u.morale = clamp(u.morale - SUPPLY.cutOffMoraleLoss * days / 2, 0, 100);
    } else {
      const delta = clamp(target - u.supply, -SUPPLY.unitDrawPerDay * days, SUPPLY.unitDrawPerDay * days);
      u.supply = clamp(u.supply + delta, 0, 100);
    }
    if (u.supply < ATTRITION.lowSupplyBelow) {
      const starved = u.strength * ATTRITION.lowSupplyLossPerDay * days * (1 - u.supply / ATTRITION.lowSupplyBelow + 0.3);
      applyLosses(u, starved, 'attrition', state);
    }
    const order = u.order?.type;
    // 피로·조직·사기·회복
    if (!fought) {
      const rest = order === 'rest' ? RECOVERY.fatigueRestPerDay : order === 'defend' ? RECOVERY.fatigueHoldPerDay : RECOVERY.fatigueHoldPerDay * (u.acted ? 0.3 : 1);
      u.fatigue = clamp(u.fatigue - rest * days * (cutOff ? 0.3 : 1), 0, 100);
      if (!cutOff) {
        u.organization = clamp(u.organization + RECOVERY.orgPerDay * days * (order === 'rest' ? 1.5 : 1), 0, 100);
        const moraleBase = RECOVERY.moraleBase + (u.supply - 50) * 0.15;
        if (u.morale < moraleBase) u.morale = clamp(u.morale + RECOVERY.moralePerDay * days * (order === 'rest' ? 1.5 : 1), 0, moraleBase);
      }
      u.recovery = clamp(u.recovery + RECOVERY.recoveryPerDay * days * (order === 'rest' ? 1.6 : 1) * (cutOff ? 0.4 : 1), 0, 100);
    } else {
      u.recovery = clamp(u.recovery + 2 * days, 0, 100);
    }
    // 훈련 명령: 장기 능력(훈련도) 증가
    if (order === 'train' && !fought && !cutOff) {
      u.training = clamp(u.training + ECONOMY.unitTrainPerDay * days * (1 - u.training / 130), 0, ECONOMY.trainingCap.unit);
      u.fatigue = clamp(u.fatigue + 1.2 * days, 0, 100);
    }
    // 방어선 강화: 같은 지역에서 방어 명령을 유지하면 방어시설이 서서히 올라간다 (지역당 1턴 1회, 보급 자원 소모)
    if (order === 'defend' && !fought && prov.owner === u.side && prov.fortification < 3 && u.organization > 50 && !dug.has(u.location) && state.nations[u.side].supplyStock > 4) {
      dug.add(u.location);
      state.nations[u.side].supplyStock -= 4;
      prov.fortification = clamp(prov.fortification + 0.5, 0, 5);
    }
    // 부상병 복귀와 손상 장비 수리 (새 징집이 아니므로 징병 가능 인구는 건드리지 않는다)
    const moved = u.acted && order !== 'rest';
    if (fought || moved) u.restTurns = 0;
    else u.restTurns = (u.restTurns ?? 0) + 1;
    const ownSupplied = prov.owner === u.side && prov.supplied;
    if (ownSupplied) {
      const enemyAdj = MAP.adjacency[u.location].some((n) => state.provinces[n].owner !== u.side);
      const stack = 1 + MEDICAL.restStack * Math.min(u.restTurns, MEDICAL.restStackCap);
      // 완전 휴식(휴식 명령)이 가장 크고, 이동만 한 부대는 낮으며, 전투 참여 부대는 휴식 보너스를 받지 못한다
      const activity = fought ? MEDICAL.fightMult : moved ? MEDICAL.movedMult : order === 'rest' ? MEDICAL.restMult * stack : 1 + (stack - 1) * 0.5;
      const medical = 0.6 + 0.4 * (prov.infrastructure / 100);
      const rate = clamp(MEDICAL.returnPerWeek * (days / 7) * activity * medical * (0.5 + 0.5 * (u.supply / 100)) * (1 - u.fatigue / 200) * (enemyAdj ? MEDICAL.unsafeMult : 1), 0, 0.9);
      if (u.wounded > 0) {
        const ret = Math.min(u.wounded, u.maxStrength - u.strength, Math.max(rate > 0.03 ? 1 : 0, Math.round(u.wounded * rate)));
        if (ret > 0) {
          u.strength += ret;
          u.wounded -= ret;
          state.nations[u.side].stats.returned += ret;
        }
      }
      if (!fought) {
        const fixRate = clamp(MEDICAL.repairPerWeek * (days / 7) * (order === 'rest' ? MEDICAL.repairRestMult : moved ? 0.6 : 1), 0, 0.9);
        for (const key of Object.keys(u.equipDamaged) as (keyof typeof u.equip)[]) {
          const d = u.equipDamaged[key];
          if (d <= 0) continue;
          const fix = Math.min(d, Math.max(fixRate > 0.03 ? 1 : 0, Math.round(d * fixRate)));
          u.equip[key] += fix;
          u.equipDamaged[key] -= fix;
        }
      }
    }
  }
}

/** 북한 AI 측 보충(인력 풀 소비, 훈련도 낮음) */
function aiReplacements(state: GameState, days: number) {
  const n = state.nations.north;
  n.replacementPool += AI_BALANCE.replacementRefillPerDay * days;
  let budget = Math.min(n.replacementPool, AI_BALANCE.replacementPerDay * days);
  const needy = Object.values(state.units)
    .filter((u) => u.side === 'north' && u.strength < u.maxStrength * 0.8 && state.provinces[u.location].owner === 'north' && state.provinces[u.location].supplied && u.supply >= 45 && !u.acted)
    .sort((a, b) => a.strength / a.maxStrength - b.strength / b.maxStrength);
  for (const u of needy) {
    if (budget <= 0) break;
    const give = Math.min(budget, u.maxStrength * 0.85 - u.strength, 900);
    const real = reinforceUnit(u, give, AI_BALANCE.replacementTraining);
    budget -= real;
    n.replacementPool -= real;
  }
}

function addIntelLines(state: GameState, summary: string[]) {
  const cut = Object.values(state.units).filter((u) => u.side === state.playerSide && !state.provinces[u.location].supplied).length;
  const ring = Object.values(state.units).filter((u) => u.side === state.playerSide && (u.encircledTurns ?? 0) > 0);
  if (ring.length) summary.push(`【포위】 포위된 아군 부대 ${ring.length}개 — 최장 ${Math.max(...ring.map((u) => u.encircledTurns ?? 0))}턴째, 병력·조직력·장비가 계속 줄어듭니다.`);
  if (cut > 0) summary.push(`【보급】 보급선이 끊긴 아군 부대 ${cut}개 — 전투력·사기가 저하됩니다.`);
}

/** 한 턴을 진행한다. state 를 직접 수정한다(스토어에서는 복제본을 넘긴다). */
export function endTurn(state: GameState): { ok: boolean; reason?: string } {
  if (state.outcome) return { ok: false, reason: '게임이 이미 종료되었습니다.' };
  if (state.pendingEvents.length) return { ok: false, reason: '결정해야 할 사건이 남아 있습니다.' };
  const days = turnDaysFor(state.date);
  const casBefore = state.nations.south.casualties;
  state.reports = [];
  const summary: string[] = [];
  const before = new Set(Object.values(state.provinces).filter((p) => p.owner === state.playerSide).map((p) => p.id));

  // 4. AI 명령 생성 (플레이어 명령은 이미 입력·검증되어 있다)
  planAIOrders(state, 'north');
  const startSnap = takeSnap(state);
  const rec: TurnRecord = {
    turn: state.turn,
    date: state.date,
    initialOwners: { ...startSnap.owners },
    initialUnits: Object.fromEntries(Object.values(state.units).map((u) => [u.id, { loc: u.location, side: u.side, name: u.name }])),
    steps: [],
  };

  // 5. 이동 → 전투
  for (const u of Object.values(state.units)) u.acted = false;
  const attackerIds = new Set<string>();
  const defenderIds = new Set<string>();
  resolveMoves(state);
  const moveDiff = diffSnap(startSnap, takeSnap(state));
  if (moveDiff.unitMoves.length) rec.steps.push({ id: `${state.turn}-move`, kind: 'movement', title: '부대 이동', ...moveDiff });
  const beforeAttack = state.reports.length;
  resolveAttacks(state, summary, rec);
  state.lastTurn = rec;
  for (const r of state.reports.slice(beforeAttack)) {
    r.attackerUnits.forEach((i) => attackerIds.add(i));
    r.defenderUnits.forEach((i) => defenderIds.add(i));
  }
  const fought = new Set([...attackerIds, ...defenderIds]);

  // 6. 보급·병력·사기 갱신
  computeSupply(state);
  updateUnits(state, fought);
  advanceEconomy(state, days);
  advanceNations(state, days);
  updatePopulation(state, days);
  autoTrainTrainees(state, days);
  for (const side of ['south', 'north'] as Side[]) {
    autoProduction(state, side, days); // 국가 군수 재고에 합산
    const aid = autoExternalAid(state, side, days); // UN(남) / 소련·중국(북) 장비 지원 도착
    if (side === state.playerSide && aid.rifles >= 1) {
      summary.push(`【UN 장비 지원】 소총 +${Math.round(aid.rifles).toLocaleString('ko-KR')} · 기관총 +${Math.round(aid.machineGuns)} · 박격포 +${Math.round(aid.mortars)} · 야포 +${Math.round(aid.artillery)} · 대전차 +${Math.round(aid.antiTank)} · 차량 +${Math.round(aid.vehicles)} (국가 군수 재고로 입고)`);
    }
    autoDistribute(state, side, fought); // 장비가 부족한 부대에 재고 자동 배분 (보급이 끊긴 부대 제외)
  }
  aiReplacements(state, days);
  for (const u of Object.values(state.units)) if (u.order?.type === 'attack') u.order = null; // 공격은 1회성, 이동 행군·방어·휴식·훈련은 지속

  // 시간 진행
  state.date = addDays(state.date, days);
  state.turn += 1;
  const cpBase = days < 7 ? 4 : days > 7 ? 9 : 6;
  state.nations.south.commandPoints = cpBase + (state.nations.south.popularSupport > 60 ? 1 : 0);
  state.nations.north.commandPoints = cpBase;
  state.nations.south.popularSupport = clamp(state.nations.south.popularSupport + 0.3 * (days / 7), 0, 100);
  // 중국 개입 위험: 38선 이북에 아군이 있으면 서서히 증가
  const beyond = Object.values(state.provinces).some((p) => p.owner === 'south' && p.initialOwner === 'north' && MAP.geometry[p.id].lat >= 38.3);
  if (beyond) state.diplomacy.chinaThreat = clamp(state.diplomacy.chinaThreat + 3 * (days / 7), 0, 100);

  // 전쟁 피로도와 정전협상 진척
  state.warWeariness = clamp(state.warWeariness + (state.nations.south.casualties - casBefore) / 1000 * ARMISTICE.wearinessPerThousandCasualties - ARMISTICE.wearinessDecayPerWeek * (days / 7), 0, 100);
  // 사상자가 많으면 국민 지지에도 영향
  state.nations.south.popularSupport = clamp(state.nations.south.popularSupport - (state.nations.south.casualties - casBefore) / 30000, 0, 100);
  if (state.warWeariness > ARMISTICE.supportLossAbove) {
    state.nations.south.popularSupport = clamp(state.nations.south.popularSupport - (state.warWeariness - ARMISTICE.supportLossAbove) * 0.03 * (days / 7), 0, 100);
  }
  if (state.flags.talks === 'on') {
    state.armisticeProgress = clamp(state.armisticeProgress + (ARMISTICE.baseProgressPerWeek + ARMISTICE.wearinessProgress * state.warWeariness) * (days / 7), 0, 100);
    summary.push(`【정전협상】 진척도 ${Math.round(state.armisticeProgress)}% (전쟁 피로도 ${Math.round(state.warWeariness)})`);
  }

  // 7. 증원·역사 이벤트
  for (const r of REINFORCEMENTS) {
    if (r.date <= state.date && !state.flags[`reinf:${r.id}`]) {
      const msg = applyReinforcement(state, r.id);
      if (msg) {
        addLog(state, r.side === 'south' ? 'good' : 'warn', msg);
        if (r.side === 'south') summary.push(`【증원】 ${msg}`);
      }
    }
  }
  computeSupply(state);
  checkEvents(state);
  for (const side of ['south', 'north'] as Side[]) state.nations[side].warCapacity = computeWarCapacity(state, side);

  // 8. 승패 판정
  state.outcome = checkOutcome(state);
  updateIntel(state);
  addIntelLines(state, summary);
  const after = new Set(Object.values(state.provinces).filter((p) => p.owner === state.playerSide).map((p) => p.id));
  const lost = [...before].filter((i) => !after.has(i)).length;
  const gained = [...after].filter((i) => !before.has(i)).length;
  summary.unshift(`${formatDate(state.date)} — 지난 ${days}일간 영토 변화: 상실 ${lost}, 획득 ${gained}.`);
  state.briefing = summary;
  for (const line of summary.slice(0, 1)) addLog(state, 'info', line);
  return { ok: true };
}
