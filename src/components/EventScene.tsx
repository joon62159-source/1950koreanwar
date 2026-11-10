import type { ReactNode } from 'react';

/**
 * 이벤트 장면 일러스트 (코드로 그린 SVG, 실제 사진 아님).
 * HOI4식 이벤트 창의 상단 그림 역할: 하늘·지형·실루엣·연기·섬광을 겹쳐 장면 분위기를 만든다.
 */
export type SceneKind =
  | 'dawn_barrage'
  | 'headquarters'
  | 'bridge'
  | 'burning_city'
  | 'port'
  | 'trench'
  | 'landing'
  | 'advance'
  | 'winter_march'
  | 'talks'
  | 'conscripts'
  | 'memorial';

const W = 640;
const H = 240;

function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** 능선 실루엣 경로 */
function ridge(seed: number, base: number, amp: number, step = 24): string {
  const r = rng(seed);
  let d = `M0 ${H} L0 ${base}`;
  for (let x = 0; x <= W + step; x += step) d += ` L${x} ${(base - r() * amp).toFixed(1)}`;
  return d + ` L${W} ${H} Z`;
}

const Stars = ({ n = 40, seed = 3, maxY = 120 }: { n?: number; seed?: number; maxY?: number }) => {
  const r = rng(seed);
  return (
    <g fill="#fff">
      {Array.from({ length: n }, (_, i) => <circle key={i} cx={r() * W} cy={r() * maxY} r={r() * 1.1 + 0.2} opacity={0.4 + r() * 0.5} />)}
    </g>
  );
};

const Soldier = ({ x, y, s = 1, flip = false, rifle = true }: { x: number; y: number; s?: number; flip?: boolean; rifle?: boolean }) => (
  <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`} fill="#05080c">
    <circle cx="0" cy="-17" r="2.6" />
    <path d="M-3 -14 L3 -14 L4 -3 L1.5 -3 L1 6 L-1 6 L-1.5 -3 L-4 -3 Z" />
    {rifle && <rect x="2" y="-12" width="10" height="1.3" transform="rotate(-18 2 -12)" />}
  </g>
);

const Tank = ({ x, y, s = 1, flip = false }: { x: number; y: number; s?: number; flip?: boolean }) => (
  <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`} fill="#05080c">
    <rect x="-22" y="-8" width="44" height="8" rx="2" />
    <rect x="-24" y="-3" width="48" height="5" rx="2.5" />
    <path d="M-11 -8 L-8 -14 L10 -14 L13 -8 Z" />
    <rect x="12" y="-12" width="30" height="2.4" />
  </g>
);

const Truck = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} fill="#05080c">
    <rect x="-20" y="-12" width="26" height="11" />
    <rect x="7" y="-9" width="12" height="8" />
    <circle cx="-12" cy="0" r="3" />
    <circle cx="12" cy="0" r="3" />
  </g>
);

const Ship = ({ x, y, s = 1, flip = false, guns = true }: { x: number; y: number; s?: number; flip?: boolean; guns?: boolean }) => (
  <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`} fill="#05080c">
    <path d="M-60 0 L60 0 L48 12 L-52 12 Z" />
    <rect x="-18" y="-12" width="30" height="12" />
    <rect x="-6" y="-24" width="12" height="12" />
    <rect x="-2" y="-34" width="3" height="10" />
    {guns && <rect x="22" y="-6" width="26" height="2.5" />}
    {guns && <rect x="-52" y="-5" width="24" height="2.5" />}
  </g>
);

const Building = ({ x, w, h, lit = 0.35, seed = 1 }: { x: number; w: number; h: number; lit?: number; seed?: number }) => {
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

const Smoke = ({ x, y, n = 6, seed = 5, color = '#1a1d22', spread = 1 }: { x: number; y: number; n?: number; seed?: number; color?: string; spread?: number }) => {
  const r = rng(seed);
  return (
    <g fill={color}>
      {Array.from({ length: n }, (_, i) => <circle key={i} cx={x + (r() - 0.4) * 26 * spread * (i / 2 + 1)} cy={y - i * 17} r={9 + i * 5 + r() * 4} opacity={0.5 - i * 0.05} />)}
    </g>
  );
};

const Flash = ({ x, y, s = 1, color = '#ffd36a' }: { x: number; y: number; s?: number; color?: string }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <circle r="26" fill={color} opacity="0.10" />
    <circle r="16" fill={color} opacity="0.22" />
    <circle r="8" fill={color} opacity="0.55" />
    <circle r="3.2" fill="#fff6d8" opacity="0.95" />
  </g>
);

const Flag = ({ x, y, color = '#3d7fd1', h = 40 }: { x: number; y: number; color?: string; h?: number }) => (
  <g>
    <rect x={x} y={y} width="1.6" height={h} fill="#0a0d12" />
    <path d={`M${x + 1.6} ${y + 1} L${x + 26} ${y + 5} L${x + 1.6} ${y + 15} Z`} fill={color} stroke="#0a0d12" strokeWidth="0.6" />
  </g>
);

function Scene({ kind, id }: { kind: SceneKind; id: string }) {
  const g = (n: string) => `${id}-${n}`;
  switch (kind) {
    case 'dawn_barrage':
      return (
        <>
          <defs>
            <linearGradient id={g('sky')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0a0e1e" />
              <stop offset="0.45" stopColor="#5a2c3e" />
              <stop offset="0.78" stopColor="#d9783a" />
              <stop offset="1" stopColor="#ffc476" />
            </linearGradient>
          </defs>
          <rect width={W} height={H} fill={`url(#${g('sky')})`} />
          <Stars n={30} maxY={80} />
          <circle cx="470" cy="168" r="46" fill="#ffd28a" opacity="0.35" />
          <path d={ridge(7, 176, 16, 20)} fill="#2a1d28" />
          <path d={ridge(9, 206, 10, 16)} fill="#0d0b11" />
          {[60, 150, 250, 340, 450, 560].map((x, i) => <Flash key={x} x={x} y={160 + (i % 2) * 8} s={0.8 + (i % 3) * 0.25} />)}
          <Tank x={120} y={186} s={1.0} />
          <Tank x={250} y={182} s={1.25} />
          <Tank x={400} y={188} s={0.95} />
          <Tank x={540} y={184} s={1.4} />
          <Smoke x={190} y={176} seed={2} color="#3a2a30" />
          <Smoke x={500} y={176} seed={8} color="#3a2a30" />
          {[{ x: 54, y: 232 }, { x: 90, y: 236 }, { x: 560, y: 234 }, { x: 598, y: 238 }].map((p, i) => <Soldier key={i} x={p.x} y={p.y} s={1.9} flip={i > 1} />)}
          {[0, 1, 2, 3, 4, 5].map((i) => <line key={i} x1={90 + i * 90} y1={190} x2={30 + i * 70} y2={232} stroke="#ffd36a" strokeWidth="0.9" opacity="0.55" />)}
        </>
      );
    case 'headquarters':
      return (
        <>
          <defs><linearGradient id={g('sky')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#060914" /><stop offset="1" stopColor="#1c2840" /></linearGradient></defs>
          <rect width={W} height={H} fill={`url(#${g('sky')})`} />
          <Stars n={60} maxY={130} seed={11} />
          <path d="M250 -10 L180 235 L330 235 Z" fill="#cfe3ff" opacity="0.07" />
          <path d="M420 -10 L370 235 L500 235 Z" fill="#cfe3ff" opacity="0.06" />
          <rect x="120" y="108" width="400" height="132" fill="#070a10" />
          <path d="M100 108 L320 62 L540 108 Z" fill="#070a10" />
          {Array.from({ length: 14 }, (_, i) => <rect key={i} x={140 + i * 27} y={128 + (i % 2) * 40} width="10" height="22" fill="#f4c866" opacity={0.8 - (i % 3) * 0.2} />)}
          {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={150 + i * 62} y="108" width="7" height="132" fill="#10151f" />)}
          <Flag x={70} y={92} color="#3d7fd1" />
          <Flag x={560} y={92} color="#d9d9d9" />
          <Flag x={96} y={104} color="#c24141" h={30} />
          <rect x="0" y="222" width={W} height="18" fill="#030508" />
          {[40, 190, 400, 600].map((x, i) => <Soldier key={x} x={x} y={228} s={1.3} flip={i % 2 === 1} rifle={false} />)}
        </>
      );
    case 'bridge':
      return (
        <>
          <defs><linearGradient id={g('sky')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1a1628" /><stop offset="0.6" stopColor="#7a3a30" /><stop offset="1" stopColor="#e08a3c" /></linearGradient></defs>
          <rect width={W} height={H} fill={`url(#${g('sky')})`} />
          <path d={ridge(21, 118, 26)} fill="#12111a" />
          <rect x="0" y="150" width={W} height="90" fill="#171a26" />
          {Array.from({ length: 8 }, (_, i) => <line key={i} x1={70 + i * 70} y1={158 + i * 7} x2={110 + i * 70} y2={158 + i * 7} stroke="#e08a3c" strokeWidth="1.2" opacity="0.35" />)}
          <rect x="0" y="118" width={W} height="9" fill="#05070b" />
          {Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${i * 76} 127 Q${i * 76 + 38} 156 ${i * 76 + 76} 127`} fill="none" stroke="#05070b" strokeWidth="6" />)}
          <circle cx="400" cy="118" r="60" fill="#ff8a2a" opacity="0.2" />
          <Flash x={400} y={116} s={2.1} color="#ff9a3a" />
          <Smoke x={404} y={104} seed={4} color="#0e0e12" />
          {[{ x: 120, y: 118 }, { x: 150, y: 118 }, { x: 190, y: 118 }, { x: 250, y: 118 }].map((p, i) => <Soldier key={i} x={p.x} y={p.y} s={1} rifle={i % 2 === 0} />)}
          <Truck x={330} y={118} s={1.2} />
          {[{ x: 460, y: 226 }, { x: 490, y: 230 }, { x: 515, y: 226 }, { x: 545, y: 232 }, { x: 580, y: 228 }].map((p, i) => <Soldier key={i} x={p.x} y={p.y} s={1.9} flip rifle={false} />)}
        </>
      );
    case 'burning_city':
      return (
        <>
          <defs><linearGradient id={g('sky')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1b0f14" /><stop offset="0.7" stopColor="#7a2a1c" /><stop offset="1" stopColor="#e0642a" /></linearGradient></defs>
          <rect width={W} height={H} fill={`url(#${g('sky')})`} />
          <path d={ridge(31, 120, 40, 30)} fill="#140d10" />
          {[20, 70, 120, 165, 215, 270, 330, 380, 430, 490, 545, 590].map((x, i) => <Building key={x} x={x} w={34 + (i % 3) * 10} h={50 + ((i * 37) % 70)} seed={i} lit={0.18} />)}
          <Smoke x={150} y={150} n={8} seed={3} color="#0c0a0b" spread={1.3} />
          <Smoke x={330} y={140} n={9} seed={6} color="#0c0a0b" spread={1.3} />
          <Smoke x={520} y={150} n={8} seed={9} color="#0c0a0b" spread={1.3} />
          {[150, 330, 520].map((x) => <Flash key={x} x={x} y={168} s={1.4} color="#ff7a2a" />)}
          <rect x="0" y="212" width={W} height="28" fill="#070508" />
          {[60, 110, 400, 450, 580].map((x, i) => <Soldier key={x} x={x} y={228} s={1.6} flip={i % 2 === 0} />)}
        </>
      );
    case 'port':
      return (
        <>
          <defs><linearGradient id={g('sky')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#243a5c" /><stop offset="0.7" stopColor="#d58a5a" /><stop offset="1" stopColor="#f7c98a" /></linearGradient></defs>
          <rect width={W} height={H} fill={`url(#${g('sky')})`} />
          <circle cx="300" cy="150" r="30" fill="#fff0c8" opacity="0.5" />
          <rect x="0" y="150" width={W} height="90" fill="#274866" />
          {Array.from({ length: 9 }, (_, i) => <line key={i} x1={30 + i * 70} y1={165 + (i % 3) * 14} x2={80 + i * 70} y2={165 + (i % 3) * 14} stroke="#cfe3ff" strokeWidth="1" opacity="0.2" />)}
          <Ship x={150} y={160} s={1} />
          <Ship x={410} y={156} s={1.3} flip />
          <rect x="0" y="196" width={W} height="44" fill="#07090d" />
          {[80, 260, 470].map((x) => (
            <g key={x} stroke="#05070b" strokeWidth="3" fill="none">
              <path d={`M${x} 196 L${x} 128 L${x + 70} 128 M${x + 70} 128 L${x + 70} 150`} />
              <path d={`M${x} 128 L${x - 24} 158`} strokeWidth="2" />
            </g>
          ))}
          {[120, 200, 340, 420, 540, 600].map((x, i) => i % 2 ? <Truck key={x} x={x} y={222} s={1.1} /> : <Soldier key={x} x={x} y={226} s={1.6} />)}
          {[{ x: 200, y: 60 }, { x: 260, y: 44 }, { x: 460, y: 70 }].map((p, i) => (
            <g key={i} transform={`translate(${p.x} ${p.y})`} fill="#05070b"><path d="M-14 0 L14 0 L0 -3 Z M0 -6 L0 3 L-3 3 L-3 -4 Z" /><rect x="-18" y="-1.4" width="36" height="2.2" /></g>
          ))}
        </>
      );
    case 'trench':
      return (
        <>
          <defs><linearGradient id={g('sky')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#10172a" /><stop offset="0.65" stopColor="#2f3a52" /><stop offset="1" stopColor="#6f6a72" /></linearGradient></defs>
          <rect width={W} height={H} fill={`url(#${g('sky')})`} />
          <Stars n={22} maxY={90} seed={5} />
          {[130, 380, 540].map((x, i) => <g key={x}><circle cx={x} cy={44 + i * 12} r="22" fill="#fff6d0" opacity="0.12" /><circle cx={x} cy={44 + i * 12} r="4.5" fill="#fff6d0" opacity="0.95" /></g>)}
          <path d={ridge(41, 130, 30)} fill="#141822" />
          <path d={ridge(43, 160, 20, 20)} fill="#0b0d13" />
          {Array.from({ length: 22 }, (_, i) => <rect key={i} x={i * 30 + 4} y={186 - (i % 3)} width="22" height="9" rx="3" fill="#2a2420" stroke="#05060a" strokeWidth="0.7" />)}
          <rect x="0" y="195" width={W} height="45" fill="#05060a" />
          {[40, 100, 170, 250, 330, 420, 500, 580].map((x, i) => <Soldier key={x} x={x} y={188 + (i % 2) * 4} s={1.5} flip={i % 3 === 0} />)}
          {Array.from({ length: 16 }, (_, i) => <path key={i} d={`M${i * 40} 170 l6 -9 l6 9 l6 -9 l6 9`} stroke="#0a0b0f" strokeWidth="1" fill="none" opacity="0.8" />)}
          <Flash x={350} y={125} s={0.9} />
          <Flash x={470} y={132} s={0.7} />
        </>
      );
    case 'landing':
      return (
        <>
          <defs><linearGradient id={g('sky')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0c1424" /><stop offset="0.6" stopColor="#3c4660" /><stop offset="1" stopColor="#d98a5a" /></linearGradient></defs>
          <rect width={W} height={H} fill={`url(#${g('sky')})`} />
          <rect x="0" y="120" width={W} height="120" fill="#18283e" />
          {Array.from({ length: 10 }, (_, i) => <line key={i} x1={20 + i * 65} y1={150 + (i % 4) * 20} x2={70 + i * 65} y2={150 + (i % 4) * 20} stroke="#cfe3ff" strokeWidth="1" opacity="0.15" />)}
          <path d={`M420 120 L${W} 120 L${W} ${H} L520 ${H} Z`} fill="#0a0d12" />
          <path d={ridge(51, 112, 22, 20)} fill="#0c0e14" />
          <Flash x={470} y={130} s={1.5} color="#ff8a3a" />
          <Flash x={560} y={136} s={1.1} color="#ff8a3a" />
          <Smoke x={470} y={118} n={6} seed={2} color="#0a0a0d" />
          <Ship x={130} y={140} s={1.2} />
          <Ship x={270} y={134} s={0.9} />
          <Flash x={196} y={128} s={0.8} />
          {[{ x: 330, y: 190 }, { x: 400, y: 200 }, { x: 250, y: 208 }, { x: 190, y: 220 }].map((p, i) => (
            <g key={i} transform={`translate(${p.x} ${p.y})`}><path d="M-22 0 L22 0 L28 -6 L-18 -6 Z" fill="#05070b" />{[-12, -4, 4, 12].map((dx) => <circle key={dx} cx={dx} cy="-9" r="2.2" fill="#05070b" />)}</g>
          ))}
          {[0, 1, 2, 3, 4].map((i) => <line key={i} x1={150 + i * 40} y1={128} x2={450 + i * 10} y2={140} stroke="#ffd36a" strokeWidth="0.8" opacity="0.35" />)}
        </>
      );
    case 'advance':
      return (
        <>
          <defs><linearGradient id={g('sky')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a5a86" /><stop offset="0.7" stopColor="#e8b27a" /><stop offset="1" stopColor="#fbe0a8" /></linearGradient></defs>
          <rect width={W} height={H} fill={`url(#${g('sky')})`} />
          <circle cx="440" cy="130" r="36" fill="#fff4cf" opacity="0.7" />
          <path d={ridge(61, 138, 40, 30)} fill="#2a3446" />
          <path d={ridge(63, 168, 24, 22)} fill="#141a24" />
          <path d={`M0 ${H - 40} L${W} ${H - 66} L${W} ${H} L0 ${H} Z`} fill="#0a0d12" />
          <Tank x={170} y={196} s={1.4} />
          <Tank x={360} y={186} s={1.1} />
          <Truck x={500} y={182} s={1.3} />
          {Array.from({ length: 8 }, (_, i) => <Soldier key={i} x={40 + i * 26} y={222 - i * 1.5} s={1.4} />)}
          <Flag x={235} y={118} color="#3d7fd1" h={52} />
          <Flag x={560} y={112} color="#3d7fd1" h={52} />
          {[0, 1, 2].map((i) => <ellipse key={i} cx={90 + i * 210} cy={226} rx="60" ry="6" fill="#d9b67e" opacity="0.15" />)}
        </>
      );
    case 'winter_march':
      return (
        <>
          <defs><linearGradient id={g('sky')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#070c1a" /><stop offset="1" stopColor="#2a3c5e" /></linearGradient></defs>
          <rect width={W} height={H} fill={`url(#${g('sky')})`} />
          <Stars n={50} maxY={100} seed={17} />
          <circle cx="520" cy="52" r="24" fill="#e8f0ff" opacity="0.9" />
          <circle cx="520" cy="52" r="46" fill="#cfe3ff" opacity="0.1" />
          <path d={ridge(71, 120, 70, 40)} fill="#9db4d4" opacity="0.55" />
          <path d={ridge(73, 150, 50, 30)} fill="#4a5f82" />
          <path d={ridge(75, 182, 30, 22)} fill="#0b101c" />
          {Array.from({ length: 34 }, (_, i) => <Soldier key={i} x={20 + i * 19} y={148 + Math.sin(i / 3) * 6 + (i * 0.7)} s={0.9} />)}
          {Array.from({ length: 14 }, (_, i) => <Soldier key={`b${i}`} x={380 + i * 18} y={206 + (i % 3) * 3} s={1.6} />)}
          {[{ x: 120, y: 90 }, { x: 300, y: 72 }].map((p, i) => <g key={i}><circle cx={p.x} cy={p.y} r="16" fill="#7bff9a" opacity="0.16" /><circle cx={p.x} cy={p.y} r="3.4" fill="#cfffd8" /></g>)}
          {Array.from({ length: 40 }, (_, i) => <circle key={i} cx={(i * 97) % W} cy={(i * 53) % H} r="1.2" fill="#fff" opacity="0.7" />)}
        </>
      );
    case 'talks':
      return (
        <>
          <defs><linearGradient id={g('sky')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a4048" /><stop offset="1" stopColor="#6a7078" /></linearGradient></defs>
          <rect width={W} height={H} fill={`url(#${g('sky')})`} />
          <path d={ridge(81, 140, 30)} fill="#252a31" />
          <path d="M150 200 L320 70 L490 200 Z" fill="#14181e" />
          <rect x="150" y="196" width="340" height="44" fill="#0c0f14" />
          <rect x="220" y="170" width="200" height="8" fill="#2a2f38" />
          <rect x="228" y="178" width="6" height="40" fill="#1a1d24" />
          <rect x="406" y="178" width="6" height="40" fill="#1a1d24" />
          <Flag x={270} y={140} color="#d9e8ff" h={32} />
          <Flag x={360} y={140} color="#c24141" h={32} />
          <rect x="268" y="140" width="1.6" height="32" fill="#0a0d12" />
          {[240, 262, 380, 404].map((x, i) => <Soldier key={x} x={x} y={198} s={1.6} flip={i > 1} rifle={false} />)}
          {Array.from({ length: 70 }, (_, i) => <line key={i} x1={(i * 37) % W} y1={(i * 29) % H} x2={((i * 37) % W) - 6} y2={((i * 29) % H) + 14} stroke="#cfe3ff" strokeWidth="0.7" opacity="0.35" />)}
        </>
      );
    case 'conscripts':
      return (
        <>
          <defs><linearGradient id={g('sky')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2a1c30" /><stop offset="0.6" stopColor="#b8503a" /><stop offset="1" stopColor="#f0a85a" /></linearGradient></defs>
          <rect width={W} height={H} fill={`url(#${g('sky')})`} />
          <circle cx="320" cy="168" r="44" fill="#ffd28a" opacity="0.55" />
          <path d={ridge(91, 150, 28, 26)} fill="#1c1420" />
          <rect x="0" y="196" width={W} height="44" fill="#07060a" />
          {Array.from({ length: 22 }, (_, i) => <Soldier key={i} x={20 + i * 28} y={210 + (i % 3) * 5} s={1.5 + (i % 4) * 0.12} />)}
          <Flag x={140} y={96} color="#3d7fd1" h={70} />
          <Flag x={470} y={104} color="#3d7fd1" h={62} />
          {Array.from({ length: 6 }, (_, i) => <ellipse key={i} cx={40 + i * 110} cy={232} rx="46" ry="5" fill="#d9a46a" opacity="0.15" />)}
        </>
      );
    case 'memorial':
    default:
      return (
        <>
          <defs><linearGradient id={g('sky')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#10131c" /><stop offset="0.7" stopColor="#3a3440" /><stop offset="1" stopColor="#7a6a60" /></linearGradient></defs>
          <rect width={W} height={H} fill={`url(#${g('sky')})`} />
          <Stars n={20} maxY={90} seed={23} />
          <path d={ridge(101, 150, 24, 28)} fill="#15131a" />
          <rect x="0" y="176" width={W} height="64" fill="#07060a" />
          {Array.from({ length: 4 }, (_, row) =>
            Array.from({ length: 16 - row }, (_, i) => {
              const x = 24 + i * (36 + row * 3) + row * 10;
              const y = 188 + row * 14;
              const s = 0.8 + row * 0.2;
              return (
                <g key={`${row}-${i}`} transform={`translate(${x} ${y}) scale(${s})`} fill="#c9c2b0" opacity={0.85 - row * 0.1}>
                  <rect x="-1" y="-16" width="2" height="16" />
                  <rect x="-6" y="-12" width="12" height="2" />
                </g>
              );
            }),
          )}
          <Flag x={300} y={70} color="#3d7fd1" h={104} />
          {[200, 420].map((x) => <g key={x}><circle cx={x} cy={166} r="18" fill="#ffd28a" opacity="0.2" /><circle cx={x} cy={166} r="3" fill="#ffe9b0" /></g>)}
        </>
      );
  }
}

export default function EventScene({ kind, title, date, kicker }: { kind: SceneKind; title: string; date: string; kicker?: string }) {
  const id = `sc-${kind}`;
  return (
    <div>
      <div className="relative overflow-hidden">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" preserveAspectRatio="xMidYMid slice" role="img" aria-label={title}>
          <defs>
            <radialGradient id={`${id}-vig`} cx="50%" cy="50%" r="75%">
              <stop offset="0.6" stopColor="#000" stopOpacity="0" />
              <stop offset="1" stopColor="#000" stopOpacity="0.65" />
            </radialGradient>
            <pattern id={`${id}-scan`} width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#000" opacity="0.12" /></pattern>
          </defs>
          <Scene kind={kind} id={id} />
          <rect width={W} height={H} fill={`url(#${id}-scan)`} />
          <rect width={W} height={H} fill={`url(#${id}-vig)`} />
        </svg>
        <div className="absolute right-3 top-2 text-[10px] tracking-widest text-[#e1c274]/90 drop-shadow">{date}</div>
        <div className="absolute left-3 top-2 rounded bg-black/40 px-1.5 text-[9px] text-slate-300/80">일러스트</div>
      </div>
      <div className="border-y-2 border-[#3a2f18] bg-gradient-to-b from-[#1f1a0e] to-[#16130c] px-5 py-2.5">
        {kicker && <div className="text-[11px] font-bold tracking-[0.3em] text-[#e1c274]">{kicker}</div>}
        <div className="font-serif text-[28px] font-black leading-tight text-[#f4ead0]">{title}</div>
      </div>
    </div>
  );
}
