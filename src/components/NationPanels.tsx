import { useMemo, useState } from 'react';
import { useGame } from '../store/gameStore';
import { buildCasualtyReport, forceStats, type CasualtyReport } from '../game/casualty';
import { previewMobilization, type MobilizationReport } from '../game/mobilization';
import { nationalDraftPool, unReplacementPerDay } from '../game/manpower';
import { aidPerDay, nationalEquip, producibleKeys, productionMultiplier } from '../game/production';
import { EQUIP_KEYS } from '../game/types';
import { ECONOMY } from '../game/balance';
import { EQUIP_KO, fmt, Bar, colorFor } from './common';
import { fogOn } from '../game/visibility';

/** 국가 전체 사상자 보고: 실제 전투 손실의 합산 (고정된 역사 수치가 아님) */
export function CasualtyPanel({ report }: { report?: CasualtyReport }) {
  const game = useGame((s) => s.game);
  const r = report ?? buildCasualtyReport(game);
  const rows: [string, number, string?][] = [
    ['누적 전사자', r.killed, '영구 손실'],
    ['누적 부상 발생', r.woundedTotal, '복귀 포함, 실종 전환분 제외'],
    ['현재 치료 중인 부상병', r.woundedInCare, '가용 병력 아님'],
    ['치료 후 복귀', r.returned, '새 징집이 아님'],
    ['누적 실종·포로', r.missing, '자연 회복 없음'],
    ['  그중 포로', r.prisoners],
    ['전멸·해체된 부대', r.unitsDestroyed],
    ['현재 총 가용 병력', r.available],
    ['현재 군 전체 편제 정원', r.authorized],
  ];
  return (
    <div className="rounded border border-[#8a7a4f]/60 bg-[#cfc19a]/60 p-3 text-[12.5px] text-[#2a2418]">
      <div className="mb-1 font-bold">국가 전체 사상자 보고</div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
        {rows.map(([l, v, note]) => (
          <div key={l} className="flex items-baseline justify-between gap-2">
            <span>{l}{note && <span className="ml-1 text-[10px] text-[#6b5a2a]">({note})</span>}</span>
            <b className="tabular-nums">{fmt(v)}</b>
          </div>
        ))}
      </div>
      <div className="mt-1 text-[11px] text-[#6b5a2a]">총 손실 {fmt(r.totalLoss)} = 전사 + 부상 발생 + 실종·포로 (중복 없음). 모든 수치는 이번 게임의 실제 전투 결과 합산입니다.</div>
    </div>
  );
}

const Row = ({ l, a, b }: { l: string; a: React.ReactNode; b: React.ReactNode }) => (
  <tr>
    <td className="py-0.5 pr-2">{l}</td>
    <td className="px-2 text-right tabular-nums">{a}</td>
    <td className="px-2 text-right tabular-nums font-bold">{b}</td>
  </tr>
);

export function MobilizationComparison({ report, preview, title }: { report: MobilizationReport; preview?: boolean; title?: string }) {
  const { before: b, after: a } = report;
  return (
    <div className="rounded border-2 border-[#7b2a2a]/70 bg-[#e9dfc2] p-3 text-[12.5px] leading-[1.55] text-[#2a2418]">
      <div className="text-[14px] font-bold text-[#7b2a2a]">{title ?? (preview ? '총동원령 예상 결과 (현재 상태 기준 계산)' : '총동원령 결과')}</div>
      <table className="mt-1 w-full text-left">
        <thead><tr className="text-[11px] text-[#6b5a2a]"><th>항목</th><th className="text-right">동원 전</th><th className="text-right">동원 후</th></tr></thead>
        <tbody>
          <Row l="부대 수" a={`${b.units}개 (여단 ${b.brigades} · 사단 ${b.divisions})`} b={`${a.units}개 (여단 ${a.brigades} · 사단 ${a.divisions})`} />
          <Row l="가용 병력" a={fmt(b.available)} b={fmt(a.available)} />
          <Row l="편제 정원" a={fmt(b.authorized)} b={fmt(a.authorized)} />
          <Row l="정원 충족률" a={`${Math.round((b.available / Math.max(1, b.authorized)) * 100)}%`} b={`${Math.round((a.available / Math.max(1, a.authorized)) * 100)}%`} />
          <Row l="남은 징병 가능 인구(접근분)" a={fmt(report.poolBefore)} b={fmt(report.poolAfter)} />
        </tbody>
      </table>
      <div className="mt-1">
        신규 <b>긴급 동원병 {fmt(report.emergencyDrafted)}명</b> (동원 예산 {fmt(report.poolBudget)}명 중) · 전환 {report.convertedUnits}개 부대(1:1, 위치 유지) ·
        정원 목표 미달 사단 {report.understrength}개
      </div>
      <div className="mt-1 text-[11px] text-[#8a4a1a]">
        긴급 동원병은 훈련·경험·조직력이 낮고 장비가 따라오지 않아, 병력이 늘어도 전투력은 그만큼 늘지 않습니다. 소모한 징병 자원은 이후 일반 징집에서 다시 쓸 수 없습니다.
        ※ 게임상 조작 단위 변경이며 수치는 밸런스 값입니다.
      </div>
    </div>
  );
}

export function MobilizationPreview() {
  const game = useGame((s) => s.game);
  const south = useMemo(() => previewMobilization(game, 'rok'), [game]);
  const north = useMemo(() => previewMobilization(game, 'kpa'), [game]);
  return (
    <div className="flex flex-col gap-3">
      <MobilizationComparison report={south} preview title="대한민국(국군) 총동원령 — 예상" />
      <MobilizationComparison report={north} preview title="북한군 총동원령 (같은 시점 동시 발동) — 예상" />
    </div>
  );
}

export function MobilizedReportModalBody() {
  const game = useGame((s) => s.game);
  const raw = game.flags.mobilizationReport as string | undefined;
  const rawN = game.flags.kpaMobilizationReport as string | undefined;
  if (!raw) return null;
  return (
    <div className="flex flex-col gap-3">
      <MobilizationComparison report={JSON.parse(raw) as MobilizationReport} title="대한민국(국군) 총동원령 결과" />
      {rawN && <MobilizationComparison report={JSON.parse(rawN) as MobilizationReport} title="북한군 총동원령 결과 (동시 발동)" />}
    </div>
  );
}

/** 국가 관리 화면: 징집·훈련병·편성·군수·사상자·전장의 안개 */
export function ManagementBody() {
  const game = useGame((s) => s.game);
  const nation = useGame((s) => s.nation);
  const setFog = useGame((s) => s.setFog);
  const selected = useGame((s) => s.selectedProvince);
  const side = game.playerSide;
  const me = game.nations[side];
  const [createAt, setCreateAt] = useState('');
  const stats = forceStats(game, side);
  const pool = nationalDraftPool(game, side);
  const owned = Object.values(game.provinces).filter((p) => p.owner === side);
  const remainingAll = owned.reduce((s, p) => s + p.recruitablePopulation, 0);
  const draftedAll = owned.reduce((s, p) => s + p.drafted, 0);
  const eq = nationalEquip(game, side);
  const echelon = game.flags.mobilized ? 'division' : 'brigade';
  const needy = Object.values(game.units).filter((u) => u.side === side && u.faction === 'ROK' && u.strength < u.maxStrength && game.provinces[u.location].owner === side && game.provinces[u.location].supplied).sort((a, b) => a.strength / a.maxStrength - b.strength / b.maxStrength).slice(0, 14);
  const target = createAt || (selected && game.provinces[selected]?.owner === side ? selected : 'busan');
  const cp = me.commandPoints;
  const box = 'rounded border border-ink-600 bg-ink-800/60 p-3';
  return (
    <div className="grid grid-cols-2 gap-3 text-[12px]">
      <div className={box}>
        <div className="panel-title mb-1">▍국가 징집 (CP 소모)</div>
        <div className="flex justify-between"><span className="text-slate-400">남은 징병 가능 인구 (통제 지역 합계)</span><b>{fmt(remainingAll)}</b></div>
        <div className="flex justify-between"><span className="text-slate-400">지금 국가가 접근 가능한 양</span><b className="text-brass">{fmt(pool)}</b></div>
        <div className="flex justify-between"><span className="text-slate-400">이미 징집 (통제 지역 기준)</span><b>{fmt(draftedAll)}</b></div>
        <div className="mt-1 text-[10.5px] text-slate-500">점령 직후·안정도 {ECONOMY.draftMinStability} 미만 지역은 접근률이 낮거나 0입니다. 서울 등을 잃으면 그 지역의 남은 인구는 국가 자원에서 빠지고, 수복하면 다시 접근할 수 있습니다.</div>
        <div className="mt-2 flex items-center justify-between rounded bg-ink-900/70 px-2 py-1">
          <span>훈련병 풀 <b className="text-sky-300">{fmt(me.trainees.count)}</b>명 · 평균 훈련도 <b>{me.trainees.training.toFixed(0)}</b> <span className="text-slate-500">/{ECONOMY.trainingCap.recruits}</span></span>
        </div>
        <div className="mt-1 grid grid-cols-2 gap-1">
          <button className="btn" disabled={cp < 1 || pool <= 0} onClick={() => nation('draft')} title={`통제 지역에서 최대 ${fmt(ECONOMY.draftBatch)}명을 모집해 훈련병 풀에 넣습니다`}>징집 (CP1, {fmt(ECONOMY.draftBatch)}명)</button>
          <button className="btn" disabled={cp < 1 || me.trainees.count <= 0} onClick={() => nation('train')}>훈련병 훈련 (CP1)</button>
        </div>
        <div className="mt-1 text-[10.5px] text-slate-500">훈련병은 매 턴 자동으로도 조금씩 훈련됩니다. 훈련을 마친 병력은 부대 보충·창설에만 쓰이고 풀에서 차감됩니다.</div>
      </div>

      <div className={box}>
        <div className="panel-title mb-1">▍편성 · 보충 (현재 기본 편제: {echelon === 'division' ? '사단급' : '여단급'})</div>
        <div className="flex items-center gap-1">
          <select className="min-w-0 flex-1 rounded border border-ink-600 bg-ink-900 px-1 text-[11px]" value={target} onChange={(e) => setCreateAt(e.target.value)}>
            {owned.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn" disabled={cp < 2 || me.trainees.count < ECONOMY.formationMin[echelon]} onClick={() => nation('create', target)} title={`훈련병 ${fmt(ECONOMY.formationMin[echelon])}명 이상 필요`}>
            {echelon === 'division' ? '사단' : '여단'} 창설 (CP2)
          </button>
        </div>
        <div className="mt-2 rounded bg-ink-900/70 px-2 py-1 text-[11px] text-sky-200">
          UN군 자체 보충: 매주 약 {fmt(unReplacementPerDay(game) * 7)}명 도착 · 보충 풀 {fmt(me.replacementPool)}명
          <div className="text-[10px] text-slate-500">미군·UN군은 국가 훈련병이 아니라 본국 보충병으로 자동 보충됩니다(전투하지 않고 보급이 이어진 부대, 정원 충족률이 낮은 부대 우선). 도착량은 미국 개입도·UN 지지·항만 접근에 비례합니다.</div>
        </div>
        <div className="mt-2 mb-0.5 text-slate-400">정원 미달 국군 부대 보충 (훈련병 풀에서 차감, 보급 연결 지역만)</div>
        <div className="max-h-[150px] overflow-y-auto">
          {needy.length === 0 && <div className="text-slate-500">보충이 필요한 부대가 없습니다.</div>}
          {needy.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-2 py-0.5">
              <span className="truncate">{u.name} <span className="text-slate-500">{fmt(u.strength)}/{fmt(u.maxStrength)}</span></span>
              <button className="btn" disabled={cp < 1 || me.trainees.count <= 0} onClick={() => nation('reinforce', u.id)}>보충 (CP1)</button>
            </div>
          ))}
        </div>
      </div>

      <div className={box}>
        <div className="panel-title mb-1">▍군 현황</div>
        <div className="grid grid-cols-2 gap-x-3">
          <span className="text-slate-400">부대 수</span><b>{stats.units}개 (여단 {stats.brigades} · 사단 {stats.divisions})</b>
          <span className="text-slate-400">가용 병력</span><b>{fmt(stats.available)}</b>
          <span className="text-slate-400">편제 정원</span><b>{fmt(stats.authorized)}</b>
          <span className="text-slate-400">치료 중 부상병</span><b>{fmt(stats.woundedInCare)}</b>
          <span className="text-slate-400">긴급 동원병(누적)</span><b>{fmt(me.emergencyDrafted)}</b>
        </div>
        <div className="mt-1"><Bar value={stats.available} max={Math.max(1, stats.authorized)} color={colorFor((stats.available / Math.max(1, stats.authorized)) * 100)} /></div>
        {game.flags.mobilized ? (
          <div className="mt-2 text-[11px] text-emerald-300">총동원령 발동됨 — 국군 부대는 사단급으로 운용 중</div>
        ) : (
          <div className="mt-2 text-[11px] text-slate-400">총동원령 미발동: 전황이 낙동강 방어선 형성·주요 전선 후퇴·후방 위협 등 국가적 위기에 이르면 별도 이벤트로 발생합니다.</div>
        )}
      </div>

      <div className={box}>
        <div className="panel-title mb-1">▍국가 군수 (자동 생산·자동 배분)</div>
        <table className="w-full text-left text-[11.5px]">
          <thead><tr className="text-slate-500"><th>장비</th><th className="text-right">재고</th><th className="text-right">정원 대비 부족</th><th className="text-right">수리 대기</th></tr></thead>
          <tbody>
            {EQUIP_KEYS.map((k) => (
              <tr key={k}>
                <td>{EQUIP_KO[k]}</td>
                <td className="text-right tabular-nums">{fmt(eq.stock[k])}</td>
                <td className={'text-right tabular-nums ' + (eq.shortage[k] > 0 ? 'text-red-300' : '')}>{fmt(eq.shortage[k])}</td>
                <td className="text-right tabular-nums">{fmt(eq.damaged[k])}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-1 rounded bg-ink-900/70 px-2 py-1 text-[11px] text-sky-200">
          UN 장비 지원(주당 예상): {(() => { const a = aidPerDay(game, side); return (['rifles', 'machineGuns', 'mortars', 'artillery', 'antiTank', 'vehicles'] as const).map((k) => `${EQUIP_KO[k]} ${fmt(a[k] * 7)}`).join(' · '); })()}
          <div className="text-[10px] text-slate-500">미국 개입도·UN 지지·항만(부산 등) 접근에 비례. 매 턴 국가 군수 재고로 입고되어 자동 배분됩니다.</div>
        </div>
        <div className="mt-1 text-[10.5px] text-slate-500">
          생산 가능 지역 {owned.filter((p) => producibleKeys(p).length).length}곳 · 생산 배율 ×{productionMultiplier(game, side).toFixed(2)}. 재고는 장비 충족률·전선 중요도·전투 투입·보급 연결을 고려해 자동 배분되며, 부족하면 일부 부대는 장비 부족 상태로 남습니다. 보급이 끊긴 부대는 배분받지 못합니다.
        </div>
      </div>

      <div className="col-span-2"><CasualtyPanel /></div>

      <div className={box + ' col-span-2 flex items-center justify-between'}>
        <div>
          <div className="panel-title">▍전장의 안개</div>
          <div className="text-[11px] text-slate-400">정보 표시만 바꿉니다. 적의 실제 전투력·병력은 변하지 않습니다. (기본: 끔)</div>
        </div>
        <button className={'btn ' + (fogOn(game) ? 'btn-blue' : '')} onClick={() => setFog(!fogOn(game))}>{fogOn(game) ? '켜짐 — 끄기' : '꺼짐 — 켜기'}</button>
      </div>
    </div>
  );
}
