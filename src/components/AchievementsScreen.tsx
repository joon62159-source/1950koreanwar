import { useGame } from '../store/gameStore';
import { ACHIEVEMENTS } from '../game/achievements';
import { DIFFICULTY } from '../game/balance';
import type { Difficulty } from '../game/types';

const GROUPS = ['작전', '정세', '생존', '결말'] as const;

/** 업적 목록 화면 (시작 화면·메뉴에서 연다) */
export default function AchievementsScreen() {
  const have = useGame((s) => s.achievements);
  const gameAch = useGame((s) => s.gameAch);
  const setModal = useGame((s) => s.setModal);
  const count = ACHIEVEMENTS.filter((a) => have[a.id]).length;
  return (
    <div className="fixed inset-0 z-[78] flex flex-col bg-[#090c10]" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex shrink-0 items-center justify-between border-b border-ink-700 bg-[#0f151c] px-3 py-2.5">
        <div>
          <div className="font-serif text-[18px] font-black text-brass">업적</div>
          <div className="text-[11px] text-slate-500">{count} / {ACHIEVEMENTS.length} 달성</div>
        </div>
        <button className="btn !px-4 !py-2 !text-[14px]" onClick={() => setModal(null)}>닫기 ✕</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="mx-auto max-w-[900px]">
          <div className="mb-3 h-2 overflow-hidden rounded bg-ink-800"><div className="h-full bg-[#c9a24b] transition-all" style={{ width: `${(count / ACHIEVEMENTS.length) * 100}%` }} /></div>
          {GROUPS.map((g) => (
            <section key={g} className="mb-4">
              <div className="panel-title mb-1.5">▍{g}</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ACHIEVEMENTS.filter((a) => a.group === g).map((a) => {
                  const r = have[a.id];
                  const isNew = gameAch.includes(a.id);
                  return (
                    <div key={a.id} className={'flex items-start gap-3 rounded border p-2.5 ' + (r ? 'border-[#8a7a4f] bg-[#1c1a10]' : 'border-ink-600 bg-ink-900/70 opacity-70')}>
                      <div className={'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-[22px] ' + (r ? 'border-[#c9a24b] bg-[#2a2410]' : 'border-ink-600 bg-ink-800 grayscale')}>{r ? a.icon : '🔒'}</div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={'font-bold ' + (r ? 'text-[#f1e3b7]' : 'text-slate-400')}>{a.title}</span>
                          {isNew && <span className="tag tag-fake">NEW</span>}
                        </div>
                        <div className="text-[12px] leading-[1.45] text-slate-400">{a.desc}</div>
                        {r && <div className="mt-0.5 text-[10.5px] text-[#b6a679]">{r.date} · {r.turn}턴째 · {DIFFICULTY[r.difficulty as Difficulty]?.label ?? r.difficulty}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          <div className="pb-4 text-center text-[11px] text-slate-600">업적은 이 기기에 저장되며 새 게임을 시작해도 남습니다. 38선에서 일찍 끝낸 이른 정전은 승리 업적에 포함되지 않습니다.</div>
        </div>
      </div>
    </div>
  );
}
