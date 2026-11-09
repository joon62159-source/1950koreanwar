import { EVENTS, EVENT_BY_ID, type Condition, type Effect, type HistoricalEvent } from '../data/events';
import { MAP } from './map';
import { applyReinforcement, northSpawnProvince, spawnTemplate } from './scenario';
import { plaBrigades } from '../data/orbat';
import { executeLanding } from './amphibious';
import { mobilize } from './mobilization';
import { MOBILIZATION_PROFILES } from '../data/mobilization';
import { applyLosses, unitsAt } from './units';
import { EQUIP_KEYS, type GameState } from './types';
import { addDays, addLog, clamp, turnDaysFor } from './util';

export function conditionHolds(state: GameState, c: Condition): boolean {
  switch (c.kind) {
    case 'owner':
      return state.provinces[c.province].owner === c.side;
    case 'ownerAny':
      return c.provinces.filter((p) => state.provinces[p].owner === c.side).length >= (c.min ?? 1);
    case 'flagEquals':
      return state.flags[c.key] === c.value;
    case 'flagUnset':
      return state.flags[c.key] === undefined;
    case 'dateAtLeast':
      return state.date >= c.date;
    case 'flagTurnsAgo': {
      const at = state.flags[c.key];
      return typeof at === 'number' && state.turn - at >= c.min;
    }
    case 'diplomacyAtLeast':
      return state.diplomacy[c.field] >= c.value;
    case 'warCapacityBelow':
      return state.nations[c.side].warCapacity < c.value;
    case 'provincesLostAtLeast':
      return Object.values(state.provinces).filter((p) => p.initialOwner === c.side && p.owner !== c.side).length >= c.min;
    case 'flagSet':
      return state.flags[c.key] !== undefined;
    case 'eventFired':
      return state.firedEvents.includes(c.id);
    case 'unitsNear': {
      const set = new Set<string>(c.provinces);
      if (c.adjacent) for (const p of c.provinces) for (const n of MAP.adjacency[p]) set.add(n);
      return Object.values(state.units).filter((u) => u.side === c.side && set.has(u.location)).length >= c.min;
    }
    case 'anyOf':
      return c.of.some((x) => conditionHolds(state, x));
    case 'allOf':
      return c.of.every((x) => conditionHolds(state, x));
    case 'not':
      return !conditionHolds(state, c.cond);
    case 'enemyNear': {
      const near = [c.province, ...MAP.adjacency[c.province]];
      return near.some((p) => unitsAt(state, p, c.side).length > 0);
    }
  }
}

export function applyEffect(state: GameState, e: Effect): void {
  switch (e.kind) {
    case 'nation': {
      const n = state.nations[e.side];
      if (e.field === 'popularSupport') n.popularSupport = clamp(n.popularSupport + e.delta, 0, 100);
      else if (e.field === 'supplyStock') n.supplyStock = Math.max(0, n.supplyStock + e.delta);
      else n.commandPoints = Math.max(0, n.commandPoints + e.delta);
      break;
    }
    case 'diplomacy':
      state.diplomacy[e.field] = clamp(state.diplomacy[e.field] + e.delta, 0, 100);
      break;
    case 'units': {
      for (const u of Object.values(state.units)) {
        if (u.side !== e.side) continue;
        if (e.area !== 'all' && !e.area.includes(u.location)) continue;
        if (e.lossFraction) applyLosses(u, u.strength * e.lossFraction, 'event', state);
        if (e.equipLossFraction) for (const k of EQUIP_KEYS) if (k !== 'rifles') u.equip[k] = Math.round(u.equip[k] * (1 - e.equipLossFraction)); // 파괴·유실
        if (e.morale) u.morale = clamp(u.morale + e.morale, 0, 100);
        if (e.organization) u.organization = clamp(u.organization + e.organization, 0, 100);
        if (e.fatigue) u.fatigue = clamp(u.fatigue + e.fatigue, 0, 100);
        if (e.recovery) u.recovery = clamp(u.recovery + e.recovery, 0, 100);
        if (e.supply) u.supply = clamp(u.supply + e.supply, 0, 100);
      }
      break;
    }
    case 'province': {
      const p = state.provinces[e.province];
      if (e.field === 'fortification') p.fortification = clamp(p.fortification + e.delta, 0, 5);
      else p[e.field] = clamp(p[e.field] + e.delta, 0, 100);
      break;
    }
    case 'setOwner': {
      const p = state.provinces[e.province];
      p.owner = e.side;
      p.controlStability = Math.min(p.controlStability, 45);
      break;
    }
    case 'flag':
      state.flags[e.key] = e.value;
      break;
    case 'interdiction':
      state.interdiction = clamp(state.interdiction + e.delta, 0, 0.9);
      break;
    case 'airSupport':
      state.airSupport = Math.max(state.airSupport, e.value);
      break;
    case 'reinforce': {
      const msg = applyReinforcement(state, e.id);
      if (msg) addLog(state, 'good', msg);
      break;
    }
    case 'stock': {
      const stock = state.nations[state.provinces[e.province].owner].equipStock;
      for (const [k, v] of Object.entries(e.equip)) stock[k as keyof typeof stock] += v as number;
      break;
    }
    case 'spawn':
      for (const t of e.templates) spawnTemplate(state, t);
      break;
    case 'relocate': {
      for (const u of Object.values(state.units)) {
        if (e.faction && u.faction !== e.faction) continue;
        if (e.trait && !u.traits.includes(e.trait)) continue;
        if (e.from && u.location !== e.from) continue;
        if (state.provinces[e.to].owner !== u.side) continue;
        u.location = e.to;
        u.order = null;
      }
      break;
    }
    case 'mobilize': {
      const prof = MOBILIZATION_PROFILES[e.profile];
      if (!state.flags[prof.doneFlag]) mobilize(state, e.profile);
      break;
    }
    case 'landing': {
      const ex = new Set(String(state.flags.landingToggle ?? '').split(',').filter(Boolean));
      executeLanding(state, e.opId, ex);
      break;
    }
    case 'spawnPla': {
      const tpls = plaBrigades(e.count, e.label, e.provinces[0]);
      tpls.forEach((t, i) => {
        const loc = northSpawnProvince(state, e.provinces, i);
        if (loc) spawnTemplate(state, { ...t, location: loc });
      });
      addLog(state, 'warn', `중국군 ${e.count}개 사단급 부대가 투입되었습니다.`);
      break;
    }
    case 'fortifyFront': {
      for (const p of Object.values(state.provinces)) {
        if (MAP.adjacency[p.id].some((n) => state.provinces[n].owner !== p.owner)) p.fortification = clamp(p.fortification + e.delta, 0, 5);
      }
      break;
    }
    case 'flagTurn':
      state.flags[e.key] = state.turn;
      break;
    case 'weariness':
      state.warWeariness = clamp(state.warWeariness + e.delta, 0, 100);
      break;
    case 'postpone': {
      state.firedEvents = state.firedEvents.filter((x) => x !== e.eventId);
      addLog(state, 'warn', '작전이 연기되었습니다. 다음 턴에 다시 결정해야 합니다.');
      break;
    }
    case 'destroyEnemy': {
      // 상륙 지점의 북측 수비대에게 타격 (상륙은 남측 작전)
      for (const u of Object.values(state.units)) {
        if (u.location === e.province && u.side === 'north') applyLosses(u, u.strength * e.fraction, 'combat', state);
      }
      break;
    }
  }
}

/** 이벤트 발동 검사: 이번 턴의 기간과 이벤트 허용 기간이 겹치고 조건을 만족하면 발동 */
export function checkEvents(state: GameState): string[] {
  const turnStart = state.date;
  const turnEnd = addDays(state.date, turnDaysFor(state.date) - 1);
  const fired: string[] = [];
  for (const ev of EVENTS) {
    if (state.firedEvents.includes(ev.id)) continue;
    if (ev.earliestDate > turnEnd || ev.latestDate < turnStart) continue;
    if (!ev.conditions.every((c) => conditionHolds(state, c))) continue;
    state.firedEvents.push(ev.id);
    for (const e of ev.effects) applyEffect(state, e);
    state.pendingEvents.push({ eventId: ev.id });
    addLog(state, 'event', `【${ev.title}】${ev.isCounterfactual ? ' (가상 사건)' : ''}`);
    fired.push(ev.id);
  }
  return fired;
}

export function resolveEvent(state: GameState, eventId: string, choiceId?: string): { ok: boolean; reason?: string } {
  const idx = state.pendingEvents.findIndex((p) => p.eventId === eventId);
  if (idx < 0) return { ok: false, reason: '대기 중인 이벤트가 아닙니다.' };
  const ev: HistoricalEvent = EVENT_BY_ID[eventId];
  if (ev.choices.length) {
    const ch = ev.choices.find((c) => c.id === choiceId);
    if (!ch) return { ok: false, reason: '선택지를 골라야 합니다.' };
    for (const e of ch.effects) applyEffect(state, e);
    addLog(state, ch.isCounterfactual ? 'warn' : 'event', `결정: ${ch.label}${ch.isCounterfactual ? ' (가상의 선택)' : ''}`);
  }
  state.pendingEvents.splice(idx, 1);
  return { ok: true };
}
