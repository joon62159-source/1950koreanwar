import { useEffect, useMemo, useState } from 'react';
import { useGame } from '../store/gameStore';
import { crossPhase } from '../game/china';
import type { GameState } from '../game/types';
import { tutorialSeen } from './Tutorial';

const KEY = 'korea1950.hints.v1';
const OFF_KEY = 'korea1950.hints.off';

function loadSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}
function save(seen: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(seen));
  } catch {
    /* 저장소를 쓸 수 없어도 진행에는 문제 없다 */
  }
}
function isOff(): boolean {
  try {
    return localStorage.getItem(OFF_KEY) === '1';
  } catch {
    return false;
  }
}

interface Hint {
  id: string;
  title: string;
  body: React.ReactNode;
  /** 지금 보여 줄 상황인가 */
  when: (g: GameState) => boolean;
}

const mine = (g: GameState) => Object.values(g.units).filter((u) => u.side === g.playerSide);

/** 상황이 처음 벌어졌을 때 한 번만 뜨는 짧은 안내. 첫 위기에서 규칙을 바로 알려 준다. */
const HINTS: Hint[] = [
  {
    id: 'first_turn',
    title: '첫 턴 — 이렇게 해 보세요',
    when: (g) => g.turn <= 2,
    body: (
      <>
        <p>① 지도에서 <b>파란 지역</b>을 클릭해 부대를 고릅니다. ② 오른쪽 <b>[방어선 강화]</b>(또는 [이동])을 누릅니다. ③ 아래 <b>[턴 종료]</b>를 누릅니다.</p>
        <p className="mt-1 text-slate-400">초반에는 이기려 하지 말고 병력을 아끼며 시간을 버세요. 시간이 곧 증원입니다.</p>
      </>
    ),
  },
  {
    id: 'supply_cut',
    title: '보급이 끊긴 부대가 있습니다',
    when: (g) => mine(g).some((u) => g.provinces[u.location] && !g.provinces[u.location].supplied),
    body: (
      <>
        <p>빗금 친 지역의 부대는 <b>보급을 못 받고</b> 매 턴 조직력·병력이 줄어듭니다. 길이 막히면 <b>포위</b>되어 몇 턴 안에 전멸할 수 있습니다.</p>
        <p className="mt-1">지도의 <b>[보급]</b> 보기로 끊긴 곳을 확인하고, <b>아군 영토로 이어진 길</b>(부산 방향)로 서둘러 후퇴시키세요. 전진 보급소를 세우면 도움이 됩니다.</p>
      </>
    ),
  },
  {
    id: 'weak_units',
    title: '병력이 크게 줄어든 부대가 있습니다',
    when: (g) => g.turn > 3 && mine(g).filter((u) => u.strength < u.maxStrength * 0.45).length >= 2,
    body: (
      <>
        <p>피해가 큰 부대를 계속 싸우게 하면 전멸합니다. 후방 보급 지역에서 <b>[휴식]</b>으로 회복시키거나 <b>보충</b>하세요.</p>
        <p className="mt-1 text-slate-400">국가 관리의 <b>징집 → 훈련 → 보충·창설</b>로 새 병력을 만들 수 있습니다.</p>
      </>
    ),
  },
  {
    id: 'near_38',
    title: '곧 38선입니다 — 중요한 결정',
    when: (g) => g.date >= '1950-09-20' && g.provinces.seoul.owner === 'south' && crossPhase(g) === 'idle',
    body: (
      <>
        <p>원래 북한 영토(38선 이북)를 <b>처음 공격</b>하려 하면 <b>중국의 경고</b>가 뜹니다. 넘기로 하면 중공군이 압록강 너머에 집결해 정해진 시간 뒤 참전하고, 멈추면 한동안 월경이 금지된 뒤 최종 결정을 내립니다.</p>
        <p className="mt-1 text-slate-400">북진은 통일의 기회이자 큰 위험입니다. 준비가 안 됐다면 서두르지 마세요.</p>
      </>
    ),
  },
  {
    id: 'skip_all',
    title: '연출이 길면 건너뛸 수 있어요',
    when: (g) => g.turn >= 4,
    body: (
      <p>턴 종료 뒤 전투·알림·신문이 길게 이어지면 <b>[모두 건너뛰기 ⏭⏭]</b>를 누르세요. 결정이 필요한 사건에서는 알아서 멈춥니다. 결과는 달라지지 않습니다.</p>
    ),
  },
];

export default function Hints() {
  const g = useGame((s) => s.game);
  const screen = useGame((s) => s.screen);
  const modal = useGame((s) => s.modal);
  const tutorialOpen = useGame((s) => s.tutorial);
  const playing = useGame((s) => s.playback !== null);
  const [seen, setSeen] = useState<string[]>(loadSeen);
  const [off, setOff] = useState(isOff);
  const [shown, setShown] = useState<string | null>(null);

  const busy = screen !== 'game' || modal !== null || tutorialOpen || playing || g.pendingEvents.length > 0 || !!g.outcome;
  const next = useMemo(() => {
    if (off || busy || !tutorialSeen()) return null;
    return HINTS.find((h) => !seen.includes(h.id) && h.when(g)) ?? null;
  }, [g, seen, off, busy]);

  // 한 번 뜬 힌트는 닫을 때까지 유지한다
  useEffect(() => {
    if (shown === null && next) setShown(next.id);
  }, [next, shown]);
  useEffect(() => {
    if (busy && shown) setShown(null);
  }, [busy, shown]);

  const hint = shown ? HINTS.find((h) => h.id === shown) : null;
  if (!hint || off) return null;
  const done = () => {
    const s = [...seen, hint.id];
    setSeen(s);
    save(s);
    setShown(null);
  };
  const turnOff = () => {
    try {
      localStorage.setItem(OFF_KEY, '1');
    } catch {
      /* 무시 */
    }
    setOff(true);
    setShown(null);
  };
  return (
    <div className="fade-in fixed right-2 top-[112px] z-[70] md:left-1/2 md:right-auto md:-translate-x-1/2 w-[min(360px,calc(100vw-16px))] rounded border border-[#c9a24b] bg-[#10171f]/97 p-3 text-[12.5px] leading-[1.6] text-slate-200 shadow-2xl">
      <div className="flex items-start gap-2">
        <span className="text-[16px]">💡</span>
        <div className="font-serif text-[14px] font-black text-brass">{hint.title}</div>
      </div>
      <div className="mt-1.5">{hint.body}</div>
      <div className="mt-2 flex items-center justify-between">
        <button className="text-[11px] text-slate-500 hover:text-slate-300 hover:underline" onClick={turnOff}>힌트 끄기</button>
        <button className="btn btn-blue px-4" onClick={done}>알겠습니다</button>
      </div>
    </div>
  );
}
