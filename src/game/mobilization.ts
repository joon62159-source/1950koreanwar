import type { GameState, Unit } from './types';
import { MOBILIZATION_PROFILES, type MobilizationProfile } from '../data/mobilization';
import { scaledNeed, reinforceUnit, unitsOfSide } from './units';
import { drawFromProvinces, nationalDraftPool } from './manpower';
import { forceStats, type ForceStats } from './casualty';
import { addLog } from './util';

/**
 * 총동원령: 기존 여단급 부대를 1:1로 사단급으로 전환하고 긴급 동원병을 자동 충원한다.
 *
 *  - 부대 수·주둔 위치·전투 경험·전투 이력·병력·장비·부상병 기록은 그대로 승계한다. 여러 여단을 합치지 않는다.
 *  - 정원(최대 병력·장비 정원)만 사단급으로 커진다. 장비는 저절로 생기지 않으므로 장비 충족률이 떨어진다.
 *  - 긴급 동원병은 실제 징병 가능 인구에서 차감하며, 풀을 넘어 생성하지 않는다. 자원이 부족하면 결원 있는 사단으로 남는다.
 *  - 긴급 동원병은 훈련도·경험·조직력이 낮아 기존 병력과 섞이면 사단 평균 숙련도가 내려간다.
 *  - 이 전환은 역사적 사단 창설의 재현이 아니라 게임의 조작 단위 변경이다.
 */
export interface MobilizationReport {
  profileId: string;
  date: string;
  before: ForceStats;
  after: ForceStats;
  emergencyDrafted: number; // 이번 동원으로 충원한 긴급 동원병
  poolBefore: number;
  poolAfter: number;
  poolBudget: number;
  convertedUnits: number;
  understrength: number; // 정원 목표에 못 미친 사단 수
}

export function divisionName(name: string): string {
  if (/여단$/.test(name)) return name.replace(/여단$/, '사단');
  if (/연대 전투단$/.test(name)) return name.replace(/연대 전투단$/, '연대 전투사단');
  if (/전투단$/.test(name)) return name.replace(/전투단$/, '전투사단');
  return `${name} (사단급)`;
}

/** 부대 1개를 사단급으로 전환 (위치·기록 유지). 병력 충원은 별도. */
export function convertToDivision(u: Unit, profile: MobilizationProfile): void {
  const toe = scaledNeed(u.kind, 'division');
  u.echelon = 'division';
  u.maxStrength = toe.maxStrength;
  u.equipNeed = toe.need;
  u.name = divisionName(u.name);
  u.speed = Math.round(u.speed * profile.speedFactor);
}

/** 예상 결과를 미리 계산 (상태를 바꾸지 않음) — 이벤트의 동원 전후 비교 화면용 */
export function previewMobilization(state: GameState, profileId = 'rok'): MobilizationReport {
  const clone = structuredClone(state);
  return runMobilization(clone, profileId, false);
}

export function mobilize(state: GameState, profileId = 'rok'): MobilizationReport {
  return runMobilization(state, profileId, true);
}

function runMobilization(state: GameState, profileId: string, record: boolean): MobilizationReport {
  const profile = MOBILIZATION_PROFILES[profileId];
  const side = profile.side;
  const before = forceStats(state, side);
  const poolBefore = nationalDraftPool(state, side);
  const targets = unitsOfSide(state, side).filter((u) => profile.factions.includes(u.faction) && u.echelon === 'brigade');
  const countBefore = targets.length;
  for (const u of targets) convertToDivision(u, profile);

  // 긴급 동원병: 실제 징병 가능 인구의 일부를 사용 (충원 목표를 넘지 않는다)
  const budget = Math.floor(poolBefore * profile.poolShare);
  const gaps = targets.map((u) => Math.max(0, Math.round(u.maxStrength * profile.fillTarget) - u.strength));
  const totalGap = gaps.reduce((a, b) => a + b, 0);
  const want = Math.min(budget, totalGap);
  const drawn = drawFromProvinces(state, side, want); // 풀에서 실제로 차감 (이후 일반 징집에서 재사용 불가)
  let given = 0;
  targets.forEach((u, i) => {
    if (totalGap <= 0 || drawn <= 0) return;
    const share = Math.min(gaps[i], Math.floor((drawn * gaps[i]) / totalGap));
    const add = reinforceUnit(u, share, profile.emergency.training, {
      organization: profile.emergency.organization,
      morale: profile.emergency.morale,
      emergency: true,
    });
    given += add;
  });
  // 내림으로 남은 인원은 결원이 큰 순서대로 한 명씩 배정 (차감한 만큼 정확히 충원)
  let rest = drawn - given;
  const order = targets.map((u, i) => i).sort((a, b) => gaps[b] - gaps[a]);
  for (const i of order) {
    if (rest <= 0) break;
    const add = reinforceUnit(targets[i], Math.min(rest, gaps[i]), profile.emergency.training, {
      organization: profile.emergency.organization,
      morale: profile.emergency.morale,
      emergency: true,
    });
    given += add;
    rest -= add;
  }
  if (rest > 0) {
    // 정원 목표를 넘겨 차감할 수는 없으므로 되돌리지 않고 남은 인원은 훈련병 풀로 돌린다 (차감한 인구가 사라지지 않도록)
    const t = state.nations[side].trainees;
    t.training = (t.training * t.count + profile.emergency.training * rest) / Math.max(1, t.count + rest);
    t.count += rest;
  }
  state.nations[side].emergencyDrafted += given;

  const under = targets.filter((u) => u.strength < u.maxStrength * profile.fillTarget - 1).length;
  const after = forceStats(state, side);
  const report: MobilizationReport = {
    profileId,
    date: state.date,
    before,
    after,
    emergencyDrafted: given,
    poolBefore,
    poolAfter: nationalDraftPool(state, side),
    poolBudget: budget,
    convertedUnits: countBefore,
    understrength: under,
  };
  if (record) {
    state.flags[profile.doneFlag] = true;
    state.flags[profile.reportFlag] = JSON.stringify(report);
    addLog(state, 'event', `${profile.label}: ${countBefore}개 여단급 부대가 사단급으로 전환되었습니다. 긴급 동원병 ${given.toLocaleString('ko-KR')}명 충원 (징병 가능 인구에서 차감).`);
  }
  return report;
}
