import type { EquipKey, Terrain, UnitKind } from '../game/types';

export const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');
export const TERRAIN_KO: Record<Terrain, string> = { plain: '평지', paddy: '논(수전)', hills: '구릉', mountain: '산악', urban: '도시', river: '하천', coastal: '해안' };
export const EQUIP_KO: Record<EquipKey, string> = { rifles: '소총', machineGuns: '기관총', mortars: '박격포', artillery: '야포', antiTank: '대전차화기', tanks: '전차', vehicles: '차량' };
export const KIND_KO: Record<UnitKind, string> = { infantry: '보병', motorized: '차량화보병', armor: '기갑', marine: '해병' };

export function Bar({ value, max = 100, color = '#3d7fd1' }: { value: number; max?: number; color?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="bar">
      <i style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function colorFor(v: number, invert = false) {
  const x = invert ? 100 - v : v;
  return x > 66 ? '#5fae6a' : x > 33 ? '#d3b04a' : '#c8503f';
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-[12px] leading-5">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-100 tabular-nums">
        {value}
        {sub && <span className="ml-1 text-[10px] text-slate-500">{sub}</span>}
      </span>
    </div>
  );
}
