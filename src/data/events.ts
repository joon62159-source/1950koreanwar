import type { Diplomacy, EquipKey, Side } from '../game/types';
import type { UnitTemplate } from './orbat';

/**
 * 역사 이벤트 데이터.
 *  - historicalDate/historicalContext/source: 실제 사건에 대한 설명. 날짜는 일반적으로 알려진 값을 적었으나
 *    국가기록원·군사편찬연구소 원자료와의 교차 검증이 필요한 항목은 needsVerification=true 로 표시했다.
 *  - 선택지의 isCounterfactual=true 는 역사에서 실제로 선택되지 않은(게임을 위해 가정한) 선택지다.
 *  - effects 는 화면 메시지가 아니라 실제 게임 상태(병력·보급·외교·지역 통제 등)를 바꾼다.
 */

export type Condition =
  | { kind: 'owner'; province: string; side: Side }
  | { kind: 'ownerAny'; provinces: string[]; side: Side; min?: number }
  | { kind: 'flagEquals'; key: string; value: string | number | boolean }
  | { kind: 'flagUnset'; key: string }
  | { kind: 'enemyNear'; province: string; side: Side } // side 의 부대가 해당 지역 또는 인접 지역에 있음
  | { kind: 'dateAtLeast'; date: string }
  | { kind: 'diplomacyAtLeast'; field: keyof Diplomacy; value: number }
  /** flags[key] 에 기록된 턴으로부터 min 턴 이상 지났음 */
  | { kind: 'flagTurnsAgo'; key: string; min: number }
  | { kind: 'flagSet'; key: string }
  | { kind: 'warCapacityBelow'; side: Side; value: number }
  /** side 의 초기 소유 프로빈스 중 현재 잃은 지역이 min 곳 이상 */
  | { kind: 'provincesLostAtLeast'; side: Side; min: number }
  | { kind: 'eventFired'; id: string }
  /** side 의 여단이 해당 지역(또는 인접 지역)에 min 개 이상 있음 */
  | { kind: 'unitsNear'; side: Side; provinces: string[]; min: number; adjacent?: boolean }
  | { kind: 'anyOf'; of: Condition[] }
  | { kind: 'allOf'; of: Condition[] }
  | { kind: 'not'; cond: Condition };

export type Effect =
  | { kind: 'nation'; side: Side; field: 'popularSupport' | 'supplyStock' | 'commandPoints'; delta: number }
  | { kind: 'diplomacy'; field: keyof Diplomacy; delta: number }
  | {
      kind: 'units';
      side: Side;
      area: string[] | 'all';
      lossFraction?: number;
      equipLossFraction?: number;
      morale?: number;
      organization?: number;
      fatigue?: number;
      recovery?: number;
      supply?: number;
    }
  | { kind: 'province'; province: string; field: 'fortification' | 'warDamage' | 'controlStability' | 'infrastructure'; delta: number }
  | { kind: 'setOwner'; province: string; side: Side }
  | { kind: 'flag'; key: string; value: string | number | boolean }
  | { kind: 'interdiction'; delta: number }
  | { kind: 'airSupport'; value: number }
  | { kind: 'reinforce'; id: string }
  | { kind: 'stock'; province: string; equip: Partial<Record<EquipKey, number>> }
  | { kind: 'spawn'; templates: UnitTemplate[] }
  | { kind: 'relocate'; faction?: 'UN' | 'ROK' | 'KPA'; trait?: string; from?: string; to: string }
  | { kind: 'destroyEnemy'; province: string; fraction: number }
  /** 상륙작전 실행 (src/game/amphibious.ts). 확인 화면에서 정한 제외 목록은 flags.landingToggle 에 담긴다 */
  | { kind: 'landing'; opId: string }
  /** 총동원령: 여단→사단 1:1 전환 + 긴급 동원병 충원 (src/game/mobilization.ts, data/mobilization.ts 의 프로필) */
  | { kind: 'mobilize'; profile: string }
  /** 중국군 여단을 북측 통제 지역(선호 지역 우선)에 배치 */
  | { kind: 'spawnPla'; count: number; label: string; provinces: string[] }
  /** 전선(적 통제 지역과 맞닿은) 프로빈스의 방어시설을 양측 모두 강화 */
  | { kind: 'fortifyFront'; delta: number }
  | { kind: 'weariness'; delta: number }
  /** flags[key] 에 현재 턴 번호를 기록 */
  | { kind: 'flagTurn'; key: string }
  /** 이벤트를 다음 턴에 다시 발동시키도록 연기 */
  | { kind: 'postpone'; eventId: string };

export interface EventChoice {
  id: string;
  label: string;
  description: string;
  isCounterfactual: boolean;
  effects: Effect[];
}

export interface HistoricalEvent {
  id: string;
  title: string;
  description: string;
  earliestDate: string;
  latestDate: string;
  conditions: Condition[];
  choices: EventChoice[];
  effects: Effect[];
  historicalContext: string;
  historicalDate: string;
  source: string;
  needsVerification: boolean;
  isCounterfactual: boolean;
  /** 상륙작전처럼 확인 화면이 필요한 이벤트 */
  operation?: string;
  /** 총동원령 동원 전후 비교 화면이 필요한 이벤트 (프로필 id) */
  mobilization?: string;
  /** 국가 전체 사상자 보고 화면을 함께 보여주는 이벤트 */
  casualtyReport?: boolean;
}

const FRONT = ['paju', 'gaeseong', 'dongducheon', 'uijeongbu', 'chuncheon', 'hongcheon', 'gangneung', 'samcheok', 'ongjin', 'yeonan'];
const NORTH_BANK = ['seoul', 'uijeongbu', 'dongducheon', 'paju', 'gimpo', 'gaeseong'];
const PERIMETER = ['waegwan', 'daegu', 'yeongcheon', 'pohang', 'changnyeong', 'masan', 'jinju', 'miryang', 'gyeongju', 'andong', 'sangju'];

/** 낙동강 방어선이 실제로 형성된 전황: 북한군이 남부 내륙까지 진격하고, 대구·부산이 아군 수중에 있으며 방어선 일대에 양측 병력이 배치됨 */
const NAKTONG_PERIMETER = ['waegwan', 'daegu', 'yeongcheon', 'pohang', 'changnyeong', 'masan', 'jinju', 'miryang', 'gyeongju', 'sangju', 'andong'];
export const NAKTONG_LINE: Condition[] = [
  { kind: 'owner', province: 'daegu', side: 'south' },
  { kind: 'owner', province: 'busan', side: 'south' },
  { kind: 'ownerAny', provinces: ['daejeon', 'yeongdong', 'sangju', 'andong', 'nonsan', 'jeonju', 'jinju'], side: 'north', min: 1 },
  { kind: 'unitsNear', side: 'south', provinces: NAKTONG_PERIMETER, min: 3 },
  { kind: 'unitsNear', side: 'north', provinces: NAKTONG_PERIMETER, min: 2, adjacent: true },
];

const SRC_KMA = '국방부 군사편찬연구소 『6·25전쟁사』 시리즈';
const SRC_APP = 'Roy E. Appleman, South to the Naktong, North to the Yalu (U.S. Army Center of Military History, 1961)';
const SRC_UN = 'UN Security Council Resolutions 82·83·84 (1950)';

export const EVENTS: HistoricalEvent[] = [
  {
    id: 'kpa_invasion',
    title: '북한군의 남침',
    description:
      '새벽, 38선 전역에서 포격과 함께 북한군이 일제히 남하하기 시작했습니다. 옹진에서 동해안까지 전선 곳곳에서 국군 전방부대가 기습을 당했고, 전차를 앞세운 주공은 의정부 축선으로 향하고 있습니다. 대한민국은 지금 압도적 열세입니다. 정면 사수보다 병력을 보존하며 시간을 버는 것이 관건입니다.',
    earliestDate: '1950-06-25',
    latestDate: '1950-06-30',
    conditions: [],
    choices: [],
    effects: [
      { kind: 'units', side: 'south', area: FRONT, organization: -26, morale: -10, recovery: -15 },
      { kind: 'nation', side: 'south', field: 'popularSupport', delta: -3 },
      { kind: 'flag', key: 'invasion', value: true },
    ],
    historicalContext: '1950년 6월 25일 새벽 4시경 북한군이 38도선 전역에서 전면 공격을 개시했다. 의정부 방면에는 제105전차여단이 투입되었다.',
    historicalDate: '1950-06-25',
    source: `${SRC_KMA}; ${SRC_APP}`,
    needsVerification: false,
    isCounterfactual: false,
  },
  {
    id: 'unsc_support',
    title: 'UN 안전보장이사회의 대응',
    description:
      '안전보장이사회가 북한의 무력 공격을 규탄하고 회원국의 지원을 권고했습니다. 미국은 해·공군의 엄호를 승인했습니다. 지상군 증원은 아직 도착하지 않았지만 외교적 상황이 크게 바뀌고 있습니다.',
    earliestDate: '1950-06-27',
    latestDate: '1950-07-10',
    conditions: [],
    choices: [],
    effects: [
      { kind: 'diplomacy', field: 'unSupport', delta: 35 },
      { kind: 'diplomacy', field: 'usCommitment', delta: 25 },
      { kind: 'airSupport', value: 0.4 },
      { kind: 'interdiction', delta: 0.12 },
      { kind: 'nation', side: 'south', field: 'popularSupport', delta: 3 },
    ],
    historicalContext: '6월 25일 안보리 결의 82호, 6월 27일 결의 83호로 군사적 지원 권고가 채택되었고 미국은 해·공군 투입을 결정했다.',
    historicalDate: '1950-06-27',
    source: `${SRC_UN}; ${SRC_APP}`,
    needsVerification: false,
    isCounterfactual: false,
  },
  {
    id: 'seoul_crisis',
    title: '서울 함락 위기와 한강선',
    description:
      '의정부 방어선이 무너지고 북한군 전차가 서울 외곽에 도달했습니다. 한강을 건너는 교량을 어떻게 처리할 것인가, 수도에서 끝까지 저항할 것인가를 결정해야 합니다. 한강 이북에 남은 부대가 많을수록 선택의 대가는 커집니다.',
    earliestDate: '1950-06-27',
    latestDate: '1950-07-08',
    conditions: [{ kind: 'owner', province: 'seoul', side: 'south' }, { kind: 'enemyNear', province: 'seoul', side: 'north' }],
    choices: [
      {
        id: 'blow_early',
        label: '한강 교량을 조기에 폭파한다',
        description: '북한군 추격이 지연되지만, 한강 이북에 남은 부대는 병력과 중장비를 크게 잃습니다. 민간인 피해로 국민 지지도 하락합니다.',
        isCounterfactual: false,
        effects: [
          { kind: 'units', side: 'south', area: NORTH_BANK, lossFraction: 0.3, equipLossFraction: 0.5, morale: -12, organization: -20 },
          { kind: 'units', side: 'north', area: ['dongducheon', 'uijeongbu', 'paju', 'gimpo', 'cheorwon', 'gaeseong', 'seoul'], organization: -10, fatigue: 12 },
          { kind: 'nation', side: 'south', field: 'popularSupport', delta: -8 },
          { kind: 'flag', key: 'bridge', value: 'early' },
        ],
      },
      {
        id: 'delay_demolition',
        label: '폭파를 늦추고 질서 있게 철수시킨다',
        description: '한강 이북 부대의 손실은 적지만 북한군이 교량을 이용해 빠르게 추격할 수 있습니다.',
        isCounterfactual: true,
        effects: [
          { kind: 'units', side: 'south', area: NORTH_BANK, lossFraction: 0.07, morale: -4, organization: -6 },
          { kind: 'units', side: 'north', area: ['dongducheon', 'uijeongbu', 'paju', 'gimpo', 'cheorwon', 'gaeseong', 'seoul'], organization: 6, morale: 4 },
          { kind: 'flag', key: 'bridge', value: 'delayed' },
        ],
      },
      {
        id: 'hold_seoul',
        label: '서울 사수를 명령한다',
        description: '서울의 부대 사기가 오르고 방어시설이 강화되지만, 서울이 포위되면 퇴각 없이 끝까지 싸우다 전멸할 수 있습니다.',
        isCounterfactual: true,
        effects: [
          { kind: 'units', side: 'south', area: ['seoul', 'uijeongbu', 'gimpo'], morale: 14, organization: 6 },
          { kind: 'province', province: 'seoul', field: 'fortification', delta: 1 },
          { kind: 'nation', side: 'south', field: 'popularSupport', delta: 4 },
          { kind: 'flag', key: 'seoulHold', value: true },
        ],
      },
    ],
    effects: [],
    historicalContext: '6월 28일 새벽 한강 인도교와 철교가 폭파되어 다리 위의 많은 피난민과 한강 이북의 국군 병력·장비가 남쪽으로 건너지 못했다. 서울은 같은 날 북한군에게 점령되었다.',
    historicalDate: '1950-06-28',
    source: `${SRC_KMA}; 국사편찬위원회 한국사데이터베이스`,
    needsVerification: true,
    isCounterfactual: false,
  },
  {
    id: 'un_command',
    title: 'UN군 통합사령부 창설과 미 지상군 증원',
    description:
      '안보리가 미국 지휘 아래 통합군사령부를 창설하도록 결의했고, 극동군사령관이 UN군 사령관으로 임명되었습니다. 미군 지상군이 순차적으로 도착하기 시작합니다. 보급과 항공 지원이 개선되지만, 도착하는 미군은 수가 적고 훈련·장비가 불충분합니다.',
    earliestDate: '1950-07-07',
    latestDate: '1950-07-20',
    conditions: [{ kind: 'eventFired', id: 'unsc_support' }],
    choices: [],
    effects: [
      { kind: 'diplomacy', field: 'usCommitment', delta: 20 },
      { kind: 'diplomacy', field: 'unSupport', delta: 10 },
      { kind: 'airSupport', value: 0.7 },
      { kind: 'interdiction', delta: 0.12 },
      { kind: 'nation', side: 'south', field: 'supplyStock', delta: 40 },
    ],
    historicalContext: '7월 7일 안보리 결의 84호에 따라 통합사령부가 창설되었고 7월 8일 맥아더 장군이 UN군 사령관으로 임명되었다.',
    historicalDate: '1950-07-07',
    source: `${SRC_UN}; ${SRC_APP}`,
    needsVerification: false,
    isCounterfactual: false,
  },
  {
    id: 'us_vanguard',
    title: '미 지상군 선견대 배치',
    description:
      '미 제24사단의 선견대가 부산에 도착했습니다. 병력은 소수이고 전차에 맞설 장비도 부족합니다. 이들을 서울-대전 축선에 앞당겨 투입해 시간을 벌 것인지, 낙동강 선에 집결시킬 것인지 결정하십시오.',
    earliestDate: '1950-07-01',
    latestDate: '1950-07-12',
    conditions: [{ kind: 'anyOf', of: [{ kind: 'owner', province: 'seoul', side: 'north' }, { kind: 'unitsNear', side: 'north', provinces: ['seoul', 'suwon', 'osan'], min: 1 }] }],
    choices: [
      {
        id: 'forward',
        label: '선견대를 오산·천안 방면에 전진 배치한다',
        description: '북한군의 진격을 늦추고 국제사회에 미군 참전 의지를 알립니다. 선견대는 큰 손실을 입기 쉽습니다.',
        isCounterfactual: false,
        effects: [
          { kind: 'relocate', faction: 'UN', from: 'busan', to: 'cheonan' },
          { kind: 'diplomacy', field: 'usCommitment', delta: 8 },
          { kind: 'flag', key: 'vanguard', value: 'forward' },
        ],
      },
      {
        id: 'consolidate',
        label: '선견대를 대구에 집결시킨다',
        description: '전투력을 보존하며 낙동강 방어선 준비 시간을 법니다. 대신 북한군의 속도는 늦춰지지 않습니다.',
        isCounterfactual: true,
        effects: [
          { kind: 'relocate', faction: 'UN', from: 'busan', to: 'daegu' },
          { kind: 'province', province: 'daegu', field: 'fortification', delta: 1 },
          { kind: 'flag', key: 'vanguard', value: 'consolidate' },
        ],
      },
    ],
    effects: [],
    historicalContext: '미 제24사단 제21연대 제1대대 기간의 스미스 특수임무부대는 7월 5일 오산 부근에서 북한군 전차와 첫 교전을 벌였으나 저지에 실패하고 철수했다.',
    historicalDate: '1950-07-05',
    source: `${SRC_APP}`,
    needsVerification: false,
    isCounterfactual: false,
  },
  {
    id: 'walker_stand',
    title: '"현 위치 사수" — 낙동강 방어 지침',
    description:
      '제8군 사령관이 더 이상의 후퇴는 없다는 방어 지침을 하달할 분위기입니다. 낙동강을 따라 마지막 방어선이 형성되고 있습니다. 사기를 끌어올릴 것인지, 종심 있는 유연 방어를 택할 것인지 정해야 합니다.',
    earliestDate: '1950-07-27',
    latestDate: '1950-08-10',
    conditions: [
      { kind: 'owner', province: 'daegu', side: 'south' },
      { kind: 'anyOf', of: [{ kind: 'ownerAny', provinces: ['daejeon', 'yeongdong', 'jochiwon', 'sangju'], side: 'north', min: 1 }, { kind: 'unitsNear', side: 'north', provinces: ['waegwan', 'yeongcheon', 'changnyeong', 'masan', 'andong', 'jinju'], min: 1, adjacent: true }] },
    ],
    choices: [
      {
        id: 'stand',
        label: '"현 위치 사수" 지침을 하달한다',
        description: '전 부대 사기가 오르고 낙동강 요충의 방어시설이 강화됩니다. 대신 후퇴 시 사기 붕괴가 큽니다.',
        isCounterfactual: false,
        effects: [
          { kind: 'units', side: 'south', area: 'all', morale: 10 },
          { kind: 'province', province: 'daegu', field: 'fortification', delta: 1 },
          { kind: 'province', province: 'waegwan', field: 'fortification', delta: 1 },
          { kind: 'province', province: 'masan', field: 'fortification', delta: 1 },
          { kind: 'province', province: 'changnyeong', field: 'fortification', delta: 1 },
          { kind: 'nation', side: 'south', field: 'popularSupport', delta: 3 },
          { kind: 'flag', key: 'standOrDie', value: true },
        ],
      },
      {
        id: 'elastic',
        label: '유연한 종심 방어를 지시한다',
        description: '조직력과 보급이 보존되고 철수가 자유롭습니다. 하지만 사기 상승 효과는 없습니다.',
        isCounterfactual: true,
        effects: [
          { kind: 'units', side: 'south', area: 'all', organization: 8, recovery: 8 },
          { kind: 'nation', side: 'south', field: 'supplyStock', delta: 20 },
        ],
      },
    ],
    effects: [],
    historicalContext: '7월 말 제8군 사령관 워커 중장은 낙동강 방어선을 사수하라는 취지의 지침을 내렸다. 정확한 일자와 표현은 자료에 따라 다르다.',
    historicalDate: '1950-07-29',
    source: SRC_APP,
    needsVerification: true,
    isCounterfactual: false,
  },
  {
    id: 'naktong_crisis',
    title: '낙동강 방어선 위기',
    description:
      '북한군이 낙동강 전선 여러 곳에서 동시에 압박하고 있습니다. 한 곳에 예비대를 넣으면 다른 곳이 뚫릴 수 있습니다. 기동 예비대(해병 임시여단 등)를 어디에 투입할지 결정하십시오. 선택한 축선의 부대는 사기·조직·휴식 회복 효과를 받고 예비대가 그곳으로 이동합니다.',
    earliestDate: '1950-08-05',
    latestDate: '1950-09-14',
    conditions: NAKTONG_LINE,
    choices: [
      {
        id: 'masan_axis',
        label: '마산·창녕(낙동강 남부 축)에 투입한다',
        description: '실제로 해병 임시여단과 미 제25사단이 남부 돌출부 방어에 투입되었습니다.',
        isCounterfactual: false,
        effects: [
          { kind: 'units', side: 'south', area: ['masan', 'changnyeong', 'jinju', 'miryang', 'gimhae'], morale: 12, organization: 10, recovery: 15, fatigue: -10 },
          { kind: 'relocate', trait: '소방대(기동예비)', to: 'masan' },
          { kind: 'nation', side: 'south', field: 'supplyStock', delta: 25 },
        ],
      },
      {
        id: 'daegu_axis',
        label: '왜관·대구(중앙 축)에 투입한다',
        description: '수도 대구 방어를 우선합니다. 남부와 동부는 현재 병력으로 버텨야 합니다.',
        isCounterfactual: true,
        effects: [
          { kind: 'units', side: 'south', area: ['waegwan', 'daegu', 'sangju', 'andong'], morale: 12, organization: 10, recovery: 15, fatigue: -10 },
          { kind: 'relocate', trait: '소방대(기동예비)', to: 'daegu' },
          { kind: 'nation', side: 'south', field: 'supplyStock', delta: 25 },
        ],
      },
      {
        id: 'east_axis',
        label: '영천·포항(동해안 축)에 투입한다',
        description: '동해안 보급 거점 포항과 경주 방면을 지킵니다.',
        isCounterfactual: true,
        effects: [
          { kind: 'units', side: 'south', area: ['yeongcheon', 'pohang', 'gyeongju'], morale: 12, organization: 10, recovery: 15, fatigue: -10 },
          { kind: 'relocate', trait: '소방대(기동예비)', to: 'yeongcheon' },
          { kind: 'nation', side: 'south', field: 'supplyStock', delta: 25 },
        ],
      },
    ],
    effects: [{ kind: 'nation', side: 'south', field: 'popularSupport', delta: -2 }],
    historicalContext: '8월 초~9월 중순 낙동강 전선에서 북한군은 여러 축선에서 동시에 공세를 가했고, 연합군은 기동 예비대를 이동시키며 위기를 막아냈다. 8월 31일에는 북한군의 대규모 공세가 재개되었다.',
    historicalDate: '1950-08-05',
    source: `${SRC_APP}; ${SRC_KMA}`,
    needsVerification: true,
    isCounterfactual: false,
  },
  {
    id: 'incheon_preparation',
    title: '인천상륙작전 준비',
    description:
      'UN군 사령부가 낙동강 정면이 아닌 북한군 배후로의 대규모 상륙작전을 구상하고 있습니다. 성공하면 북한군의 보급선이 끊기지만, 실패하면 막대한 자원을 잃습니다. 지금 상륙 지점을 결정해야 하며, 준비에는 보급 자원이 소모됩니다.',
    earliestDate: '1950-08-12',
    latestDate: '1950-09-14',
    conditions: [
      { kind: 'flagUnset', key: 'incheonPlan' },
      { kind: 'owner', province: 'busan', side: 'south' },
      { kind: 'owner', province: 'incheon', side: 'north' },
      { kind: 'ownerAny', provinces: ['suwon', 'osan', 'pyeongtaek', 'cheonan', 'daejeon'], side: 'north', min: 1 },
    ],
    choices: [
      {
        id: 'incheon',
        label: '인천 상륙을 승인한다 (9월 15일 목표)',
        description: '서울과 가까운 인천에 상륙해 북한군 보급선을 끊습니다. 위험하지만 성공하면 전황이 뒤집힙니다.',
        isCounterfactual: false,
        effects: [
          { kind: 'nation', side: 'south', field: 'supplyStock', delta: -40 },
          { kind: 'diplomacy', field: 'usCommitment', delta: 8 },
          { kind: 'flag', key: 'incheonPlan', value: 'incheon' },
        ],
      },
      {
        id: 'gunsan',
        label: '군산 상륙으로 계획을 바꾼다',
        description: '위험이 작은 군산에 상륙합니다. 북한군 배후 타격 효과는 작습니다.',
        isCounterfactual: true,
        effects: [
          { kind: 'nation', side: 'south', field: 'supplyStock', delta: -30 },
          { kind: 'flag', key: 'incheonPlan', value: 'gunsan' },
        ],
      },
      {
        id: 'none',
        label: '상륙을 보류하고 낙동강 정면 방어에 전념한다',
        description: '자원을 아끼지만 북한군 보급선은 그대로입니다. 반격 시점이 크게 늦어집니다.',
        isCounterfactual: true,
        effects: [
          { kind: 'nation', side: 'south', field: 'supplyStock', delta: 30 },
          { kind: 'flag', key: 'incheonPlan', value: 'none' },
        ],
      },
    ],
    effects: [],
    historicalContext: '맥아더 장군은 낙동강 전선의 북한군 배후를 치는 인천상륙작전을 주장했고, 작전은 1950년 9월 15일에 실행되었다. 군산 상륙 등 대안은 검토 과정에서 거론된 가상의 대안으로 다룬다.',
    historicalDate: '1950-09-15',
    source: `${SRC_APP}; ${SRC_KMA}`,
    needsVerification: true,
    isCounterfactual: false,
  },
  {
    id: 'incheon_landing',
    title: '인천상륙작전 — 작전 실행 확인',
    description:
      '작전 준비가 끝났습니다. 아래 확인 화면에서 투입 부대, 출발지, 전선 방어력 감소를 검토한 뒤 실행 여부를 결정하십시오. 실행하면 기존 부대가 출발지에서 실제로 차출되어 인천으로 이동하고, 외부 증원은 새로 편성됩니다.',
    earliestDate: '1950-09-15',
    latestDate: '1950-10-07',
    conditions: [{ kind: 'flagEquals', key: 'incheonPlan', value: 'incheon' }, { kind: 'owner', province: 'incheon', side: 'north' }],
    choices: [
      {
        id: 'execute',
        label: '상륙작전을 실행한다',
        description: '확인 화면의 구성대로 병력을 차출·편성하고 인천에 상륙합니다.',
        isCounterfactual: false,
        effects: [{ kind: 'landing', opId: 'incheon_landing' }],
      },
      {
        id: 'postpone',
        label: '작전을 1주 연기한다',
        description: '전황을 더 지켜봅니다. 다음 턴에 다시 결정해야 하며, 시간이 지체됩니다.',
        isCounterfactual: true,
        effects: [{ kind: 'postpone', eventId: 'incheon_landing' }],
      },
    ],
    effects: [],
    operation: 'incheon_landing',
    historicalContext: '1950년 9월 15일 UN군은 인천에 상륙했고 9월 28일경 서울을 수복했다. 이 게임에서 "11개 여단급(외부 도착 7 + 현지 차출 4)"은 가상의 작전 규모이며 실제 역사적 상륙부대 편제와 다르다.',
    historicalDate: '1950-09-15',
    source: `${SRC_APP}; ${SRC_KMA}`,
    needsVerification: true,
    isCounterfactual: false,
  },
  {
    id: 'gunsan_landing',
    title: '군산 상륙 (가상) — 작전 실행 확인',
    description: '대안으로 선택된 군산 상륙 작전입니다. 서울 방면 북한군 병참선에는 직접 타격이 되지 못하지만 위험은 더 작습니다. (이 사건은 실제로 일어나지 않았습니다.)',
    earliestDate: '1950-09-15',
    latestDate: '1950-10-07',
    conditions: [{ kind: 'flagEquals', key: 'incheonPlan', value: 'gunsan' }, { kind: 'owner', province: 'gunsan', side: 'north' }],
    choices: [
      { id: 'execute', label: '상륙작전을 실행한다', description: '확인 화면의 구성대로 군산에 상륙합니다.', isCounterfactual: true, effects: [{ kind: 'landing', opId: 'gunsan_landing' }] },
      { id: 'postpone', label: '작전을 1주 연기한다', description: '다음 턴에 다시 결정합니다.', isCounterfactual: true, effects: [{ kind: 'postpone', eventId: 'gunsan_landing' }] },
    ],
    effects: [],
    operation: 'gunsan_landing',
    historicalContext: '실제 역사에서는 군산 상륙이 실행되지 않았다. 이 사건은 선택지를 위한 가상 시나리오다.',
    historicalDate: '(가상)',
    source: '게임 내 가정(대체역사)',
    needsVerification: false,
    isCounterfactual: true,
  },
  {
    id: 'front_crisis',
    title: '남동부 전선 위기 (일반 방어전)',
    description: '낙동강 방어선과는 다른 형태의 전선에서 북한군이 대구·부산 등 후방 핵심 지역을 위협하고 있습니다. 예비대를 재배치하고 방어선을 정비해야 합니다.',
    earliestDate: '1950-08-05',
    latestDate: '1950-10-07',
    conditions: [
      { kind: 'owner', province: 'busan', side: 'south' },
      { kind: 'unitsNear', side: 'north', provinces: ['daegu', 'busan', 'masan', 'pohang', 'miryang', 'gyeongju', 'changnyeong'], min: 1, adjacent: true },
      { kind: 'not', cond: { kind: 'allOf', of: NAKTONG_LINE } },
      { kind: 'not', cond: { kind: 'eventFired', id: 'naktong_crisis' } },
    ],
    choices: [],
    effects: [
      { kind: 'units', side: 'south', area: ['daegu', 'busan', 'masan', 'pohang', 'miryang', 'gyeongju', 'changnyeong', 'gimhae'], organization: 6, recovery: 8 },
      { kind: 'nation', side: 'south', field: 'supplyStock', delta: 15 },
    ],
    historicalContext: '(게임 내 일반 사건) 실제 낙동강 방어선 사건과 구분되는, 현재 전황에 맞춘 방어전 이벤트다.',
    historicalDate: '(전황 연동)',
    source: '게임 내 전황 연동 이벤트',
    needsVerification: false,
    isCounterfactual: false,
  },
  {
    id: 'naktong_breakout',
    title: '낙동강 방어선 돌파·반격 개시',
    description:
      '북한군의 병참선과 조직이 한계에 달했습니다. 전선의 UN군과 국군이 일제히 반격에 나섭니다. 사기가 오른 아군과 달리 북한군은 보급이 끊기고 조직력이 무너지고 있습니다. 하지만 과도한 북진은 보급 문제와 중국의 개입 위험을 키운다는 점을 잊지 마십시오.',
    earliestDate: '1950-09-16',
    latestDate: '1950-10-07',
    conditions: [
      { kind: 'anyOf', of: [
        { kind: 'flagEquals', key: 'landingResult', value: 'success' },
        { kind: 'allOf', of: [{ kind: 'eventFired', id: 'naktong_crisis' }, { kind: 'dateAtLeast', date: '1950-09-26' }, { kind: 'owner', province: 'daegu', side: 'south' }] },
      ] },
    ],
    choices: [],
    effects: [
      { kind: 'units', side: 'south', area: 'all', morale: 15, organization: 8, recovery: 10 },
      { kind: 'units', side: 'north', area: PERIMETER, morale: -15, organization: -10 },
      { kind: 'interdiction', delta: 0.1 },
      { kind: 'flag', key: 'counteroffensive', value: true },
    ],
    historicalContext: '9월 16일 낙동강 전선에서 유엔군의 총반격이 시작되었고, 인천상륙작전과 맞물려 북한군은 급속히 퇴각했다.',
    historicalDate: '1950-09-16',
    source: `${SRC_APP}; ${SRC_KMA}`,
    needsVerification: false,
    isCounterfactual: false,
  },
  {
    id: 'seoul_recaptured',
    title: '서울 수복',
    description: '수도 서울이 다시 아군의 손에 들어왔습니다. 정부와 국민의 사기가 크게 오릅니다. 한강 이북으로 보급 거점도 옮길 수 있게 되었습니다.',
    earliestDate: '1950-09-25',
    latestDate: '1950-10-07',
    conditions: [{ kind: 'owner', province: 'seoul', side: 'south' }, { kind: 'flagSet', key: 'seoulLost' }, { kind: 'dateAtLeast', date: '1950-09-25' }],
    choices: [],
    effects: [
      { kind: 'nation', side: 'south', field: 'popularSupport', delta: 10 },
      { kind: 'diplomacy', field: 'unSupport', delta: 5 },
      { kind: 'flag', key: 'seoulHub', value: true },
      { kind: 'province', province: 'seoul', field: 'controlStability', delta: 10 },
    ],
    historicalContext: '서울은 9월 하순 수복되었다(정부의 환도는 9월 29일).',
    historicalDate: '1950-09-28',
    source: `${SRC_APP}; ${SRC_KMA}`,
    needsVerification: true,
    isCounterfactual: false,
  },
  {
    id: 'china_warning',
    title: '중국의 경고와 38선 월경 결정',
    description:
      '중국 지도부가 UN군이 38선을 넘으면 개입할 수 있다는 경고를 외교 경로로 전달했습니다. 38선 이북으로 진격하면 북한 체제를 무너뜨릴 수 있지만 중국군 참전의 위험이 크게 높아집니다. (이번 프로토타입 시나리오는 이 시점에서 종료되며, 중국군 참전은 후속 단계에서 구현됩니다.)',
    earliestDate: '1950-09-30',
    latestDate: '1950-10-07',
    conditions: [
      { kind: 'dateAtLeast', date: '1950-09-30' },
      { kind: 'ownerAny', provinces: ['geumcheon', 'haeju', 'cheorwon', 'gimhwa', 'hwacheon', 'inje', 'sokcho', 'goseong', 'pyeonggang', 'tongcheon', 'songnim', 'singye'], side: 'south', min: 1 },
    ],
    choices: [
      {
        id: 'cross',
        label: '38선 이북으로 진격한다',
        description: '북한군 완전 붕괴의 기회지만 중국 개입 위험이 크게 상승합니다.',
        isCounterfactual: false,
        effects: [
          { kind: 'diplomacy', field: 'chinaThreat', delta: 35 },
          { kind: 'flag', key: 'cross38', value: true },
        ],
      },
      {
        id: 'halt',
        label: '38선에서 정지하고 협상을 모색한다',
        description: '중국 개입 위험이 낮아지지만 북한군은 재편의 시간을 얻습니다.',
        isCounterfactual: true,
        effects: [
          { kind: 'diplomacy', field: 'chinaThreat', delta: -10 },
          { kind: 'flag', key: 'cross38', value: false },
        ],
      },
    ],
    effects: [{ kind: 'diplomacy', field: 'chinaThreat', delta: 20 }],
    historicalContext: '1950년 10월 초 중국 지도부는 인도 대사 등을 통해 UN군의 38선 이북 진격 시 개입할 수 있다는 경고를 전달했다. 한국군 일부는 10월 1일 38선을 넘었다.',
    historicalDate: '1950-10-03',
    source: `${SRC_APP}; ${SRC_KMA}`,
    needsVerification: true,
    isCounterfactual: false,
  },
  {
    id: 'phase1_review',
    title: '1단계 종료 — 전쟁은 계속된다',
    description: '1950년 6월 말부터 10월 초까지의 첫 국면이 끝났습니다. 전쟁은 여기서 끝나지 않습니다. 북진 여부에 따라 중국의 개입이 있을 수 있고, 그 뒤에는 교착과 정전협상의 시간이 이어집니다. 지금까지의 전황이 이후의 선택지를 결정합니다.',
    earliestDate: '1950-10-07',
    latestDate: '1950-10-31',
    conditions: [{ kind: 'dateAtLeast', date: '1950-10-07' }],
    choices: [],
    effects: [{ kind: 'nation', side: 'south', field: 'commandPoints', delta: 1 }],
    historicalContext: '1950년 10월 초 UN군과 국군은 38선 이북으로 진격하기 시작했고, 10월 19일경 중국 인민지원군이 압록강을 건너기 시작했다.',
    historicalDate: '1950-10-07',
    source: SRC_APP,
    needsVerification: true,
    isCounterfactual: false,
  },
  {
    id: 'china_intervention',
    title: '중국군 참전',
    description:
      '평양이 함락되자 압록강 너머에서 대규모 중국군이 야음을 틈타 이동해 들어왔습니다. 정찰되지 않은 병력이 능선을 따라 침투하고, 야간 공격과 측면 포위가 시작됩니다. 중국군은 숫자는 압도적이지만 포·대전차·차량이 부족하고 보급선이 길어, 지형과 화력 지원, 보급선 차단, 지연전으로 막을 수 있습니다.',
    earliestDate: '1950-06-25',
    latestDate: '1953-07-27',
    // 평양을 함락한 순간부터 2턴 뒤에 참전한다 (날짜가 아니라 실제 전황이 기준)
    conditions: [{ kind: 'flagTurnsAgo', key: 'pyongyangFallTurn', min: 2 }],
    choices: [],
    effects: [
      { kind: 'spawnPla', count: 18, label: '제1진', provinces: ['gangye', 'sinuiju', 'hyesan', 'huichon', 'unsan', 'jeongju', 'gusong'] },
      { kind: 'flag', key: 'plaIntervened', value: true },
      { kind: 'flagTurn', key: 'plaIntervenedTurn' },
      { kind: 'diplomacy', field: 'chinaThreat', delta: 25 },
      { kind: 'diplomacy', field: 'sovietSupport', delta: 10 },
      { kind: 'units', side: 'south', area: 'all', morale: -4 },
    ],
    historicalContext: '1950년 10월 19일경 중국 인민지원군이 압록강을 건너 한반도에 들어왔고, 10월 하순부터 UN군·국군과 교전했다. 이 게임에서 투입 규모와 편제는 가상의 밸런스 값이다.',
    historicalDate: '1950-10-19',
    source: `${SRC_APP}; ${SRC_KMA}`,
    needsVerification: true,
    isCounterfactual: false,
  },
  {
    id: 'china_second_offensive',
    title: '중국군 대공세',
    description: '중국군 후속 병력이 도착해 전 전선에서 대규모 공세에 들어갔습니다. 포위 위험이 커졌습니다. 전선 부대를 보존하며 단계적으로 물러나 보급선을 짧게 하고 지형을 이용하십시오.',
    earliestDate: '1950-06-25',
    latestDate: '1953-07-27',
    conditions: [{ kind: 'flagTurnsAgo', key: 'plaIntervenedTurn', min: 4 }],
    choices: [],
    effects: [
      { kind: 'spawnPla', count: 18, label: '제2진', provinces: ['gangye', 'sinuiju', 'hyesan', 'huichon', 'unsan', 'jeongju', 'gusong'] },
      { kind: 'units', side: 'south', area: 'all', morale: -3 },
    ],
    historicalContext: '1950년 11월 하순 중국군의 대규모 공세로 UN군은 전선 전반에서 후퇴했다. 정확한 시기와 규모는 자료에 따라 다르다.',
    historicalDate: '1950-11-25',
    source: SRC_APP,
    needsVerification: true,
    isCounterfactual: false,
  },
  {
    id: 'trench_warfare',
    title: '교착기 — 참호전과 고지전',
    description: '양측 모두 전선을 따라 참호와 방어시설을 구축했습니다. 이제 한 고지를 빼앗기 위해 큰 피를 흘려야 합니다. 전쟁 피로도가 쌓이고, 군사적 승리가 곧바로 국가 이익이 되지는 않습니다.',
    earliestDate: '1951-06-01',
    latestDate: '1951-12-31',
    conditions: [{ kind: 'dateAtLeast', date: '1951-06-01' }],
    choices: [],
    effects: [{ kind: 'fortifyFront', delta: 1 }, { kind: 'flag', key: 'trenchWar', value: true }, { kind: 'nation', side: 'south', field: 'popularSupport', delta: -2 }],
    historicalContext: '1951년 중반 이후 전선은 38선 일대에서 교착되었고 고지를 둘러싼 소모적 전투가 이어졌다.',
    historicalDate: '1951-06',
    source: SRC_KMA,
    needsVerification: true,
    isCounterfactual: false,
  },
  {
    id: 'armistice_talks',
    title: '정전협상 개시',
    description: '교전 당사자들이 협상 테이블에 앉을 것을 제안했습니다. 협상에 응하면 정전협상이 진행되며 시간이 지날수록(그리고 전쟁 피로가 쌓일수록) 타결에 가까워집니다. 거부하면 전쟁은 계속되지만 국민 지지가 흔들립니다.',
    earliestDate: '1951-07-10',
    latestDate: '1953-06-30',
    conditions: [{ kind: 'dateAtLeast', date: '1951-07-10' }],
    choices: [
      { id: 'accept', label: '정전협상에 응한다', description: '협상이 시작됩니다. 협상 진척도가 서서히 오르며 100%가 되면 정전이 타결됩니다.', isCounterfactual: false, effects: [{ kind: 'flag', key: 'talks', value: 'on' }, { kind: 'nation', side: 'south', field: 'popularSupport', delta: 2 }] },
      { id: 'refuse', label: '협상을 거부하고 공세를 계속한다', description: '국민 지지와 국제 지지가 떨어지고 전쟁 피로가 늘며, 얼마 뒤 협상 제안이 다시 올 것입니다.', isCounterfactual: true, effects: [{ kind: 'flag', key: 'talks', value: 'refused' }, { kind: 'diplomacy', field: 'unSupport', delta: -8 }, { kind: 'weariness', delta: 4 }, { kind: 'postpone', eventId: 'armistice_talks' }] },
    ],
    effects: [],
    historicalContext: '1951년 7월 정전회담이 시작되어 2년 넘게 이어졌고, 1953년 7월 27일 정전협정이 체결되었다.',
    historicalDate: '1951-07-10',
    source: SRC_KMA,
    needsVerification: true,
    isCounterfactual: false,
  },
  {
    id: 'general_mobilization',
    title: '국가 총동원령',
    description:
      '전선이 무너지고 후방이 위협받는 국가적 위기입니다. 총동원령을 발동하면 기존 여단급 부대가 모두 1:1로 사단급으로 전환됩니다(부대 수·주둔 위치·전투 경험·이력은 그대로). 징병 가능 인구에서 긴급 동원병을 즉시 충원하지만, 이들은 훈련·장비·조직력이 부족해 처음에는 전투력이 크게 오르지 않습니다. 장비는 저절로 늘지 않으며 군수 생산에 의존합니다. 소모한 징병 자원은 이후 일반 징집에서 다시 쓸 수 없습니다. 남한의 총동원령에 맞서 북한군도 같은 시점에 자체 총동원령을 발동해 조선인민군 여단급 부대가 사단급으로 확대됩니다.',
    earliestDate: '1950-07-10',
    latestDate: '1953-07-27',
    conditions: [
      { kind: 'flagUnset', key: 'mobilized' },
      { kind: 'anyOf', of: [
        // (1) 낙동강 방어선이 실제로 형성된 전황 (낙동강 이벤트와 연계하되 별도 이벤트)
        { kind: 'allOf', of: NAKTONG_LINE },
        // (2) 국군의 주요 전선 후퇴 + 핵심 후방(대구·부산)이 위협받거나 전쟁수행능력 저하
        { kind: 'allOf', of: [
          { kind: 'provincesLostAtLeast', side: 'south', min: 15 },
          { kind: 'anyOf', of: [
            { kind: 'unitsNear', side: 'north', provinces: ['daegu', 'busan', 'masan', 'pohang', 'miryang', 'gyeongju', 'changnyeong', 'waegwan'], min: 1, adjacent: true },
            { kind: 'warCapacityBelow', side: 'south', value: 70 },
          ] },
        ] },
        // (3) 대체역사: 낙동강과 무관한 곳에서 국가적 위기가 심각한 경우 (어느 지역이든 발동)
        { kind: 'allOf', of: [{ kind: 'provincesLostAtLeast', side: 'south', min: 25 }, { kind: 'warCapacityBelow', side: 'south', value: 55 }] },
      ] },
    ],
    choices: [
      {
        id: 'execute',
        label: '총동원령을 발동한다',
        description: '여단급 부대 전부를 사단급으로 전환하고 긴급 동원병을 충원합니다. 북한군도 같은 시점에 자체 총동원령을 발동해 확전합니다. 징병 자원이 부족하면 결원 있는 사단으로 남습니다. (게임상 조작 단위 변경)',
        isCounterfactual: false,
        // 국군이 총동원령을 내리는 순간 북한군도 같은 시점에 자체 총동원령을 발동한다 (균형)
        effects: [{ kind: 'mobilize', profile: 'rok' }, { kind: 'mobilize', profile: 'kpa' }],
      },
      {
        id: 'postpone',
        label: '발동을 1턴 보류한다',
        description: '전황을 더 지켜봅니다. 다음 턴에 다시 결정해야 합니다.',
        isCounterfactual: true,
        effects: [{ kind: 'postpone', eventId: 'general_mobilization' }],
      },
    ],
    effects: [],
    mobilization: 'rok',
    historicalContext:
      '실제 1950년 국군은 이미 사단 편제로 운용되었다. 이 이벤트의 "여단→사단 전환"은 역사적 사단 창설을 그대로 재현하는 것이 아니라, 이 게임의 조작 단위와 긴급 동원 체계를 바꾸는 게임 설계이다. 병력·장비·훈련 수치는 모두 게임 밸런스용 값이다.',
    historicalDate: '(게임 설계)',
    source: '게임 내 설계 (실제 역사적 동원 통계 아님)',
    needsVerification: false,
    isCounterfactual: false,
  },
  {
    id: 'casualty_report_seoul',
    title: '국가 사상자 보고 — 수도 함락',
    description: '수도 서울을 잃었습니다. 지금까지의 국가 전체 사상자 현황을 보고합니다.',
    earliestDate: '1950-06-25', latestDate: '1953-07-27',
    conditions: [{ kind: 'flagSet', key: 'seoulLost' }],
    choices: [], effects: [], casualtyReport: true,
    historicalContext: '(게임 내 보고) 이 보고의 숫자는 실제 전투 손실을 합산한 결과이며 역사적 통계가 아닙니다.',
    historicalDate: '(전황 연동)', source: '게임 내 집계', needsVerification: false, isCounterfactual: false,
  },
  {
    id: 'casualty_report_mobilization',
    title: '국가 사상자 보고 — 총동원령 이후',
    description: '총동원령이 발동되었습니다. 동원 직후의 국가 전체 손실과 병력 현황입니다.',
    earliestDate: '1950-07-10', latestDate: '1953-07-27',
    conditions: [{ kind: 'eventFired', id: 'general_mobilization' }, { kind: 'flagSet', key: 'mobilized' }],
    choices: [], effects: [], casualtyReport: true,
    historicalContext: '(게임 내 보고) 이 보고의 숫자는 실제 전투 손실을 합산한 결과이며 역사적 통계가 아닙니다.',
    historicalDate: '(전황 연동)', source: '게임 내 집계', needsVerification: false, isCounterfactual: false,
  },
  {
    id: 'casualty_report_naktong',
    title: '국가 사상자 보고 — 낙동강 방어전',
    description: '낙동강 방어전이 시작되었습니다. 지금까지의 국가 전체 사상자 현황을 보고합니다.',
    earliestDate: '1950-08-05', latestDate: '1953-07-27',
    conditions: [{ kind: 'eventFired', id: 'naktong_crisis' }],
    choices: [], effects: [], casualtyReport: true,
    historicalContext: '(게임 내 보고) 이 보고의 숫자는 실제 전투 손실을 합산한 결과이며 역사적 통계가 아닙니다.',
    historicalDate: '(전황 연동)', source: '게임 내 집계', needsVerification: false, isCounterfactual: false,
  },
  {
    id: 'casualty_report_landing',
    title: '국가 사상자 보고 — 상륙작전 이후',
    description: '상륙작전이 종료되었습니다. 작전 직후의 국가 전체 사상자 현황을 보고합니다.',
    earliestDate: '1950-09-15', latestDate: '1953-07-27',
    conditions: [{ kind: 'flagSet', key: 'landingResult' }],
    choices: [], effects: [], casualtyReport: true,
    historicalContext: '(게임 내 보고) 이 보고의 숫자는 실제 전투 손실을 합산한 결과이며 역사적 통계가 아닙니다.',
    historicalDate: '(전황 연동)', source: '게임 내 집계', needsVerification: false, isCounterfactual: false,
  },
  {
    id: 'casualty_report_china',
    title: '국가 사상자 보고 — 중국군 대공세 이후',
    description: '중국군의 대규모 공세가 이어졌습니다. 지금까지의 국가 전체 사상자 현황을 보고합니다.',
    earliestDate: '1950-09-01', latestDate: '1953-07-27',
    conditions: [{ kind: 'flagTurnsAgo', key: 'plaIntervenedTurn', min: 6 }],
    choices: [], effects: [], casualtyReport: true,
    historicalContext: '(게임 내 보고) 이 보고의 숫자는 실제 전투 손실을 합산한 결과이며 역사적 통계가 아닙니다.',
    historicalDate: '(전황 연동)', source: '게임 내 집계', needsVerification: false, isCounterfactual: false,
  },
  {
    id: 'casualty_report_talks',
    title: '국가 사상자 보고 — 정전협상',
    description: '정전협상이 진행되고 있습니다. 협상 시점까지의 국가 전체 사상자 현황을 보고합니다.',
    earliestDate: '1951-07-10', latestDate: '1953-07-27',
    conditions: [{ kind: 'eventFired', id: 'armistice_talks' }, { kind: 'flagEquals', key: 'talks', value: 'on' }],
    choices: [], effects: [], casualtyReport: true,
    historicalContext: '(게임 내 보고) 이 보고의 숫자는 실제 전투 손실을 합산한 결과이며 역사적 통계가 아닙니다.',
    historicalDate: '(전황 연동)', source: '게임 내 집계', needsVerification: false, isCounterfactual: false,
  },
];

export const EVENT_BY_ID: Record<string, HistoricalEvent> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
