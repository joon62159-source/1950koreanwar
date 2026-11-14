import { useMemo, useState } from 'react';
import { useGame } from '../store/gameStore';
import { Bar, colorFor, EQUIP_KO, fmt, KIND_KO, Stat, TERRAIN_KO } from './common';
import { fogOn } from '../game/visibility';
import { damagedEquipRatio, needsRest } from '../game/units';
import { producibleKeys } from '../game/production';
import { draftEfficiency, provinceDraftable } from '../game/manpower';
import { ECONOMY } from '../game/balance';
import { EQUIP_KEYS, type Province, type Unit } from '../game/types';
import { unitsAt, fillRatio } from '../game/units';
import { orderLabel, attackableTargets } from '../game/orders';
import { visibleProvinces } from '../game/visibility';
import { infantryPower, stateFactor, troopQuality, equipmentFactor } from '../game/combat';
import { effectiveIndustry } from '../game/economy';
import { MAP } from '../game/map';

function UnitCard({ u, selected, onToggle, ordered, onCancel }: { u: Unit; selected: boolean; onToggle: () => void; ordered: boolean; onCancel: () => void }) {
  const setMode = useGame((s) => s.setMode);
  const game = useGame((s) => s.game);
  const [open, setOpen] = useState(false);
  const pct = (u.strength / u.maxStrength) * 100;
  return (
    <div className={'rounded border p-1.5 text-[11.5px] transition-colors ' + (selected ? 'border-yellow-300 bg-[#2a3342] shadow-[inset_3px_0_0_#ffe08a]' : ordered ? 'border-sky-800 bg-ink-800/40 opacity-80' : 'border-ink-600 bg-ink-800/60')}>
      <div className="flex items-start gap-1.5">
        <input type="checkbox" checked={selected} disabled={ordered} onChange={onToggle} className="mt-0.5 accent-yellow-400" title={ordered ? '이번 턴 명령을 받았습니다. 취소하면 다시 선택할 수 있습니다.' : '선택/해제'} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <span className="truncate font-bold text-slate-100" title={u.name}>{u.name}</span>
            <button className="text-[10px] text-slate-400 hover:text-white" onClick={() => setOpen(!open)}>{open ? '접기' : '상세'}</button>
          </div>
          <div className="truncate text-[10px] text-slate-500">{u.historicalParent} · {KIND_KO[u.kind]} · <b className={u.echelon === 'division' ? 'text-sky-300' : ''}>{u.echelon === 'division' ? '사단급' : '여단급'}</b>{needsRest(u) && <b className="ml-1 text-amber-300">휴식 필요</b>}{(u.encircledTurns ?? 0) > 0 && <b className="ml-1 text-red-400">⛓ 포위 {u.encircledTurns}턴째</b>}</div>
          <div className="mt-0.5 flex items-center gap-2">
            <div className="flex-1"><Bar value={pct} color={colorFor(pct)} /></div>
            <span className="tabular-nums text-slate-300">{fmt(u.strength)}/{fmt(u.maxStrength)}{u.wounded > 0 && <span className="ml-1 text-[10px] text-amber-300" title="치료 중인 부상병 (가용 병력 아님)">+치료 {fmt(u.wounded)}</span>}</span>
          </div>
          <div className="mt-0.5 grid grid-cols-4 gap-x-2 text-[10px] text-slate-400">
            <span>훈련 <b className="text-slate-200">{u.training.toFixed(0)}</b></span>
            <span>사기 <b style={{ color: colorFor(u.morale) }}>{u.morale.toFixed(0)}</b></span>
            <span>조직 <b style={{ color: colorFor(u.organization) }}>{u.organization.toFixed(0)}</b></span>
            <span>보급 <b style={{ color: colorFor(u.supply) }}>{u.supply.toFixed(0)}</b></span>
          </div>
          <div className="mt-0.5 flex items-center justify-between text-[10.5px] text-sky-300"><span>{ordered ? '✔ ' : ''}{orderLabel(u.order, game)}{u.order && u.order.issuedTurn === game.turn ? '' : u.order ? ' (진행 중)' : ''}</span>{u.order ? <button className="text-[10px] text-amber-300 hover:underline" onClick={onCancel}>명령 취소</button> : <span className="flex gap-2"><button className="text-[10px] text-sky-200 hover:underline" onClick={() => setMode('move', [u.id])} title="이 부대만 이동">이 부대만 이동</button><button className="text-[10px] text-orange-300 hover:underline" onClick={() => setMode('attack', [u.id])} title="이 부대만 공격">공격</button></span>}</div>
        </div>
      </div>
      {open && (
        <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 border-t border-ink-600 pt-1.5 text-[10.5px]">
          <Stat label="전투 경험" value={u.experience.toFixed(0)} />
          <Stat label="부상병(치료 중)" value={fmt(u.wounded)} />
          <Stat label="누적 전사" value={fmt(u.record.killed)} />
          <Stat label="누적 실종·포로" value={fmt(u.record.missing)} />
          <Stat label="긴급 동원병" value={fmt(u.emergencyTroops)} />
          <Stat label="손상 장비 비율" value={`${(damagedEquipRatio(u) * 100).toFixed(0)}%`} />
          <Stat label="연속 휴식" value={`${u.restTurns ?? 0}턴`} />
          <Stat label="피로도" value={u.fatigue.toFixed(0)} />
          <Stat label="회복 상태" value={u.recovery.toFixed(0)} />
          <Stat label="이동력" value={`${u.speed}km/일`} />
          <Stat label="숙련(훈련·경험)" value={`×${troopQuality(u).toFixed(2)}`} />
          <Stat label="장비 화력" value={`×${equipmentFactor(u).toFixed(2)}`} />
          <Stat label="상태(조직·피로·사기·보급)" value={`×${stateFactor(u).toFixed(2)}`} />
          <Stat label="보병 전투력" value={fmt(infantryPower(u))} />
          <div className="col-span-2 mt-1 text-slate-500">장비 충족률</div>
          {EQUIP_KEYS.filter((k) => u.equipNeed[k] > 0).map((k) => (
            <div key={k} className="col-span-1">
              <div className="flex justify-between"><span className="text-slate-400">{EQUIP_KO[k]}</span><span className="tabular-nums">{fmt(u.equip[k])}</span></div>
              <Bar value={fillRatio(u, k) * 100} color={colorFor(fillRatio(u, k) * 100)} />
            </div>
          ))}
          {u.traits.length > 0 && <div className="col-span-2 mt-1 text-amber-200">특성: {u.traits.join(', ')}</div>}
          <div className="col-span-2 mt-1 text-slate-500">전투 이력</div>
          <div className="col-span-2 max-h-20 overflow-y-auto text-slate-300">
            {u.history.length === 0 ? '없음' : u.history.slice(-6).reverse().map((h, i) => <div key={i}>{h.date.slice(5)} {h.place} {h.role === 'attack' ? '공격' : '방어'} {h.result === 'win' ? '승' : h.result === 'lose' ? '패' : '무'} (손실 ~{fmt(h.lossesTaken)})</div>)}
          </div>
        </div>
      )}
    </div>
  );
}

function Overview({ p }: { p: Province }) {
  const game = useGame((s) => s.game);
  return (
    <div className="flex flex-col gap-0.5">
      <div className="mb-1 flex items-center gap-2">
        <span className="font-serif text-[17px] font-black">{p.name}</span>
        <span className={'tag ' + (p.owner === game.playerSide ? 'border-south text-south' : 'border-north text-north')}>{p.owner === 'south' ? '대한민국 통제' : '북한 통제'}</span>
      </div>
      <div className="text-[10.5px] text-slate-500">{p.historicalName} · {p.geographicalRegion}</div>
      <Stat label="지형" value={TERRAIN_KO[p.terrain]} />
      <Stat label="전략 가치" value={`${p.strategicValue}/10`} />
      <Stat label="총인구" value={fmt(p.population)} sub="추정" />
      <Stat label="징병 대상 인구" value={fmt(p.draftEligible)} sub="추정" />
      <Stat label="이미 징집" value={fmt(p.drafted)} />
      <Stat label="남은 징병 가능" value={fmt(p.recruitablePopulation)} sub={`접근 ${Math.round(draftEfficiency(p) * 100)}%`} />
      <Stat label="산업 능력" value={`${p.industrialCapacity.toFixed(0)}/${p.industrialBase}`} sub="게임값" />
      <Stat label="실효 산업력" value={effectiveIndustry(p).toFixed(1)} />
      <Stat label="장비 생산(일일 점수)" value={p.equipmentProduction.toFixed(2)} />
      <Stat label="기반시설" value={p.infrastructure.toFixed(0)} />
      <Stat label="항만 능력" value={p.portCapacity} />
      <Stat label="방어시설" value={`${p.fortification.toFixed(1)}/5`} />
      <Stat label="전쟁 피해" value={p.warDamage.toFixed(0)} />
      <Stat label="통제 안정도" value={p.controlStability.toFixed(0)} />
      <Stat label="보급" value={p.supplied ? <span style={{ color: colorFor(p.supplyLevel) }}>{p.supplyLevel}</span> : <span className="text-red-400">단절</span>} />
      <div className="mt-1 text-[10.5px] text-slate-500">
        도로 인접: {p.roadConnections.map((id) => game.provinces[id].name).join(', ')}
        {p.railwayConnections.length > 0 && <div>철도: {p.railwayConnections.map((id) => game.provinces[id].name).join(', ')}</div>}
        {p.seaConnections.length > 0 && <div>해상: {p.seaConnections.map((id) => game.provinces[id].name).join(', ')}</div>}
      </div>
      <div className="mt-1 text-[10px] text-slate-600">인구·산업은 추정/게임 밸런스 수치이며 공식 통계가 아닙니다.</div>
    </div>
  );
}

function UnitsTab({ p }: { p: Province }) {
  const game = useGame((s) => s.game);
  const selectedUnits = useGame((s) => s.selectedUnits);
  const toggle = useGame((s) => s.toggleUnit);
  const setUnits = useGame((s) => s.setUnits);
  const selectAllHere = useGame((s) => s.selectAllHere);
  const selectHalf = useGame((s) => s.selectHalf);
  const selectNeedsRest = useGame((s) => s.selectNeedsRest);
  const setMode = useGame((s) => s.setMode);
  const mode = useGame((s) => s.mode);
  const orderScope = useGame((s) => s.orderScope);
  const orderUnits = useGame((s) => s.orderUnits);
  const cancelUnits = useGame((s) => s.cancelUnits);
  const vis = useMemo(() => visibleProvinces(game, game.playerSide), [game]);
  const fog = fogOn(game);
  const mine = unitsAt(game, p.id, game.playerSide);
  const enemy = unitsAt(game, p.id, game.playerSide === 'south' ? 'north' : 'south');
  const sel = selectedUnits.filter((id) => game.units[id]);
  const canAttack = sel.some((id) => attackableTargets(game, game.units[id]).length > 0);
  return (
    <div className="flex flex-col gap-2">
      {mine.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <span className="panel-title">▍아군 부대 ({mine.length}) · 선택 {sel.length}</span>
            <div className="flex gap-1">
              <button className="btn" onClick={selectAllHere}>전체 선택</button>
              <button className="btn" onClick={() => setUnits([])}>전체 해제</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <button className="btn" disabled={sel.length < 1} onClick={selectHalf} title="선택된 부대 중 목록 순서대로 절반(올림)만 남깁니다">절반만 선택</button>
            <button className="btn" onClick={selectNeedsRest} title="피로·조직력·사기·부상병·손상 장비 기준으로 휴식이 필요한 부대만 선택">휴식 필요 부대 선택</button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            <button className={'btn ' + (mode === 'move' ? 'btn-blue' : '')} disabled={!sel.length} onClick={() => setMode(mode === 'move' ? 'select' : 'move')} title="지도에서 아군 지역을 클릭">이동</button>
            <button className={'btn ' + (mode === 'attack' ? 'btn-primary' : '')} disabled={!sel.length || !canAttack} onClick={() => setMode(mode === 'attack' ? 'select' : 'attack')} title="인접한 적 지역 클릭">공격</button>
            <button className="btn" disabled={!sel.length} onClick={() => orderUnits('defend')} title="참호를 파고 방어선을 강화">방어선 강화</button>
            <button className="btn" disabled={!sel.length} onClick={() => orderUnits('rest')} title="피로·조직·회복 개선">휴식·재정비</button>
            <button className="btn" disabled={!sel.length} onClick={() => orderUnits('train')} title="훈련도 향상(장기 능력)">훈련</button>
            <button className="btn" disabled={!mine.some((u) => u.order && u.order.issuedTurn === game.turn)} onClick={() => cancelUnits(mine.filter((u) => u.order && u.order.issuedTurn === game.turn).map((u) => u.id))} title="이번 턴 명령을 받은 부대 전체의 명령을 취소">명령 전체 취소</button>
          </div>
          {mode !== 'select' && <div className="rounded bg-ink-700 px-2 py-1 text-[11px] text-yellow-200">지도에서 {mode === 'move' ? '이동할 아군 지역' : '공격할 인접 적 지역'}을 클릭하세요. (강조 표시된 곳){orderScope ? ` — 대상: 지정한 ${orderScope.length}개 부대만` : ` — 대상: 선택된 ${sel.length}개 부대`}</div>}
          <div className="flex flex-col gap-1.5">
            {mine.map((u) => <UnitCard key={u.id} u={u} selected={selectedUnits.includes(u.id)} onToggle={() => toggle(u.id)} ordered={!!u.order && u.order.issuedTurn === game.turn} onCancel={() => cancelUnits([u.id])} />)}
          </div>
        </>
      )}
      {enemy.length > 0 && (
        <>
          <span className="panel-title">▍적 부대</span>
          {!fog || vis.has(p.id) ? (
            <div className="flex flex-col gap-1">
              <div className="text-[11.5px] text-red-300">{fog ? '정찰됨' : '안개 꺼짐(전체 공개)'}: 부대 {enemy.length}개 확인</div>
              {enemy.map((u) => (
                <div key={u.id} className="rounded border border-north-dim bg-ink-800/60 px-2 py-1 text-[11px]">
                  <div className="font-bold">{u.name}</div>
                  {fog ? (
                    <div className="text-slate-400">{KIND_KO[u.kind]} · 병력 약 {fmt(Math.round(u.strength / 250) * 250)}명{u.equip.tanks > 0 ? ' · 전차 보유' : ''}</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-x-2 text-slate-300">
                      <span className="col-span-2 text-slate-400">{KIND_KO[u.kind]} · {u.echelon === 'division' ? '사단급' : '여단급'} · 병력 {fmt(u.strength)}/{fmt(u.maxStrength)} (부상 {fmt(u.wounded)})</span>
                      <span>훈련 {u.training.toFixed(0)} · 경험 {u.experience.toFixed(0)}</span>
                      <span>사기 {u.morale.toFixed(0)} · 조직 {u.organization.toFixed(0)}</span>
                      <span>피로 {u.fatigue.toFixed(0)} · 보급 {u.supply.toFixed(0)}</span>
                      <span>전차 {fmt(u.equip.tanks)} · 대전차 {fmt(u.equip.antiTank)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded border border-dashed border-north-dim p-2 text-[11.5px] text-slate-400">정찰되지 않아 정확한 정보가 없습니다.{game.intel[p.id] && ` (마지막 보고: ${game.turn - game.intel[p.id].turn}턴 전, 여단 약 ${game.intel[p.id].count}개)`}</div>
          )}
        </>
      )}
      {mine.length === 0 && enemy.length === 0 && (
        fog && game.intel[p.id] && !vis.has(p.id)
          ? <div className="rounded border border-dashed border-north-dim p-2 text-[11.5px] text-slate-400">정찰되지 않음. 오래된 정보: {game.turn - game.intel[p.id].turn}턴 전 여단 약 {game.intel[p.id].count}개</div>
          : <div className="text-[12px] text-slate-500">이 지역에는 부대가 없습니다.</div>
      )}
    </div>
  );
}

function DomesticTab({ p }: { p: Province }) {
  const game = useGame((s) => s.game);
  const act = useGame((s) => s.province);
  const nation = useGame((s) => s.nation);
  const setModal = useGame((s) => s.setModal);
  const me = game.nations[game.playerSide];
  const own = p.owner === game.playerSide;
  const [reinforceId, setReinforceId] = useState('');
  if (!own) return <div className="text-[12px] text-slate-500">아군이 통제하는 지역에서만 내정 명령을 내릴 수 있습니다.</div>;
  const cpOk = (n = 1) => me.commandPoints >= n;
  const keys = producibleKeys(p);
  const echelon = game.flags.mobilized ? 'division' : 'brigade';
  const label = echelon === 'division' ? '사단' : '여단';
  const minMen = ECONOMY.formationMin[echelon];
  const needy = unitsAt(game, p.id, game.playerSide).filter((u) => u.faction === 'ROK' && u.strength < u.maxStrength);
  return (
    <div className="flex flex-col gap-2 text-[12px]">
      <div className="rounded border border-ink-600 bg-ink-800/60 p-2">
        <div className="panel-title mb-1">▍인구 · 징병 자원</div>
        <Stat label="총인구" value={fmt(p.population)} sub="추정" />
        <Stat label="징병 대상 인구" value={fmt(p.draftEligible)} />
        <Stat label="이미 징집" value={fmt(p.drafted)} />
        <Stat label="남은 징병 가능" value={fmt(p.recruitablePopulation)} />
        <Stat label="국가가 접근 가능한 양" value={fmt(provinceDraftable(p))} sub={`안정도 ${p.controlStability.toFixed(0)}`} />
        <div className="mt-1 text-[10.5px] text-slate-500">징집은 개별 도시가 아니라 <b>국가</b> 단위로 수행합니다(국가 관리 화면). 이 지역의 남은 인구는 통제 중일 때만 국가 징병 자원에 합산됩니다.</div>
        <button className="btn mt-1.5 w-full" onClick={() => setModal('manage')}>국가 관리 화면 열기 (징집·훈련)</button>
      </div>
      <div className="rounded border border-ink-600 bg-ink-800/60 p-2">
        <div className="panel-title mb-1">▍부대 편성 (국가 훈련병 풀 사용)</div>
        <div className="flex justify-between"><span className="text-slate-400">국가 훈련병 풀</span><b className="text-sky-300">{fmt(me.trainees.count)}명 · 훈련도 {me.trainees.training.toFixed(0)}</b></div>
        <button className="btn mt-1.5 w-full" disabled={!cpOk(2) || me.trainees.count < minMen} onClick={() => nation('create', p.id)} title={`이 도시에 ${label}을(를) 창설합니다. 훈련병 ${fmt(minMen)}명 이상 필요, 장비는 자동 배분`}>
          {label} 창설 (CP2) — 이 지역에 편성
        </button>
        {me.trainees.count < minMen && <div className="mt-0.5 text-[10.5px] text-slate-500">훈련병이 {fmt(minMen)}명 이상 필요합니다. 국가 관리 화면에서 징집하세요.</div>}
        <div className="mt-1.5 flex gap-1">
          <select className="min-w-0 flex-1 rounded border border-ink-600 bg-ink-900 px-1 text-[11px]" value={reinforceId} onChange={(e) => setReinforceId(e.target.value)}>
            <option value="">보충할 부대 선택…</option>
            {needy.map((u) => <option key={u.id} value={u.id}>{u.name} ({fmt(u.strength)}/{fmt(u.maxStrength)})</option>)}
          </select>
          <button className="btn" disabled={!reinforceId || !cpOk() || me.trainees.count <= 0} onClick={() => { nation('reinforce', reinforceId); setReinforceId(''); }}>보충 (CP1)</button>
        </div>
      </div>
      <div className="rounded border border-ink-600 bg-ink-800/60 p-2">
        <div className="panel-title mb-1">▍군수 생산 (자동)</div>
        <div className="text-slate-300">생산 가능: {keys.length ? keys.map((k) => EQUIP_KO[k]).join(', ') : '없음 (산업 기반 부족)'}</div>
        <div className="mt-1 text-[10.5px] text-slate-500">일일 생산 점수 {p.equipmentProduction.toFixed(2)} · 국가 전체 부족 현황에 맞춰 자동 생산되어 국가 군수 재고로 들어가고, 부족한 부대에 자동 배분됩니다.</div>
      </div>
      <div className="rounded border border-ink-600 bg-ink-800/60 p-2">
        <div className="panel-title mb-1">▍기반시설 · 방어</div>
        <div className="grid grid-cols-2 gap-1">
          <button className="btn" disabled={!cpOk()} onClick={() => act('repair')} title="기반시설·전쟁 피해 복구">기반시설 복구 (CP1)</button>
          <button className="btn" disabled={!cpOk() || p.fortification >= 5} onClick={() => act('fortify')} title="보급 자원 12 소모">방어시설 강화 (CP1)</button>
        </div>
      </div>
    </div>
  );
}

export default function RightPanel({ embedded = false }: { embedded?: boolean }) {
  const game = useGame((s) => s.game);
  const selected = useGame((s) => s.selectedProvince);
  const [tab, setTab] = useState<'info' | 'units' | 'domestic'>('units');
  const p = selected ? game.provinces[selected] : null;
  if (!p) {
    if (embedded) return null;
    return (
      <aside data-tour="right" className="panel flex w-[300px] shrink-0 flex-col items-center justify-center gap-2 border-y-0 border-r-0 p-4 text-center text-[12px] text-slate-500">
        <div className="text-3xl">🗺</div>
        지도에서 지역을 클릭하면 정보와<br />부대·내정 명령이 표시됩니다.
        <div className="mt-2 text-[11px] text-slate-600">마우스 휠: 확대·축소 / 드래그: 이동</div>
      </aside>
    );
  }
  const tabs = [['info', '개요'], ['units', '부대'], ['domestic', '내정']] as const;
  const nUnits = Object.values(game.units).filter((u) => u.location === p.id && u.side === game.playerSide).length;
  void MAP;
  return (
    <aside data-tour="right" className={embedded ? 'flex min-h-0 flex-1 flex-col' : 'panel flex w-[300px] shrink-0 flex-col border-y-0 border-r-0'}>
      <div className="flex border-b border-ink-700">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={(embedded ? 'flex-1 py-3 text-[14px] font-bold ' : 'flex-1 py-2 text-[12px] font-bold ') + (tab === id ? 'border-b-2 border-brass text-brass' : 'text-slate-500 hover:text-slate-300')}>
            {label}{id === 'units' && nUnits ? ` (${nUnits})` : ''}
          </button>
        ))}
      </div>
      <div className={'flex-1 p-3 ' + (embedded ? '' : 'overflow-y-auto')}>
        {tab === 'info' && <Overview p={p} />}
        {tab === 'units' && <UnitsTab p={p} />}
        {tab === 'domestic' && <DomesticTab p={p} />}
      </div>
    </aside>
  );
}
