import { useEffect } from 'react';
import { useGame } from '../store/gameStore';
import type { BattleReport, RosterEntry } from '../game/types';
import { fmt } from './common';
import { formatDate } from '../game/util';

const sideName = (s: string) => (s === 'north' ? '북한군' : '대한민국·UN군');

function Roster({ list, color }: { list: RosterEntry[]; color: string }) {
  const game = useGame((s) => s.game);
  const total = list.reduce((a, e) => ({ b: a.b + e.before, a: a.a + e.after }), { b: 0, a: 0 });
  return (
    <div>
      <div className="mb-0.5 text-[11px]" style={{ color }}>전투 전 {fmt(total.b)} → 전투 후 가용 {fmt(total.a)}<br />전사 {fmt(list.reduce((s, e) => s + e.killed, 0))} · 부상 {fmt(list.reduce((s, e) => s + e.wounded, 0))} · 실종·포로 {fmt(list.reduce((s, e) => s + e.missing, 0))}</div>
      <div className="max-h-[84px] overflow-y-auto text-[11px] leading-[1.45] text-slate-300">
        {list.map((e) => (
          <div key={e.id} className="flex justify-between gap-2">
            <span className="truncate">{e.name} <span className="text-slate-500">({game.provinces[e.from]?.name})</span></span>
            <span className="tabular-nums" title={`전사 ${e.killed} · 부상 ${e.wounded} · 실종·포로 ${e.missing}`}>{fmt(e.before)}→{e.destroyed ? <b className="text-red-400">전멸</b> : fmt(e.after)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BattleResult({ r }: { r: BattleReport }) {
  const game = useGame((s) => s.game);
  const verdict = r.outcome === 'attacker_win' ? `공격 성공 — ${sideName(r.attackerSide)} 승리` : r.outcome === 'defender_win' ? `방어 성공 — ${sideName(r.attackerSide === 'north' ? 'south' : 'north')} 승리` : '교착 (결정적 승패 없음)';
  const defSide = r.attackerSide === 'north' ? 'south' : 'north';
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-2 text-[12.5px]">
        <b className="text-[15px]">{r.provinceName} 전투 결과</b>
        <span className={r.outcome === 'attacker_win' ? 'text-orange-300' : r.outcome === 'defender_win' ? 'text-sky-300' : 'text-slate-300'}>{verdict}</span>
        <span className="tag">{r.captured ? `점령: ${sideName(r.attackerSide)} 통제로 전환` : '점령 없음 (기존 통제 유지)'}</span>
        {r.retreatTo && <span className="tag">후퇴: {game.provinces[r.retreatTo].name}로 이동</span>}
        {r.surrounded && <span className="tag border-red-500 text-red-300">포위</span>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded border border-ink-600 bg-ink-800/60 p-1.5">
          <div className="mb-0.5 text-[11.5px] font-bold" style={{ color: r.attackerSide === 'north' ? '#ff8a8a' : '#8fc4ff' }}>공격측 · {sideName(r.attackerSide)}</div>
          <Roster list={r.attackerRoster} color="#cbd5e1" />
        </div>
        <div className="rounded border border-ink-600 bg-ink-800/60 p-1.5">
          <div className="mb-0.5 text-[11.5px] font-bold" style={{ color: defSide === 'north' ? '#ff8a8a' : '#8fc4ff' }}>방어측 · {sideName(defSide)}</div>
          <Roster list={r.defenderRoster} color="#cbd5e1" />
        </div>
      </div>
      <div className="mt-1 text-[11px] text-slate-400">전투력 {fmt(r.attackerPower)} vs {fmt(r.defenderPower)} · 가용 병력 감소 공격측 {fmt(r.attackerLosses)} / 방어측 {fmt(r.defenderLosses)} · 사기 {r.moraleChange.attacker >= 0 ? '+' : ''}{r.moraleChange.attacker}/{r.moraleChange.defender >= 0 ? '+' : ''}{r.moraleChange.defender} · {r.reasons[1] ?? ''}</div>
    </div>
  );
}

export default function PlaybackPanel() {
  const game = useGame((s) => s.game);
  const pb = useGame((s) => s.playback)!;
  const next = useGame((s) => s.playNext);
  const toResult = useGame((s) => s.playToResult);
  const setAuto = useGame((s) => s.setAuto);
  const skip = useGame((s) => s.skipPlayback);
  const setModal = useGame((s) => s.setModal);
  const steps = game.lastTurn?.steps ?? [];
  const step = steps[pb.index];
  const battleSteps = steps.filter((s) => s.kind !== 'movement');
  const nth = step ? battleSteps.findIndex((s) => s.id === step.id) + 1 : 0;
  const report = step?.reportId ? game.reports.find((r) => r.id === step.reportId) : undefined;

  // 자동 진행 타이머: 각 단계는 로직이 이미 확정된 기록을 재생할 뿐이라 일시정지·건너뛰기가 결과를 바꾸지 않는다
  useEffect(() => {
    if (!pb.auto) return;
    const t = setTimeout(() => (pb.phase === 'intro' ? toResult() : next()), pb.phase === 'intro' ? 1500 : 3600);
    return () => clearTimeout(t);
  }, [pb.auto, pb.phase, pb.index, next, toResult]);

  if (!step) return null;
  const moved = step.unitMoves.length;
  const isLast = pb.index >= steps.length - 1;

  return (
    <div className="fade-in pointer-events-auto fixed bottom-[184px] left-[262px] right-[312px] z-30 rounded border border-yellow-700/70 bg-[#0d141c]/95 p-3 shadow-2xl">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="panel-title">
          ▍{formatDate(game.lastTurn!.date)} 턴 진행 — {step.kind === 'movement' ? '부대 이동' : `전투 ${nth}/${battleSteps.length}`}
        </div>
        <div className="flex items-center gap-1.5">
          <button className={'btn ' + (pb.auto ? 'btn-blue' : '')} onClick={() => setAuto(!pb.auto)}>{pb.auto ? '⏸ 일시정지' : '▶ 자동 진행'}</button>
          <button className="btn" onClick={() => setModal('allBattles')}>전체 전투 결과</button>
          <button className="btn" onClick={skip} title="남은 연출을 모두 건너뜁니다. 게임 결과는 동일합니다.">연출 건너뛰기 ⏭</button>
          <button className="btn btn-primary" onClick={next}>{pb.phase === 'intro' ? '결과 보기' : isLast ? '턴 종합 보고 ▶' : '다음 전투 ▶'}</button>
        </div>
      </div>
      {pb.phase === 'intro' && step.kind === 'battle' && (
        <div className="flex items-center gap-3 py-2 text-[14px]">
          <span className="text-2xl">⚔</span>
          <b>{step.title} 시작</b>
          <span className="text-slate-400">— 교전 중… (지도가 해당 지역으로 이동합니다)</span>
        </div>
      )}
      {pb.phase === 'intro' && step.kind === 'occupy' && <div className="py-2 text-[14px]"><b>{step.title}</b> 진행 중…</div>}
      {pb.phase === 'result' && step.kind === 'battle' && report && <BattleResult r={report} />}
      {pb.phase === 'result' && step.kind === 'occupy' && (
        <div className="text-[13px]">
          <b>{step.title}</b> — 저항 없이 점령되었습니다. 지역 통제가 {step.ownerChanges.map((c) => `${sideName(c.from)}→${sideName(c.to)}`).join(', ')}로 전환되었습니다.
        </div>
      )}
      {pb.phase === 'result' && step.kind === 'movement' && (
        <div className="text-[13px]">
          <b>부대 이동</b> — {moved}개 여단이 행군했습니다. 이어서 전투를 하나씩 확인합니다.
        </div>
      )}
    </div>
  );
}
