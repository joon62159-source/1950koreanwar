import type { Condition, HistoricalEvent } from './events';

/**
 * 전황 연동 스토리 이벤트.
 * 날짜가 아니라 실제 전투 결과·점령 상태에 반응한다 (예: 수도방어전의 승패에 따라 다른 이벤트가 뜬다).
 * 연출 문구는 eventNarrative.ts 에 있다.
 */

const BEGIN = '1950-06-25';
const END = '1953-07-27';
const YALU = ['sinuiju', 'hyesan', 'gangye', 'musan', 'hoeryong'];

function story(
  id: string,
  title: string,
  description: string,
  conditions: Condition[],
  effects: HistoricalEvent['effects'],
  window: [string, string] = [BEGIN, END],
): HistoricalEvent {
  return {
    id,
    title,
    description,
    earliestDate: window[0],
    latestDate: window[1],
    conditions,
    choices: [],
    effects,
    historicalContext: '',
    historicalDate: '(전황 연동)',
    source: '',
    needsVerification: false,
    isCounterfactual: false,
  };
}

const SEOUL_AREA = ['seoul', 'uijeongbu', 'gimpo', 'dongducheon', 'paju'];

export const STORY_EVENTS: HistoricalEvent[] = [
  story(
    'macarthur_arrives',
    '맥아더 장군, 한강 전선에 서다',
    'UN군 총사령관이 직접 전선을 시찰했습니다. 장병들은 구원이 오고 있다는 확신을 얻었고, 미국의 개입 의지도 한층 분명해졌습니다.',
    [{ kind: 'eventFired', id: 'kpa_invasion' }],
    [
      { kind: 'units', side: 'south', area: 'all', morale: 6 },
      { kind: 'nation', side: 'south', field: 'popularSupport', delta: 3 },
      { kind: 'diplomacy', field: 'usCommitment', delta: 6 },
    ],
    ['1950-06-29', '1950-07-13'],
  ),
  story(
    'seoul_defense_held',
    '수도방어전 — 서울을 지켜냈다',
    '북한군의 첫 서울 공격이 격퇴되었습니다. 수도는 아직 우리 손에 있습니다. 장병과 시민의 사기가 크게 오르고 적은 전열을 가다듬어야 합니다.',
    [{ kind: 'flagEquals', key: 'seoulBattle', value: 'held' }],
    [
      { kind: 'units', side: 'south', area: SEOUL_AREA, morale: 12, organization: 5 },
      { kind: 'units', side: 'north', area: SEOUL_AREA, morale: -8, organization: -8, fatigue: 8 },
      { kind: 'nation', side: 'south', field: 'popularSupport', delta: 5 },
      { kind: 'province', province: 'seoul', field: 'fortification', delta: 1 },
    ],
  ),
  story(
    'seoul_fall_battle',
    '수도방어전 패배 — 서울 함락',
    '서울 방어선이 돌파되었습니다. 수도가 적의 손에 넘어갔습니다. 정부와 국민의 충격은 이루 말할 수 없고, 후퇴하는 부대는 한강 이남에서 다시 전열을 세워야 합니다.',
    [{ kind: 'flagEquals', key: 'seoulBattle', value: 'fell' }, { kind: 'owner', province: 'seoul', side: 'north' }],
    [
      { kind: 'units', side: 'south', area: 'all', morale: -7 },
      { kind: 'nation', side: 'south', field: 'popularSupport', delta: -10 },
      { kind: 'units', side: 'north', area: SEOUL_AREA, morale: 8 },
    ],
  ),
  story(
    'seoul_fall',
    '서울 함락',
    '서울이 적의 손에 떨어졌습니다. 수도를 잃은 충격이 전군과 후방을 흔듭니다.',
    [
      { kind: 'flagSet', key: 'seoulLost' },
      { kind: 'owner', province: 'seoul', side: 'north' },
      { kind: 'anyOf', of: [{ kind: 'flagUnset', key: 'seoulBattle' }, { kind: 'flagEquals', key: 'seoulBattle', value: 'held' }] },
    ],
    [
      { kind: 'units', side: 'south', area: 'all', morale: -6 },
      { kind: 'nation', side: 'south', field: 'popularSupport', delta: -9 },
    ],
  ),
  story(
    'daejeon_fall',
    '대전 함락',
    '임시 수도 방어의 요충 대전이 무너졌습니다. 남쪽으로 이어지는 도로가 열려 낙동강까지 전선이 밀려납니다. 지연전이 끝나가고 있습니다.',
    [{ kind: 'owner', province: 'daejeon', side: 'north' }],
    [
      { kind: 'units', side: 'south', area: 'all', morale: -4 },
      { kind: 'nation', side: 'south', field: 'popularSupport', delta: -4 },
      { kind: 'units', side: 'north', area: 'all', morale: 4 },
    ],
  ),
  story(
    'incheon_success',
    '인천상륙 성공',
    '상륙부대가 교두보를 확보했습니다. 적의 후방이 열렸고 보급로가 위협받습니다. 전쟁의 흐름이 바뀌기 시작했습니다.',
    [{ kind: 'flagSet', key: 'incheonHub' }],
    [
      { kind: 'nation', side: 'south', field: 'popularSupport', delta: 8 },
      { kind: 'diplomacy', field: 'unSupport', delta: 5 },
      { kind: 'units', side: 'south', area: 'all', morale: 8 },
      { kind: 'units', side: 'north', area: 'all', morale: -8, organization: -6 },
    ],
  ),
  story(
    'incheon_failure',
    '상륙작전 실패',
    '상륙부대가 해안에서 막혔습니다. 큰 손실을 입고 후퇴했고, 이 작전에 건 기대가 컸던 만큼 충격도 큽니다.',
    [{ kind: 'flagEquals', key: 'landingResult', value: 'failure' }],
    [
      { kind: 'units', side: 'south', area: 'all', morale: -6 },
      { kind: 'nation', side: 'south', field: 'popularSupport', delta: -5 },
      { kind: 'diplomacy', field: 'unSupport', delta: -3 },
    ],
  ),
  story(
    'bloody_battle',
    '혈투 — 전선이 갈려 나간다',
    '양군 합쳐 20개 부대 이상이 한 지역에서 맞붙었습니다. 전투는 이틀 밤낮을 이어졌고 들것과 구급차가 쉴 새 없이 오갑니다. 이 전투가 남긴 상처는 오래갑니다.',
    [{ kind: 'flagSet', key: 'bloodyBattle' }],
    [
      { kind: 'weariness', delta: 3 },
      { kind: 'nation', side: 'south', field: 'popularSupport', delta: -2 },
    ],
  ),
  story(
    'pyongyang_fall',
    '평양 함락',
    '북한의 수도 평양이 아군의 손에 들어왔습니다. 북한 지도부는 북쪽 산악 지대로 물러났고 전쟁이 끝나는 듯 보입니다. 그러나 압록강 너머의 반응이 걱정됩니다.',
    [{ kind: 'owner', province: 'pyongyang', side: 'south' }, { kind: 'flagSet', key: 'pyongyangFallTurn' }],
    [
      { kind: 'nation', side: 'south', field: 'popularSupport', delta: 6 },
      { kind: 'nation', side: 'north', field: 'popularSupport', delta: -8 },
      { kind: 'units', side: 'north', area: 'all', morale: -8 },
      { kind: 'diplomacy', field: 'chinaThreat', delta: 10 },
    ],
  ),
  story(
    'yalu_reached',
    '압록강에 닿다',
    '선두 부대가 압록강변에 도달했습니다. 눈앞에 국경의 강이 흐릅니다. 이 한 걸음이 전쟁을 끝낼지, 더 큰 전쟁을 부를지 아무도 모릅니다.',
    [{ kind: 'unitsNear', side: 'south', provinces: YALU, min: 1 }],
    [
      { kind: 'nation', side: 'south', field: 'popularSupport', delta: 5 },
      { kind: 'diplomacy', field: 'chinaThreat', delta: 15 },
      { kind: 'units', side: 'south', area: 'all', morale: 5 },
    ],
  ),
  story(
    'seoul_second_fall',
    '서울 재함락',
    '탈환했던 서울을 다시 잃었습니다. 얼어붙은 한강 위로 피난민이 남쪽으로 걷습니다. 같은 비극을 두 번 겪는 도시의 침묵이 무겁습니다.',
    [{ kind: 'eventFired', id: 'seoul_recaptured' }, { kind: 'owner', province: 'seoul', side: 'north' }],
    [
      { kind: 'units', side: 'south', area: 'all', morale: -6 },
      { kind: 'nation', side: 'south', field: 'popularSupport', delta: -8 },
      { kind: 'weariness', delta: 3 },
    ],
  ),
];
