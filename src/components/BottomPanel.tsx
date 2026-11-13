import { useEffect, useRef } from 'react';
import { useGame } from '../store/gameStore';
import { turnDaysFor, formatDate, addDays } from '../game/util';
import { sideTotals } from '../game/casualty';
import { fmt } from './common';

const KIND_COLOR: Record<string, string> = { info: 'text-slate-300', battle: 'text-orange-300', event: 'text-yellow-200', warn: 'text-red-300', good: 'text-emerald-300' };

export default function BottomPanel() {
  const game = useGame((s) => s.game);
  const endTurn = useGame((s) => s.endTurn);
  const setModal = useGame((s) => s.setModal);
  const showBattle = useGame((s) => s.showBattle);
  const playing = useGame((s) => s.playback !== null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [game.log.length]);
  const mine = Object.values(game.units).filter((u) => u.side === game.playerSide);
  const ordered = mine.filter((u) => u.order && u.order.issuedTurn === game.turn).length;
  const idle = mine.filter((u) => !u.order).length;
  const days = turnDaysFor(game.date);
  const blocked = game.pendingEvents.length > 0 || !!game.outcome || playing;
  return (
    <footer className="panel flex h-[176px] shrink-0 border-x-0 border-b-0">
      <div className="flex w-[260px] shrink-0 flex-col gap-1 border-r border-ink-700 p-2">
        <div className="flex items-center justify-between"><div className="panel-title">▍직전 전투 결과</div><button className="text-[10px] text-sky-300 hover:underline" onClick={() => setModal('allBattles')}>전체 보기</button></div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {playing && <div className="text-[11px] text-slate-500">전투 재생이 끝나면 표시됩니다.</div>}
          {!playing && game.reports.length === 0 && <div className="text-[11px] text-slate-500">아직 전투가 없습니다.</div>}
          {(playing ? [] : game.reports).map((r) => {
            const ours = r.attackerSide === game.playerSide;
            const win = (r.outcome === 'attacker_win') === ours;
            const label = r.outcome === 'draw' ? '교착' : win ? '승리' : '패배';
            return (
              <button key={r.id} className="mb-0.5 flex w-full items-center justify-between rounded px-1.5 py-0.5 text-left text-[11px] hover:bg-ink-700" onClick={() => showBattle(r.id)}>
                <span>{r.provinceName} <span className="text-slate-500">({ours ? '공격' : '방어'})</span></span>
                <span className={r.outcome === 'draw' ? 'text-slate-300' : win ? 'text-emerald-300' : 'text-red-300'}>{label}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-0.5 shrink-0 border-t border-ink-700 pt-1">
          <div className="panel-title">▍총 사상자 (누적)</div>
          {playing ? (
            <div className="text-[10.5px] text-slate-500">재생이 끝나면 표시됩니다.</div>
          ) : (
            <table className="w-full text-[10.5px] leading-[1.35]">
              <thead>
                <tr className="text-slate-500"><th className="text-left font-normal"> </th><th className="text-right font-normal">전사</th><th className="text-right font-normal">부상</th><th className="text-right font-normal">실종</th><th className="text-right font-normal">포로</th><th className="text-right font-normal">합계</th></tr>
              </thead>
              <tbody>
                {([['한국·UN', 'south', 'text-sky-300'], ['북한·중공', 'north', 'text-red-300']] as const).map(([label, side, cls]) => {
                  const t = sideTotals(game, side);
                  return (
                    <tr key={side} title={side === 'south' ? '국군 + 미군 + UN군 합산' : '북한군 + 중국군 합산'}>
                      <td className={'whitespace-nowrap font-bold ' + cls}>{label}</td>
                      <td className="text-right tabular-nums">{fmt(t.killed)}</td>
                      <td className="text-right tabular-nums">{fmt(t.wounded)}</td>
                      <td className="text-right tabular-nums">{fmt(t.missing)}</td>
                      <td className="text-right tabular-nums">{fmt(t.prisoners)}</td>
                      <td className="text-right font-bold tabular-nums">{fmt(t.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-2">
        <div className="panel-title">▍전쟁 상황 기록</div>
        <div ref={ref} className="mt-0.5 flex-1 overflow-y-auto pr-1 text-[11.5px] leading-[1.5]">
          {game.log.filter((l) => !playing || l.turn < (game.lastTurn?.turn ?? Infinity)).slice(-60).map((l, i) => (
            <div key={i} className={KIND_COLOR[l.kind]}><span className="mr-1.5 text-slate-600">{l.date.slice(5).replace('-', '/')}</span>{l.text}</div>
          ))}
        </div>
      </div>
      <div className="flex w-[250px] shrink-0 flex-col justify-between gap-1 border-l border-ink-700 p-2">
        <div className="text-[11px] leading-[1.5] text-slate-400">
          명령 내린 부대 <b className="text-sky-300">{ordered}</b> · 대기 {idle}
          <br />
          이번 턴: {formatDate(game.date)} ~ {formatDate(addDays(game.date, days - 1))}
          {game.pendingEvents.length > 0 && <div className="text-yellow-300">⚠ 결정해야 할 사건이 있습니다</div>}
        </div>
        <div className="flex gap-1.5">
          <button className="btn" onClick={() => setModal('briefing')} disabled={!game.briefing.length}>브리핑</button>
          <button data-tour="endturn" className="btn btn-primary flex-1 py-2 text-[14px] tracking-widest" disabled={blocked} onClick={endTurn}>턴 종료 ▶</button>
        </div>
      </div>
    </footer>
  );
}
