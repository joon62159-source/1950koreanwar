import type { ReactNode } from 'react';

/** 이벤트 장면 공용 부품: 캔버스 크기, 난수, 능선, 별, 병사·전차·트럭·함선·건물·연기·섬광·깃발 */
export const W = 640;
export const H = 240;

export function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** 능선 실루엣 경로 */
export function ridge(seed: number, base: number, amp: number, step = 24): string {
  const r = rng(seed);
  let d = `M0 ${H} L0 ${base}`;
  for (let x = 0; x <= W + step; x += step) d += ` L${x} ${(base - r() * amp).toFixed(1)}`;
  return d + ` L${W} ${H} Z`;
}

export const Stars = ({ n = 40, seed = 3, maxY = 120 }: { n?: number; seed?: number; maxY?: number }) => {
  const r = rng(seed);
  return (
    <g fill="#fff">
      {Array.from({ length: n }, (_, i) => <circle key={i} cx={r() * W} cy={r() * maxY} r={r() * 1.1 + 0.2} opacity={0.4 + r() * 0.5} />)}
    </g>
  );
};

export const Soldier = ({ x, y, s = 1, flip = false, rifle = true }: { x: number; y: number; s?: number; flip?: boolean; rifle?: boolean }) => (
  <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`} fill="#05080c">
    <circle cx="0" cy="-17" r="2.6" />
    <path d="M-3 -14 L3 -14 L4 -3 L1.5 -3 L1 6 L-1 6 L-1.5 -3 L-4 -3 Z" />
    {rifle && <rect x="2" y="-12" width="10" height="1.3" transform="rotate(-18 2 -12)" />}
  </g>
);

export const Tank = ({ x, y, s = 1, flip = false }: { x: number; y: number; s?: number; flip?: boolean }) => (
  <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`} fill="#05080c">
    <rect x="-22" y="-8" width="44" height="8" rx="2" />
    <rect x="-24" y="-3" width="48" height="5" rx="2.5" />
    <path d="M-11 -8 L-8 -14 L10 -14 L13 -8 Z" />
    <rect x="12" y="-12" width="30" height="2.4" />
  </g>
);

export const Truck = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} fill="#05080c">
    <rect x="-20" y="-12" width="26" height="11" />
    <rect x="7" y="-9" width="12" height="8" />
    <circle cx="-12" cy="0" r="3" />
    <circle cx="12" cy="0" r="3" />
  </g>
);

export const Ship = ({ x, y, s = 1, flip = false, guns = true }: { x: number; y: number; s?: number; flip?: boolean; guns?: boolean }) => (
  <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`} fill="#05080c">
    <path d="M-60 0 L60 0 L48 12 L-52 12 Z" />
    <rect x="-18" y="-12" width="30" height="12" />
    <rect x="-6" y="-24" width="12" height="12" />
    <rect x="-2" y="-34" width="3" height="10" />
    {guns && <rect x="22" y="-6" width="26" height="2.5" />}
    {guns && <rect x="-52" y="-5" width="24" height="2.5" />}
  </g>
);

export const Building = ({ x, w, h, lit = 0.35, seed = 1 }: { x: number; w: number; h: number; lit?: number; seed?: number }) => {
  const r = rng(seed + x);
  const wins: ReactNode[] = [];
  for (let wy = 8; wy < h - 6; wy += 10) for (let wx = 4; wx < w - 4; wx += 8) if (r() < lit) wins.push(<rect key={`${wx}-${wy}`} x={x + wx} y={H - 38 - h + wy} width="3.5" height="4.5" fill="#f4c866" opacity="0.85" />);
  return (
    <g>
      <rect x={x} y={H - 38 - h} width={w} height={h + 38} fill="#080b10" />
      {wins}
    </g>
  );
};

export const Smoke = ({ x, y, n = 6, seed = 5, color = '#1a1d22', spread = 1 }: { x: number; y: number; n?: number; seed?: number; color?: string; spread?: number }) => {
  const r = rng(seed);
  return (
    <g fill={color}>
      {Array.from({ length: n }, (_, i) => <circle key={i} cx={x + (r() - 0.4) * 26 * spread * (i / 2 + 1)} cy={y - i * 17} r={9 + i * 5 + r() * 4} opacity={0.5 - i * 0.05} />)}
    </g>
  );
};

export const Flash = ({ x, y, s = 1, color = '#ffd36a' }: { x: number; y: number; s?: number; color?: string }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <circle r="26" fill={color} opacity="0.10" />
    <circle r="16" fill={color} opacity="0.22" />
    <circle r="8" fill={color} opacity="0.55" />
    <circle r="3.2" fill="#fff6d8" opacity="0.95" />
  </g>
);

export const Flag = ({ x, y, color = '#3d7fd1', h = 40 }: { x: number; y: number; color?: string; h?: number }) => (
  <g>
    <rect x={x} y={y} width="1.6" height={h} fill="#0a0d12" />
    <path d={`M${x + 1.6} ${y + 1} L${x + 26} ${y + 5} L${x + 1.6} ${y + 15} Z`} fill={color} stroke="#0a0d12" strokeWidth="0.6" />
  </g>
);

