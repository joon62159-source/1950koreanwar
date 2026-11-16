import { useMemo, useState } from 'react';
import { useGame } from '../store/gameStore';
import { supplyInfo } from '../game/supply';
import { supplyBalance } from '../game/economy';
import { ECONOMY, SUPPLY } from '../game/balance';
import { Bar, colorFor, fmt } from './common';

const KIND = { main: ['★', '주 거점', '#ffe08a'], depot: ['▲', '전진 보급소', '#9fd0ff'], built: ['◆', '설치한 보급소', '#7ff0a2'] } as const;

/** 보급 현황: 보급 자원 수지, 거점, 단절된 부대, 시스템 안내. 상황 패널(PC)·상황 시트(모바일)에서 쓴다. */
export default function SupplyPanel() {
  const game = useGame((s) => s.game);
  const setLayer = useGame((s) => s.setLayer);
  const selectProvince = useGame((s) => s.selectProvince);
  const depot = useGame((s) => s.depot);
  const [help, setHelp] = useState(false);
  const side = game.playerSide;
  const me = game.nations[side];
  const bal = supplyBalance(game, side);
  const info = useMemo(() => supplyInfo(game, side), [game, side]);
  const cutUnits = Object.values(game.units).filter((u) => u.side === side && game.provinces[u.location].owner === side && !game.provinces[u.location].supplied);
  const sgn = (n: number) => (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(1);
  return (
    <section>
      <div className="panel-title mb-1">▍보급 현황</div>
      <div className="rounded border border-ink-600 bg-ink-800/60 p-2 text-[11.5px]">
        <div className="flex items-baseline justify-between">
          <span className="text-slate-400">보급 자원</span>
          <b style={{ color: colorFor(Math.min(100, me.supplyStock / 3)) }}>{fmt(me.supplyStock)} <span className="font-normal text-slate-500">/ {fmt(ECONOMY.supplyStockCap)}</span></b>
        </div>
        <Bar value={me.supplyStock} max={ECONOMY.supplyStockCap} color={colorFor(Math.min(100, me.supplyStock / 3))} />
        <div className="mt-1 leading-[1.5] text-slate-400">
          하루 수입 <b className="text-emerald-300">+{(bal.production + bal.aid).toFixed(1)}</b> (생산 {bal.production.toFixed(1)} · 원조 {bal.aid.toFixed(1)}) · 병력 소모 <b className="text-red-300">−{bal.consumption.toFixed(1)}</b>
          <div>하루 순증감 <b style={{ color: bal.net >= 0 ? '#6ee7a1' : '#ff9a9a' }}>{sgn(bal.net)}</b></div>
        </div>
      </div>
      <div className="mt-2 rounded border border-ink-600 bg-ink-800/60 p-2 text-[11.5px]">
        <div className="mb-1 text-slate-400">보급 거점</div>
        <div className="flex flex-col gap-1">
          {info.hubs.length === 0 && <div className="text-red-300">보급 거점이 없습니다!</div>}
          {info.hubs.map((h) => {
            const [icon, label, color] = KIND[h.kind];
            return (
              <div key={h.id} className="flex items-center justify-between gap-1">
                <button className="min-w-0 truncate text-left hover:underline" onClick={() => selectProvince(h.id)} title="지도에서 선택">
                  <span style={{ color }}>{icon}</span> {game.provinces[h.id].name} <span className="text-slate-500">{label}</span>
                </button>
                <span className="flex shrink-0 items-center gap-1">
                  {h.cut ? <span className="text-red-300" title="주 거점과 끊겨 비축분으로 버티는 중">고립 · {h.turnsLeft}턴 뒤 소멸</span> : <span className="tabular-nums text-slate-300">{h.level}</span>}
                  {h.kind === 'built' && <button className="btn !px-1.5 !py-0 !text-[10.5px]" onClick={() => depot(h.id, true)} title="이 보급소를 철수합니다(자원 환급 없음)">철수</button>}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 text-[10.5px] leading-[1.45] text-slate-500">전진 보급소는 인천 상륙 성공·서울 수복 때 자동으로 생기고, 항만·철도가 있는 지역에는 직접 설치할 수 있습니다(지역 선택 → 내정). 직접 설치 {Math.max(0, SUPPLY.maxBuiltDepots - info.hubs.filter((h) => h.kind === 'built').length)}곳 남음.</div>
      </div>
      <div className="mt-2 rounded border border-ink-600 bg-ink-800/60 p-2 text-[11.5px]">
        <div className="mb-0.5 flex items-center justify-between">
          <span className="text-slate-400">보급이 끊긴 부대</span>
          <b className={cutUnits.length ? 'text-red-300' : 'text-emerald-300'}>{cutUnits.length}개</b>
        </div>
        {cutUnits.slice(0, 4).map((u) => (
          <button key={u.id} className="block w-full truncate text-left text-red-200 hover:underline" onClick={() => selectProvince(u.location)}>
            ⚠ {u.name} <span className="text-slate-500">({game.provinces[u.location].name})</span>
          </button>
        ))}
        {cutUnits.length > 4 && <div className="text-slate-500">…외 {cutUnits.length - 4}개</div>}
        {cutUnits.length === 0 && <div className="text-slate-500">모든 부대가 보급선에 이어져 있습니다.</div>}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <button className="btn whitespace-nowrap" onClick={() => setLayer('supply')}>지도에서 보급 보기</button>
        <button className={'btn whitespace-nowrap ' + (help ? 'btn-blue' : '')} onClick={() => setHelp(!help)}>보급 시스템 안내 {help ? '▲' : '▼'}</button>
      </div>
      {help && (
        <div className="mt-2 rounded border border-[#8a7a4f]/60 bg-[#1a160c] p-2.5 text-[11.5px] leading-[1.6] text-slate-300">
          <div className="mb-1 font-bold text-brass">보급은 이렇게 작동합니다</div>
          <ul className="flex list-disc flex-col gap-1 pl-4">
            <li><b>보급 자원</b>: 나라 전체의 재고입니다. 생산·원조(미국 개입도에 비례)가 들어오고 병력 규모에 비례해 줄어듭니다. 방어시설 강화, 전진 보급소 설치, 일부 정책에 쓰이고 전쟁수행능력에도 반영됩니다.</li>
            <li><b>보급선</b>: 부대는 <b>보급 거점</b>(★ 부산)에서 <b>아군이 통제하는 지역</b>을 따라 이어진 길로 보급을 받습니다. 멀수록 보급 수준이 낮아지지만 이어져 있으면 최소 {SUPPLY.minConnectedLevel}은 유지됩니다. 철도와 좋은 기반시설이 보급을 늘립니다.</li>
            <li><b>포위</b>: 적이 길을 끊어 거점과 이어지지 않으면 그 지역은 보급 단절(빗금)입니다. 부대의 조직력이 떨어지고 턴마다 병력·장비를 잃습니다.</li>
            <li><b>전진 보급소</b>(▲◆): 전선 가까이에서 보급을 퍼뜨립니다. 반드시 <b>주 거점과 이어져</b> 있어야 하며, 끊기면 {Math.ceil(1 / SUPPLY.depotDecayPerTurn)}턴 안에 사라집니다. 적에게 점령당하면 파괴됩니다.</li>
            <li><b>관리하는 법</b>: ① [지도에서 보급 보기]로 거점과 보급선을 확인 ② 항만·철도 지역에 전진 보급소 설치(행정 점수 {SUPPLY.builtDepotCP} · 보급 {SUPPLY.builtDepotStock}) ③ 끊긴 길목을 탈환하거나 기반시설 복구 ④ 보급이 끊긴 부대는 서둘러 구출·후퇴.</li>
          </ul>
        </div>
      )}
    </section>
  );
}
