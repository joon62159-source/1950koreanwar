import { useState } from 'react';
import { useGame } from '../store/gameStore';
import { DIFFICULTY } from '../game/balance';
import type { Difficulty } from '../game/types';
import EventScene from './EventScene';
import { formatDate } from '../game/util';
import { ACHIEVEMENTS } from '../game/achievements';

const KEY = 'korea1950.difficulty';
const ORDER: Difficulty[] = ['easy', 'normal', 'hard'];
const TONE: Record<Difficulty, { ring: string; accent: string; mark: string }> = {
  easy: { ring: 'border-emerald-600', accent: 'text-emerald-300', mark: '●' },
  normal: { ring: 'border-sky-500', accent: 'text-sky-300', mark: '●●' },
  hard: { ring: 'border-red-500', accent: 'text-red-300', mark: '●●●' },
};

const pct = (v: number) => `${v > 1 ? '+' : '−'}${Math.round(Math.abs(v - 1) * 100)}%`;
const sgn = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/** 난이도 카드에 보여 줄 바뀌는 항목 (실제 적용되는 값에서 만든다) */
export function difficultyLines(d: Difficulty): string[] {
  const x = DIFFICULTY[d];
  const out: string[] = [];
  if (d === 'normal') return ['모든 수치가 기본값입니다.'];
  if (x.northForce !== 1) out.push(`북한군 병력 ${pct(x.northForce)}`);
  if (x.southForce !== 1) out.push(`국군 초기 병력 ${pct(x.southForce)}`);
  if (x.northQuality !== 0) out.push(`북한군 훈련·사기 ${sgn(x.northQuality)}`);
  if (x.northCombat !== 1) out.push(`북한군·중국군 전투력 ${pct(x.northCombat)}`);
  if (x.northReplace !== 1) out.push(`북한군 보충 속도 ${pct(x.northReplace)}`);
  if (x.aiAttackRatio !== 1) out.push(x.aiAttackRatio < 1 ? '북한군이 더 공세적' : '북한군이 더 신중');
  if (x.unDelayDays !== 0) out.push(`미군·UN군 도착 ${Math.abs(x.unDelayDays)}일 ${x.unDelayDays < 0 ? '빠름' : '늦음'}`);
  if (x.aidMult !== 1) out.push(`미국 원조 ${pct(x.aidMult)}`);
  out.push(`시작 행정 점수 ${x.startCP}${x.cpBonus ? ` (매 턴 +${x.cpBonus})` : ''} · 보급 자원 ${x.startStock}`);
  if (x.plaExtra !== 0) out.push(`중국군 참전 규모 ${sgn(x.plaExtra)}개 사단`);
  if (x.northWaves !== 1) out.push(`북한·중국 후속 증원 ${pct(x.northWaves)}`);
  return out;
}

export function savedDifficulty(): Difficulty {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'easy' || v === 'normal' || v === 'hard') return v;
  } catch {
    /* 저장소를 쓸 수 없어도 진행에는 문제 없다 */
  }
  return 'normal';
}

/** 시작 화면: 난이도를 고르고 새 게임을 시작하거나 저장된 게임을 이어한다 */
export default function TitleScreen() {
  const newGame = useGame((s) => s.newGame);
  const load = useGame((s) => s.load);
  const saveInfo = useGame((s) => s.saveInfo);
  const setScreen = useGame((s) => s.setScreen);
  const setModal = useGame((s) => s.setModal);
  const have = useGame((s) => s.achievements);
  const inGame = useGame((s) => s.game.turn > 1 || s.game.log.length > 2);
  const [sel, setSel] = useState<Difficulty>(savedDifficulty);
  const choose = (d: Difficulty) => {
    setSel(d);
    try {
      localStorage.setItem(KEY, d);
    } catch {
      /* 무시 */
    }
  };
  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#090c10]" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="mx-auto flex min-h-full max-w-[980px] flex-col px-4 py-5">
        <div className="overflow-hidden rounded border border-[#8a7a4f]/70 shadow-2xl">
          <EventScene kind="dawn_barrage" title="6.25: 운명의 한반도" date="1950-06-25" hideTitle />
          <div className="bg-[#16130c] px-5 pb-4 pt-1 text-center">
            <div className="text-[11px] tracking-[0.35em] text-[#e1c274]">전략 시뮬레이션</div>
            <div className="mt-1 font-serif text-[30px] font-black leading-tight text-[#f4ead0] sm:text-[40px]">6.25: 운명의 한반도</div>
            <div className="mt-1 text-[12px] text-slate-400">대한민국을 지휘해 1953년 정전까지 버텨내십시오.</div>
          </div>
        </div>

        <div className="mt-5 text-center font-serif text-[16px] font-bold text-brass">난이도를 선택하세요</div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {ORDER.map((d) => {
            const x = DIFFICULTY[d];
            const t = TONE[d];
            const on = sel === d;
            return (
              <button
                key={d}
                onClick={() => choose(d)}
                aria-pressed={on}
                className={'flex flex-col items-stretch justify-start rounded-lg border-2 bg-[#10161d] p-3 text-left transition-colors ' + (on ? t.ring + ' bg-[#17202a] shadow-[0_0_18px_rgba(255,255,255,.08)]' : 'border-ink-600 opacity-80 hover:opacity-100')}
              >
                <div className="flex items-center justify-between">
                  <span className={'font-serif text-[20px] font-black ' + t.accent}>{x.label}</span>
                  <span className={'text-[12px] ' + t.accent}>{t.mark}</span>
                </div>
                <div className="mt-1 text-[12px] leading-[1.55] text-slate-300">{x.blurb}</div>
                <ul className="mt-2 flex flex-col gap-0.5 text-[11px] leading-[1.45] text-slate-400">
                  {difficultyLines(d).map((l) => <li key={l}>· {l}</li>)}
                </ul>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-col items-stretch gap-2 sm:flex-row sm:justify-center">
          <button className="btn btn-primary !px-10 !py-3 !text-[17px] tracking-widest" onClick={() => newGame(sel)}>새 게임 시작 ▶</button>
          {saveInfo.exists && (
            <button className="btn !px-6 !py-3 !text-[14px]" onClick={load}>이어하기 (저장: {saveInfo.turn}턴 · {saveInfo.date ? formatDate(saveInfo.date) : ''})</button>
          )}
          {inGame && <button className="btn !px-6 !py-3 !text-[14px]" onClick={() => setScreen('game')}>진행 중인 게임으로 돌아가기</button>}
          <button className="btn !px-6 !py-3 !text-[14px]" onClick={() => setModal('achievements')}>🏆 업적 ({ACHIEVEMENTS.filter((a) => have[a.id]).length}/{ACHIEVEMENTS.length})</button>
        </div>
        <div className="mt-3 text-center text-[11px] text-slate-600">난이도는 새 게임을 시작할 때만 정할 수 있습니다. 이어하기는 저장한 난이도 그대로 진행됩니다.</div>
      </div>
    </div>
  );
}
