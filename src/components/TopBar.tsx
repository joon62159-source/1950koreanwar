import { useGame } from '../store/gameStore';
import { totalStrength } from '../game/units';
import { formatDate, turnDaysFor } from '../game/util';
import { SCENARIO } from '../game/balance';
import { Bar, colorFor, fmt } from './common';

function Metric({ label, value, color, children }: { label: string; value: React.ReactNode; color?: string; children?: React.ReactNode }) {
  return (
    <div className="flex min-w-[88px] flex-col justify-center px-3">
      <span className="text-[10px] tracking-wider text-slate-500">{label}</span>
      <span className="text-[15px] font-bold tabular-nums leading-5" style={{ color }}>{value}</span>
      {children}
    </div>
  );
}

export default function TopBar() {
  const game = useGame((s) => s.game);
  const setModal = useGame((s) => s.setModal);
  const me = game.nations[game.playerSide];
  const strength = totalStrength(game, game.playerSide);
  const brigades = Object.values(game.units).filter((u) => u.side === game.playerSide).length;
  const d = game.diplomacy;
  const days = turnDaysFor(game.date);
  const ownCount = Object.values(game.provinces).filter((p) => p.owner === game.playerSide).length;
  return (
    <header className="panel flex h-[58px] shrink-0 items-stretch divide-x divide-ink-700 border-x-0 border-t-0">
      <div className="flex items-center gap-3 px-4">
        <div className="font-serif text-[17px] font-black tracking-wider text-brass">1950 — 운명의 한반도</div>
      </div>
      <div className="flex min-w-[210px] flex-col justify-center px-4">
        <span className="text-[10px] tracking-wider text-slate-500">TURN {game.turn} · 1턴 = {days}일</span>
        <span className="text-[15px] font-bold leading-5">{formatDate(game.date)}</span>
        <span className="text-[10px] text-slate-500">종료 {formatDate(SCENARIO.endDate)}</span>
      </div>
      <Metric label="국가" value={<span className="text-south">대한민국</span>}>
        <span className="text-[10px] text-slate-500">지역 {ownCount}/{Object.values(game.provinces).filter((p) => !p.external).length}</span>
      </Metric>
      <Metric label="총병력" value={fmt(strength)}>
        <span className="text-[10px] text-slate-500">여단 {brigades}개</span>
      </Metric>
      <Metric label="보급 자원" value={fmt(me.supplyStock)} color={colorFor(Math.min(100, me.supplyStock / 3))} />
      <Metric label="전쟁수행능력" value={me.warCapacity} color={colorFor(me.warCapacity)}>
        <Bar value={me.warCapacity} color={colorFor(me.warCapacity)} />
      </Metric>
      <Metric label="국민 지지" value={Math.round(me.popularSupport)} color={colorFor(me.popularSupport)}>
        <Bar value={me.popularSupport} color={colorFor(me.popularSupport)} />
      </Metric>
      <div className="flex items-center gap-4 px-3 text-[11px]">
        {[['미국 개입', d.usCommitment, false], ['UN 지지', d.unSupport, false], ['중국 개입 위험', d.chinaThreat, true], ['소련 지원(적)', d.sovietSupport, true]].map(([l, v, inv]) => (
          <div key={l as string} className="w-[74px]">
            <div className="flex justify-between text-slate-400"><span>{l}</span><span className="tabular-nums text-slate-200">{Math.round(v as number)}</span></div>
            <Bar value={v as number} color={colorFor(v as number, inv as boolean)} />
          </div>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-2 px-3">
        <button className="btn btn-blue" onClick={() => setModal('manage')}>국가 관리</button>
        <button className="btn" onClick={() => setModal('help')}>도움말</button>
        <button className="btn" onClick={() => setModal('menu')}>메뉴</button>
      </div>
    </header>
  );
}
