import type { Condition, EventChoice, HistoricalEvent } from './events';
import { NUKE } from '../game/balance';

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
  choices: EventChoice[] = [],
): HistoricalEvent {
  return {
    id,
    title,
    description,
    earliestDate: window[0],
    latestDate: window[1],
    conditions,
    choices,
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
    ],
  ),
  story(
    'yalu_reached',
    '압록강에 닿다',
    '선두 부대가 압록강변에 도달했습니다. 눈앞에 국경의 강이 흐릅니다. 이 한 걸음이 전쟁을 끝낼지, 더 큰 전쟁을 부를지 아무도 모릅니다.',
    [{ kind: 'unitsNear', side: 'south', provinces: YALU, min: 1 }],
    [
      { kind: 'nation', side: 'south', field: 'popularSupport', delta: 5 },
      { kind: 'units', side: 'south', area: 'all', morale: 5 },
    ],
  ),
  // ── 38선 월경 이후: 첩보 (중공군이 압록강 너머에 쌓이는 동안) ──
  story(
    'pla_intel_start',
    '첩보: 중공군의 집결 개시',
    '38선을 넘은 직후, 압록강 북안의 정보원들이 같은 내용을 타전했습니다. 만주의 철도역마다 불 꺼진 열차가 들어오고, 야음에 내린 부대들이 숲 속으로 사라집니다. 지도 위쪽의 중국 영내에 사단들이 하나둘 늘어갑니다. 이 병력이 압록강을 건너오는 순간이 이 전쟁의 분기점입니다. 시간이 많지 않습니다.',
    [{ kind: 'flagSet', key: 'plaStageStarted' }, { kind: 'flagUnset', key: 'plaIntervened' }],
    [],
  ),
  story(
    'pla_intel_mid',
    '첩보: 압록강 북안에 대규모 병력',
    '정찰기가 압록강 북안의 숲에서 겹겹이 쳐진 위장망과 천막을 포착했습니다. 집결 규모가 절반을 넘었습니다. 지금 속도라면 곧 강을 건널 병력이 모입니다. 선두 부대가 어디까지 가 있느냐가 이 전쟁의 결말을 가릅니다.',
    [{ kind: 'flagSet', key: 'plaStageMid' }, { kind: 'flagUnset', key: 'plaIntervened' }],
    [],
  ),
  story(
    'pla_intel_imminent',
    '첩보: 도하 임박',
    '압록강 북안의 불빛이 하루 사이에 사라졌습니다. 야간 도하를 준비하는 징후입니다. 첩보는 일주일 안에 강을 건널 것이라고 전합니다. 전선을 정비하고 보급선을 점검할 마지막 시간입니다.',
    [{ kind: 'flagSet', key: 'plaImminent' }, { kind: 'flagUnset', key: 'plaIntervened' }],
    [],
  ),
  story(
    'cross_final_decision',
    '최종 결정 — 38선에서 정전할 것인가, 넘을 것인가',
    '38선에서 멈춘 지 두 달이 지났습니다. 북한군은 전열을 정비했고 중국은 여전히 압록강 너머를 지켜봅니다. 지금 협상에 나서면 38선 부근에서 비교적 빨리 전쟁을 끝낼 수 있습니다. 그러나 북한 체제를 무너뜨리고 통일을 이룰 기회는 사라집니다. 38선을 넘으면 중국의 개입을 각오해야 합니다.',
    [{ kind: 'flagEquals', key: 'crossPhase', value: 'banned' }, { kind: 'flagDateReached', key: 'banUntil' }],
    [],
    [BEGIN, END],
    [
      {
        id: 'armistice',
        label: '38선에서 정전협상을 시작한다',
        description: '협상이 곧바로 시작되어 약 12턴 안에 타결됩니다. 이른 정전은 평가 점수에 상한이 있습니다. 이후 38선을 넘을 수 없습니다.',
        isCounterfactual: false,
        effects: [{ kind: 'earlyArmistice' }],
      },
      {
        id: 'cross',
        label: '38선을 넘는다',
        description: '북진을 시작하면 중공군이 압록강 너머에 집결하고, 정해진 시간 뒤 참전합니다. 그 안에 최대한 올라가야 합니다.',
        isCounterfactual: false,
        effects: [{ kind: 'crossDeclare' }],
      },
    ],
  ),
  story(
    'nuclear_debate',
    '만주에 핵을? — 사령관의 주장',
    '전선의 교착이 이어지자 UN군 총사령관이 만주의 중국군 기지와 보급 거점에 핵을 투하해야 한다고 공개적으로 주장했습니다. 워싱턴은 결정을 앞두고 있습니다. 핵을 쓰면 중국군은 회복할 수 없는 타격을 입겠지만 소련이 개입할 수 있고, 전쟁이 세계대전으로 번질 위험이 있습니다.',
    [{ kind: 'flagSet', key: 'plaIntervened' }],
    [],
    ['1951-06-01', '1951-06-30'],
    [
      {
        id: 'drop',
        label: '핵을 투하한다',
        description: '만주의 중국군이 큰 타격을 입고 회복·보충을 받지 못합니다. 그러나 40% 확률로 소련이 60개 사단을 보내 참전하고, 이후 세계대전으로 확대될 수 있습니다. 국제 여론도 크게 악화됩니다.',
        isCounterfactual: true,
        effects: [
          { kind: 'nuke' },
          { kind: 'chance', p: NUKE.sovietChance, then: [{ kind: 'flag', key: 'sovietPending', value: true }] },
        ],
      },
      {
        id: 'refuse',
        label: '투하를 거부한다',
        description: '전황은 현상 유지됩니다. 총사령관은 명령 불복종 논란 끝에 해임됩니다.',
        isCounterfactual: false,
        effects: [
          { kind: 'flag', key: 'macarthurFired', value: true },
          { kind: 'diplomacy', field: 'unSupport', delta: 4 },
        ],
      },
    ],
  ),
  story(
    'macarthur_relieved',
    '맥아더 해임',
    '핵 투하를 거부한 대통령은 끝내 총사령관을 해임했습니다. 전선 지휘부와 군 안팎이 크게 동요합니다.',
    [{ kind: 'flagSet', key: 'macarthurFired' }],
    [
      { kind: 'units', side: 'south', area: 'all', morale: -4 },
      { kind: 'nation', side: 'south', field: 'popularSupport', delta: -2 },
    ],
  ),
  story(
    'nuclear_aftermath',
    '만주의 버섯구름',
    '핵이 투하되었습니다. 만주의 중국군 기지가 순식간에 사라졌고 중국군은 더 이상 병력을 회복하거나 보충받을 수 없습니다. 세계가 충격에 빠졌고 UN의 지지도 흔들립니다.',
    [{ kind: 'flagSet', key: 'nukeUsed' }],
    [
      { kind: 'diplomacy', field: 'unSupport', delta: -18 },
      { kind: 'weariness', delta: -2 },
    ],
  ),
  story(
    'soviet_intervention',
    '소련군 참전',
    '핵 투하에 대한 보복으로 소련이 극동 군관구의 60개 사단을 투입했습니다. 만주와 북한 국경 지대로 소련군이 쏟아져 내려옵니다. 이 전쟁은 더 이상 한반도의 전쟁이 아닙니다.',
    [{ kind: 'flagSet', key: 'sovietPending' }],
    [
      { kind: 'sovietJoin', count: NUKE.sovietDivisions, label: '극동군' },
      { kind: 'diplomacy', field: 'sovietSupport', delta: 25 },
      { kind: 'flag', key: 'sovietIntervened', value: true },
      { kind: 'flagTurn', key: 'sovietTurn' },
    ],
  ),
  story(
    'world_war_risk',
    '세계대전의 문턱',
    '소련군이 참전하자 양 진영의 지도부는 전면전의 갈림길에 섰습니다. 확전하면 전 세계가 전쟁에 휘말립니다. 한 걸음 물러서면 협상의 문이 열립니다.',
    [{ kind: 'flagTurnsAgo', key: 'sovietTurn', min: 3 }],
    [],
    [BEGIN, END],
    [
      {
        id: 'escalate',
        label: '확전을 선택한다',
        description: '전쟁이 세계대전으로 번져 게임이 끝납니다.',
        isCounterfactual: true,
        effects: [{ kind: 'flag', key: 'worldWar', value: true }],
      },
      {
        id: 'deescalate',
        label: '확전을 막고 협상에 나선다',
        description: '정전협상이 시작되고 국제 지지가 오르지만 국민 지지는 하락합니다.',
        isCounterfactual: true,
        effects: [
          { kind: 'flag', key: 'talks', value: 'on' },
          { kind: 'diplomacy', field: 'unSupport', delta: 8 },
          { kind: 'nation', side: 'south', field: 'popularSupport', delta: -4 },
        ],
      },
    ],
  ),
  // ── 중국군 공세: 인해전술 (훈련도·조직력은 낮지만 숫자가 압도적). 핵 투하 이후에는 일어나지 않는다 ──
  story(
    'pla_new_year_offensive',
    '중국군 신정 공세',
    '새해 전야, 중국군이 전 전선에서 다시 공세에 나섰습니다. 포와 차량은 부족해도 파도처럼 밀려드는 보병이 눈 덮인 능선을 넘습니다. 훈련도와 조직력은 낮지만 병력이 너무 많아 한 곳을 막으면 다른 곳이 뚫립니다.',
    [{ kind: 'flagSet', key: 'plaIntervened' }, { kind: 'flagUnset', key: 'nukeUsed' }, { kind: 'flagTurnsAgo', key: 'plaIntervenedTurn', min: 7 }],
    [
      { kind: 'spawnPla', count: 12, label: '신정공세군', provinces: ['gangye', 'sinuiju', 'hyesan', 'huichon', 'unsan', 'jeongju', 'gusong'], mass: true },
      { kind: 'plaOffensive', turns: 3 },
      { kind: 'units', side: 'south', area: 'all', morale: -4 },
    ],
    ['1950-12-28', '1951-02-10'],
  ),
  story(
    'pla_spring_offensive',
    '중국군 춘계 공세',
    '얼었던 땅이 녹자 중국군이 대규모 춘계 공세를 시작했습니다. 압록강 너머에서 새 사단들이 끝없이 내려오고, 야간 돌파와 측면 포위가 전선 곳곳에서 동시에 일어납니다. 숫자는 압도적이지만 이들은 훈련이 짧고 보급이 길어 오래 버티지 못합니다. 막아낸 곳에서 반격의 기회가 열립니다.',
    [{ kind: 'flagSet', key: 'plaIntervened' }, { kind: 'flagUnset', key: 'nukeUsed' }],
    [
      { kind: 'spawnPla', count: 10, label: '춘계공세군', provinces: ['gangye', 'sinuiju', 'hyesan', 'huichon', 'unsan', 'jeongju', 'gusong'], mass: true },
      { kind: 'plaOffensive', turns: 3 },
      { kind: 'units', side: 'south', area: 'all', morale: -4 },
    ],
    ['1951-04-22', '1951-05-20'],
  ),
  story(
    'pla_may_offensive',
    '중국군 5월 공세',
    '춘계 공세가 꺾인 직후 중국군이 동부 전선에 다시 병력을 쏟아부었습니다. 지친 병력을 교대한 새 사단들이 산악 지대로 밀려 내려옵니다. 이 파도를 넘기면 전선은 38선 일대에서 굳어질 것입니다.',
    [{ kind: 'flagSet', key: 'plaIntervened' }, { kind: 'flagUnset', key: 'nukeUsed' }, { kind: 'eventFired', id: 'pla_spring_offensive' }],
    [
      { kind: 'spawnPla', count: 6, label: '5월공세군', provinces: ['gangye', 'sinuiju', 'hyesan', 'huichon', 'unsan', 'jeongju', 'gusong'], mass: true },
      { kind: 'plaOffensive', turns: 2 },
      { kind: 'units', side: 'south', area: 'all', morale: -2 },
    ],
    ['1951-05-16', '1951-06-20'],
  ),
  story(
    'pla_autumn_offensive',
    '중국군 추계 고지 공세',
    '가을, 교착된 전선의 고지들을 둘러싸고 중국군이 대규모 공세를 걸어왔습니다. 갱도에서 나온 병력이 포격 속에서 고지로 올라옵니다. 한 고지를 지키는 데 몇 개 대대가 사라집니다.',
    [{ kind: 'flagSet', key: 'plaIntervened' }, { kind: 'flagUnset', key: 'nukeUsed' }],
    [
      { kind: 'spawnPla', count: 4, label: '추계공세군', provinces: ['gangye', 'sinuiju', 'hyesan', 'huichon', 'unsan', 'jeongju', 'gusong'], mass: true },
      { kind: 'plaOffensive', turns: 2 },
      { kind: 'units', side: 'south', area: 'all', morale: -2 },
    ],
    ['1952-10-10', '1952-11-15'],
  ),
  story(
    'geoje_pow_release',
    '거제도 — 반공 포로 석방',
    '거제도 포로수용소에는 송환을 거부하는 반공 포로가 수만 명 있습니다. 정전협정 서명이 가까워지자 대통령은 이들을 협정과 상관없이 석방하겠다고 선언했습니다. 석방하면 국민의 지지를 얻지만 협상은 틀어지고 동맹국의 신뢰를 잃습니다. 따르지 않으면 협상은 순조롭지만 포로들의 운명은 돌아올 수 없는 곳으로 넘어갑니다.',
    [{ kind: 'flagEquals', key: 'talks', value: 'on' }],
    [],
    ['1953-05-20', '1953-07-10'],
    [
      {
        id: 'release',
        label: '반공 포로를 석방한다',
        description: '수용소 철조망이 열리고 약 2만 7천 명이 풀려납니다. 국민 지지가 크게 오르지만 정전협상은 크게 후퇴하고 UN 지지와 미국 개입도가 떨어집니다. 중국군이 보복 공세에 나설 수 있습니다.',
        isCounterfactual: false,
        effects: [
          { kind: 'flag', key: 'powReleased', value: true },
          { kind: 'nation', side: 'south', field: 'popularSupport', delta: 8 },
          { kind: 'diplomacy', field: 'unSupport', delta: -7 },
          { kind: 'diplomacy', field: 'usCommitment', delta: -8 },
          { kind: 'weariness', delta: -3 },
          { kind: 'armisticeSet', delta: -15 },
          { kind: 'plaOffensive', turns: 2 },
        ],
      },
      {
        id: 'comply',
        label: '협정에 따라 송환 절차를 따른다',
        description: '포로 문제를 협정 절차에 맡깁니다. 협상은 순조롭게 진척되고 UN 지지가 오르지만, 포로 가족과 국민의 반발로 국민 지지가 떨어집니다.',
        isCounterfactual: false,
        effects: [
          { kind: 'flag', key: 'powKept', value: true },
          { kind: 'nation', side: 'south', field: 'popularSupport', delta: -6 },
          { kind: 'diplomacy', field: 'unSupport', delta: 6 },
          { kind: 'armisticeSet', delta: 12 },
        ],
      },
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

/** 날씨·계절 알림 이벤트: 장마(7월), 혹한 예보(11월 하순)와 시작(12월), 해빙기(3월). 효과 자체는 src/game/weather.ts 가 날짜로 적용한다. */
for (const y of [1950, 1951, 1952]) {
  STORY_EVENTS.push(
    story(`weather_monsoon_${y}`, '장마가 시작되었다', '장마철이 시작되었습니다. 비로 도로가 진창이 되어 이동과 보급이 느려지고, 부상병 회복이 더뎌집니다. 8월 중순까지 이어집니다.', [{ kind: 'dateAtLeast', date: `${y}-07-01` }], [], [`${y}-07-01`, `${y}-07-16`]),
    story(`weather_cold_warning_${y}`, '혹한 예보', '시베리아 한랭 기단이 내려와 곧 영하 20도 안팎의 혹한이 시작됩니다. 보급이 약한 부대는 겨울을 나기 어렵습니다. 보급선과 전진 보급소를 점검하십시오.', [{ kind: 'dateAtLeast', date: `${y}-11-22` }], [], [`${y}-11-22`, `${y}-12-01`]),
    story(`weather_cold_${y}`, '혹한이 시작되었다', '혹한이 시작되었습니다. 이동이 둔해지고 공격력이 떨어지며, 보급이 약한 부대는 동상과 질병으로 병력을 잃습니다. 2월 말까지 이어집니다.', [{ kind: 'dateAtLeast', date: `${y}-12-01` }], [], [`${y}-12-01`, `${y}-12-16`]),
  );
}
for (const y of [1951, 1952, 1953]) {
  STORY_EVENTS.push(
    story(`weather_thaw_${y}`, '해빙기', '얼었던 땅이 녹으면서 길이 질척해졌습니다. 이동과 보급이 크게 느려집니다. 4월 초까지 이어집니다.', [{ kind: 'dateAtLeast', date: `${y}-03-10` }], [], [`${y}-03-10`, `${y}-03-25`]),
  );
}
