import type { EquipKey, Faction, UnitKind } from '../game/types';

/**
 * 초기 편성 및 증원 데이터.
 * ⚠ 부대 번호·배치는 역사적 편제를 단순화·근사한 것이며 세부 편제(연대 번호, 정확한 배치)는 검증이 필요합니다.
 *   훈련도·경험·장비 충족률·병력은 모두 게임 밸런스용 임시값입니다.
 */
export interface UnitTemplate {
  faction: Faction;
  name: string;
  parent: string;
  kind: UnitKind;
  /** 편제 단위 (생략하면 여단급). 중국군·북한군 재편 부대 등은 사단급으로 지정할 수 있다 */
  echelon?: 'brigade' | 'division';
  location: string;
  training: number;
  experience: number;
  morale?: number;
  strengthPct?: number;
  fill?: Partial<Record<EquipKey, number>>;
  traits?: string[];
}

const ROK_FILL = { rifles: 0.85, machineGuns: 0.55, mortars: 0.5, artillery: 0.25, antiTank: 0.12, tanks: 0, vehicles: 0.12 };
const KPA_FILL = { rifles: 0.95, machineGuns: 0.9, mortars: 0.9, artillery: 0.85, antiTank: 0.45, tanks: 0, vehicles: 0.4 };
const US_FILL = { rifles: 0.95, machineGuns: 0.9, mortars: 0.9, artillery: 0.85, antiTank: 0.8, tanks: 0, vehicles: 0.85 };

function rokRegiments(division: string, parent: string, spots: [string, string][], training = 46, experience = 8): UnitTemplate[] {
  return spots.map(([reg, loc]) => ({
    faction: 'ROK', name: `${division} ${reg}연대 전투단`, parent, kind: 'infantry', location: loc,
    training, experience, morale: 62, strengthPct: 0.92, fill: ROK_FILL,
  }));
}
function kpaRegiments(division: string, loc: string, n = 3, training = 68, experience = 30, traits: string[] = [], echelon: 'brigade' | 'division' = 'brigade'): UnitTemplate[] {
  return Array.from({ length: n }, (_, i) => ({
    faction: 'KPA' as const,
    name: echelon === 'division' ? `인민군 ${division} ${i + 1}사단급` : `인민군 ${division} ${i + 1}연대 전투단`,
    parent: `조선인민군 ${division}`, kind: 'infantry' as const, echelon,
    location: loc, training, experience, morale: 80, strengthPct: echelon === 'division' ? 0.55 : 0.98, fill: KPA_FILL, traits,
  }));
}
function usRegiments(division: string, regs: string[], loc: string, opts: Partial<UnitTemplate> = {}): UnitTemplate[] {
  return regs.map((r) => ({
    faction: 'UN' as const, name: `미 ${division} ${r}연대`, parent: `미 ${division}`, kind: 'motorized' as const, location: loc,
    training: 58, experience: 22, morale: 60, strengthPct: 0.78, fill: US_FILL, ...opts,
  }));
}

export const INITIAL_UNITS: UnitTemplate[] = [
  // ───────── 대한민국 육군 (1950.6.25 전선 배치 근사) ─────────
  ...rokRegiments('1사단', '대한민국 육군 제1사단', [['11', 'paju'], ['12', 'gaeseong'], ['13', 'paju']]),
  ...rokRegiments('수도사단', '대한민국 육군 수도경비사령부(수도사단)', [['1', 'seoul'], ['18', 'seoul'], ['기병', 'seoul']], 50, 10),
  ...rokRegiments('7사단', '대한민국 육군 제7사단', [['1', 'dongducheon'], ['3', 'uijeongbu'], ['9', 'uijeongbu']]),
  ...rokRegiments('6사단', '대한민국 육군 제6사단', [['7', 'chuncheon'], ['2', 'hongcheon'], ['19', 'wonju']], 52, 12),
  ...rokRegiments('8사단', '대한민국 육군 제8사단', [['10', 'gangneung'], ['21', 'samcheok']]),
  ...rokRegiments('2사단', '대한민국 육군 제2사단', [['5', 'cheongju'], ['16', 'daejeon'], ['25', 'daejeon']], 40, 5),
  ...rokRegiments('3사단', '대한민국 육군 제3사단', [['22', 'daegu'], ['23', 'daegu']], 40, 5),
  ...rokRegiments('5사단', '대한민국 육군 제5사단', [['15', 'gwangju'], ['20', 'gwangju']], 38, 5),
  ...rokRegiments('17연대(독립)', '대한민국 육군 독립 제17연대(옹진)', [['17', 'ongjin']], 48, 8),

  // ───────── 조선인민군 (남침 1선 근사) ─────────
  ...kpaRegiments('제6사단', 'haeju', 3, 72, 50, ['중국내전 참전 경험']),
  ...kpaRegiments('제1사단', 'geumcheon', 3, 70, 35),
  ...kpaRegiments('제4사단', 'cheorwon', 3, 70, 35),
  ...kpaRegiments('제3사단', 'pyeonggang', 3, 70, 35),
  ...['107전차연대', '109전차연대', '203전차연대'].map((n): UnitTemplate => ({
    faction: 'KPA', name: `인민군 제105전차여단 ${n}`, parent: '조선인민군 제105전차여단', kind: 'armor', location: 'cheorwon',
    training: 64, experience: 20, morale: 82, strengthPct: 0.98, traits: ['기갑 돌파'],
    fill: { rifles: 0.95, machineGuns: 0.9, mortars: 0.9, artillery: 0.9, antiTank: 0.5, tanks: 0.95, vehicles: 0.7 },
  })),
  ...kpaRegiments('제2사단', 'hwacheon', 3, 68, 35),
  ...kpaRegiments('제7사단', 'gimhwa', 3, 66, 30),
  ...kpaRegiments('제12사단', 'inje', 3, 70, 45, ['중국내전 참전 경험']),
  ...kpaRegiments('제5사단', 'sokcho', 3, 72, 50, ['중국내전 참전 경험']),
];

export interface Reinforcement {
  id: string;
  date: string; // 이 날짜 이후 첫 턴 시작에 도착
  side: 'south' | 'north';
  message: string;
  units: UnitTemplate[];
  /** 이 플래그가 켜져 있어야 도착 (예: 중국군 참전 후에만 오는 증원) */
  requiresFlag?: string;
  /** 지역 장비 비축 증가 */
  stock?: { province: string; equip: Partial<Record<EquipKey, number>> };
  /** 외교 지표 변화 없음 — 이벤트가 담당 */
}

const tankBn = (name: string, parent: string, loc: string, fillTanks: number): UnitTemplate => ({
  faction: 'UN', name, parent, kind: 'armor', location: loc, training: 60, experience: 20, morale: 65, strengthPct: 0.7,
  fill: { rifles: 0.9, machineGuns: 0.9, mortars: 0.8, artillery: 0.5, antiTank: 0.7, tanks: fillTanks, vehicles: 0.8 },
});

/** 중국군 여단 템플릿(가상 편성: 군단·여단 번호는 실제 편제가 아님) */
export function plaBrigades(count: number, label: string, loc: string): UnitTemplate[] {
  return Array.from({ length: count }, (_, i) => ({
    faction: 'PLA' as const,
    name: `중국군 ${label} ${Math.floor(i / 3) + 1}군단 ${(i % 3) + 1}사단급`,
    parent: '중국인민지원군 (사단급 운용 · 편제는 근사·가상 편성)',
    kind: 'infantry' as const,
    echelon: 'division' as const,
    location: loc,
    training: PLA_T.training,
    experience: PLA_T.experience,
    morale: PLA_T.morale,
    strengthPct: 0.6, // 사단급이지만 병력은 정원의 약 60% (대규모이나 결원)
    fill: PLA_T.fill,
    traits: ['야간전'],
  }));
}
/** 소련군 사단 템플릿 (가상 편성: 핵 투하 후 소련 참전 시나리오) */
export function sovietDivisions(count: number, label: string, loc: string): UnitTemplate[] {
  return Array.from({ length: count }, (_, i) => ({
    faction: 'SOV' as const,
    name: `소련군 ${label} ${i + 1}사단`,
    parent: '소련 극동군관구 (사단급 · 가상 편성)',
    kind: 'motorized' as const,
    echelon: 'division' as const,
    location: loc,
    training: 72,
    experience: 40,
    morale: 88,
    strengthPct: 0.9,
    fill: { rifles: 0.95, machineGuns: 0.8, mortars: 0.8, artillery: 0.6, antiTank: 0.5, tanks: 0.12, vehicles: 0.35 },
  }));
}
const PLA_T = { training: 58, experience: 45, morale: 86, fill: { rifles: 0.85, machineGuns: 0.5, mortars: 0.55, artillery: 0.18, antiTank: 0.12, tanks: 0, vehicles: 0.03 } };

const genericUn = (n: number, label: string, kind: UnitTemplate['kind'] = 'motorized'): UnitTemplate[] =>
  Array.from({ length: n }, (_, i) => ({
    faction: 'UN' as const, name: `UN군 ${label} ${i + 1}여단`, parent: 'UN군 증원 (가상 편성)', kind, location: 'busan',
    training: 62, experience: 25, morale: 70, strengthPct: 0.85, fill: US_FILL,
  }));
const genericRok = (n: number, label: string): UnitTemplate[] =>
  Array.from({ length: n }, (_, i) => ({
    faction: 'ROK' as const, name: `국군 ${label} ${i + 1}연대 전투단`, parent: '대한민국 육군 (신편)', kind: 'infantry' as const, location: 'busan',
    training: 52, experience: 12, morale: 68, strengthPct: 0.8, fill: { ...ROK_FILL, machineGuns: 0.7, mortars: 0.7, artillery: 0.4, antiTank: 0.35, vehicles: 0.25 },
  }));

export const REINFORCEMENTS: Reinforcement[] = [
  // ── 1950.10 이후: 장기전 증원 (일정은 게임 밸런스용 근사) ──
  { id: 'un-late-1', date: '1950-11-01', side: 'south', message: 'UN군 증원(미국·연합국 부대)이 부산에 도착했습니다.', units: genericUn(3, '제1증원') },
  { id: 'rok-new-1', date: '1950-12-01', side: 'south', message: '신편 국군 연대 전투단이 편성되어 합류했습니다.', units: genericRok(4, '신편1') },
  { id: 'un-late-2', date: '1950-12-15', side: 'south', message: 'UN군 증원이 부산에 도착했습니다.', units: genericUn(3, '제2증원') },
  { id: 'un-late-3', date: '1951-02-01', side: 'south', message: 'UN군 증원이 부산에 도착했습니다.', units: genericUn(3, '제3증원') },
  { id: 'rok-new-2', date: '1951-06-01', side: 'south', message: '국군 신편 연대 전투단이 합류했습니다.', units: genericRok(4, '신편2') },
  { id: 'un-late-4', date: '1951-10-01', side: 'south', message: 'UN군 교대 병력이 도착했습니다.', units: genericUn(3, '제4증원') },
  { id: 'rok-new-3', date: '1952-03-01', side: 'south', message: '국군 증편 부대가 합류했습니다.', units: genericRok(4, '신편3') },
  { id: 'un-aid-3', date: '1950-11-20', side: 'south', message: '미국의 3차 원조 물자가 도착했습니다.', units: [], stock: { province: 'busan', equip: { rifles: 8000, machineGuns: 200, mortars: 120, artillery: 40, antiTank: 300, vehicles: 300 } } },
  { id: 'un-aid-4', date: '1951-06-01', side: 'south', message: '미국의 4차 원조 물자가 도착했습니다.', units: [], stock: { province: 'busan', equip: { rifles: 10000, machineGuns: 250, mortars: 150, artillery: 60, antiTank: 400, vehicles: 400 } } },
  // 북측 재편·중국군 후속 증원 (중국군 참전 후에만)
  { id: 'kpa-rebuild-1', date: '1951-01-01', side: 'north', message: '북한군이 재편되어 신편 부대가 투입됩니다.', units: kpaRegiments('재편 제1사단', 'wonsan', 3, 45, 15, [], 'division') },
  { id: 'pla-wave-3', date: '1951-02-01', side: 'north', requiresFlag: 'plaIntervened', message: '중국군 후속 병력이 압록강을 건넜습니다.', units: plaBrigades(8, '제3진', 'sinuiju') },
  { id: 'pla-wave-4', date: '1951-04-15', side: 'north', requiresFlag: 'plaIntervened', message: '중국군 후속 병력이 추가 투입되었습니다.', units: plaBrigades(10, '제4진', 'sinuiju') },
  { id: 'kpa-rebuild-2', date: '1951-07-01', side: 'north', message: '북한군 신편 부대가 투입됩니다.', units: kpaRegiments('재편 제2사단', 'wonsan', 3, 45, 15, [], 'division') },
  { id: 'pla-wave-5', date: '1951-09-01', side: 'north', requiresFlag: 'plaIntervened', message: '중국군 교대 병력이 도착했습니다.', units: plaBrigades(6, '제5진', 'sinuiju') },
  { id: 'pla-wave-6', date: '1952-06-01', side: 'north', requiresFlag: 'plaIntervened', message: '중국군 교대 병력이 도착했습니다.', units: plaBrigades(6, '제6진', 'sinuiju') },
  // ── UN군 ──
  {
    id: 'un-tf-smith', date: '1950-07-01', side: 'south', message: '미 제24사단 선견대가 부산에 공수·상륙했습니다.',
    units: [{ ...usRegiments('24사단', ['21'], 'busan')[0], name: '미 24사단 스미스 특수임무부대', strengthPct: 0.22, training: 52, experience: 12 }],
  },
  { id: 'un-24div', date: '1950-07-05', side: 'south', message: '미 제24사단 주력이 부산에 도착했습니다.', units: usRegiments('24사단', ['19', '34'], 'busan') },
  { id: 'un-25div', date: '1950-07-10', side: 'south', message: '미 제25사단이 부산에 도착했습니다.', units: usRegiments('25사단', ['24', '27', '35'], 'busan') },
  {
    id: 'un-1cav', date: '1950-07-18', side: 'south', message: '미 제1기병사단이 포항에 상륙했습니다.',
    units: usRegiments('1기병사단', ['5기병', '7기병', '8기병'], 'pohang'),
  },
  {
    id: 'un-aid-1', date: '1950-07-08', side: 'south', message: '미국의 긴급 원조 물자(소총·박격포·대전차 로켓포)가 부산항에 하역되었습니다.', units: [],
    stock: { province: 'busan', equip: { rifles: 6000, machineGuns: 160, mortars: 80, artillery: 18, antiTank: 260, vehicles: 150 } },
  },
  {
    id: 'un-tanks-1', date: '1950-07-25', side: 'south', message: '미 전차대대가 부산에 도착했습니다.',
    units: [tankBn('미 제6전차대대', '미 제8군 직할', 'busan', 0.9), tankBn('미 제72전차대대', '미 제8군 직할', 'busan', 0.8)],
  },
  {
    id: 'un-marine', date: '1950-08-02', side: 'south', message: '미 제1임시해병여단이 부산에 도착했습니다. (기동 예비대로 적합)',
    units: [{ faction: 'UN', name: '미 제1임시해병여단', parent: '미 해병대', kind: 'marine', location: 'busan', training: 78, experience: 40, morale: 85, strengthPct: 0.85, fill: US_FILL, traits: ['소방대(기동예비)', '노련한 지휘관'] }],
  },
  { id: 'un-5rct', date: '1950-07-31', side: 'south', message: '미 제5연대전투단이 부산에 도착했습니다.', units: usRegiments('5연대전투단', ['5'], 'busan', { training: 62 }) },
  { id: 'un-2div', date: '1950-08-12', side: 'south', message: '미 제2사단이 부산에 도착했습니다.', units: usRegiments('2사단', ['9', '23', '38'], 'busan', { training: 62 }) },
  {
    id: 'un-aid-2', date: '1950-08-15', side: 'south', message: '미국의 2차 원조 물자(포·차량)가 도착했습니다.', units: [],
    stock: { province: 'busan', equip: { rifles: 8000, machineGuns: 200, mortars: 120, artillery: 36, antiTank: 200, vehicles: 300 } },
  },
  {
    id: 'un-brit', date: '1950-08-29', side: 'south', message: '영연방 제27여단이 부산에 도착했습니다.',
    units: [{ faction: 'UN', name: '영연방 제27여단', parent: '영연방 제27보병여단', kind: 'infantry', location: 'busan', training: 66, experience: 30, morale: 72, strengthPct: 0.8, fill: US_FILL }],
  },
  // ── 조선인민군 (2선·증원 사단) ──
  { id: 'kpa-10div', date: '1950-07-05', side: 'north', message: '인민군 제10사단이 남하를 시작했습니다.', units: kpaRegiments('제10사단', 'sariwon', 3, 60, 15) },
  { id: 'kpa-13div', date: '1950-07-14', side: 'north', message: '인민군 제13사단이 투입되었습니다.', units: kpaRegiments('제13사단', 'sariwon', 3, 62, 25) },
  { id: 'kpa-15div', date: '1950-07-26', side: 'north', message: '인민군 제15사단이 전선으로 이동합니다.', units: kpaRegiments('제15사단', 'sariwon', 3, 58, 15) },
  { id: 'kpa-8div', date: '1950-08-02', side: 'north', message: '인민군 제8사단이 투입되었습니다.', units: kpaRegiments('제8사단', 'pyongyang', 3, 55, 12) },
  { id: 'kpa-9div', date: '1950-08-10', side: 'north', message: '인민군 제9사단이 투입되었습니다.', units: kpaRegiments('제9사단', 'pyongyang', 3, 55, 12) },
  { id: 'kpa-recruit', date: '1950-08-20', side: 'north', message: '인민군 신편 사단(속성 훈련)이 편성되었습니다.', units: kpaRegiments('신편 제83사단', 'pyongyang', 3, 38, 2) },
];
