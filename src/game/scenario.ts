import { CHINA_SEED, PROVINCE_SEEDS } from '../data/provinceSeeds';
import { INITIAL_UNITS, REINFORCEMENTS, type UnitTemplate } from '../data/orbat';
import { ECONOMY, AI_BALANCE, SCENARIO } from './balance';
import { MAP } from './map';
import { computeSupply } from './supply';
import { computeWarCapacity, effectiveIndustry } from './economy';
import { createUnit, emptyEquip, totalStrength } from './units';
import { addLog } from './util';
import { updateIntel } from './visibility';
import type { GameState, Province, Side } from './types';

export const SAVE_VERSION = 7;
const SOUTH_POP_TOTAL = 20200; // 천 명, 1949년 전후 남한 총인구 약 2,000만 (추정 총량)
const NORTH_POP_TOTAL = 9600; // 천 명, 북한 총인구 추정 총량

function buildProvinces(): Record<string, Province> {
  const southRaw = PROVINCE_SEEDS.filter((s) => s.lat < 38).reduce((a, s) => a + s.pop, 0);
  const northRaw = PROVINCE_SEEDS.filter((s) => s.lat >= 38).reduce((a, s) => a + s.pop, 0);
  const out: Record<string, Province> = {};
  for (const s of PROVINCE_SEEDS) {
    const owner: Side = s.lat < 38 ? 'south' : 'north'; // 38도선 기준 초기 통제 (옹진·연안·개성 포함)
    const scale = owner === 'south' ? SOUTH_POP_TOTAL / southRaw : NORTH_POP_TOTAL / northRaw;
    const population = Math.round(s.pop * scale * 1000);
    const railCount = MAP.rail[s.id].length;
    const infra = Math.round(
      Math.max(15, Math.min(95, 28 + s.ind * 4 + railCount * 8 + (s.terrain === 'urban' ? 10 : 0) - (s.terrain === 'mountain' ? 12 : 0))),
    );
    const base = s.ind * 10;
    out[s.id] = {
      id: s.id,
      name: s.name,
      historicalName: s.hist,
      geographicalRegion: s.region,
      initialOwner: owner,
      owner,
      population,
      draftEligible: Math.round(population * ECONOMY.recruitableShare),
      drafted: 0,
      recruitablePopulation: Math.round(population * ECONOMY.recruitableShare),
      industrialCapacity: base,
      industrialBase: base,
      equipmentProduction: 0,
      infrastructure: infra,
      terrain: s.terrain,
      roadConnections: [...MAP.adjacency[s.id]],
      railwayConnections: [...MAP.rail[s.id]],
      seaConnections: [...MAP.sea[s.id]],
      portCapacity: s.port ?? 0,
      fortification: s.lat >= 37.7 && s.lat < 38.1 && owner === 'south' ? 1 : 0,
      warDamage: 0,
      controlStability: 92,
      strategicValue: s.strat,
      supplyLevel: 0,
      supplied: true,
      dataQuality: { population: 'estimated', industry: 'game', military: 'game' },
    };
  }
  out[CHINA_SEED.id] = {
    id: CHINA_SEED.id,
    name: CHINA_SEED.name,
    historicalName: CHINA_SEED.hist,
    geographicalRegion: CHINA_SEED.region,
    initialOwner: 'north',
    owner: 'north',
    population: 0,
    draftEligible: 0,
    drafted: 0,
    recruitablePopulation: 0,
    industrialCapacity: 0,
    industrialBase: 0,
    equipmentProduction: 0,
    infrastructure: 60,
    terrain: 'plain',
    roadConnections: [...MAP.adjacency[CHINA_SEED.id]],
    railwayConnections: [],
    seaConnections: [],
    portCapacity: 0,
    fortification: 0,
    warDamage: 0,
    controlStability: 100,
    strategicValue: 1,
    supplyLevel: 100,
    supplied: true,
    external: true,
    dataQuality: { population: 'estimated', industry: 'game', military: 'game' },
  };
  return out;
}

export function spawnTemplate(state: GameState, t: UnitTemplate) {
  const u = createUnit(state, {
    faction: t.faction, name: t.name, parent: t.parent, kind: t.kind, echelon: t.echelon, location: t.location,
    training: t.training, experience: t.experience, morale: t.morale, strengthPct: t.strengthPct,
    fill: t.fill, defaultFill: 0.7, traits: t.traits,
  });
  state.units[u.id] = u;
  return u;
}

/** 북측(북한군·중국군) 증원이 도착할 프로빈스: 선호 지역 중 북측이 통제하는 곳을 고르고, 없으면 북측 통제 지역 아무 곳이나 고른다 */
export function northSpawnProvince(state: GameState, preferred: string[], index = 0): string | null {
  const own = preferred.filter((id) => state.provinces[id]?.owner === 'north');
  if (own.length) return own[index % own.length];
  const any = Object.values(state.provinces).filter((p) => p.owner === 'north').sort((a, b) => b.strategicValue - a.strategicValue);
  return any.length ? any[index % Math.min(3, any.length)].id : null;
}

export function applyReinforcement(state: GameState, id: string): string | null {
  const r = REINFORCEMENTS.find((x) => x.id === id);
  if (!r || state.flags[`reinf:${id}`]) return null;
  if (r.requiresFlag && !state.flags[r.requiresFlag]) return null;
  if (id.startsWith('pla-wave') && state.flags.nukeUsed) return null; // 핵 투하 이후 중국군 증원 불가
  state.flags[`reinf:${id}`] = true;
  r.units.forEach((t, i) => {
    if (t.faction === 'PLA' || t.faction === 'KPA') {
      const loc = northSpawnProvince(state, [t.location], i);
      if (!loc) return;
      spawnTemplate(state, { ...t, location: loc });
    } else spawnTemplate(state, t);
  });
  if (r.stock) {
    // 원조 물자는 국가 군수 재고에 합산된다 (자동 배분의 원천)
    const stock = state.nations[r.side].equipStock;
    for (const [k, v] of Object.entries(r.stock.equip)) stock[k as keyof typeof stock] += v as number;
  }
  return r.message;
}

export function newGame(seed = 1950): GameState {
  const state: GameState = {
    version: SAVE_VERSION,
    scenarioId: SCENARIO.id,
    turn: 1,
    date: SCENARIO.startDate,
    rng: seed >>> 0,
    playerSide: 'south',
    provinces: buildProvinces(),
    units: {},
    nations: {
      south: {
        side: 'south', supplyStock: 320, popularSupport: 68, warCapacity: 0, commandPoints: 6, replacementPool: 0, policyCooldowns: {}, casualties: 0,
        // 초기 군수 재고 (게임 밸런스 값)
        equipStock: { rifles: 4500, machineGuns: 60, mortars: 30, artillery: 6, antiTank: 50, tanks: 0, vehicles: 55 },
        trainees: { count: 2400, training: 20 },
        emergencyDrafted: 0,
        stats: { killed: 0, wounded: 0, returned: 0, missing: 0, prisoners: 0, unitsDestroyed: 0 },
      },
      north: {
        side: 'north', supplyStock: 520, popularSupport: 75, warCapacity: 0, commandPoints: 6, replacementPool: AI_BALANCE.replacementPoolStart, policyCooldowns: {}, casualties: 0,
        equipStock: { rifles: 4000, machineGuns: 120, mortars: 60, artillery: 20, antiTank: 60, tanks: 0, vehicles: 80 },
        trainees: { count: 0, training: 0 },
        emergencyDrafted: 0,
        stats: { killed: 0, wounded: 0, returned: 0, missing: 0, prisoners: 0, unitsDestroyed: 0 },
      },
    },
    diplomacy: { usCommitment: 10, unSupport: 15, chinaThreat: 5, sovietSupport: 45 },
    flags: {},
    firedEvents: [],
    pendingEvents: [],
    reports: [],
    log: [],
    interdiction: 0,
    airSupport: 0,
    intel: {},
    nextUnitNumber: 1,
    outcome: null,
    briefing: [],
    lastTurn: null,
    settings: { fog: false },
    warWeariness: 0,
    armisticeProgress: 0,
    initialTotals: { southIndustry: 1, northIndustry: 1, southStrength: 1, northStrength: 1, southProvinces: 1 },
  };
  for (const t of INITIAL_UNITS) spawnTemplate(state, t);
  computeSupply(state);
  for (const u of Object.values(state.units)) u.supply = Math.max(40, state.provinces[u.location].supplyLevel);
  const ind = (side: Side) => Object.values(state.provinces).filter((p) => p.owner === side).reduce((a, p) => a + effectiveIndustry(p), 0);
  state.initialTotals = {
    southIndustry: ind('south'),
    northIndustry: ind('north'),
    southStrength: totalStrength(state, 'south'),
    northStrength: totalStrength(state, 'north'),
    southProvinces: Object.values(state.provinces).filter((p) => p.owner === 'south').length,
  };
  state.nations.south.warCapacity = computeWarCapacity(state, 'south');
  state.nations.north.warCapacity = computeWarCapacity(state, 'north');
  updateIntel(state, 'south');
  addLog(state, 'event', '1950년 6월 25일 — 북한군이 38선 전역에서 공격을 개시했습니다.');
  return state;
}
