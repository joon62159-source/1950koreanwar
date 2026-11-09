import type { Faction, Side } from '../game/types';

/**
 * 동원 프로필: 국가별 "총동원령 / 병력 동원 + 편제 전환" 데이터.
 * 지금은 대한민국(ROK) 프로필만 구현되어 있다. 북한군 등은 같은 구조로 프로필과 이벤트를 추가하면 된다.
 * (북한군·중국군·미군은 각자의 편제와 동원 방식을 유지하므로 이 프로필을 쓰지 않는다)
 *
 * ⚠ 중요: 실제 1950년 국군은 이미 사단 편제로 운용되었다. 여기서의 "여단→사단 전환"은 역사적 사단 창설의 재현이 아니라
 *   이 게임의 "조작 단위" 및 "긴급 동원 체계"를 바꾸는 게임 설계이다. 수치는 모두 게임 밸런스용 값이다.
 */
export interface MobilizationProfile {
  id: string;
  /** 로그·화면에 쓰는 이름 */
  label: string;
  /** 발동 여부·보고서를 저장하는 flags 키 */
  doneFlag: string;
  reportFlag: string;
  side: Side;
  /** 전환 대상 진영 부대 (여기에 속한 부대만 전환) */
  factions: Faction[];
  eventId: string;
  /** 발동 순간 국가의 남은 징병 가능 인구 중 긴급 동원에 쓰는 비율 (대안: 0.10 보수적 / 0.20 기본 / 0.35 공격적) */
  poolShare: number;
  /** 전환 후 사단의 목표 충원율 (정원 대비). 징병 자원이 부족하면 이보다 낮아진다 */
  fillTarget: number;
  /** 긴급 동원병의 초기 상태: 일반 훈련병(훈련도 15~55)보다 낮다 */
  emergency: { training: number; experience: number; organization: number; morale: number };
  /** 사단 전환 후 이동 속도 배율 (대규모 부대는 느리다) */
  speedFactor: number;
  /** 총동원령 이후 군수 생산 배율 (전시 증산) */
  productionBoost: number;
}

export const MOBILIZATION_PROFILES: Record<string, MobilizationProfile> = {
  rok: {
    id: 'rok',
    label: '국군 총동원령',
    doneFlag: 'mobilized',
    reportFlag: 'mobilizationReport',
    side: 'south',
    factions: ['ROK'],
    eventId: 'general_mobilization',
    poolShare: 0.2,
    fillTarget: 0.75,
    emergency: { training: 8, experience: 0, organization: 35, morale: 45 },
    speedFactor: 0.85,
    productionBoost: 1.25,
  },
  /**
   * 북한군: 국군이 총동원령을 발동하는 순간 함께 발동한다(국가 위기에 맞선 상호 확전).
   * 자체 편제(조선인민군)와 동원 방식을 유지하며 국군 프로필과 수치가 다르다. 중국군·미군은 이 프로필을 쓰지 않는다.
   */
  kpa: {
    id: 'kpa',
    label: '북한군 총동원령',
    doneFlag: 'kpaMobilized',
    reportFlag: 'kpaMobilizationReport',
    side: 'north',
    factions: ['KPA'],
    eventId: 'general_mobilization',
    poolShare: 0.18,
    fillTarget: 0.65,
    emergency: { training: 10, experience: 0, organization: 40, morale: 55 },
    speedFactor: 0.85,
    productionBoost: 1.2,
  },
};
