import type { Difficulty, EquipKey, Terrain, UnitKind } from './types';

/**
 * 게임 밸런스 상수 모음. 모든 수치는 역사적 사실이 아니라 "게임 밸런스용 임시값"입니다.
 * 전투 공식의 계수는 전부 이 파일에서 조정합니다.
 */

export const SCENARIO = {
  id: 'korea-1950-summer',
  startDate: '1950-06-25',
  /** 정전 협정일. 이 날짜까지 존속하거나 정전협상이 타결되면 최종 평가 */
  endDate: '1953-07-27',
  /** 1단계(1950.6~10) 종료일: 중간 평가용 이벤트 */
  phase1End: '1950-10-07',
  /** 이 날짜 이전에는 1턴 3일, 이후 7일, 교착기(longTurnFrom)부터는 14일 */
  shortTurnUntil: '1950-07-01',
  shortTurnDays: 3,
  normalTurnDays: 7,
  longTurnFrom: '1951-07-01',
  longTurnDays: 14,
} as const;

export const COMBAT = {
  /** 병력의 질: 훈련도·경험이 병력의 "숙련 수준"만 결정한다 (장비와 분리) */
  quality: { floor: 0.6, training: 0.28, experience: 0.12 },
  /** 장비의 질: 보병 화력 장비 충족률이 화력 밀도를 결정한다 (훈련과 분리) */
  equipment: { floor: 0.55, rifles: 0.4, machineGuns: 0.25, mortars: 0.15, artillery: 0.2 },
  /** 상태(단기) 페널티 가중치: 합이 1 미만이라 곱셈식으로 전투력이 0에 수렴하지 않는다 */
  statePenalty: { organization: 0.2, fatigue: 0.14, morale: 0.14, supply: 0.22, recovery: 0.05 },
  /** 전차 1대의 병력 환산, 대전차 무력화 최대치 */
  tankMenEquivalent: 45,
  tankCrewFloor: 0.6,
  antiArmorMaxReduction: 0.7,
  /** 대전차 커버율 계산: 상대 전차 대비 (대전차화기 + 전차*2 + 포*0.3) */
  antiArmorTankWeight: 2,
  antiArmorGunWeight: 0.3,
  antiArmorPerTank: 3,
  /** 전차 충격: 대전차 수단이 없는 보병이 전차에 맞닥뜨렸을 때 추가 손실·사기 저하 */
  tankShockThreshold: 0.3,
  tankShockMorale: 10,
  tankShockLossMult: 1.25,
  terrainDefense: { plain: 1.0, paddy: 1.05, hills: 1.25, mountain: 1.5, urban: 1.3, river: 1.2, coastal: 1.08 } as Record<Terrain, number>,
  /** 지형별 전차 운용 효율 */
  terrainTank: { plain: 1.0, paddy: 0.8, hills: 0.6, mountain: 0.35, urban: 0.7, river: 0.5, coastal: 0.9 } as Record<Terrain, number>,
  fortificationPerLevel: 0.07,
  entrenchBonus: 0.15,
  airSupportBonus: 0.12,
  /** 지휘 변수: 전투마다 양측에 곱해지는 무작위 계수의 폭 */
  luckSpread: 0.1,
  traitBonus: 0.04,
  /** 결과 판정 */
  winRatio: 1.08,
  repulseRatio: 0.85,
  /** 손실률 */
  baseLoss: 0.16,
  lossExponent: 0.6,
  lossClamp: [0.4, 2.2] as [number, number],
  pursuitLoss: 0.03,
  surroundedLoss: 0.45,
  disbandBelow: 120,
};

export const MOVEMENT = {
  terrainCost: { plain: 1.0, paddy: 1.25, hills: 1.5, mountain: 2.2, urban: 1.0, river: 1.4, coastal: 1.1 } as Record<Terrain, number>,
  railDiscount: 0.5,
  seaCostKm: 90,
  speedByKind: { infantry: 18, motorized: 26, armor: 24, marine: 20 } as Record<UnitKind, number>,
};

export const UNIT_TOE: Record<UnitKind, { maxStrength: number; need: Record<EquipKey, number> }> = {
  infantry: {
    maxStrength: 3000,
    need: { rifles: 2400, machineGuns: 75, mortars: 50, artillery: 17, antiTank: 25, tanks: 0, vehicles: 60 },
  },
  motorized: {
    maxStrength: 3400,
    need: { rifles: 2700, machineGuns: 100, mortars: 60, artillery: 24, antiTank: 40, tanks: 0, vehicles: 220 },
  },
  armor: {
    maxStrength: 1700,
    need: { rifles: 1000, machineGuns: 80, mortars: 12, artillery: 6, antiTank: 12, tanks: 40, vehicles: 150 },
  },
  marine: {
    maxStrength: 3200,
    need: { rifles: 2600, machineGuns: 90, mortars: 60, artillery: 24, antiTank: 40, tanks: 0, vehicles: 160 },
  },
};

/** 사단급 편제(총동원령 후 국군): 기준 8,000~12,000명. 장비 정원은 병력 비율로 확대된다. */
export const DIVISION_TOE: Record<UnitKind, { maxStrength: number }> = {
  infantry: { maxStrength: 10000 },
  motorized: { maxStrength: 11500 },
  armor: { maxStrength: 8000 },
  marine: { maxStrength: 10500 },
};

/**
 * 인명 손실 구분. 전투 손실 1건을 전사(영구)·부상(치료 후 복귀)·실종·포로(복귀 없음)로 나눈다.
 * 종류별 비율은 게임 밸런스용 값이다.
 */
export const CASUALTY = {
  splits: {
    combat: { killed: 0.3, wounded: 0.55, missing: 0.15 },
    rout: { killed: 0.15, wounded: 0.35, missing: 0.5 }, // 패주·추격
    attrition: { killed: 0.1, wounded: 0.3, missing: 0.6 }, // 굶주림·탈영·질병
    event: { killed: 0.35, wounded: 0.45, missing: 0.2 }, // 사건에 의한 손실
  },
  /** 실종·포로 중 포로가 되는 비율 (나머지는 단순 실종·탈영). 전멸 시에는 전원 포로로 본다 */
  powShare: { combat: 0.5, rout: 0.7, attrition: 0, event: 0.3 },
  /** 손실된 장비 중 수리 가능한(손상) 비율. 나머지는 파괴·유실 */
  equipDamagedShare: 0.35,
  annihilatedKilledShare: 0.2, // 전멸 시 잔존 병력 중 전사 비율, 나머지는 포로·실종
  capturedEquipShare: 0.3, // 전멸 부대 장비 중 상대가 노획하는 비율
};

/** 부상병 복귀와 장비 수리 (1주 기준, 경과일에 비례) */
export const MEDICAL = {
  returnPerWeek: 0.2, // 부상병 중 복귀 비율 기본값
  restMult: 1.8, // 휴식 명령
  restStack: 0.15, // 연속 휴식 턴당 추가
  restStackCap: 4,
  movedMult: 0.6, // 이동만 한 부대
  fightMult: 0.4, // 전투 참여 (완전 휴식 보너스 없음)
  unsafeMult: 0.6, // 적과 인접한 위험 지역
  repairPerWeek: 0.3, // 손상 장비 중 수리되는 비율
  repairRestMult: 1.5,
  /** 휴식 명령 중인 부대(보급 연결 지역)의 주간 부상병 복귀율 하한 — 적과 맞닿아 있어도 '휴식 필요'가 3주 안에 풀리도록 */
  restMinRate: 0.55,
};

export const ECONOMY = {
  /** 징병 대상 인구 = 인구 × 비율 (추정) */
  recruitableShare: 0.06,
  /** 국가 징집 1회(CP 1)당 모집 인원 상한과 신병의 초기 훈련도 */
  draftBatch: 6000,
  draftTraining: 15,
  draftMinStability: 30,
  trainingCap: { recruits: 55, unit: 90 },
  recruitTrainGain: 12, // 훈련 명령 1회
  traineeAutoTrainPerWeek: 5, // 자동 훈련
  /** 훈련 명령: 1주(7일)에 훈련도 +15 (상한 trainingCap.unit 까지) */
  unitTrainPerWeek: 15,
  /** 전투를 치른 턴의 훈련도 증가 (한 전투 턴당, 이미 높을수록 조금씩 줄어든다) */
  combatTrainGain: 2,
  /** 실전으로 오를 수 있는 훈련도 상한 (그 이상은 훈련 명령으로만 오른다) */
  combatTrainCap: 75,
  formationMin: { brigade: 1500, division: 5000 } as Record<'brigade' | 'division', number>,
  formationMax: { brigade: 3000, division: 10000 } as Record<'brigade' | 'division', number>,
  newBrigadeMorale: 55,
  /** 하루당 생산량 (산업 능력 100 기준) */
  productionPerDay: { rifles: 70, machineGuns: 3, mortars: 2, artillery: 0.35, antiTank: 1.2, tanks: 0, vehicles: 1.5 } as Record<EquipKey, number>,
  stockPerIndustryDay: 0.03,
  /** 산업·원조와 별개로 매일 들어오는 기본 보급량 (후방의 민간·정부 비축) */
  baseIncomePerDay: { south: 16, north: 10 } as Record<'south' | 'north', number>,
  /** 병력 1,000명당 하루 보급 자원 소모 (기존 0.33 은 UN군 도착 후 생산·원조를 훨씬 넘어 가을부터 줄곧 0 이었다) */
  consumptionPerThousandDay: 0.2,
  /** 외국군(UN군·미군, 중국군, 소련군)은 본국 보급선이 따로 있어 국가 보급 자원 소모가 적다 */
  foreignConsumptionMult: 0.6,
  /** 미국 개입도·소련 지원 1포인트당 하루 보급 원조량 (남: 미국 개입도 100 이면 하루 22) */
  aidPerPoint: { south: 0.42, north: 0.45 } as Record<'south' | 'north', number>,
  /** 정책 '후방 보급 집중'으로 늘어나는 보급 자원 */
  rearSupplyBoost: 50,
  /** 보급 자원 보유 상한 (쌓아 두기만 하는 것을 막는다) */
  supplyStockCap: 1000,
  fortifyCost: 1,
  repairInfraGain: 12,
  repairDamageGain: 14,
  /** 국민 지지: 지역을 잃을 때(전략가치당) 감소 / 점령할 때 증가, 매주 회복(낮으면 더 빨리), 사상자 이만큼마다 1 감소 */
  supportLossPerValueLost: 0.2,
  supportGainPerValueTaken: 0.1,
  supportRecovery: 0.3,
  supportRecoveryLow: 1.6,
  supportLowBelow: 50,
  supportPerCasualty: 60000,
  stabilityOccupiedStart: 25,
  stabilityRecoveryPerDay: 2.5,
  stabilityHomeFloor: 55,
};

export const SUPPLY = {
  hopCostRail: 4,
  hopCostRoad: 12,
  infraAdjust: 0.4, // 기반시설이 나쁠수록 비용 증가
  hubLevel: 100,
  /** 보급 거점과 연결(포위되지 않음)되어 있으면 아무리 멀어도 최소 이 수준의 보급은 도달한다 */
  minConnectedLevel: 15,
  /** 주 거점에서 끊긴 전진 보급소: 이 턴 수만큼은 비축분으로 유지, 이후 턴마다 이 비율씩 약해진다 */
  depotGraceTurns: 0,
  depotDecayPerTurn: 0.5, // 끊긴 전진 보급소는 2턴 안에 사라진다 (포위 판정이 곧바로 시작된다)
  /** 플레이어가 설치하는 전진 보급소 */
  builtDepotLevel: 60,
  builtDepotCP: 2,
  builtDepotStock: 60,
  maxBuiltDepots: 3,
  unitDrawPerDay: 14,
  unitDecayCutOffPerDay: 9,
  cutOffOrgLoss: 3,
  cutOffMoraleLoss: 2.5,
  hubs: { south: ['busan'], north: ['pyongyang', 'wonsan', 'sinuiju'] } as Record<'south' | 'north', string[]>,
};

export const ATTRITION = {
  /** 보급 수준이 이 값 미만이면 굶주림·탈영·질병으로 하루 병력이 감소한다 */
  lowSupplyBelow: 30,
  lowSupplyLossPerDay: 0.008,
};

/**
 * 날씨와 계절 (양측 모두에 똑같이 적용). 날짜로 결정되며 이벤트로 미리 알려 준다.
 *  - moveMult: 부대 이동력 배율 / roadSupplyMult: 도로 보급 비용 배율(철도·해상 제외)
 *  - attackMult: 공격측 전투력 배율 / lossPerDay: 보급이 70 미만인 부대의 하루 손실 계수(보급이 나쁠수록 커진다)
 *  - consumptionMult: 국가 보급 자원 소모 배율 / recoveryMult: 부상병 회복 배율
 */
export type WeatherId = 'clear' | 'monsoon' | 'cold' | 'thaw';
export const WEATHER: Record<WeatherId, {
  label: string; icon: string; from: string; to: string; blurb: string;
  moveMult: number; roadSupplyMult: number; attackMult: number; lossPerDay: number; consumptionMult: number; recoveryMult: number;
}> = {
  clear: { label: '평년', icon: '☀', from: '', to: '', blurb: '평년 날씨입니다.', moveMult: 1, roadSupplyMult: 1, attackMult: 1, lossPerDay: 0, consumptionMult: 1, recoveryMult: 1 },
  monsoon: { label: '장마', icon: '🌧', from: '07-01', to: '08-15', blurb: '비로 도로가 진창이 되어 이동과 보급이 느려집니다.', moveMult: 0.85, roadSupplyMult: 1.2, attackMult: 0.97, lossPerDay: 0, consumptionMult: 1, recoveryMult: 0.9 },
  cold: { label: '혹한', icon: '❄', from: '12-01', to: '02-28', blurb: '영하의 추위로 이동이 둔해지고, 보급이 약한 부대는 동상과 질병으로 병력을 잃습니다.', moveMult: 0.85, roadSupplyMult: 1.1, attackMult: 0.95, lossPerDay: 0.0025, consumptionMult: 1.15, recoveryMult: 0.8 },
  thaw: { label: '해빙기', icon: '🌫', from: '03-10', to: '04-10', blurb: '얼었던 땅이 녹아 길이 질척해져 이동과 보급이 크게 느려집니다.', moveMult: 0.8, roadSupplyMult: 1.25, attackMult: 1, lossPerDay: 0, consumptionMult: 1, recoveryMult: 1 },
};

/** 포위(보급 거점과 단절된 자국 영토 안의 부대): 완료 시점에 조직력 -20%, 이후 포위 턴 수에 비례해 악화 */
export const ENCIRCLE = {
  organizationFactor: 0.8, // 포위 완료 시점 조직력 ×0.8 (-20%)
  lossPerTurn: 0.03, // 포위 n턴째: 병력의 (0.03×n) 손실, 상한 lossCap (7일 기준, 경과일에 비례)
  lossCap: 0.2,
  orgLossPerTurn: 3, // 추가 조직력 감소 (3×n, 상한 orgLossCap)
  orgLossCap: 12,
  equipLossPerTurn: 0.04, // 장비 감소율 (0.04×n, 상한 equipLossCap)
  equipLossCap: 0.25,
};

export const RECOVERY = {
  moraleBase: 62,
  moralePerDay: 2.2,
  orgPerDay: 4,
  fatigueRestPerDay: 5,
  fatigueHoldPerDay: 2.5,
  fatigueMovePerDay: 1.2,
  recoveryPerDay: 7,
};

/**
 * 난이도. "보통"이 기존 밸런스이고, 쉬움·어려움은 아래 값만 바뀐다.
 *  - northForce: 북한군 초기·재편 부대 병력 배율 (정원 100% 상한)
 *  - southForce: 국군 초기 부대 병력 배율 (정원 100% 상한)
 *  - northQuality: 북한군 훈련도·경험·사기에 더하는 값
 *  - northCombat: 북한군·중국군의 전투력 배율 (전투 판정에 곱한다)
 *  - northReplace: 북한 AI 보충 속도 배율
 *  - aiAttackRatio: 북한 AI 공격 개시에 필요한 우세비 배율 (작을수록 공세적)
 *  - unDelayDays: UN군 증원·원조 도착일 가감 (+면 늦게 도착)
 *  - startCP / cpBonus: 시작 행정 점수 / 매 턴 추가 행정 점수
 *  - startStock / aidMult / usStart: 시작 보급 자원 / 미국 원조 배율 / 시작 미국 개입도
 *  - plaExtra: 중국군 참전 규모(사단) 가감
 *  - northWaves: 북한·중국 후속 증원(재편 부대, 중국군 후속 병력)의 규모 배율
 *  - plaArrivalDays: 남한군이 38선을 넘기로 한 날부터 중공군이 참전하기까지 걸리는 일수 (쉬움 14턴 / 보통 10턴 / 어려움 7턴, 7일 턴 기준)
 */
export const DIFFICULTY: Record<Difficulty, {
  label: string;
  blurb: string;
  northForce: number;
  southForce: number;
  northQuality: number;
  northCombat: number;
  northReplace: number;
  aiAttackRatio: number;
  unDelayDays: number;
  startCP: number;
  cpBonus: number;
  startStock: number;
  aidMult: number;
  usStart: number;
  plaExtra: number;
  northWaves: number;
  plaArrivalDays: number;
}> = {
  easy: {
    label: '쉬움',
    blurb: '북한군이 약하고 신중하며, 미군과 원조가 빨리 옵니다. 전쟁을 처음 접하는 분께 권합니다.',
    northForce: 0.8, southForce: 1.08, northQuality: -8, northCombat: 0.92, northReplace: 0.6, aiAttackRatio: 1.3, unDelayDays: -7,
    startCP: 8, cpBonus: 1, startStock: 500, aidMult: 1.5, usStart: 30, plaExtra: -6, northWaves: 0.6, plaArrivalDays: 98,
  },
  normal: {
    label: '보통',
    blurb: '기본 밸런스입니다. 지연전으로 시간을 벌고 낙동강에서 버티는 흐름을 경험합니다.',
    northForce: 1, southForce: 1, northQuality: 0, northCombat: 1, northReplace: 1, aiAttackRatio: 1, unDelayDays: 0,
    startCP: 6, cpBonus: 0, startStock: 320, aidMult: 1, usStart: 10, plaExtra: 0, northWaves: 1, plaArrivalDays: 70,
  },
  hard: {
    label: '어려움',
    blurb: '북한군이 정예이고 공세적이며 증원이 빠릅니다. 미군은 늦게 오고 원조도 적어, 모든 판단이 정확해야 합니다.',
    northForce: 1, southForce: 0.88, northQuality: 8, northCombat: 1.12, northReplace: 1.8, aiAttackRatio: 0.8, unDelayDays: 14,
    startCP: 5, cpBonus: 0, startStock: 220, aidMult: 0.7, usStart: 0, plaExtra: 8, northWaves: 1.3, plaArrivalDays: 49,
  },
};

export const AI_BALANCE = {
  /** 북한 AI 보충: 인력 풀, 일일 최대 보충량(부대당 비율) */
  replacementPoolStart: 20000,
  replacementPerDay: 300,
  replacementRefillPerDay: 100,
  replacementTraining: 28,
  attackRatio: { blitz: 0.95, naktong: 1.12, counter: 1.4, chinese: 1.0, stalemate: 1.6 },
};

/** 중국군(PLA): 병력은 많지만 장비·보급이 약하다 — 무적도 무제한 보급도 아님 */
export const PLA = {
  training: 58,
  experience: 45,
  morale: 86,
  fill: { rifles: 0.85, machineGuns: 0.5, mortars: 0.55, artillery: 0.18, antiTank: 0.12, tanks: 0, vehicles: 0.03 },
  /** 야간전: 공격 시 전투력 보너스(병력 가중) */
  nightAttackBonus: 0.12,
  /** 측면 공격: 서로 다른 출발지의 부대가 함께 공격하면 보너스 (출발지 2곳, 3곳 이상) */
  flankBonus: [0.06, 0.12] as [number, number],
  /** 참전 시 투입 규모(여단) */
  wave1: 18,
  wave2: 18,
  depots: { gangye: 80, hyesan: 60 } as Record<string, number>,
  /** 평양 함락 후 압록강을 건너 투입되는 중국군 총 규모(사단급) */
  invasionTotal: 30,
  /** 압록강·두만강에 닿은 북한 영토는 중국 참전 후 보급 거점 역할을 한다 (포위 판정을 받지 않는다) */
  borderHubLevel: 60,
  /** 인해전술 부대: 숫자는 많지만 훈련도·조직력이 낮다 */
  mass: { training: 26, experience: 24, morale: 72, organization: 45, strengthPct: 0.7, fill: { rifles: 0.6, machineGuns: 0.3, mortars: 0.35, artillery: 0.1, antiTank: 0.05, tanks: 0, vehicles: 0.02 } },
  /** 공세 기간(턴): 이 동안 중국군 AI 는 우세비를 따지지 않고 훨씬 많은 지점을 동시에 공격한다 */
  /** 후반으로 갈수록 인해전술 부대의 훈련도·조직력이 떨어진다: 이 날짜 이후 매달 perMonth 만큼 (하한 floor) */
  massDecayFrom: '1951-03-01',
  massDecayPerMonth: 0.04,
  massDecayFloor: 0.7,
  offensiveRatioMult: 0.85,
  offensiveExtraTargets: 5,
};

/** 핵 투하 (1951년 6월 이벤트) */
export const NUKE = {
  /** 만주의 중국군 병력 손실·조직력·사기 하락. 이후 중국군은 회복·보충을 받지 못한다 */
  plaLossFraction: 0.3,
  plaOrgLoss: 35,
  plaMoraleLoss: 25,
  sovietChance: 0.4,
  sovietDivisions: 60,
};

/** 38선 월경 제한: 중국의 경고를 받고 멈추면 이 일수 동안(8턴×7일) 원래 국경을 넘을 수 없다 */
export const CROSS = {
  banDays: 56,
};

/**
 * 정전협상과 전쟁 피로도.
 * 협상은 1951년 6월 25일 미국의 압박으로 시작된다. 기본 속도는 '계획 일수'에 100%가 되는 속도이고, 전쟁 피로가 높을수록 빨라진다.
 * 계획 일수 728일 = 14일 턴 52개 (1953년 6월 말). '38선에서 멈춘 뒤 이른 정전'을 고르면 계획 일수가 짧아진다.
 */
export const ARMISTICE = {
  talksFrom: '1951-06-25',
  plannedDays: 728,
  earlyDays: 84,
  wearinessBoost: 0.5,
  wearinessPerThousandCasualties: 0.16,
  wearinessDecayPerWeek: 0.9,
  supportLossAbove: 60,
  signAt: 100,
  /** 이른 정전(38선 정전)의 점수 상한 */
  earlyScoreCap: 69,
  /** 미국 설득: 성공하면 협상 계획 일수가 이만큼 늘어난다(약 4턴) / 실패하면 이만큼 줄어든다(약 2턴) */
  persuadeDelayDays: 56,
  persuadeBackfireDays: 28,
};

/**
 * 외부 장비 지원 (하루 기준, 지원 100%일 때). 모두 게임 밸런스용 값이다.
 *  - 남측: UN군(미국 등) 장비 지원. 미국 개입도·UN 지지·항만 접근(주로 부산)에 비례한다.
 *  - 북측: 소련·중국 장비 지원(상대 진영 균형용). 소련 지원도에 비례하고 항공 차단에 약해진다.
 */
/**
 * UN군(미군 등)의 자체 보충 체계. 국군은 국가 훈련병 풀로 직접 보충하지만 UN군은 본국에서 보충병이 도착한다.
 * 도착량은 미국 개입도·UN 지지·항만 접근(장비 지원과 같은 계수)에 비례한다. 수치는 게임 밸런스용.
 */
export const UN_REPLACEMENT = {
  perDayFull: 900, // 지원 100%일 때 하루 보충병
  training: 55,
  organization: 60,
  morale: 70,
  maxPerUnitShare: 0.25, // 한 턴에 부대 정원의 이 비율까지만 받는다
  poolCap: 25000, // 쌓아둘 수 있는 보충병 한도
  medicalMult: 1.5, // UN군 의무 지원(후송·치료)으로 부상병 복귀가 빠르다
};

export const AID = {
  un: { rifles: 900, machineGuns: 24, mortars: 14, artillery: 3.5, antiTank: 18, tanks: 0, vehicles: 36 },
  soviet: { rifles: 420, machineGuns: 12, mortars: 8, artillery: 2.2, antiTank: 6, tanks: 0, vehicles: 10 },
  /** 항만 능력 합계가 이 값 이상이면 하역 능력 100% */
  portCapacityFull: 12,
  mobilizationSurge: 1.3,
  plaSurge: 1.25,
};

export const SCORE = {
  maxForce: 25,
  maxTerritory: 25,
  maxSupport: 15,
  maxDamage: 15, // 전쟁 피해가 적을수록 가산
  casualtyPerThousand: 0.35,
  casualtyCap: 20,
  bonusSeoul: 10,
  bonusBeyond38: 10,
  gradeCuts: [85, 70, 55, 40] as number[], // S, A, B, C, D
};
