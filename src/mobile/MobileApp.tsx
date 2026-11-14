import { useEffect, useState } from 'react';
import { useGame } from '../store/gameStore';
import { totalStrength, unitsAt } from '../game/units';
import { attackableTargets } from '../game/orders';
import { sideTotals } from '../game/casualty';
import { formatDate, turnDaysFor } from '../game/util';
import MapView from '../components/MapView';
import PlaybackPanel from '../components/PlaybackPanel';
import ModalLayer from '../components/ModalLayer';
import LeftPanel from '../components/LeftPanel';
import RightPanel from '../components/RightPanel';
import { Bar, colorFor, fmt } from '../components/common';

type SheetId = 'status' | 'log' | null;

const KIND_COLOR: Record<string, string> = { info: 'text-slate-300', battle: 'text-orange-300', event: 'text-yellow-200', warn: 'text-red-300', good: 'text-emerald-300' };

/** 상단 상태 바 (문명의 시대처럼 자원 칩만 간단히). 누르면 상세 상황 화면이 열린다. */
function Hud({ onOpen }: { onOpen: () => void }) {
  const game = useGame((s) => s.game);
  const setModal = useGame((s) => s.setModal);
  const me = game.nations[game.playerSide];
  const strength = totalStrength(game, game.playerSide);
  const chip = (label: string, value: string, color?: string) => (
    <div className="flex min-w-0 flex-1 flex-col items-center leading-tight">
      <span className="text-[9.5px] tracking-wider text-slate-500">{label}</span>
      <span className="text-[14px] font-bold tabular-nums" style={{ color }}>{value}</span>
    </div>
  );
  return (
    <header data-tour="topbar" className="flex shrink-0 items-stretch gap-1 border-b border-ink-700 bg-[#0f151c] px-2 pb-1.5" style={{ paddingTop: 'max(6px, env(safe-area-inset-top))' }}>
      <button className="flex min-w-[78px] flex-col justify-center pr-1 text-left leading-tight" onClick={onOpen} aria-label="상황 보기">
        <span className="font-serif text-[15px] font-black text-brass">{formatDate(game.date).replace(/^\d{4}년 /, '')}</span>
        <span className="text-[9.5px] text-slate-500">{game.date.slice(0, 4)} · T{game.turn} · {turnDaysFor(game.date)}일</span>
      </button>
      <button className="flex min-w-0 flex-1 items-center gap-1 rounded bg-ink-800/60 px-1.5 active:bg-ink-700" onClick={onOpen} aria-label="상세 상황">
        {chip('병력', fmt(strength))}
        {chip('보급', fmt(me.supplyStock), colorFor(Math.min(100, me.supplyStock / 3)))}
        {chip('전쟁능력', String(me.warCapacity), colorFor(me.warCapacity))}
        {chip('지지', String(Math.round(me.popularSupport)), colorFor(me.popularSupport))}
      </button>
      <button className="flex w-11 items-center justify-center rounded border border-ink-600 bg-ink-800 text-[20px] active:bg-ink-700" onClick={() => setModal('menu')} aria-label="메뉴">☰</button>
    </header>
  );
}

/** 하단 행동 바: 왼쪽 보조 버튼 3개 + 오른쪽 큰 [턴 종료] */
function ActionBar({ onSheet }: { onSheet: (s: SheetId) => void }) {
  const game = useGame((s) => s.game);
  const endTurn = useGame((s) => s.endTurn);
  const setModal = useGame((s) => s.setModal);
  const playing = useGame((s) => s.playback !== null);
  const blocked = game.pendingEvents.length > 0 || !!game.outcome || playing;
  const mine = Object.values(game.units).filter((u) => u.side === game.playerSide);
  const idle = mine.filter((u) => !u.order).length;
  const sub = 'flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg border border-ink-600 bg-ink-800 text-[11px] text-slate-300 active:bg-ink-700';
  return (
    <footer className="flex shrink-0 gap-1.5 border-t border-ink-700 bg-[#0f151c] px-2 pt-2" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
      <button data-tour="status" className={sub} onClick={() => onSheet('status')}><span className="text-[18px] leading-none">📊</span>상황</button>
      <button className={sub} onClick={() => onSheet('log')}><span className="text-[18px] leading-none">📜</span>기록</button>
      <button data-tour="manage" className={sub} onClick={() => setModal('manage')}><span className="text-[18px] leading-none">🏛</span>국가</button>
      <button data-tour="endturn" className="flex min-h-[52px] flex-[2] items-center justify-center gap-2 rounded-lg border border-[#b04848] bg-[#7b2a2a] text-[15px] font-black tracking-wider text-white active:bg-[#983535] disabled:opacity-40" disabled={blocked} onClick={endTurn}>
        <span className="whitespace-nowrap">턴 종료 ▶</span>
        {!blocked && idle > 0 && <span className="rounded-full bg-black/35 px-1.5 text-[11px] font-bold" title="명령 대기 부대">{idle}</span>}
      </button>
    </footer>
  );
}

/** 전체 화면 시트 (상황·기록) */
function FullSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[35] flex flex-col bg-[#0b0f14]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex shrink-0 items-center justify-between border-b border-ink-700 bg-[#0f151c] px-3 py-2.5">
        <div className="font-serif text-[17px] font-black text-brass">{title}</div>
        <button className="btn !px-4 !py-2 !text-[14px]" onClick={onClose}>닫기 ✕</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>{children}</div>
    </div>
  );
}

function StatusBody() {
  const game = useGame((s) => s.game);
  const me = game.nations[game.playerSide];
  const d = game.diplomacy;
  const strength = totalStrength(game, game.playerSide);
  const rows: [string, number, boolean][] = [['미국 개입', d.usCommitment, false], ['UN 지지', d.unSupport, false], ['중국 개입 위험', d.chinaThreat, true], ['소련 지원(적)', d.sovietSupport, true]];
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 p-3">
        {([['총병력', fmt(strength), undefined], ['보급 자원', fmt(me.supplyStock), colorFor(Math.min(100, me.supplyStock / 3))], ['전쟁수행능력', String(me.warCapacity), colorFor(me.warCapacity)], ['국민 지지', String(Math.round(me.popularSupport)), colorFor(me.popularSupport)]] as const).map(([l, v, c]) => (
          <div key={l} className="rounded border border-ink-600 bg-ink-800/60 px-3 py-2">
            <div className="text-[11px] text-slate-500">{l}</div>
            <div className="text-[20px] font-bold tabular-nums" style={{ color: c }}>{v}</div>
          </div>
        ))}
      </div>
      <div className="mx-3 mb-2 rounded border border-ink-600 bg-ink-800/60 p-3">
        <div className="panel-title mb-2">▍외교 · 국제 정세</div>
        <div className="flex flex-col gap-2.5">
          {rows.map(([l, v, inv]) => (
            <div key={l}>
              <div className="flex justify-between text-[12.5px] text-slate-300"><span>{l}</span><b className="tabular-nums">{Math.round(v)}</b></div>
              <Bar value={v} color={colorFor(v, inv)} />
            </div>
          ))}
        </div>
      </div>
      <LeftPanel embedded />
    </div>
  );
}

function LogBody() {
  const game = useGame((s) => s.game);
  const showBattle = useGame((s) => s.showBattle);
  const setModal = useGame((s) => s.setModal);
  const playing = useGame((s) => s.playback !== null);
  return (
    <div className="flex flex-col gap-3 p-3">
      <section>
        <div className="mb-1 flex items-center justify-between"><div className="panel-title">▍직전 전투 결과</div><button className="text-[12px] text-sky-300 underline" onClick={() => setModal('allBattles')}>전체 보기</button></div>
        {game.reports.length === 0 && <div className="text-[12px] text-slate-500">아직 전투가 없습니다.</div>}
        <div className="flex flex-col gap-1">
          {game.reports.slice(-12).reverse().map((r) => {
            const ours = r.attackerSide === game.playerSide;
            const win = (r.outcome === 'attacker_win') === ours;
            const label = r.outcome === 'draw' ? '교착' : win ? '승리' : '패배';
            return (
              <button key={r.id} className="flex w-full items-center justify-between rounded border border-ink-600 bg-ink-800/60 px-3 py-2.5 text-left text-[13px] active:bg-ink-700" onClick={() => showBattle(r.id)}>
                <span>{r.provinceName} <span className="text-slate-500">({ours ? '공격' : '방어'})</span></span>
                <span className={r.outcome === 'draw' ? 'text-slate-300' : win ? 'text-emerald-300' : 'text-red-300'}>{label}</span>
              </button>
            );
          })}
        </div>
      </section>
      <section>
        <div className="panel-title mb-1">▍총 사상자 (누적)</div>
        {playing ? (
          <div className="text-[12px] text-slate-500">전투 재생이 끝나면 표시됩니다.</div>
        ) : (
          <table className="w-full rounded border border-ink-600 bg-ink-800/60 text-[12px]">
            <thead>
              <tr className="text-slate-500"><th className="px-2 py-1 text-left font-normal"> </th><th className="text-right font-normal">전사</th><th className="text-right font-normal">부상</th><th className="text-right font-normal">포로</th><th className="pr-2 text-right font-normal">합계</th></tr>
            </thead>
            <tbody>
              {([['한국·UN', 'south', 'text-sky-300'], ['북한·중공', 'north', 'text-red-300']] as const).map(([label, side, cls]) => {
                const t = sideTotals(game, side);
                return (
                  <tr key={side}>
                    <td className={'whitespace-nowrap px-2 py-1.5 font-bold ' + cls}>{label}</td>
                    <td className="text-right tabular-nums">{fmt(t.killed)}</td>
                    <td className="text-right tabular-nums">{fmt(t.wounded)}</td>
                    <td className="text-right tabular-nums">{fmt(t.prisoners)}</td>
                    <td className="pr-2 text-right font-bold tabular-nums">{fmt(t.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
      <section>
        <div className="panel-title mb-1">▍전쟁 상황 기록</div>
        <div className="rounded border border-ink-600 bg-ink-800/40 p-2 text-[12.5px] leading-[1.55]">
          {game.log.slice(-80).reverse().map((l, i) => (
            <div key={i} className={KIND_COLOR[l.kind]}><span className="mr-1.5 text-slate-600">{l.date.slice(5).replace('-', '/')}</span>{l.text}</div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** 지역을 누르면 아래에서 올라오는 시트: 핵심 명령 4개를 큰 버튼으로, 상세는 펼쳐서 본다 */
function ProvinceSheet() {
  const game = useGame((s) => s.game);
  const selected = useGame((s) => s.selectedProvince);
  const selectedUnits = useGame((s) => s.selectedUnits);
  const mode = useGame((s) => s.mode);
  const setMode = useGame((s) => s.setMode);
  const orderUnits = useGame((s) => s.orderUnits);
  const selectProvince = useGame((s) => s.selectProvince);
  const selectAllHere = useGame((s) => s.selectAllHere);
  const playing = useGame((s) => s.playback !== null);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => setExpanded(false), [selected]);
  if (!selected || playing) return null;
  const p = game.provinces[selected];
  const mine = unitsAt(game, p.id, game.playerSide);
  const enemy = unitsAt(game, p.id, game.playerSide === 'south' ? 'north' : 'south');
  const sel = selectedUnits.filter((id) => game.units[id]);
  const canAttack = sel.some((id) => attackableTargets(game, game.units[id]).length > 0);

  // 이동·공격 대상 고르는 중: 시트를 작은 안내줄로 바꿔 지도를 가리지 않는다
  if (mode !== 'select') {
    return (
      <div className="absolute inset-x-2 bottom-2 z-20 flex items-center justify-between gap-2 rounded-xl border border-yellow-600/70 bg-[#1a1608]/95 px-3 py-2.5 shadow-xl">
        <div className="text-[13px] leading-snug text-yellow-100">
          <b>{mode === 'move' ? '이동할 아군 지역' : '공격할 적 지역'}</b>을 지도에서 터치하세요
          <div className="text-[11px] text-yellow-200/70">강조된 곳 · 선택한 부대 {sel.length}개</div>
        </div>
        <button className="btn !px-4 !py-2.5 !text-[14px]" onClick={() => setMode('select')}>취소</button>
      </div>
    );
  }

  const act = 'flex min-h-[54px] flex-col items-center justify-center gap-0.5 rounded-lg border text-[13px] font-bold active:brightness-125 disabled:opacity-35';
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-2xl border-t border-[#3a4a5e] bg-[#0f151c]/[0.98] shadow-[0_-10px_30px_rgba(0,0,0,.65)]" style={{ height: expanded ? '74%' : 'auto', maxHeight: '78%' }}>
      <button className="flex h-6 w-full shrink-0 items-center justify-center" onClick={() => setExpanded(!expanded)} aria-label={expanded ? '시트 줄이기' : '시트 펼치기'}>
        <span className="h-1.5 w-12 rounded-full bg-slate-600" />
      </button>
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 pb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-serif text-[18px] font-black">{p.name}</span>
            <span className={'tag ' + (p.owner === game.playerSide ? 'border-south text-south' : 'border-north text-north')}>{p.owner === 'south' ? '대한민국' : '북한'}</span>
          </div>
          <div className="text-[11px] text-slate-400">
            보급 {p.supplied ? <b style={{ color: colorFor(p.supplyLevel) }}>{p.supplyLevel}</b> : <b className="text-red-400">단절</b>} · 전략가치 {p.strategicValue} · 아군 {mine.length}{enemy.length > 0 ? ` · 적 ${enemy.length}` : ''}
          </div>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button className="btn !px-3 !py-2 !text-[13px]" onClick={() => setExpanded(!expanded)}>{expanded ? '접기 ▼' : '상세 ▲'}</button>
          <button className="btn !px-3 !py-2 !text-[14px]" onClick={() => selectProvince(null)} aria-label="닫기">✕</button>
        </div>
      </div>
      {mine.length > 0 && !expanded && (
        <div className="shrink-0 px-3 pb-3">
          <div className="mb-1.5 flex items-center justify-between text-[12px] text-slate-400">
            <span>선택한 부대 <b className="text-sky-300">{sel.length}</b> / {mine.length}</span>
            <button className="text-sky-300 underline" onClick={selectAllHere}>전체 선택</button>
          </div>
          <div className="grid grid-cols-4 gap-1.5" data-tour="orders">
            <button className={act + ' border-sky-700 bg-[#1b3a63] text-sky-100'} disabled={!sel.length} onClick={() => setMode('move')}><span className="text-[17px] leading-none">➜</span>이동</button>
            <button className={act + ' border-red-700 bg-[#6a2626] text-red-100'} disabled={!sel.length || !canAttack} onClick={() => setMode('attack')}><span className="text-[17px] leading-none">⚔</span>공격</button>
            <button className={act + ' border-ink-500 bg-ink-800 text-slate-200'} disabled={!sel.length} onClick={() => orderUnits('defend')}><span className="text-[17px] leading-none">🛡</span>방어</button>
            <button className={act + ' border-ink-500 bg-ink-800 text-slate-200'} disabled={!sel.length} onClick={() => orderUnits('rest')}><span className="text-[17px] leading-none">⛺</span>휴식</button>
          </div>
        </div>
      )}
      {mine.length === 0 && !expanded && (
        <div className="shrink-0 px-3 pb-3 text-[12.5px] text-slate-400">
          {enemy.length > 0 ? `적 부대 ${enemy.length}개가 있습니다. 인접한 아군 지역의 부대로 [공격]하세요.` : '이 지역에는 아군 부대가 없습니다. 상세를 펼쳐 지역 정보를 보세요.'}
        </div>
      )}
      {expanded && (
        <div className="min-h-0 flex-1 overflow-y-auto border-t border-ink-700">
          <RightPanel embedded />
        </div>
      )}
    </div>
  );
}

export default function MobileApp() {
  const [sheet, setSheet] = useState<SheetId>(null);
  const playing = useGame((s) => s.playback !== null);
  const game = useGame((s) => s.game);
  return (
    <div className="mobile-root flex flex-col overflow-hidden bg-[#0a1118] text-slate-200" style={{ height: '100dvh' }}>
      <Hud onOpen={() => setSheet('status')} />
      <main className="relative min-h-0 flex-1" data-tour="map">
        <MapView />
        {playing && <PlaybackPanel />}
        <ProvinceSheet />
        {!playing && game.pendingEvents.length > 0 && (
          <div className="pointer-events-none absolute left-1/2 top-14 -translate-x-1/2 rounded-full border border-yellow-600/70 bg-black/70 px-3 py-1 text-[11.5px] text-yellow-200">⚠ 결정할 사건이 있습니다</div>
        )}
      </main>
      <ActionBar onSheet={setSheet} />
      {sheet === 'status' && <FullSheet title="상황" onClose={() => setSheet(null)}><StatusBody /></FullSheet>}
      {sheet === 'log' && <FullSheet title="기록" onClose={() => setSheet(null)}><LogBody /></FullSheet>}
      <ModalLayer />
    </div>
  );
}
