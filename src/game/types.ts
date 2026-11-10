// 게임 전체에서 쓰는 타입 정의. 로직은 순수 함수로 분리되어 있으며 상태는 직렬화 가능한 객체로만 구성한다.

export type Side = 'south' | 'north';
export type Faction = 'ROK' | 'UN' | 'KPA' | 'PLA';
export type Terrain = 'plain' | 'paddy' | 'hills' | 'mountain' | 'urban' | 'river' | 'coastal';

export type EquipKey = 'rifles' | 'machineGuns' | 'mortars' | 'artillery' | 'antiTank' | 'tanks' | 'vehicles';
export type Equip = Record<EquipKey, number>;
export const EQUIP_KEYS: EquipKey[] = ['rifles', 'machineGuns', 'mortars', 'artillery', 'antiTank', 'tanks', 'vehicles'];

/** 수치 신뢰도: verified=공식 자료로 확인, estimated=추정치, game=게임 밸런스용 임의값 */
export type DataQuality = 'verified' | 'estimated' | 'game';

export interface Province {
  id: string;
  name: string;
  historicalName: string;
  geographicalRegion: string;
  initialOwner: Side;
  owner: Side;
  population: number;
  /** 징병 대상 인구(전체): 인구 × 징병 비율. 전쟁 피해·피란으로 인구가 줄면 함께 줄어든다 */
  draftEligible: number;
  /** 이미 징집된 인구 (줄어들지 않는다: 부상병 복귀 등은 새 징집이 아님) */
  drafted: number;
  /** 남은 징병 가능 인구 = 징병 대상 - 이미 징집 */
  recruitablePopulation: number;
  /** 산업 능력 0~100 (현재) */
  industrialCapacity: number;
  industrialBase: number;
  /** 일일 장비 생산 점수 (산업·안정도·피해 반영, 표시용 계산값) */
  equipmentProduction: number;
  infrastructure: number;
  terrain: Terrain;
  roadConnections: string[];
  railwayConnections: string[];
  seaConnections: string[];
  portCapacity: number;
  fortification: number; // 0~5
  warDamage: number; // 0~100
  controlStability: number; // 0~100
  strategicValue: number; // 1~10
  supplyLevel: number; // 0~100 (현재 보급 도달 수준)
  supplied: boolean; // 보급 거점과 연결되어 있는가
  dataQuality: { population: DataQuality; industry: DataQuality; military: DataQuality };
}

export interface BattleRecord {
  turn: number;
  date: string;
  place: string;
  role: 'attack' | 'defend';
  result: 'win' | 'lose' | 'draw';
  lossesTaken: number;
}

export type OrderType = 'move' | 'attack' | 'defend' | 'rest' | 'train';
export interface Order {
  type: OrderType;
  target?: string;
  issuedTurn: number;
}

export type UnitKind = 'infantry' | 'motorized' | 'armor' | 'marine';
/** 편제 단위: 총동원령 전에는 여단급, 후에는 사단급(국군 한정, 게임상 조작 단위) */
export type Echelon = 'brigade' | 'division';

export interface CasualtyTally {
  killed: number;
  wounded: number;
  missing: number;
}

export interface Unit {
  id: string;
  faction: Faction;
  side: Side;
  name: string;
  historicalParent: string;
  kind: UnitKind;
  location: string;
  echelon: Echelon;
  maxStrength: number;
  /** 현재 가용(전투 가능) 병력. 부상병·실종·포로는 포함되지 않는다 */
  strength: number;
  /** 치료 중인 부상병 (복귀 가능). 가용 병력이 아니다 */
  wounded: number;
  /** 이 부대의 누적 손실 기록 (wounded 는 부상 발생 누계에서 실종 전환분을 뺀 값) */
  record: CasualtyTally;
  /** 긴급 동원병으로 충원된 누적 인원 */
  emergencyTroops: number;
  /** 연속 휴식 턴 수 (전투·이동·명령 없이 지낸 턴) */
  restTurns: number;
  /** 손상되어 수리 가능한 장비 (정상 장비 equip 과 별도, 파괴·유실분은 기록하지 않음) */
  equipDamaged: Equip;
  training: number; // 장기 능력
  experience: number; // 장기 능력
  morale: number; // 0~100
  fatigue: number; // 0~100 단기
  organization: number; // 0~100 단기
  recovery: number; // 0~100 단기: 전투 후 재정비 상태
  supply: number; // 0~100
  equip: Equip;
  equipNeed: Equip;
  traits: string[];
  history: BattleRecord[];
  speed: number; // km/일
  order: Order | null;
  /** 이번 턴에 이미 명령을 수행했는가(행동 제한) */
  acted: boolean;
  /** 이동 중 한 칸의 비용이 한 턴 이동력보다 클 때 쌓아 두는 이동력(km) */
  moveCarry?: number;
  /** 포위(보급 거점과 단절) 지속 턴 수. 0이면 포위 아님 */
  encircledTurns?: number;
}

export interface Nation {
  side: Side;
  supplyStock: number;
  popularSupport: number; // 국민 지지
  warCapacity: number; // 전쟁수행능력 (계산값)
  commandPoints: number;
  replacementPool: number; // AI 측 보충 인력
  /** 국가 군수 재고 (프로빈스 생산·원조 합산, 자동 배분의 원천) */
  equipStock: Equip;
  /** 훈련병 풀: 징집되었으나 아직 부대에 배정되지 않은 병력 */
  trainees: { count: number; training: number };
  /** 긴급 동원(총동원령)으로 징집된 누적 인원 */
  emergencyDrafted: number;
  stats: NationStats;
  policyCooldowns: Record<string, number>; // 정책 id → 사용 가능해지는 턴
  casualties: number;
}

export interface NationStats {
  killed: number; // 누적 전사
  wounded: number; // 누적 부상 발생(복귀 포함, 실종 전환분 제외)
  returned: number; // 치료 후 복귀
  missing: number; // 누적 실종·포로 (prisoners 를 포함한 총수)
  prisoners: number; // 그중 포로가 된 인원 (실종 = missing - prisoners)
  unitsDestroyed: number; // 전멸·해체된 부대 수
}

export interface Diplomacy {
  usCommitment: number; // 미국 개입도
  unSupport: number; // UN 지지
  chinaThreat: number; // 중국 개입 위험
  sovietSupport: number; // 소련 지원
}

export interface BattleReport {
  id: string;
  turn: number;
  date: string;
  province: string;
  provinceName: string;
  attackerSide: Side;
  attackerPower: number;
  defenderPower: number;
  attackerUnits: string[];
  defenderUnits: string[];
  outcome: 'attacker_win' | 'defender_win' | 'draw';
  attackerLosses: number;
  defenderLosses: number;
  retreated: boolean;
  captured: boolean;
  surrounded: boolean;
  moraleChange: { attacker: number; defender: number };
  supplyUsed: { attacker: number; defender: number };
  reasons: string[];
  attackerCasualty: CasualtyTally;
  defenderCasualty: CasualtyTally;
  attackerRoster: RosterEntry[];
  defenderRoster: RosterEntry[];
  retreatTo: string | null;
  stepId: string;
}

export interface RosterEntry {
  id: string;
  name: string;
  from: string; // 전투 시작 시 위치
  before: number; // 전투 전 가용 병력
  after: number; // 전투 후 가용 병력 (전멸·해체되면 0)
  killed: number;
  wounded: number;
  missing: number;
  destroyed?: boolean; // 후퇴 경로가 없어 전멸
}

/** 턴 처리 결과를 순서대로 재생하기 위한 기록. 게임 로직은 이미 끝난 결과이며 UI는 이것을 재생만 한다. */
export interface PlaybackStep {
  id: string;
  kind: 'movement' | 'battle' | 'occupy';
  province?: string;
  reportId?: string;
  title: string;
  ownerChanges: { province: string; from: Side; to: Side }[];
  unitMoves: { id: string; from: string; to: string }[];
  unitsRemoved: string[];
}

export interface TurnRecord {
  turn: number;
  date: string;
  initialOwners: Record<string, Side>;
  initialUnits: Record<string, { loc: string; side: Side; name: string }>;
  steps: PlaybackStep[];
}

export interface LogEntry {
  turn: number;
  date: string;
  kind: 'info' | 'battle' | 'event' | 'warn' | 'good';
  text: string;
}

export interface PendingEvent {
  eventId: string;
}

export type GamePhase = 'blitz' | 'naktong' | 'counter' | 'chinese' | 'stalemate';

export interface GameOutcome {
  result: 'victory' | 'defeat';
  grade: string;
  title: string;
  reasons: string[];
  score: ScoreBreakdown | null;
  turn: number;
  date: string;
}

export interface ScoreBreakdown {
  remainingForce: number;
  territory: number;
  popularSupport: number;
  warDamage: number;
  casualtyPenalty: number;
  bonus: number;
  total: number;
}

export interface GameState {
  version: number;
  scenarioId: string;
  turn: number;
  date: string; // ISO yyyy-mm-dd, 현재 턴 시작일
  rng: number;
  playerSide: Side;
  provinces: Record<string, Province>;
  units: Record<string, Unit>;
  nations: Record<Side, Nation>;
  diplomacy: Diplomacy;
  flags: Record<string, string | number | boolean>;
  firedEvents: string[];
  pendingEvents: PendingEvent[];
  reports: BattleReport[]; // 직전 턴 전투 보고
  log: LogEntry[];
  interdiction: number; // 0~1, 북측 보급선 폭격 효과
  airSupport: number; // 0~1, 아군 항공지원 효과
  intel: Record<string, { count: number; turn: number }>; // 플레이어 측이 마지막으로 파악한 적 정보
  nextUnitNumber: number;
  outcome: GameOutcome | null;
  briefing: string[]; // 직전 턴 종료 시 상황 브리핑
  lastTurn: TurnRecord | null;
  settings: { fog: boolean }; // 전장의 안개 (기본 꺼짐)
  warWeariness: number; // 남측 전쟁 피로도 0~100
  armisticeProgress: number; // 정전협상 진척 0~100
  initialTotals: { southIndustry: number; northIndustry: number; southStrength: number; northStrength: number; southProvinces: number };
}
