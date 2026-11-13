import { useEffect, useLayoutEffect, useState } from 'react';
import { useGame } from '../store/gameStore';

const KEY = 'korea1950.tutorial.done';

export const tutorialSeen = (): boolean => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};
const markSeen = () => {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* 저장소를 쓸 수 없어도 진행에는 문제 없다 */
  }
};

type Placement = 'center' | 'below' | 'right' | 'left' | 'inside';
interface Step {
  title: string;
  target?: string; // data-tour 값
  placement: Placement;
  body: React.ReactNode;
}

const STEPS: Step[] = [
  {
    title: '환영합니다, 사령관',
    placement: 'center',
    body: (
      <>
        <p>1950년 6월 25일 새벽, 북한군이 38선을 넘었습니다. 당신은 대한민국의 지휘를 맡았습니다.</p>
        <p className="mt-2"><b>목표</b>: 핵심 보급 거점 <b>부산</b>을 지키며 1953년 7월 27일 정전까지 버티는 것. 서울 수복과 영토 회복, 국민 지지가 높을수록 높은 등급을 받습니다.</p>
        <p className="mt-2 text-slate-400">이 안내는 2분 정도 걸립니다. 언제든 <b>건너뛰기</b>를 누르면 닫을 수 있고, 도움말에서 다시 볼 수 있습니다.</p>
      </>
    ),
  },
  {
    title: '1. 상단 바 — 나라의 상태',
    target: 'topbar',
    placement: 'below',
    body: (
      <>
        <p><b>총병력·보급 자원</b>은 군의 힘, <b>전쟁수행능력</b>은 나라의 종합 체력입니다. 이 값이 너무 낮아지면 패배합니다.</p>
        <p className="mt-2">오른쪽 게이지는 외교 상황입니다. <b>미국 개입·UN 지지</b>는 높을수록 좋고, <b>중국 개입 위험·소련 지원</b>은 높을수록 위험합니다.</p>
      </>
    ),
  },
  {
    title: '2. 지도 — 전선을 읽는 법',
    target: 'map',
    placement: 'inside',
    body: (
      <>
        <p><span className="text-south">파란색</span>은 아군, <span className="text-red-400">붉은색</span>은 적 통제 지역입니다. 지도의 원 안 숫자는 <b>부대 수</b>(병력 규모가 아님)입니다.</p>
        <p className="mt-2">휠로 확대·축소, 드래그로 이동합니다. 지역을 <b>클릭</b>하면 오른쪽 패널에 정보가 나옵니다. 빗금 친 지역은 <b>보급이 끊긴</b> 곳입니다.</p>
      </>
    ),
  },
  {
    title: '3. 부대에 명령하기',
    target: 'right',
    placement: 'left',
    body: (
      <>
        <p>지도에서 아군 지역을 클릭하면 그곳의 부대가 자동으로 선택되고, 이 패널에 <b>[부대]</b> 탭이 열립니다. 여기의 <b>[이동]·[공격]·[방어선 강화]·[휴식]</b> 버튼으로 명령을 내리세요.</p>
        <p className="mt-2">이동·공격은 버튼을 누른 뒤 <b>지도에서 강조된 지역</b>을 클릭합니다. 한 부대는 한 턴에 한 가지 명령만 받을 수 있습니다.</p>
        <p className="mt-2 text-slate-400">피로하거나 병력이 줄어든 부대는 쉬게 해서 회복시키세요.</p>
      </>
    ),
  },
  {
    title: '4. 보급과 포위',
    target: 'left',
    placement: 'right',
    body: (
      <>
        <p>부대는 부산에서 <b>아군 영토를 따라 이어진 길</b>로 보급을 받습니다. 길이 끊겨 적에게 둘러싸이면 <b>포위</b>입니다. 조직력이 떨어지고 턴마다 병력과 장비가 줄어듭니다.</p>
        <p className="mt-2">왼쪽 패널의 <b>표시 설정</b>에서 보급 레이어를 켜 보급 상태를 확인하세요. 후퇴할 길이 없으면 부대가 전멸할 수 있습니다.</p>
      </>
    ),
  },
  {
    title: '5. 국가 관리 — 병력을 만드는 곳',
    target: 'manage',
    placement: 'below',
    body: (
      <>
        <p>여기서 <b>징집 → 훈련병 훈련 → 부대 창설·보충</b>을 합니다. 징집은 국가 단위이고, 장비는 자동으로 생산·배분됩니다.</p>
        <p className="mt-2">특정 시점에는 <b>총동원령</b>이 발동해 여단이 사단으로 커집니다. 인구와 산업이 곧 전쟁 능력입니다.</p>
      </>
    ),
  },
  {
    title: '6. 턴 종료와 전투',
    target: 'endturn',
    placement: 'inside',
    body: (
      <>
        <p>명령을 다 내렸으면 <b>[턴 종료]</b>를 누르세요. 북한군이 행동하고, 전투가 하나씩 순서대로 재생됩니다. 전투마다 손실과 결과를 볼 수 있습니다.</p>
        <p className="mt-2">초반(6~7월)은 1턴이 3일이고 이후는 7일입니다. 시간이 곧 자원이니, 처음에는 병력을 보존하며 지연전을 펴는 것이 좋습니다.</p>
      </>
    ),
  },
  {
    title: '7. 이벤트와 선택',
    placement: 'center',
    body: (
      <>
        <p>전황이 바뀌면 <b>이벤트</b>가 뜹니다. 서울 함락, 인천 상륙, 중국군 개입… 어떤 선택은 국가의 운명을 가릅니다.</p>
        <p className="mt-2"><b>첫 팁</b></p>
        <ul className="ml-4 list-disc">
          <li>한강선에서 병력을 아끼며 시간을 버세요.</li>
          <li>대구·부산 방어선(낙동강)은 절대 내주지 마세요.</li>
          <li>기회가 오면 적의 후방을 노리는 상륙작전을 고려하세요.</li>
        </ul>
        <p className="mt-2 text-slate-400">행운을 빕니다. 이제 지휘를 시작하세요.</p>
      </>
    ),
  },
];

interface Box { left: number; top: number; width: number; height: number }

export default function Tutorial() {
  const open = useGame((s) => s.tutorial);
  const setTutorial = useGame((s) => s.setTutorial);
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const step = STEPS[i];

  const close = () => {
    markSeen();
    setTutorial(false);
    setI(0);
  };

  // 대상 요소의 위치를 읽는다 (창 크기가 바뀌어도 따라간다)
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      setVp({ w: window.innerWidth, h: window.innerHeight });
      const el = step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null;
      if (!el) return setBox(null);
      const r = el.getBoundingClientRect();
      setBox({ left: r.left, top: r.top, width: r.width, height: r.height });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open, i, step.target]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') setI((x) => Math.min(STEPS.length - 1, x + 1));
      else if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const CW = Math.min(380, vp.w - 24);
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  let cardLeft = (vp.w - CW) / 2;
  let cardTop = vp.h * 0.22;
  if (box && step.placement !== 'center') {
    const gap = 16;
    if (step.placement === 'below') {
      cardLeft = clamp(box.left + 12, 12, vp.w - CW - 12);
      cardTop = box.top + box.height + gap;
    } else if (step.placement === 'right') {
      cardLeft = clamp(box.left + box.width + gap, 12, vp.w - CW - 12);
      cardTop = clamp(box.top + 40, 12, vp.h - 330);
    } else if (step.placement === 'left') {
      cardLeft = clamp(box.left - CW - gap, 12, vp.w - CW - 12);
      cardTop = clamp(box.top + 40, 12, vp.h - 360);
    } else {
      cardLeft = clamp(box.left + box.width / 2 - CW / 2, 12, vp.w - CW - 12);
      cardTop = clamp(box.top + (box.height > 200 ? 40 : -300), 12, vp.h - 330);
    }
  }
  const last = i === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[95]" role="dialog" aria-label="튜토리얼">
      {/* 바깥 클릭 방지 + 대상 강조 */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />
      {box ? (
        <div
          className="pointer-events-none absolute rounded border-2 border-[#ffe08a]"
          style={{ left: box.left - 4, top: box.top - 4, width: box.width + 8, height: box.height + 8, boxShadow: '0 0 0 9999px rgba(3,7,12,.72), 0 0 18px 2px rgba(255,224,138,.55)', transition: 'all .25s ease' }}
        />
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-[rgba(3,7,12,.72)]" />
      )}
      <div className="fade-in absolute rounded border border-[#8a7a4f] bg-[#10171f] p-4 text-[13px] leading-[1.65] text-slate-200 shadow-2xl" style={{ left: cardLeft, top: cardTop, width: CW }}>
        <div className="flex items-start justify-between gap-3">
          <div className="font-serif text-[16px] font-black text-brass">{step.title}</div>
          <span className="shrink-0 text-[11px] text-slate-500">{i + 1} / {STEPS.length}</span>
        </div>
        <div className="mt-2">{step.body}</div>
        <div className="mt-3 flex items-center gap-1.5">
          {STEPS.map((_, k) => (
            <span key={k} className={'h-1.5 rounded-full transition-all ' + (k === i ? 'w-5 bg-[#ffe08a]' : 'w-1.5 bg-slate-600')} />
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <button className="btn" onClick={close}>건너뛰기</button>
          <div className="flex gap-2">
            {i > 0 && <button className="btn" onClick={() => setI(i - 1)}>이전</button>}
            <button className="btn btn-blue px-4" onClick={() => (last ? close() : setI(i + 1))}>{last ? '시작하기' : '다음'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
