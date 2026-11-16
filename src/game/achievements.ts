import type { GameState } from './types';
import { conditionHolds } from './events';

/** 업적 정의. check 는 지금 게임 상태에서 달성했는지 본다. 달성 기록은 기기에 저장되어 새 게임에도 남는다. */
export interface AchievementDef {
  id: string;
  group: '작전' | '정세' | '생존' | '결말';
  title: string;
  desc: string;
  icon: string;
  check: (s: GameState) => boolean;
}

const fired = (s: GameState, id: string) => s.firedEvents.includes(id);
const won = (s: GameState) => s.outcome?.result === 'victory';

export const ACHIEVEMENTS: AchievementDef[] = [
  // ── 작전 ──
  { id: 'incheon', group: '작전', icon: '🌊', title: '인천의 파도', desc: '인천상륙작전에 성공해 교두보를 확보한다.', check: (s) => !!s.flags.incheonHub },
  { id: 'seoul_back', group: '작전', icon: '🏛', title: '서울, 다시 우리 품으로', desc: '함락된 서울을 수복한다.', check: (s) => fired(s, 'seoul_recaptured') },
  { id: 'cross38', group: '작전', icon: '➡', title: '38선을 넘다', desc: '38선 훨씬 북쪽의 북한 영토를 점령한다.', check: (s) => conditionHolds(s, { kind: 'beyond38' }) },
  { id: 'pyongyang', group: '작전', icon: '🚩', title: '평양 입성', desc: '북한의 수도 평양을 점령한다.', check: (s) => s.flags.pyongyangFallTurn !== undefined },
  { id: 'yalu', group: '작전', icon: '🌉', title: '압록강에 서다', desc: '선두 부대가 압록강변에 도달한다.', check: (s) => fired(s, 'yalu_reached') },
  { id: 'annihilate', group: '작전', icon: '⚔', title: '포위 섬멸', desc: '한 판에서 북한군 부대 40개를 소멸시킨다.', check: (s) => s.nations.north.stats.unitsDestroyed >= 40 },
  { id: 'bloody', group: '작전', icon: '🩸', title: '피의 능선', desc: '양군 합쳐 20개 부대 이상이 맞붙은 혈투를 겪는다.', check: (s) => fired(s, 'bloody_battle') },
  // ── 정세 ──
  { id: 'mobilize', group: '정세', icon: '📢', title: '총동원', desc: '총동원령을 발동해 여단을 사단으로 키운다.', check: (s) => !!s.flags.mobilized },
  { id: 'depots', group: '정세', icon: '📦', title: '보급의 달인', desc: '전진 보급소를 세 곳 설치한다.', check: (s) => Number(s.flags['stat:depotsBuilt'] ?? 0) >= 3 },
  { id: 'letters', group: '정세', icon: '✉', title: '전선의 편지 수집가', desc: '전선 편지를 다섯 통 받는다.', check: (s) => s.firedEvents.filter((e) => e.startsWith('letter_')).length >= 5 },
  { id: 'nuke_no', group: '정세', icon: '🕊', title: '핵은 쓰지 않는다', desc: '만주 핵 투하 요구를 거부한다.', check: (s) => !!s.flags.macarthurFired },
  { id: 'nuke_yes', group: '정세', icon: '☢', title: '금단의 선택', desc: '만주에 핵을 투하한다.', check: (s) => !!s.flags.nukeUsed },
  // ── 생존 ──
  { id: 'winter', group: '생존', icon: '❄', title: '혹한을 넘기다', desc: '첫 겨울(1950~51)을 전쟁수행능력 50 이상으로 넘긴다.', check: (s) => fired(s, 'weather_cold_1950') && s.date >= '1951-03-10' && s.nations.south.warCapacity >= 50 },
  // ── 결말 ──
  { id: 'win', group: '결말', icon: '🏁', title: '정전의 날', desc: '정전까지 버텨 승리한다.', check: (s) => won(s) },
  { id: 'win_easy', group: '결말', icon: '🥉', title: '쉬움 정복', desc: '쉬움 난이도에서 승리한다.', check: (s) => won(s) && s.difficulty === 'easy' },
  { id: 'win_normal', group: '결말', icon: '🥈', title: '보통 정복', desc: '보통 난이도에서 승리한다.', check: (s) => won(s) && s.difficulty === 'normal' },
  { id: 'win_hard', group: '결말', icon: '🥇', title: '어려움 정복', desc: '어려움 난이도에서 승리한다.', check: (s) => won(s) && s.difficulty === 'hard' },
  { id: 'seoul_kept', group: '결말', icon: '🛡', title: '서울을 지켜낸 사령관', desc: '서울을 한 번도 내주지 않고 승리한다.', check: (s) => won(s) && !s.flags.seoulLost },
  { id: 'low_loss', group: '결말', icon: '🕯', title: '피를 아낀 승리', desc: '국군·UN군 누적 전사자 20만 명 미만으로 승리한다.', check: (s) => won(s) && s.nations.south.stats.killed < 200000 },
  { id: 'grade_a', group: '결말', icon: '⭐', title: '명장', desc: 'A등급 이상으로 승리한다.', check: (s) => won(s) && ['S', 'A'].includes(s.outcome!.grade) },
  { id: 'total', group: '결말', icon: '🗺', title: '한반도 전역 확보', desc: '북한 지역 대부분을 확보하는 대체역사 결말을 맞는다.', check: (s) => !!s.outcome?.title.includes('한반도 전역') },
];

export const ACHIEVEMENT_BY_ID: Record<string, AchievementDef> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

export interface UnlockRecord {
  date: string;
  turn: number;
  difficulty: string;
}
export type Unlocked = Record<string, UnlockRecord>;

const KEY = 'korea1950.achievements.v1';

export function loadAchievements(): Unlocked {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Unlocked) : {};
  } catch {
    return {};
  }
}

export function saveAchievements(u: Unlocked): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(u));
  } catch {
    /* 저장소를 쓸 수 없어도 게임은 계속된다 */
  }
}

/** 지금 상태에서 새로 달성한 업적 목록 (이미 달성한 것은 제외) */
export function newlyUnlocked(state: GameState, have: Unlocked): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => !have[a.id] && a.check(state));
}
