import { useState } from 'react';
import { useGame } from '../store/gameStore';
import { EVENT_BY_ID, type Effect } from '../data/events';
import { NARRATIVES, describeEffects, situationLines } from '../data/eventNarrative';
import EventScene from './EventScene';
import { formatDate } from '../game/util';
import { fmt } from './common';
import { SCORE } from '../game/balance';
import type { BattleReport } from '../game/types';
import { buildLandingPlan, type LandingReport } from '../game/amphibious';
import { CasualtyPanel, ManagementBody, MobilizationPreview, MobilizedReportModalBody } from './NationPanels';
import { useMemo } from 'react';

function Shell({ children, width = 640, z = 40 }: { children: React.ReactNode; width?: number; z?: number }) {
  return (
    <div className="modal-bg fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: z }}>
      <div className="fade-in max-h-[92vh] overflow-y-auto" style={{ width, maxWidth: '100%' }}>{children}</div>
    </div>
  );
}

const TONE: Record<string, string> = {
  good: 'border-emerald-700/70 bg-emerald-950/50 text-emerald-200',
  bad: 'border-red-800/70 bg-red-950/50 text-red-200',
  neutral: 'border-slate-600/70 bg-slate-800/50 text-slate-200',
};

function EffectChips({ effects }: { effects: Effect[] }) {
  const game = useGame((s) => s.game);
  const lines = useMemo(() => describeEffects(effects, game), [effects, game]);
  if (!lines.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {lines.map((l, i) => <span key={i} className={'rounded border px-1.5 py-0.5 text-[11px] ' + TONE[l.tone]}>{l.text}</span>)}
    </div>
  );
}

/** HOI4식 이벤트 창: 장면 그림 → 서술 → 전황 보고 → 선택지(효과 목록) */
export function EventModal() {
  const game = useGame((s) => s.game);
  const choose = useGame((s) => s.chooseEvent);
  const pending = game.pendingEvents[0];
  const [pick, setPick] = useState<string | null>(null);
  const ev = pending ? EVENT_BY_ID[pending.eventId] : null;
  const nar = ev ? NARRATIVES[ev.id] : undefined;
  const sit = useMemo(() => (ev ? situationLines(game, ev.id) : []), [game, ev]);
  if (!pending || !ev) return null;
  const needChoice = ev.choices.length > 0;
  return (
    <Shell width={760} z={60}>
      <div className="overflow-hidden rounded border border-[#8a7a4f] bg-[#16130c] text-[#e9dfc2] shadow-[0_12px_50px_rgba(0,0,0,0.8)]">
        <EventScene kind={nar?.scene ?? 'advance'} title={ev.title} kicker={nar?.kicker} date={formatDate(game.date)} />
        <div className="p-5">
          {ev.isCounterfactual && <div className="mb-2"><span className="tag tag-fake">가상 시나리오</span></div>}
          {nar ? (
            <div className="flex flex-col gap-2.5 font-serif text-[14.5px] leading-[1.8] text-[#efe6cb]">
              {nar.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
              {nar.quote && (
                <blockquote className="border-l-2 border-[#c9a24b] pl-3 italic text-[#e1c274]">
                  “{nar.quote.text}”<span className="ml-2 text-[12px] not-italic text-[#a99a6e]">— {nar.quote.by}</span>
                </blockquote>
              )}
            </div>
          ) : (
            <p className="font-serif text-[14.5px] leading-[1.8] text-[#efe6cb]">{ev.description}</p>
          )}

          <div className="mt-4 rounded border border-[#3a3220] bg-black/30 p-3">
            <div className="mb-1 text-[11px] font-bold tracking-[0.25em] text-[#c9a24b]">현재 전황</div>
            <ul className="grid grid-cols-1 gap-x-6 gap-y-0.5 text-[12.5px] leading-[1.55] text-[#d9ceb0] sm:grid-cols-2">
              {sit.map((l, i) => <li key={i} className="flex gap-1.5"><span className="text-[#c9a24b]">▸</span><span>{l}</span></li>)}
            </ul>
          </div>

          {ev.effects.length > 0 && (
            <div className="mt-3">
              <div className="text-[11px] font-bold tracking-[0.25em] text-[#c9a24b]">즉시 반영된 영향</div>
              <EffectChips effects={ev.effects} />
            </div>
          )}

          <div className="mt-3 text-[#2a2418]">
            {ev.operation && <LandingPlanPanel opId={ev.operation} />}
            {ev.mobilization && <div className="mt-3"><MobilizationPreview /></div>}
            {ev.casualtyReport && <div className="mt-3"><CasualtyPanel /></div>}
          </div>

          {needChoice && (
            <div className="mt-4 flex flex-col gap-2">
              {ev.choices.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setPick(c.id)}
                  className={'rounded border p-3 text-left transition ' + (pick === c.id ? 'border-[#e1c274] bg-[#2d2616] shadow-[inset_0_0_0_1px_#e1c274]' : 'border-[#4a3f26] bg-[#1d1910] hover:border-[#a88c4a] hover:bg-[#25201a]')}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[14.5px] font-bold text-[#f4ead0]">{c.label}</span>
                    {c.isCounterfactual && <span className="tag tag-fake">가상</span>}
                  </div>
                  <div className="mt-1 text-[12.5px] leading-[1.55] text-[#c9bd9a]">{c.description}</div>
                  <EffectChips effects={c.effects} />
                </button>
              ))}
            </div>
          )}
          <div className="mt-5 flex justify-end">
            <button className="btn btn-primary px-6 py-2 text-[14px]" disabled={needChoice && !pick} onClick={() => { choose(ev.id, pick ?? undefined); setPick(null); }}>
              {needChoice ? '결정' : '확인'}
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function BattleCard({ r, onOpen }: { r: BattleReport; onOpen?: () => void }) {
  const game = useGame((s) => s.game);
  const ours = r.attackerSide === game.playerSide;
  const total = Math.max(1, r.attackerPower + r.defenderPower);
  const aPct = (r.attackerPower / total) * 100;
  const win = (r.outcome === 'attacker_win') === ours;
  const verdict = r.outcome === 'draw' ? '교착' : win ? '승리' : '패배';
  return (
    <div className="rounded border border-ink-600 bg-ink-800/70 p-2 text-[12px]">
      <div className="flex items-center justify-between">
        <b>{r.provinceName} 전투</b>
        <span className={r.outcome === 'draw' ? 'text-slate-300' : win ? 'text-emerald-300' : 'text-red-300'}>{verdict}{r.captured ? ' · 점령' : ''}{r.retreated ? ' · 후퇴' : ''}{r.surrounded ? ' · 포위' : ''}</span>
      </div>
      <div className="mt-1 flex h-3 overflow-hidden rounded bg-ink-900">
        <div className="flex items-center justify-start px-1 text-[9px] text-white transition-all duration-700" style={{ width: `${aPct}%`, background: r.attackerSide === 'south' ? '#2f6db8' : '#b23a3a' }}>공 {fmt(r.attackerPower)}</div>
        <div className="flex flex-1 items-center justify-end px-1 text-[9px] text-white" style={{ background: r.attackerSide === 'south' ? '#b23a3a' : '#2f6db8' }}>방 {fmt(r.defenderPower)}</div>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-x-3 text-[11px] text-slate-300">
        <span>공격측 전사 {fmt(r.attackerCasualty.killed)} · 부상 {fmt(r.attackerCasualty.wounded)} · 실종·포로 {fmt(r.attackerCasualty.missing)}</span>
        <span>방어측 전사 {fmt(r.defenderCasualty.killed)} · 부상 {fmt(r.defenderCasualty.wounded)} · 실종·포로 {fmt(r.defenderCasualty.missing)}</span>
      </div>
      <div className="mt-1 text-slate-400">가용 병력 감소 — 공격측 {fmt(r.attackerLosses)} / 방어측 {fmt(r.defenderLosses)} · 사기 {r.moraleChange.attacker >= 0 ? '+' : ''}{r.moraleChange.attacker} / {r.moraleChange.defender >= 0 ? '+' : ''}{r.moraleChange.defender} · 보급 소비 {r.supplyUsed.attacker}/{r.supplyUsed.defender}</div>
      {onOpen && <button className="mt-1 text-[11px] text-sky-300 hover:underline" onClick={onOpen}>계산 근거 보기</button>}
    </div>
  );
}

export function BriefingModal() {
  const game = useGame((s) => s.game);
  const setModal = useGame((s) => s.setModal);
  const showBattle = useGame((s) => s.showBattle);
  return (
    <Shell width={720}>
      <div className="panel rounded p-5">
        <div className="panel-title">▍상황 브리핑 — {formatDate(game.date)}</div>
        <ul className="mt-2 flex flex-col gap-1 text-[13px] leading-[1.55]">
          {game.briefing.map((l, i) => (
            <li key={i} className={l.startsWith('【함락】') ? 'text-red-300' : l.startsWith('【점령】') || l.startsWith('【증원】') ? 'text-emerald-300' : l.startsWith('【보급】') ? 'text-amber-300' : 'text-slate-200'}>{l}</li>
          ))}
        </ul>
        {game.reports.length > 0 && (
          <>
            <div className="panel-title mt-4">▍전투 결과</div>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {game.reports.map((r) => <BattleCard key={r.id} r={r} onOpen={() => showBattle(r.id)} />)}
            </div>
          </>
        )}
        <div className="mt-4 flex justify-end"><button className="btn btn-blue px-5 py-1.5" onClick={() => setModal(null)}>다음 턴 시작</button></div>
      </div>
    </Shell>
  );
}

export function BattleModal() {
  const game = useGame((s) => s.game);
  const id = useGame((s) => s.battleFocus);
  const showBattle = useGame((s) => s.showBattle);
  const r = game.reports.find((x) => x.id === id);
  if (!r) return null;
  const names = (ids: string[]) => ids.map((i) => game.units[i]?.name ?? `(소멸) ${i}`);
  return (
    <Shell width={640} z={50}>
      <div className="panel rounded p-5">
        <div className="panel-title">▍{r.provinceName} 전투 — {formatDate(r.date)}</div>
        <div className="mt-2"><BattleCard r={r} /></div>
        <div className="mt-3 text-[12px]">
          <div className="panel-title mb-1">왜 이런 결과가 나왔는가</div>
          <ul className="list-disc pl-5 leading-[1.6] text-slate-200">{r.reasons.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-[11.5px]">
          <div><div className="text-slate-400">공격측 ({r.attackerSide === 'south' ? '아군' : '북한군'})</div>{names(r.attackerUnits).map((n) => <div key={n}>{n}</div>)}</div>
          <div><div className="text-slate-400">방어측</div>{names(r.defenderUnits).map((n) => <div key={n}>{n}</div>)}</div>
        </div>
        <div className="mt-4 flex justify-end"><button className="btn px-4" onClick={() => showBattle(null)}>닫기</button></div>
      </div>
    </Shell>
  );
}

export function GameOverModal() {
  const game = useGame((s) => s.game);
  const newGame = useGame((s) => s.newGame);
  const setModal = useGame((s) => s.setModal);
  const o = game.outcome;
  if (!o) return null;
  const win = o.result === 'victory';
  return (
    <Shell width={640} z={70}>
      <div className={'rounded p-6 ' + (win ? 'parchment' : 'panel')}>
        <div className={'text-[12px] tracking-widest ' + (win ? 'text-[#6b5a2a]' : 'text-red-300')}>{win ? '생존 — 시나리오 종료' : '패배'} · {formatDate(o.date)}</div>
        <h2 className="mt-1 font-serif text-[30px] font-black">{o.title}</h2>
        {win && <div className="mt-1 text-[42px] font-black text-[#7b2a2a]">등급 {o.grade}</div>}
        <ul className="mt-3 list-disc pl-5 text-[13.5px] leading-[1.7]">{o.reasons.map((x, i) => <li key={i}>{x}</li>)}</ul>
        <div className="mt-3"><CasualtyPanel /></div>
        {o.score && (
          <div className="mt-4 rounded border border-[#8a7a4f]/60 bg-[#cfc19a]/50 p-3 text-[12.5px]">
            <div className="mb-1 font-bold">종합 점수 {o.score.total} / 100</div>
            <div className="grid grid-cols-2 gap-x-6">
              <span>잔존 병력 {o.score.remainingForce.toFixed(1)} / {SCORE.maxForce}</span>
              <span>확보 영토 {o.score.territory.toFixed(1)} / {SCORE.maxTerritory}</span>
              <span>국민 지지 {o.score.popularSupport.toFixed(1)} / {SCORE.maxSupport}</span>
              <span>전쟁 피해(적을수록↑) {o.score.warDamage.toFixed(1)} / {SCORE.maxDamage}</span>
              <span>인명 손실 -{o.score.casualtyPenalty.toFixed(1)}</span>
              <span>전략 보너스 +{o.score.bonus}</span>
            </div>
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn px-4" onClick={() => setModal(null)}>지도 보기</button>
          <button className="btn btn-primary px-6 py-2" onClick={newGame}>새 게임</button>
        </div>
      </div>
    </Shell>
  );
}

export function MenuModal() {
  const { save, load, newGame, restart, setModal, saveInfo, game } = useGame();
  return (
    <Shell width={420}>
      <div className="panel rounded p-5">
        <div className="panel-title">▍메뉴</div>
        <div className="mt-3 flex flex-col gap-2">
          <button className="btn py-2" onClick={() => { newGame(); setModal(null); }}>새 게임</button>
          <button className="btn py-2" onClick={() => { restart(); setModal(null); }}>게임 재시작 (처음부터)</button>
          <button className="btn py-2" onClick={() => { save(); }}>저장 (현재 {game.turn}턴)</button>
          <button className="btn py-2" disabled={!saveInfo.exists} onClick={() => { load(); }}>
            불러오기 {saveInfo.exists ? `(저장: ${saveInfo.turn}턴, ${saveInfo.date})` : '(저장 데이터 없음)'}
          </button>
          <button className="btn py-2" onClick={() => setModal('help')}>조작 방법</button>
          <button className="btn btn-blue mt-1 py-2" onClick={() => setModal(null)}>닫기</button>
        </div>
        <div className="mt-3 text-[11px] text-slate-500">저장은 이 브라우저의 localStorage 에 보관됩니다. 매 턴 종료 시 자동 저장 슬롯에도 기록됩니다.</div>
      </div>
    </Shell>
  );
}

export function HelpModal() {
  const setModal = useGame((s) => s.setModal);
  return (
    <Shell width={640}>
      <div className="panel rounded p-5 text-[12.5px] leading-[1.7]">
        <div className="panel-title">▍플레이 방법</div>
        <ol className="mt-2 list-decimal pl-5">
          <li><b>지도</b>: 휠로 확대·축소, 드래그로 이동. 지역을 클릭하면 오른쪽 패널에 정보가 나옵니다. 지도의 파란 원 숫자는 <b>여단 수</b>입니다(병력 규모가 아님).</li>
          <li><b>부대 명령</b>: 오른쪽 [부대] 탭에서 체크 → [이동]/[공격] 버튼 → 지도에서 강조된 지역 클릭. 방어선 강화·휴식·훈련은 버튼만 누르면 됩니다. 한 부대는 한 턴에 한 가지 명령만 받습니다.</li>
          <li><b>국가 관리</b>: 상단 [국가 관리]에서 징집 → 훈련병 훈련 → 부대 창설/보충을 합니다(징집은 국가 단위). 장비는 자동 생산·자동 배분됩니다. 총동원령 전에는 여단, 후에는 사단이 기본 편성 단위입니다. [내정] 탭은 기반시설·방어시설과 지역 인구 정보를 다룹니다.</li>
          <li><b>보급</b>: 부산에서 아군 영토를 따라 이어져야 합니다. 해칭 표시된 지역은 보급 단절입니다. 보급 레이어로 확인하세요.</li>
          <li><b>턴 종료</b>: 하단 [턴 종료] → 북한군 AI가 행동하고 전투가 해결됩니다. 초반(6월)은 1턴 3일, 이후는 1턴 7일입니다.</li>
          <li><b>목표</b>: 부산을 지키며 정전(1953.7.27) 또는 정전협상 타결까지 생존. 서울 수복·영토·병력·국민 지지로 점수가 매겨집니다.</li>
        </ol>
        <div className="mt-3 rounded border border-ink-600 bg-ink-800/70 p-2 text-[11.5px] text-slate-300">
          ⚠ 지역 인구·산업·부대 능력치는 <b>추정치 또는 게임 밸런스용 값</b>이며 공식 통계가 아닙니다. 이벤트의 "가상의 선택"은 실제 역사에서 선택되지 않은 대안입니다.
        </div>
        <div className="mt-3 text-right"><button className="btn btn-blue px-4" onClick={() => setModal('menu')}>닫기</button></div>
      </div>
    </Shell>
  );
}

function LandingPlanPanel({ opId }: { opId: string }) {
  const game = useGame((s) => s.game);
  const toggled = useGame((s) => s.landingToggled);
  const toggle = useGame((s) => s.toggleLanding);
  const plan = useMemo(() => buildLandingPlan(game, opId, new Set(toggled)), [game, opId, toggled]);
  const pname = (id: string | null) => (id ? game.provinces[id].name : '—');
  const label = { reserve: '예비대(후방)', front: '전선 차출', external: '외부 증원(신규 편성)' } as const;
  return (
    <div className="mt-4 rounded border-2 border-[#7b2a2a]/70 bg-[#e9dfc2] p-3 text-[12px] leading-[1.55]">
      <div className="text-[14px] font-bold text-[#7b2a2a]">
        총 {plan.brigadesTotal}개 여단급 부대가 {plan.op.name} 작전에 투입됩니다. <span className="text-[12px] font-normal">(외부 도착 {plan.brigadesTotal - plan.op.drawn} + 현지 차출 {plan.op.drawn})</span>
      </div>
      <div className="text-[11px] text-[#8a4a1a]">※ 11개 여단(외부 도착 7 · 현지 차출 4)은 이 게임의 작전 규모입니다.</div>
      <div className="mt-1.5">
        기존 부대 차출 <b>{plan.drawnCount}</b>개 · 외부 증원 <b>{plan.externalCount}</b>개 (새로 편성) · 합계 <b>{plan.brigadesTotal}</b>개 여단 · 총 병력 <b>{fmt(plan.totalStrength)}</b>명 · 도착지 <b>{pname(plan.op.target)}</b>
      </div>
      <div className="mt-2 max-h-[190px] overflow-y-auto rounded border border-[#8a7a4f]/60 bg-[#f1e9d1]">
        <table className="w-full text-left text-[11.5px]">
          <thead className="sticky top-0 bg-[#d9ccaa]"><tr><th className="px-1.5 py-1">선택</th><th>부대</th><th>구분</th><th>출발 → 도착</th><th className="pr-1.5 text-right">병력</th></tr></thead>
          <tbody>
            {plan.entries.map((e) => (
              <tr key={e.key} className={e.selected ? '' : 'opacity-45'}>
                <td className="px-1.5 py-0.5">{e.selectable ? <input type="checkbox" checked={e.selected} onChange={() => toggle(e.key)} /> : '●'}</td>
                <td className="max-w-[210px] truncate">{e.name}</td>
                <td>{label[e.source]}</td>
                <td>{e.origin ? pname(e.origin) : '(외부)'} → {pname(plan.op.target)}</td>
                <td className="pr-1.5 text-right tabular-nums">{fmt(e.strength)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div>
          <b>차출로 방어력이 감소하는 전선</b>
          {plan.fronts.length === 0 ? <div className="text-[#4a6b3a]">없음 (전선 부대를 차출하지 않음)</div> : plan.fronts.map((f) => (
            <div key={f.province} className="text-[#7b2a2a]">{pname(f.province)}: 주둔 {f.before}→{f.after}개 여단, 방어력 {fmt(f.powerBefore)}→{fmt(f.powerAfter)} (인접 적 {f.enemyAdjacent}개 여단)</div>
          ))}
        </div>
        <div>
          <b>방어측(예상)</b>
          <div>{pname(plan.op.target)} 및 인접 지역 북한군 {plan.garrison.count}개 여단{plan.garrison.virtual ? ' (목표 지역 수비대는 작전 시 가상 편성)' : ''}</div>
          <div>예상 전투력비 {plan.ratio.toFixed(1)}</div>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div><b>예상되는 군사적 이익</b><ul className="list-disc pl-4">{plan.benefits.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
        <div><b>위험</b><ul className="list-disc pl-4">{plan.risks.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
      </div>
    </div>
  );
}

export function LandingReportModal() {
  const game = useGame((s) => s.game);
  const setModal = useGame((s) => s.setModal);
  const raw = game.flags.landingReport as string | undefined;
  if (!raw) return null;
  const r = JSON.parse(raw) as LandingReport;
  const pn = (id: string) => game.provinces[id]?.name ?? id;
  const onMap = Object.values(game.units).filter((u) => u.side === 'south' && u.location === r.target).length;
  return (
    <Shell width={680} z={65}>
      <div className="parchment rounded p-6">
        <div className="text-[11px] tracking-widest text-[#6b5a2a]">{formatDate(game.date)} · 작전 결과 보고</div>
        <h2 className={'font-serif text-[26px] font-black ' + (r.success ? 'text-[#1f4a82]' : 'text-[#7b2a2a]')}>{r.name} {r.success ? '성공' : '실패'}</h2>
        <ul className="mt-2 list-disc pl-5 text-[13px] leading-[1.7]">{r.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
        <div className="mt-3 grid grid-cols-3 gap-3 text-[12px]">
          <div><b>예비대 출신 {r.fromReserve.length}개</b>{r.fromReserve.map((x, i) => <div key={i}>{x.name} ({x.origin})</div>)}</div>
          <div><b>전선 차출 {r.fromFront.length}개</b>{r.fromFront.map((x, i) => <div key={i}>{x.name} ({x.origin})</div>)}</div>
          <div><b>외부 증원(신규) {r.external.length}개</b>{r.external.slice(0, 8).map((x, i) => <div key={i} className="truncate">{x}</div>)}{r.external.length > 8 && <div>… 외 {r.external.length - 8}개</div>}</div>
        </div>
        <div className="mt-3 text-[12.5px]">
          투입 {r.total}개 여단 (= 차출 {r.fromReserve.length + r.fromFront.length} + 외부 {r.external.length}) · {r.success ? `지도상 ${pn(r.target)} 주둔 아군 여단 ${onMap}개 (상륙 생존 ${r.survivors}개 포함)` : `상륙 생존 ${r.survivors}개 여단이 출발지로 후퇴`}
        </div>
        <div className="mt-4 flex justify-end"><button className="btn btn-primary px-6 py-2" onClick={() => setModal(null)}>확인</button></div>
      </div>
    </Shell>
  );
}

export function AllBattlesModal() {
  const game = useGame((s) => s.game);
  const setModal = useGame((s) => s.setModal);
  const playing = useGame((s) => s.playback !== null);
  return (
    <Shell width={760} z={55}>
      <div className="panel rounded p-5">
        <div className="panel-title">▍이번 턴 전체 전투 결과 ({game.reports.length}건)</div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {game.reports.length === 0 && <div className="text-[12px] text-slate-500">전투가 없었습니다.</div>}
          {game.reports.map((r) => <BattleCard key={r.id} r={r} />)}
        </div>
        <div className="mt-4 flex justify-end"><button className="btn px-4" onClick={() => setModal(playing ? null : 'briefing')}>닫기</button></div>
      </div>
    </Shell>
  );
}

export function ManagementModal() {
  const setModal = useGame((s) => s.setModal);
  const game = useGame((s) => s.game);
  const me = game.nations[game.playerSide];
  return (
    <Shell width={980} z={45}>
      <div className="panel rounded p-5">
        <div className="flex items-center justify-between">
          <div className="panel-title">▍국가 관리 — 징집 · 편성 · 군수 · 사상자</div>
          <div className="text-[12px]">행정 점수 <b className="text-brass">{me.commandPoints}</b></div>
        </div>
        <div className="mt-2"><ManagementBody /></div>
        <div className="mt-3 flex justify-end"><button className="btn btn-blue px-5" onClick={() => setModal(null)}>닫기</button></div>
      </div>
    </Shell>
  );
}

export function MobilizedModal() {
  const setModal = useGame((s) => s.setModal);
  return (
    <Shell width={760} z={66}>
      <div className="parchment rounded p-6">
        <div className="text-[11px] tracking-widest text-[#6b5a2a]">국가 총동원령 발동</div>
        <h2 className="font-serif text-[26px] font-black">여단급 → 사단급 전환 완료</h2>
        <div className="mt-3"><MobilizedReportModalBody /></div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn px-4" onClick={() => setModal('manage')}>국가 관리 화면</button>
          <button className="btn btn-primary px-6 py-2" onClick={() => setModal(null)}>확인</button>
        </div>
      </div>
    </Shell>
  );
}
