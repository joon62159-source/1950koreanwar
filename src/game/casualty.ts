import type { GameState, Side } from './types';
import { nationalDraftPool } from './manpower';
import { unitsOfSide } from './units';

/** 군 전체 규모 통계 (현재 상태에서 계산 — 고정된 역사적 수치를 쓰지 않는다) */
export interface ForceStats {
  units: number;
  brigades: number;
  divisions: number;
  available: number; // 현재 가용 병력
  authorized: number; // 편제 정원 합계
  woundedInCare: number; // 치료 중인 부상병
  emergency: number; // 긴급 동원병 누계(현재 부대에 있는 인원 기준 기록값)
  draftPool: number; // 남은 징병 가능 인구(접근 가능분)
  trainees: number;
}

export function forceStats(state: GameState, side: Side): ForceStats {
  const us = unitsOfSide(state, side);
  return {
    units: us.length,
    brigades: us.filter((u) => u.echelon === 'brigade').length,
    divisions: us.filter((u) => u.echelon === 'division').length,
    available: us.reduce((s, u) => s + u.strength, 0),
    authorized: us.reduce((s, u) => s + u.maxStrength, 0),
    woundedInCare: us.reduce((s, u) => s + u.wounded, 0),
    emergency: us.reduce((s, u) => s + u.emergencyTroops, 0),
    draftPool: nationalDraftPool(state, side),
    trainees: state.nations[side].trainees.count,
  };
}

export interface CasualtyReport {
  side: Side;
  date: string;
  killed: number; // 누적 전사
  woundedTotal: number; // 누적 부상 발생
  woundedInCare: number; // 현재 치료 중
  returned: number; // 치료 후 복귀
  missing: number; // 누적 실종·포로 (총수)
  prisoners: number; // 그중 포로
  unitsDestroyed: number;
  available: number;
  authorized: number;
  totalLoss: number; // 전사+부상 발생+실종 (중복 없이 합산)
}

/** 국가 전체 사상자 보고. 부대·전투에서 실제 발생한 손실의 합이다. */
export function buildCasualtyReport(state: GameState, side: Side = state.playerSide): CasualtyReport {
  const st = state.nations[side].stats;
  const f = forceStats(state, side);
  return {
    side,
    date: state.date,
    killed: st.killed,
    woundedTotal: st.wounded,
    woundedInCare: f.woundedInCare,
    returned: st.returned,
    missing: st.missing,
    prisoners: st.prisoners,
    unitsDestroyed: st.unitsDestroyed,
    available: f.available,
    authorized: f.authorized,
    totalLoss: st.killed + st.wounded + st.missing,
  };
}

/** 진영별 누적 사상자 합계. 남측 = 국군 + 미군 + UN군, 북측 = 북한군 + 중국군 (국가 통계가 진영 단위로 집계된다) */
export interface SideTotals {
  killed: number;
  wounded: number; // 누적 부상 발생 (복귀 포함)
  missing: number; // 실종 (포로 제외)
  prisoners: number; // 포로
  total: number; // 전사 + 부상 + 실종 + 포로 (중복 없음)
}

export function sideTotals(state: GameState, side: Side): SideTotals {
  const st = state.nations[side].stats;
  return {
    killed: st.killed,
    wounded: st.wounded,
    missing: st.missing - st.prisoners,
    prisoners: st.prisoners,
    total: st.killed + st.wounded + st.missing,
  };
}
