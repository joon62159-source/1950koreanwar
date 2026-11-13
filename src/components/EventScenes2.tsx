import type { ReactNode } from 'react';
import { W, H, rng, ridge, Stars, Soldier, Tank, Truck, Ship, Smoke, Flash, Flag } from './sceneKit';

/**
 * 이벤트마다 서로 다른 장면을 쓰기 위한 추가 일러스트 (코드로 그린 SVG).
 * 장면마다 구도·시간대·주인공 소품이 다르다.
 */
export type NewSceneKind =
  | 'airstrip' | 'war_room' | 'tokyo_crowd' | 'telegram' | 'mushroom' | 'empty_capital' | 'flag_raise'
  | 'railway_retreat' | 'river_tank' | 'ship_conference' | 'beachhead' | 'wreck_beach' | 'hotline'
  | 'convoy' | 'river_defense' | 'command_post' | 'victory_street' | 'hilltop' | 'bugle_charge'
  | 'rail_yard' | 'refugees_ice' | 'red_train' | 'river_border' | 'campaign_map' | 'barbed_wire';

type Stop = [number, string];
const Sky = ({ id, stops }: { id: string; stops: Stop[] }) => (
  <>
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        {stops.map(([o, c]) => <stop key={o} offset={o} stopColor={c} />)}
      </linearGradient>
    </defs>
    <rect width={W} height={H} fill={`url(#${id})`} />
  </>
);

const Glow = ({ x, y, r, color, o = 0.35 }: { x: number; y: number; r: number; color: string; o?: number }) => (
  <>
    <circle cx={x} cy={y} r={r} fill={color} opacity={o * 0.35} />
    <circle cx={x} cy={y} r={r * 0.62} fill={color} opacity={o * 0.55} />
    <circle cx={x} cy={y} r={r * 0.3} fill="#fff4d0" opacity={o} />
  </>
);

/** 빛줄기(램프 원뿔) */
const Cone = ({ x, y, w, h, color = '#ffd78a', o = 0.22 }: { x: number; y: number; w: number; h: number; color?: string; o?: number }) => (
  <path d={`M${x - 4} ${y} L${x - w / 2} ${y + h} L${x + w / 2} ${y + h} L${x + 4} ${y}Z`} fill={color} opacity={o} />
);

/** 윗몸 실루엣 (군모·파이프 옵션) */
const Bust = ({ x, y, s = 1, cap = false, pipe = false, flip = false, fill = '#05080c' }: { x: number; y: number; s?: number; cap?: boolean; pipe?: boolean; flip?: boolean; fill?: string }) => (
  <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`} fill={fill}>
    <path d="M-16 0 C-15 -14 -8 -19 0 -19 C8 -19 15 -14 16 0Z" />
    <rect x="-3" y="-24" width="6" height="7" />
    <ellipse cx="0" cy="-31" rx="8" ry="9.5" />
    {cap && (
      <g>
        <path d="M-10 -36 C-9 -45 9 -45 10 -36 L11 -33 L-11 -33Z" />
        <path d="M-6 -33 L16 -32 L15 -30 L-6 -31Z" />
      </g>
    )}
    {pipe && <path d="M4 -26 L18 -22 L19 -27 L22 -27 L22 -20 L18 -19 L4 -23Z" />}
  </g>
);

const Plane = ({ x, y, s = 1, flip = false }: { x: number; y: number; s?: number; flip?: boolean }) => (
  <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`} fill="#06080c">
    <path d="M-50 -2 C-40 -12 30 -12 52 -4 L58 0 L52 5 C30 8 -40 8 -50 2Z" />
    <path d="M-48 -3 L-62 -22 L-50 -22 L-36 -5Z" />
    <path d="M-8 -3 L-18 -26 L-6 -26 L6 -5Z" opacity=".9" />
    <path d="M-6 4 L-14 18 L-4 18 L8 5Z" />
    <rect x="12" y="-1" width="3" height="5" fill="#c9b36a" opacity=".5" />
    <rect x="22" y="-1" width="3" height="5" fill="#c9b36a" opacity=".5" />
    <circle cx="-20" cy="9" r="5" />
    <circle cx="10" cy="9" r="5" />
    <ellipse cx="-14" cy="-10" rx="2" ry="9" opacity=".35" />
  </g>
);

const Jeep = ({ x, y, s = 1, flip = false }: { x: number; y: number; s?: number; flip?: boolean }) => (
  <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`} fill="#05080c">
    <rect x="-15" y="-9" width="30" height="7" rx="1.5" />
    <path d="M-6 -9 L-4 -16 L8 -16 L10 -9Z" />
    <rect x="-17" y="-8" width="4" height="3" />
    <circle cx="-9" cy="-1" r="4" />
    <circle cx="9" cy="-1" r="4" />
  </g>
);

const Cloud = ({ x, y, w, color, o }: { x: number; y: number; w: number; color: string; o: number }) => (
  <g fill={color} opacity={o}>
    <ellipse cx={x} cy={y} rx={w} ry={w * 0.22} />
    <ellipse cx={x + w * 0.5} cy={y - w * 0.08} rx={w * 0.6} ry={w * 0.18} />
    <ellipse cx={x - w * 0.55} cy={y + w * 0.02} rx={w * 0.55} ry={w * 0.16} />
  </g>
);

const Crowd = ({ y, n, seed, s = 1, color = '#04060a', hats = true }: { y: number; n: number; seed: number; s?: number; color?: string; hats?: boolean }) => {
  const r = rng(seed);
  return (
    <g fill={color}>
      {Array.from({ length: n }, (_, i) => {
        const x = (i / n) * W + r() * 14;
        const k = (0.8 + r() * 0.5) * s;
        return (
          <g key={i} transform={`translate(${x} ${y + r() * 8}) scale(${k})`}>
            <ellipse cx="0" cy="-12" rx="4.2" ry="4.8" />
            <path d="M-7 8 C-7 -3 -4 -7 0 -7 C4 -7 7 -3 7 8Z" />
            {hats && r() > 0.65 && <path d="M-7 -16 L7 -16 L5 -19 L-5 -19Z" />}
            {r() > 0.85 && <path d="M5 -4 L11 -20 L13 -19 L8 -2Z" />}
          </g>
        );
      })}
    </g>
  );
};

const Poles = ({ y, n, color = '#05080c', h = 46 }: { y: number; n: number; color?: string; h?: number }) => (
  <g stroke={color} strokeWidth="1.4" fill="none">
    {Array.from({ length: n }, (_, i) => {
      const x = (i + 0.5) * (W / n);
      return (
        <g key={i}>
          <line x1={x} y1={y} x2={x} y2={y - h} />
          <line x1={x - 9} y1={y - h + 5} x2={x + 9} y2={y - h + 5} />
        </g>
      );
    })}
    <path d={`M0 ${y - h + 6} ${Array.from({ length: n }, (_, i) => `Q${(i + 0.5) * (W / n) + W / n / 2} ${y - h + 14} ${(i + 1.5) * (W / n)} ${y - h + 6}`).join(' ')}`} strokeWidth="0.8" />
  </g>
);

const Ruins = ({ y, seed, color = '#07090e', n = 12 }: { y: number; seed: number; color?: string; n?: number }) => {
  const r = rng(seed);
  let x = -10;
  const out: ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const w = 34 + r() * 40;
    const h = 26 + r() * 70;
    const jag = `M${x} ${y} L${x} ${y - h} L${x + w * 0.3} ${y - h + r() * 14} L${x + w * 0.5} ${y - h - r() * 8} L${x + w * 0.75} ${y - h + r() * 18} L${x + w} ${y - h + 6} L${x + w} ${y}Z`;
    out.push(<path key={i} d={jag} fill={color} />);
    for (let k = 0; k < 4; k++) if (r() > 0.55) out.push(<rect key={`w${i}-${k}`} x={x + 5 + (k % 2) * (w * 0.4)} y={y - h + 14 + Math.floor(k / 2) * 18} width="5" height="7" fill="#ff8a3a" opacity={0.5 + r() * 0.4} />);
    x += w - 4;
  }
  return <g>{out}</g>;
};

function Scene2Inner({ kind, id }: { kind: NewSceneKind; id: string }) {
  const g = (n: string) => `${id}-${n}`;
  switch (kind) {
    case 'airstrip':
      return (
        <>
          <Sky id={g('sky')} stops={[[0, '#171a30'], [0.4, '#7b3e4a'], [0.72, '#e0803c'], [1, '#ffc67a']]} />
          <Glow x={430} y={150} r={70} color="#ffd28a" o={0.9} />
          <path d={ridge(31, 150, 22, 28)} fill="#2d2230" />
          <path d={ridge(32, 168, 12, 22)} fill="#1a141d" />
          <Smoke x={560} y={160} n={5} seed={9} color="#1a1418" spread={0.7} />
          <path d={`M0 ${H} L0 176 L${W} 176 L${W} ${H}Z`} fill="#15110f" />
          <path d="M-20 176 L660 176 L660 240 L-20 240Z" fill="#1d1816" />
          {Array.from({ length: 10 }, (_, i) => <path key={i} d={`M${60 + i * 62} 190 L${80 + i * 62} 190 L${86 + i * 62} 196 L${62 + i * 62} 196Z`} fill="#e8d6a8" opacity={0.18 + i * 0.01} />)}
          <Plane x={150} y={186} s={2.1} />
          <path d="M96 186 L110 192 L98 196Z" fill="#05080c" />
          <rect x="94" y="184" width="2" height="12" fill="#e0803c" opacity=".7" />
          <Jeep x={290} y={190} s={1.7} />
          {[330, 345, 360, 375, 390].map((x, i) => <Soldier key={x} x={x} y={198 + (i % 2)} s={1.25} rifle />)}
          {[60, 74, 88].map((x) => <Soldier key={x} x={x} y={200} s={1.15} />)}
          <Bust x={500} y={238} s={3.2} cap pipe />
          <path d="M522 190 C530 178 520 170 528 158 C534 150 526 142 532 134" fill="none" stroke="#d8d0c8" strokeOpacity=".28" strokeWidth="4" strokeLinecap="round" />
        </>
      );
    case 'war_room':
      return (
        <>
          <Sky id={g('sky')} stops={[[0, '#07090e'], [1, '#17130e']]} />
          <rect x="60" y="30" width="520" height="110" fill="#1a1710" stroke="#2f2814" strokeWidth="3" />
          {/* 벽 지도 */}
          <path d="M120 50 L170 44 L210 70 L190 110 L230 128 L180 132 L140 100Z" fill="#33442f" opacity=".7" />
          <path d="M300 56 L350 50 L400 80 L380 120 L330 124Z" fill="#3a3f52" opacity=".6" />
          <path d="M420 60 L470 56 L520 90 L500 128 L450 120Z" fill="#4a3a30" opacity=".6" />
          <path d="M150 60 L400 90 L480 70" fill="none" stroke="#c24141" strokeWidth="2.4" strokeDasharray="6 4" />
          <circle cx="560" cy="48" r="12" fill="#e9e0c4" opacity=".7" />
          <path d="M560 48 L560 40 M560 48 L566 50" stroke="#222" strokeWidth="1.4" />
          {/* 램프 */}
          <Cone x={320} y={0} w={380} h={190} color="#ffd78a" o={0.2} />
          <path d="M300 0 L300 24 M340 0 L340 24" stroke="#0a0a0a" strokeWidth="1.2" />
          <path d="M296 24 L344 24 L336 36 L304 36Z" fill="#060606" />
          <ellipse cx="320" cy="38" rx="24" ry="4" fill="#ffe7a8" opacity=".85" />
          {/* 책상과 지도 */}
          <path d="M70 196 L120 150 L520 150 L570 196Z" fill="#8a7a50" />
          <path d="M70 196 L570 196 L570 214 L70 214Z" fill="#2a2214" />
          <path d="M200 172 C240 165 300 177 340 168 C380 160 420 172 450 166" fill="none" stroke="#c24141" strokeWidth="2" />
          <circle cx="260" cy="170" r="3" fill="#3d7fd1" />
          <circle cx="390" cy="164" r="3" fill="#c24141" />
          {[100, 170, 480, 550].map((x, i) => <Bust key={x} x={x} y={i < 2 ? 148 : 148} s={1.5} cap={i % 2 === 0} flip={x > 320} />)}
          {[230, 410].map((x) => <Bust key={x} x={x} y={146} s={1.4} />)}
          <Bust x={320} y={140} s={1.9} cap pipe />
          <rect x="0" y="214" width={W} height="26" fill="#050608" />
        </>
      );
    case 'tokyo_crowd':
      return (
        <>
          <Sky id={g('sky')} stops={[[0, '#2d3744'], [0.6, '#6f7c88'], [1, '#aab3ba']]} />
          <Cloud x={120} y={40} w={90} color="#c9d0d6" o={0.5} />
          <Cloud x={420} y={30} w={120} color="#d5dbe0" o={0.45} />
          <rect x="150" y="62" width="340" height="140" fill="#262d36" />
          <rect x="150" y="62" width="340" height="8" fill="#3b4551" />
          {Array.from({ length: 6 }, (_, i) => <rect key={i} x={172 + i * 52} y="84" width="14" height="110" fill="#1b2128" />)}
          {Array.from({ length: 10 }, (_, i) => <rect key={i} x={166 + i * 33} y={76} width="12" height="8" fill="#9fb2c4" opacity=".4" />)}
          <Flag x={160} y={34} color="#3d7fd1" h={34} />
          <Flag x={470} y={34} color="#d9d9d9" h={34} />
          {/* 비 */}
          {Array.from({ length: 60 }, (_, i) => {
            const r = rng(i + 3);
            const x = r() * W, y = r() * H;
            return <line key={i} x1={x} y1={y} x2={x - 6} y2={y + 16} stroke="#dfe8f0" strokeOpacity=".22" strokeWidth=".8" />;
          })}
          {/* 검은 승용차 */}
          <path d="M240 202 L255 188 C280 182 340 182 366 188 L392 202Z" fill="#050709" />
          <rect x="232" y="198" width="168" height="10" rx="3" fill="#050709" />
          <circle cx="268" cy="208" r="8" fill="#050709" />
          <circle cx="364" cy="208" r="8" fill="#050709" />
          <Bust x={312} y={186} s={1.5} cap />
          <Crowd y={218} n={64} seed={5} s={1.35} />
          <Crowd y={232} n={50} seed={8} s={1.7} />
        </>
      );
    case 'telegram':
      return (
        <>
          <Sky id={g('sky')} stops={[[0, '#05070c'], [1, '#10141c']]} />
          <rect x="60" y="30" width="170" height="130" fill="#0b1522" stroke="#2a2a2a" strokeWidth="4" />
          <path d="M60 130 L90 100 L110 120 L140 90 L170 125 L200 105 L230 130 L230 160 L60 160Z" fill="#05080c" />
          {Array.from({ length: 12 }, (_, i) => <rect key={i} x={72 + i * 13} y={118 + (i % 3) * 5} width="3" height="4" fill="#f4c866" opacity=".8" />)}
          <path d="M145 30 L145 160 M60 95 L230 95" stroke="#2a2a2a" strokeWidth="3" />
          <Stars n={20} seed={4} maxY={60} />
          <Cone x={470} y={20} w={300} h={210} color="#ffd78a" o={0.24} />
          <path d="M440 20 L500 20 L490 44 L450 44Z" fill="#070707" />
          <rect x="468" y="0" width="4" height="20" fill="#070707" />
          <ellipse cx="470" cy="46" rx="20" ry="3.5" fill="#ffe7a8" opacity=".9" />
          <path d="M0 190 L640 190 L640 240 L0 240Z" fill="#241b10" />
          <path d="M0 190 L640 190" stroke="#3a2c18" strokeWidth="3" />
          <g transform="rotate(-6 360 170)">
            <rect x="290" y="130" width="160" height="96" fill="#e6dcb8" />
            {Array.from({ length: 7 }, (_, i) => <rect key={i} x={304} y={144 + i * 11} width={90 + ((i * 37) % 50)} height="3" fill="#3a3224" opacity=".8" />)}
            <circle cx="415" cy="195" r="14" fill="none" stroke="#b02a2a" strokeWidth="2.4" />
            <path d="M406 195 L424 195 M415 186 L415 204" stroke="#b02a2a" strokeWidth="2" />
          </g>
          <path d="M470 205 L520 170 L526 174 L476 211Z" fill="#05080c" />
          <rect x="130" y="170" width="46" height="26" fill="#060606" />
          <path d="M150 168 C146 156 156 148 150 136" fill="none" stroke="#ddd" strokeOpacity=".3" strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case 'mushroom':
      return (
        <>
          <Sky id={g('sky')} stops={[[0, '#150c10'], [0.5, '#7a2e1c'], [0.85, '#ee9a3a'], [1, '#ffe3a0']]} />
          <Glow x={320} y={150} r={150} color="#ffcf6a" o={0.8} />
          <circle cx="320" cy="150" r="120" fill="none" stroke="#ffe3a0" strokeOpacity=".35" strokeWidth="3" />
          <path d="M296 190 C300 150 304 128 314 116 L326 116 C336 128 340 150 344 190Z" fill="#5a2a1c" />
          <path d="M296 190 C300 150 304 128 314 116" fill="none" stroke="#ff9a3a" strokeWidth="3" opacity=".7" />
          {[[320, 96, 46, '#7a3a24'], [286, 108, 30, '#5a2a1c'], [354, 108, 30, '#5a2a1c'], [320, 80, 32, '#a8522c'], [300, 90, 22, '#c8683a'], [342, 90, 22, '#c8683a'], [320, 68, 18, '#e88a44']].map(([x, y, r, c], i) => <circle key={i} cx={x as number} cy={y as number} r={r as number} fill={c as string} />)}
          <ellipse cx="320" cy="116" rx="52" ry="9" fill="#2a120c" opacity=".75" />
          <Glow x={320} y={88} r={34} color="#fff0b0" o={0.9} />
          <path d={ridge(41, 188, 20, 22)} fill="#120a0c" />
          <path d={ridge(42, 212, 10, 16)} fill="#070405" />
          <Smoke x={120} y={190} n={4} seed={3} color="#2a1410" />
          <Smoke x={540} y={192} n={4} seed={13} color="#2a1410" />
          {[80, 560, 600].map((x, i) => <Soldier key={x} x={x} y={234} s={1.6} flip={i > 0} rifle={false} />)}
        </>
      );
    case 'empty_capital':
      return (
        <>
          <Sky id={g('sky')} stops={[[0, '#150f1c'], [0.5, '#6a2a34'], [0.85, '#d8683a'], [1, '#f2a860']]} />
          <Glow x={320} y={140} r={100} color="#ffb870" o={0.7} />
          {/* 원경 돔 건물 */}
          <path d="M270 150 L270 118 L290 118 L290 104 C290 84 350 84 350 104 L350 118 L370 118 L370 150Z" fill="#12090f" />
          <rect x="316" y="72" width="8" height="14" fill="#12090f" />
          {Array.from({ length: 6 }, (_, i) => <rect key={i} x={276 + i * 16} y="124" width="5" height="20" fill="#e0803c" opacity=".5" />)}
          {/* 대로 (소실점 원근) */}
          <path d="M290 150 L350 150 L640 240 L0 240Z" fill="#17101a" />
          {Array.from({ length: 6 }, (_, i) => {
            const t = i / 6;
            const y = 150 + t * t * 90;
            const w = 4 + t * 24;
            return <rect key={i} x={320 - w / 2} y={y} width={w} height={2 + t * 4} fill="#d8b878" opacity={0.25 + t * 0.3} />;
          })}
          {/* 양쪽 건물 */}
          <path d="M0 240 L0 40 L90 62 L130 150 L110 240Z" fill="#0a0710" />
          <path d="M640 240 L640 40 L550 62 L510 150 L530 240Z" fill="#0a0710" />
          {Array.from({ length: 5 }, (_, i) => <rect key={i} x={26 + (i % 2) * 36} y={76 + i * 26} width="10" height="14" fill="#e0803c" opacity=".35" />)}
          {Array.from({ length: 5 }, (_, i) => <rect key={i} x={580 + (i % 2) * -36} y={76 + i * 26} width="10" height="14" fill="#e0803c" opacity=".35" />)}
          {/* 적 깃발 */}
          <Flag x={150} y={140} color="#c0272d" h={58} />
          <Flag x={470} y={140} color="#c0272d" h={58} />
          <Flag x={240} y={128} color="#c0272d" h={24} />
          {/* 멀리 오는 전차와 버려진 수레 */}
          <Tank x={326} y={158} s={0.7} />
          <path d="M200 214 L240 214 L236 224 L204 224Z M206 214 L206 200 M236 214 L236 202" stroke="#05080c" fill="#05080c" strokeWidth="1.6" />
          <circle cx="212" cy="226" r="5" fill="#05080c" />
          <circle cx="232" cy="226" r="5" fill="#05080c" />
          <path d="M60 228 L130 232" stroke="#05080c" strokeWidth="2" opacity=".6" />
        </>
      );
    case 'flag_raise':
      return (
        <>
          <Sky id={g('sky')} stops={[[0, '#2a2236'], [0.5, '#c8683a'], [1, '#ffd890']]} />
          <path d="M320 10 L190 240 L450 240Z" fill="#fff4d0" opacity=".1" />
          <Glow x={320} y={80} r={90} color="#ffe0a0" o={0.6} />
          <Ruins y={178} seed={11} color="#161018" n={14} />
          <Smoke x={90} y={170} n={5} seed={6} color="#2a2026" />
          <Smoke x={560} y={172} n={5} seed={16} color="#2a2026" />
          {/* 잔해 더미 */}
          <path d="M150 240 L220 184 L260 196 L300 168 L360 176 L420 190 L490 240Z" fill="#0b0810" />
          <path d="M220 184 L300 168" stroke="#3a2e30" strokeWidth="2" />
          {/* 깃대와 태극기 */}
          <rect x="318" y="62" width="3" height="120" fill="#1a1410" />
          <g>
            <rect x="321" y="66" width="62" height="40" fill="#f2efe6" />
            <circle cx="352" cy="86" r="10" fill="#c0272d" />
            <path d="M342 86 A10 10 0 0 0 362 86Z" fill="#2a5aa8" />
            {[[329, 72], [375, 72], [329, 100], [375, 100]].map(([x, y], i) => <rect key={i} x={x - 3} y={y - 4} width="8" height="3" fill="#1a1a1a" />)}
          </g>
          {[270, 292, 300, 346, 366, 392].map((x, i) => <Soldier key={x} x={x} y={190 + (i % 3) * 6} s={1.9} flip={i > 2} rifle={i % 2 === 0} />)}
          <Crowd y={236} n={36} seed={31} s={1.5} />
        </>
      );
    case 'railway_retreat':
      return (
        <>
          <Sky id={g('sky')} stops={[[0, '#10131f'], [0.55, '#5a3036'], [1, '#c8683a']]} />
          <path d={ridge(51, 120, 30, 30)} fill="#1a121a" />
          {/* 부서진 역사 지붕 */}
          <path d="M20 110 L240 110 L240 124 L20 124Z" fill="#07090e" />
          <path d="M60 124 L60 190 M130 124 L130 190 M200 124 L200 190" stroke="#07090e" strokeWidth="6" />
          <path d="M150 110 L190 138 L160 142Z" fill="#07090e" />
          <Flash x={110} y={168} s={1.7} color="#ff8a2a" />
          <Smoke x={118} y={160} n={6} seed={7} color="#120e10" />
          {/* 철로 (원근) */}
          <path d="M0 240 L300 150 L340 150 L640 240Z" fill="#0f0b0d" />
          {[0, 1, 2, 3, 4, 5].map((i) => <line key={i} x1={20 + i * 52} y1={236 - i * 12} x2={290 + i * 6} y2={152} stroke="#6a4a32" strokeWidth="1.2" opacity=".5" />)}
          <path d="M100 240 L308 152 M540 240 L332 152" stroke="#8a6a48" strokeWidth="2" />
          {/* 불타는 기관차 */}
          <rect x="400" y="160" width="86" height="30" fill="#05070a" />
          <rect x="460" y="144" width="26" height="18" fill="#05070a" />
          <rect x="408" y="148" width="8" height="14" fill="#05070a" />
          <circle cx="420" cy="192" r="8" fill="#05070a" />
          <circle cx="448" cy="192" r="8" fill="#05070a" />
          <circle cx="474" cy="192" r="8" fill="#05070a" />
          <Flash x={440} y={150} s={1.6} color="#ff7a2a" />
          <Smoke x={412} y={146} n={5} seed={19} color="#0e0b0d" />
          {/* 후퇴 행렬 */}
          {Array.from({ length: 10 }, (_, i) => <Soldier key={i} x={60 + i * 44} y={226 - (i % 3) * 3} s={1.55} flip={i % 4 === 0} rifle={i % 2 === 0} />)}
          <Truck x={300} y={222} s={1.6} />
        </>
      );
    case 'river_tank':
      return (
        <>
          <Sky id={g('sky')} stops={[[0, '#1a2236'], [0.5, '#c97a4a'], [0.85, '#ffd48a'], [1, '#ffe8b8']]} />
          <Glow x={500} y={140} r={80} color="#fff0b0" o={0.8} />
          {/* 도시 스카이라인과 연기 */}
          {Array.from({ length: 16 }, (_, i) => {
            const r = rng(i + 70);
            const w = 24 + r() * 22, h = 20 + r() * 52;
            return <rect key={i} x={i * 42 - 8} y={150 - h} width={w} height={h + 20} fill="#251a22" />;
          })}
          <Smoke x={160} y={140} n={4} seed={3} color="#3a2a2a" />
          <Smoke x={420} y={146} n={4} seed={8} color="#3a2a2a" />
          <rect x="0" y="168" width={W} height="72" fill="#16202e" />
          {Array.from({ length: 9 }, (_, i) => <line key={i} x1={40 + i * 70} y1={180 + (i % 3) * 14} x2={90 + i * 70} y2={180 + (i % 3) * 14} stroke="#ffe0a0" strokeOpacity=".3" strokeWidth="1.4" />)}
          {/* 큰 교량 */}
          <rect x="0" y="154" width={W} height="10" fill="#05070b" />
          {Array.from({ length: 8 }, (_, i) => <path key={i} d={`M${i * 84} 164 Q${i * 84 + 42} 192 ${i * 84 + 84} 164`} fill="none" stroke="#05070b" strokeWidth="6" />)}
          <Tank x={300} y={154} s={1.9} />
          {[170, 200, 230, 380, 410, 440].map((x, i) => <Soldier key={x} x={x} y={154} s={1.5} flip={i > 2} rifle />)}
          {[190, 395].map((x) => <path key={x} d={`M${x + 4} 138 L${x + 16} 118`} stroke="#05070b" strokeWidth="2" />)}
        </>
      );
    case 'ship_conference':
      return (
        <>
          <Sky id={g('sky')} stops={[[0, '#2a3040'], [0.55, '#7a828e'], [1, '#c8cdd2']]} />
          <Cloud x={160} y={44} w={110} color="#d8dde2" o={0.55} />
          <Cloud x={480} y={60} w={90} color="#e2e6ea" o={0.5} />
          <rect x="0" y="120" width={W} height="120" fill="#2d3a48" />
          {[60, 150, 250, 380, 470, 560].map((x, i) => <Ship key={x} x={x} y={120} s={0.28 + (i % 3) * 0.08} flip={i % 2 === 0} />)}
          {/* 함상 구조물 */}
          <path d="M0 240 L0 150 L640 150 L640 240Z" fill="#1a222c" />
          <path d="M0 150 L640 150" stroke="#8a96a2" strokeWidth="3" />
          {Array.from({ length: 22 }, (_, i) => <line key={i} x1={i * 30} y1="150" x2={i * 30} y2="172" stroke="#8a96a2" strokeWidth="2" />)}
          <path d="M0 172 L640 172" stroke="#8a96a2" strokeWidth="2" />
          {/* 주포탑 */}
          <path d="M420 190 L420 162 C430 152 470 152 480 162 L480 190Z" fill="#0a0f14" />
          <rect x="478" y="168" width="70" height="5" fill="#0a0f14" />
          <rect x="478" y="176" width="70" height="5" fill="#0a0f14" />
          {/* 지도 탁자와 장교들 */}
          <rect x="130" y="196" width="190" height="10" fill="#c9b78a" />
          <rect x="140" y="206" width="6" height="34" fill="#0a0f14" />
          <rect x="304" y="206" width="6" height="34" fill="#0a0f14" />
          <path d="M150 196 L300 196 L292 188 L160 188Z" fill="#e6dcb8" />
          <path d="M170 193 C200 190 230 194 260 190" stroke="#c24141" strokeWidth="1.4" fill="none" />
          {[110, 180, 240, 330].map((x, i) => <Bust key={x} x={x} y={198} s={1.7} cap={i !== 1} pipe={i === 2} flip={i > 1} />)}
          <path d="M130 100 C160 108 200 96 240 108" stroke="#05080c" strokeWidth="0" />
        </>
      );
    case 'beachhead':
      return (
        <>
          <Sky id={g('sky')} stops={[[0, '#26334a'], [0.5, '#8a6a7a'], [0.8, '#e8a060'], [1, '#ffd894']]} />
          <Glow x={440} y={130} r={80} color="#ffe0a0" o={0.75} />
          <rect x="0" y="130" width={W} height="40" fill="#2e4660" />
          <path d="M0 170 C100 160 200 176 320 168 C440 160 540 176 640 168 L640 240 L0 240Z" fill="#6a5a46" />
          <path d="M0 176 C100 170 200 184 320 176 C440 170 540 184 640 176" fill="none" stroke="#e8e2d0" strokeOpacity=".5" strokeWidth="2" />
          {/* 상륙정 램프 */}
          <path d="M20 110 L170 110 L170 176 L40 176Z" fill="#06080c" />
          <path d="M40 176 L90 200 L170 200 L170 176Z" fill="#0b0e14" />
          <rect x="30" y="92" width="60" height="18" fill="#06080c" />
          <Flag x={80} y={64} color="#3d7fd1" h={30} />
          {/* 해안 방벽과 불타는 잔해 */}
          <path d="M360 176 L640 176 L640 192 L360 192Z" fill="#241a16" />
          <Flash x={470} y={170} s={1.6} color="#ff8a2a" />
          <Smoke x={470} y={160} n={6} seed={5} color="#1a1416" />
          <Flash x={570} y={176} s={1.1} color="#ff8a2a" />
          <Smoke x={574} y={166} n={4} seed={15} color="#1a1416" />
          {/* 돌진하는 병사들 */}
          {Array.from({ length: 14 }, (_, i) => <Soldier key={i} x={150 + i * 28} y={200 + (i % 3) * 9} s={1.5 + (i % 3) * 0.2} rifle />)}
          {[0, 1, 2, 3].map((i) => <line key={i} x1={260 + i * 80} y1={188} x2={400 + i * 60} y2={174} stroke="#ffd36a" strokeWidth="1" opacity=".5" />)}
          <Flag x={604} y={150} color="#3d7fd1" h={36} />
        </>
      );
    case 'wreck_beach':
      return (
        <>
          <Sky id={g('sky')} stops={[[0, '#0a0b10'], [0.55, '#3a2a30'], [1, '#7a4a3a']]} />
          <Cloud x={200} y={40} w={150} color="#1a1418" o={0.8} />
          <Cloud x={500} y={64} w={160} color="#241a1e" o={0.7} />
          <rect x="0" y="130" width={W} height="110" fill="#10161e" />
          {Array.from({ length: 8 }, (_, i) => <path key={i} d={`M0 ${150 + i * 12} Q80 ${144 + i * 12} 160 ${150 + i * 12} T320 ${150 + i * 12} T480 ${150 + i * 12} T640 ${150 + i * 12}`} fill="none" stroke="#6a7a8a" strokeOpacity=".16" strokeWidth="1.2" />)}
          {[120, 300, 480].map((x, i) => (
            <g key={x} transform={`translate(${x} ${170 + i * 8}) rotate(${i % 2 ? 10 : -14})`}>
              <path d="M-40 0 L40 0 L30 14 L-34 14Z" fill="#05070b" />
              <rect x="-14" y="-12" width="28" height="12" fill="#05070b" />
              <Flash x={-4} y={-14} s={1.4} color="#ff6a2a" />
            </g>
          ))}
          <Smoke x={118} y={150} n={5} seed={2} color="#08090c" />
          <Smoke x={478} y={158} n={5} seed={12} color="#08090c" />
          {/* 조명탄 */}
          <Glow x={300} y={50} r={34} color="#ffcf8a" o={0.7} />
          <line x1="300" y1="54" x2="298" y2="120" stroke="#ddd" strokeOpacity=".2" />
          {[40, 160, 400, 560].map((x, i) => <Soldier key={x} x={x} y={232} s={1.7} flip={i > 1} rifle={false} />)}
        </>
      );
    case 'hotline':
      return (
        <>
          <Sky id={g('sky')} stops={[[0, '#0a0608'], [1, '#1a0f0f']]} />
          <rect x="0" y="40" width={W} height="110" fill="#1c1214" />
          {/* 벽의 세계지도와 붉은 화살표 */}
          <ellipse cx="320" cy="96" rx="170" ry="48" fill="#2b3a2a" opacity=".5" />
          <path d="M200 100 L240 80 L270 96 L300 70 L340 86 L380 70 L430 96 L450 110" fill="none" stroke="#c0272d" strokeWidth="2.4" strokeDasharray="7 5" />
          <path d="M440 96 L470 106 L452 114Z" fill="#c0272d" />
          {Array.from({ length: 8 }, (_, i) => <line key={i} x1={0} y1={46 + i * 14} x2={W} y2={46 + i * 14} stroke="#2a1a1a" strokeWidth="1" />)}
          <Cone x={200} y={0} w={240} h={190} color="#ffb46a" o={0.18} />
          {/* 책상 */}
          <path d="M0 176 L640 176 L640 240 L0 240Z" fill="#1d1410" />
          <path d="M0 176 L640 176" stroke="#3a2418" strokeWidth="3" />
          {/* 붉은 전화기 */}
          <path d="M300 176 L300 160 C300 150 340 150 340 160 L340 176Z" fill="#c0272d" />
          <path d="M296 152 C300 142 340 142 344 152 L342 148 C338 140 302 140 298 148Z" fill="#a31e24" />
          <rect x="296" y="150" width="48" height="8" rx="4" fill="#d8383e" />
          <circle cx="320" cy="168" r="6" fill="#7a1418" />
          <Glow x={320} y={160} r={46} color="#ff4a3a" o={0.35} />
          {/* 지구본 */}
          <circle cx="470" cy="148" r="26" fill="#2a3a52" />
          <path d="M452 140 C462 132 480 134 486 146 C480 160 462 164 454 156Z" fill="#3a5a3a" opacity=".85" />
          <path d="M470 120 L470 176 M440 148 L500 148" stroke="#111" strokeWidth="1.4" opacity=".5" />
          <path d="M452 176 L488 176 L480 168 L460 168Z" fill="#0a0808" />
          {/* 시계 */}
          <circle cx="90" cy="100" r="22" fill="#d8cfb6" />
          <path d="M90 100 L90 84 M90 100 L102 104" stroke="#1a1a1a" strokeWidth="2.2" />
          {[130, 560].map((x) => <Bust key={x} x={x} y={182} s={2.2} />)}
        </>
      );
    case 'convoy':
      return (
        <>
          <Sky id={g('sky')} stops={[[0, '#141a2c'], [0.5, '#5a3a44'], [0.85, '#d8783a'], [1, '#f0a85c']]} />
          <Glow x={320} y={150} r={90} color="#ffb070" o={0.6} />
          <path d={ridge(61, 150, 26, 26)} fill="#1c141c" />
          <path d={ridge(62, 172, 12, 20)} fill="#0f0b10" />
          <Poles y={184} n={7} h={40} />
          <path d="M0 184 L640 184 L640 240 L0 240Z" fill="#150f10" />
          <path d="M0 214 L640 200" stroke="#3a2e28" strokeWidth="2" opacity=".8" strokeDasharray="14 10" />
          {[40, 150, 270, 400, 520].map((x, i) => (
            <g key={x}>
              <Truck x={x} y={206 - i * 1.5} s={1.8 + (i % 2) * 0.2} />
              <path d={`M${x + 22} ${196 - i} L${x + 120} ${190 - i} L${x + 120} ${204 - i}Z`} fill="#ffe7a8" opacity=".12" />
              <circle cx={x + 22} cy={199 - i} r="2" fill="#ffe7a8" />
            </g>
          ))}
          {Array.from({ length: 12 }, (_, i) => <Soldier key={i} x={30 + i * 52} y={230} s={1.8} rifle />)}
        </>
      );
    case 'river_defense':
      return (
        <>
          <Sky id={g('sky')} stops={[[0, '#0a0e18'], [0.6, '#1c2a3a'], [1, '#2e4a52']]} />
          {[110, 300, 500].map((x, i) => (
            <g key={x}>
              <Glow x={x} y={40 + i * 10} r={44} color="#d8ff9a" o={0.55} />
              <path d={`M${x} ${60 + i * 10} L${x - 4} ${120}`} stroke="#ddd" strokeOpacity=".25" />
            </g>
          ))}
          <path d={ridge(71, 118, 24, 28)} fill="#0b121a" />
          <rect x="0" y="120" width={W} height="62" fill="#17283a" />
          {Array.from({ length: 6 }, (_, i) => <path key={i} d={`M0 ${128 + i * 10} Q80 ${122 + i * 10} 160 ${128 + i * 10} T320 ${128 + i * 10} T480 ${128 + i * 10} T640 ${128 + i * 10}`} fill="none" stroke="#d8ff9a" strokeOpacity=".15" strokeWidth="1" />)}
          {/* 도하하는 적 보트 */}
          {[90, 210, 330, 440, 560].map((x, i) => (
            <g key={x}>
              <path d={`M${x - 20} ${142 + (i % 2) * 10} L${x + 20} ${142 + (i % 2) * 10} L${x + 14} ${150 + (i % 2) * 10} L${x - 14} ${150 + (i % 2) * 10}Z`} fill="#04070a" />
              {[-10, 0, 10].map((d) => <circle key={d} cx={x + d} cy={138 + (i % 2) * 10} r="3" fill="#04070a" />)}
            </g>
          ))}
          {[0, 1, 2, 3, 4].map((i) => <line key={i} x1={60 + i * 120} y1={210} x2={100 + i * 110} y2={146} stroke="#ffd36a" strokeWidth="1" opacity=".7" />)}
          {/* 아군 참호 */}
          <path d="M0 240 L0 190 L640 186 L640 240Z" fill="#0a0e12" />
          <path d="M0 196 L640 192" stroke="#2a2a22" strokeWidth="6" />
          {Array.from({ length: 14 }, (_, i) => <Soldier key={i} x={24 + i * 46} y={206 + (i % 2) * 4} s={1.6} rifle />)}
          <Flash x={210} y={150} s={1.1} color="#ff9a3a" />
          <Flash x={420} y={146} s={0.9} color="#ff9a3a" />
        </>
      );
    case 'command_post':
      return (
        <>
          <Sky id={g('sky')} stops={[[0, '#1a1c22'], [1, '#3a3a30']]} />
          <path d="M0 40 L320 10 L640 40 L640 240 L0 240Z" fill="#2a2a20" />
          <path d="M0 40 L320 10 L640 40" fill="none" stroke="#45452e" strokeWidth="4" />
          {/* 작전 지도판 */}
          <rect x="150" y="62" width="250" height="124" fill="#d8cfa8" stroke="#2a2214" strokeWidth="6" />
          <path d="M180 90 C220 80 250 100 280 88 C320 76 350 96 380 84" fill="none" stroke="#3d7fd1" strokeWidth="3" />
          <path d="M180 130 C220 120 250 140 290 126 C320 118 350 138 380 124" fill="none" stroke="#c24141" strokeWidth="3" />
          {[[210, 86], [300, 100], [350, 130], [240, 126]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4.5" fill={i % 2 ? '#c24141' : '#3d7fd1'} />)}
          <path d="M200 160 L240 150 M300 160 L340 156" stroke="#c24141" strokeWidth="2.4" markerEnd="" />
          {/* 램프 */}
          <Cone x={290} y={30} w={220} h={170} color="#ffd78a" o={0.22} />
          <ellipse cx="290" cy="34" rx="14" ry="5" fill="#ffe7a8" />
          {/* 모래주머니 */}
          {Array.from({ length: 22 }, (_, i) => <ellipse key={i} cx={10 + i * 30} cy={206 + (i % 2) * 8} rx="16" ry="8" fill="#3a3626" stroke="#1a1810" strokeWidth="1" />)}
          <Jeep x={540} y={206} s={2.2} />
          <Bust x={430} y={200} s={2.2} cap />
          <path d="M426 178 L396 158" stroke="#05080c" strokeWidth="4" strokeLinecap="round" />
          <Bust x={110} y={204} s={2} />
          <Bust x={72} y={208} s={1.7} cap flip />
        </>
      );
    case 'victory_street':
      return (
        <>
          <Sky id={g('sky')} stops={[[0, '#2a2a46'], [0.5, '#c8783a'], [1, '#ffd890']]} />
          <Glow x={320} y={90} r={110} color="#fff0b0" o={0.65} />
          <path d="M0 240 L0 50 L120 80 L160 150 L130 240Z" fill="#171018" />
          <path d="M640 240 L640 50 L520 80 L480 150 L510 240Z" fill="#171018" />
          {Array.from({ length: 4 }, (_, i) => <rect key={i} x={20 + (i % 2) * 40} y={82 + i * 32} width="12" height="18" fill="#ff8a3a" opacity=".3" />)}
          <path d="M150 150 L490 150 L640 240 L0 240Z" fill="#1c1418" />
          {/* 불타는 T-34 */}
          <Tank x={320} y={184} s={2.6} />
          <Flash x={300} y={160} s={2.2} color="#ff7a2a" />
          <Flash x={340} y={168} s={1.6} color="#ffcf6a" />
          <Smoke x={310} y={150} n={7} seed={5} color="#0e0a0c" />
          {/* 환호하는 병사와 시민 */}
          {[90, 140, 200, 440, 500, 560].map((x, i) => (
            <g key={x}>
              <Soldier x={x} y={228 - (i % 2) * 6} s={2.2} flip={i > 2} rifle={false} />
              <path d={`M${x + (i > 2 ? -5 : 5)} ${206 - (i % 2) * 6} L${x + (i > 2 ? -12 : 12)} ${186 - (i % 2) * 6}`} stroke="#05080c" strokeWidth="2.4" strokeLinecap="round" />
            </g>
          ))}
          <Flag x={70} y={120} color="#3d7fd1" h={86} />
          <Flag x={580} y={120} color="#f2efe6" h={86} />
        </>
      );
    case 'hilltop':
      return (
        <>
          <Sky id={g('sky')} stops={[[0, '#2a0f14'], [0.5, '#8a2e24'], [1, '#e0803c']]} />
          <path d="M0 240 L0 140 C80 110 160 120 240 90 C320 60 380 70 440 50 C520 30 580 40 640 20 L640 240Z" fill="#150c0e" />
          <path d="M0 240 L0 180 C100 160 200 170 300 140 C400 110 500 120 640 90 L640 240Z" fill="#0b0708" />
          {[[160, 118], [260, 84], [380, 66], [480, 44]].map(([x, y], i) => <Flash key={i} x={x} y={y} s={1.3 + (i % 2) * 0.4} color="#ff8a2a" />)}
          {[[140, 124], [200, 108], [300, 80], [350, 70], [440, 52], [520, 36]].map(([x, y], i) => <Soldier key={i} x={x} y={y + 6} s={1.1} flip={i % 2 === 0} rifle />)}
          {Array.from({ length: 12 }, (_, i) => <Soldier key={i} x={40 + i * 50} y={200 + (i % 3) * 10 - i * 6} s={1.7} rifle />)}
          <Smoke x={250} y={80} n={5} seed={4} color="#1a0c0c" />
          <Smoke x={470} y={44} n={5} seed={14} color="#1a0c0c" />
          {Array.from({ length: 8 }, (_, i) => <line key={i} x1={600 - i * 56} y1={30 + i * 6} x2={560 - i * 52} y2={150 + i * 8} stroke="#ffd36a" strokeWidth="0.9" opacity=".5" />)}
        </>
      );
    case 'bugle_charge':
      return (
        <>
          <Sky id={g('sky')} stops={[[0, '#050810'], [0.6, '#1c2a3e'], [1, '#2e4258']]} />
          <Stars n={40} seed={21} maxY={90} />
          <Glow x={160} y={60} r={50} color="#ff6a5a" o={0.55} />
          <Glow x={440} y={50} r={44} color="#9aff9a" o={0.5} />
          <path d={ridge(81, 118, 40, 36)} fill="#e8eef6" opacity=".9" />
          <path d={ridge(82, 138, 34, 30)} fill="#9fb0c4" opacity=".9" />
          <path d={ridge(83, 160, 26, 24)} fill="#4a5a70" />
          {/* 능선에서 쏟아지는 병력 */}
          {Array.from({ length: 52 }, (_, i) => {
            const r = rng(i + 400);
            const x = r() * W, y = 126 + r() * 70;
            const s = 0.55 + ((y - 126) / 70) * 0.9;
            return <Soldier key={i} x={x} y={y} s={s} flip={r() > 0.5} rifle />;
          })}
          {/* 나팔수 */}
          <g transform="translate(540 236) scale(3.4)" fill="#05080c">
            <circle cx="0" cy="-17" r="2.6" />
            <path d="M-3 -14 L3 -14 L4 -3 L1.5 -3 L1 6 L-1 6 L-1.5 -3 L-4 -3 Z" />
            <path d="M0 -17 L-14 -22 L-18 -26 L-18 -18 L-14 -18Z" fill="#d9b24a" />
          </g>
          {[0, 1, 2].map((i) => <path key={i} d={`M${500 - i * 12} ${180 - i * 14} q-10 -8 -12 -20`} stroke="#fff" strokeOpacity={0.25 - i * 0.06} strokeWidth="2" fill="none" />)}
        </>
      );
    case 'rail_yard':
      return (
        <>
          <Sky id={g('sky')} stops={[[0, '#04060c'], [0.7, '#141c2a'], [1, '#20283a']]} />
          <Stars n={34} seed={5} maxY={90} />
          <path d={ridge(91, 140, 22, 30)} fill="#0b1018" />
          {Array.from({ length: 10 }, (_, i) => <rect key={i} x={10 + i * 64} y={140} width="4" height="4" fill="#f4c866" opacity=".7" />)}
          {/* 탐조등 */}
          <path d="M120 200 L60 0 L120 0Z" fill="#cfe3ff" opacity=".1" />
          <path d="M520 200 L470 0 L560 0Z" fill="#cfe3ff" opacity=".09" />
          <rect x="112" y="196" width="16" height="10" fill="#0a0d14" />
          <rect x="512" y="196" width="16" height="10" fill="#0a0d14" />
          {/* 화차 줄 */}
          {Array.from({ length: 7 }, (_, i) => (
            <g key={i}>
              <rect x={i * 94} y="170" width="86" height="30" fill="#0b0f16" />
              <rect x={i * 94} y="166" width="86" height="4" fill="#161b26" />
              <circle cx={i * 94 + 16} cy="204" r="5" fill="#0b0f16" />
              <circle cx={i * 94 + 70} cy="204" r="5" fill="#0b0f16" />
              <path d={`M${i * 94 + 20} 170 L${i * 94 + 20} 200 M${i * 94 + 66} 170 L${i * 94 + 66} 200`} stroke="#222a38" strokeWidth="1.2" />
            </g>
          ))}
          <path d="M0 208 L640 208" stroke="#3a4558" strokeWidth="2" />
          <Smoke x={50} y={166} n={5} seed={7} color="#a8b4c4" spread={1.2} />
          {/* 승차 대기 병력 */}
          {Array.from({ length: 22 }, (_, i) => <Soldier key={i} x={14 + i * 29} y={232 - (i % 2) * 3} s={1.7} rifle />)}
          {[100, 330, 480].map((x) => <path key={x} d={`M${x} 232 L${x - 6} 214 L${x + 6} 214Z`} fill="#05080c" />)}
        </>
      );
    case 'refugees_ice':
      return (
        <>
          <Sky id={g('sky')} stops={[[0, '#2a323f'], [0.55, '#6d7886'], [1, '#aab4be']]} />
          <path d={ridge(101, 124, 26, 32)} fill="#566272" />
          <Glow x={540} y={118} r={60} color="#ff8a3a" o={0.5} />
          <Smoke x={540} y={116} n={6} seed={3} color="#3a3236" />
          <rect x="0" y="130" width={W} height="110" fill="#c8d4e0" />
          <path d="M0 130 L640 130" stroke="#8a98a8" strokeWidth="2" />
          {Array.from({ length: 6 }, (_, i) => <path key={i} d={`M${20 + i * 100} ${150 + (i % 3) * 20} L${80 + i * 100} ${158 + (i % 3) * 20}`} stroke="#8a98a8" strokeWidth="1" opacity=".6" />)}
          {/* 끊어진 다리 */}
          <path d="M360 130 L360 108 L420 108 L420 130" fill="none" stroke="#1a1f26" strokeWidth="5" />
          <path d="M420 108 L440 122" stroke="#1a1f26" strokeWidth="5" />
          {/* 피난 행렬 (지게·소달구지) */}
          {Array.from({ length: 16 }, (_, i) => {
            const r = rng(i + 600);
            const x = 20 + i * 38 + r() * 10, y = 176 + (i % 4) * 14;
            const s = 1.3 + (y - 176) / 40;
            return (
              <g key={i}>
                <Soldier x={x} y={y} s={s} rifle={false} />
                <path d={`M${x - 6 * s} ${y - 12 * s} L${x - 12 * s} ${y - 24 * s} L${x + 8 * s} ${y - 24 * s} L${x + 4 * s} ${y - 12 * s}Z`} fill="#05080c" />
              </g>
            );
          })}
          <g fill="#05080c">
            <path d="M120 206 L190 206 L184 224 L126 224Z" />
            <circle cx="134" cy="226" r="9" />
            <circle cx="176" cy="226" r="9" />
            <ellipse cx="210" cy="212" rx="18" ry="10" />
            <rect x="222" y="196" width="8" height="12" />
          </g>
          {Array.from({ length: 80 }, (_, i) => {
            const r = rng(i + 900);
            return <circle key={i} cx={r() * W} cy={r() * H} r={r() * 1.4 + 0.4} fill="#fff" opacity=".7" />;
          })}
        </>
      );
    case 'red_train':
      return (
        <>
          <Sky id={g('sky')} stops={[[0, '#2a3454'], [0.55, '#d8886a'], [1, '#ffd8a8']]} />
          <Glow x={500} y={140} r={80} color="#fff0c0" o={0.8} />
          <path d={ridge(111, 150, 22, 28)} fill="#6a6a86" />
          <rect x="0" y="150" width={W} height="90" fill="#e6ecf4" />
          <path d="M0 150 C200 146 440 154 640 148" stroke="#b8c4d4" strokeWidth="2" fill="none" />
          <Poles y={196} n={8} h={44} />
          {/* 기관차 + 포차 화차 */}
          <g fill="#07090e">
            <rect x="380" y="164" width="130" height="32" />
            <rect x="470" y="140" width="40" height="26" />
            <rect x="388" y="150" width="14" height="16" />
            <circle cx="404" cy="200" r="9" />
            <circle cx="440" cy="200" r="9" />
            <circle cx="480" cy="200" r="9" />
          </g>
          <Star5 x={490} y={152} r={10} />
          <path d="M395 150 C390 130 400 124 396 108 C392 94 404 86 398 72" fill="none" stroke="#f4f4f4" strokeOpacity=".55" strokeWidth="9" strokeLinecap="round" />
          {Array.from({ length: 5 }, (_, i) => (
            <g key={i} transform={`translate(${-40 + i * 84} 0)`}>
              <rect x="30" y="184" width="80" height="12" fill="#07090e" />
              <circle cx="46" cy="200" r="6" fill="#07090e" />
              <circle cx="94" cy="200" r="6" fill="#07090e" />
              <Tank x={70} y={184} s={1.1} />
            </g>
          ))}
          <rect x="60" y="120" width="2" height="76" fill="#07090e" />
          <path d="M62 122 L104 128 L62 144Z" fill="#c0272d" />
        </>
      );
    case 'river_border':
      return (
        <>
          <Sky id={g('sky')} stops={[[0, '#111a2e'], [0.55, '#46405a'], [0.85, '#c8784a'], [1, '#f0b070']]} />
          <Glow x={160} y={146} r={80} color="#ffc880" o={0.7} />
          <path d={ridge(121, 128, 24, 30)} fill="#141722" />
          {Array.from({ length: 22 }, (_, i) => <rect key={i} x={20 + i * 29} y={132 + (i % 3) * 3} width="3" height="3" fill="#f4c866" opacity=".85" />)}
          <rect x="0" y="138" width={W} height="60" fill="#2c3f58" />
          {Array.from({ length: 5 }, (_, i) => <path key={i} d={`M0 ${146 + i * 10} Q80 ${140 + i * 10} 160 ${146 + i * 10} T320 ${146 + i * 10} T480 ${146 + i * 10} T640 ${146 + i * 10}`} fill="none" stroke="#ffd8a0" strokeOpacity=".22" strokeWidth="1.2" />)}
          <path d="M0 198 C120 188 240 202 360 194 C480 186 560 200 640 192 L640 240 L0 240Z" fill="#0b0e14" />
          {Array.from({ length: 9 }, (_, i) => <Soldier key={i} x={60 + i * 62} y={214 + (i % 2) * 6} s={2.1} rifle={i % 3 === 0} />)}
          <Flag x={330} y={150} color="#3d7fd1" h={64} />
          <path d="M260 172 L300 168" stroke="#05080c" strokeWidth="2" />
        </>
      );
    case 'campaign_map':
      return (
        <>
          <Sky id={g('sky')} stops={[[0, '#14110a'], [1, '#241c10']]} />
          <path d="M40 220 L110 40 L540 40 L610 220Z" fill="#d8cfa8" />
          <path d="M110 40 L540 40" stroke="#fff" strokeOpacity=".3" strokeWidth="3" />
          <path d="M300 56 C330 80 310 110 340 130 C360 150 340 180 360 206 L310 206 C280 190 290 160 270 140 C250 110 280 80 300 56Z" fill="#9fb48a" opacity=".6" />
          <path d="M250 150 C290 140 320 160 360 148 C400 138 430 154 470 142" fill="none" stroke="#c24141" strokeWidth="4" strokeDasharray="10 5" />
          <path d="M250 110 C290 100 320 120 360 108" fill="none" stroke="#3d7fd1" strokeWidth="3" />
          {[[280, 138], [330, 150], [390, 142], [310, 100], [350, 106]].map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="6" fill={i < 3 ? '#c24141' : '#3d7fd1'} /><circle cx={x} cy={y} r="2" fill="#fff" /></g>)}
          <path d="M200 90 L260 120 M470 80 L400 120" stroke="#2a2214" strokeWidth="2.6" />
          <path d="M254 114 L264 124 L252 124Z M406 114 L396 124 L408 124Z" fill="#2a2214" />
          <Cone x={320} y={0} w={420} h={220} color="#ffd78a" o={0.14} />
          {/* 손과 컴퍼스 */}
          <path d="M520 240 L430 150 L440 142 L530 232Z" fill="#05080c" />
          <path d="M436 146 L384 108 M436 146 L398 96" stroke="#c9b36a" strokeWidth="2.6" />
          <rect x="0" y="222" width={W} height="18" fill="#08060a" />
        </>
      );
    case 'barbed_wire':
      return (
        <>
          <Sky id={g('sky')} stops={[[0, '#10131f'], [0.6, '#4a3040'], [0.9, '#c8683a'], [1, '#e8a060']]} />
          <Glow x={470} y={150} r={80} color="#ffb070" o={0.6} />
          <Glow x={160} y={50} r={30} color="#fff0b0" o={0.6} />
          <path d={ridge(131, 150, 26, 30)} fill="#1c141c" />
          <path d="M0 240 L0 176 C120 168 240 182 360 174 C480 166 560 180 640 172 L640 240Z" fill="#150f10" />
          {/* 포탄 구덩이 */}
          {[[120, 200], [300, 210], [520, 204]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="38" ry="7" fill="#0a0708" />)}
          {/* 철조망 */}
          {Array.from({ length: 8 }, (_, i) => (
            <g key={i}>
              <path d={`M${i * 84} 196 L${i * 84 + 4} 172`} stroke="#05080c" strokeWidth="2.6" />
              <path d={`M${i * 84 + 4} 178 Q${i * 84 + 20} 172 ${i * 84 + 38} 180 T${i * 84 + 80} 178`} fill="none" stroke="#05080c" strokeWidth="1.2" />
              <path d={`M${i * 84 + 4} 188 Q${i * 84 + 20} 182 ${i * 84 + 38} 190 T${i * 84 + 80} 188`} fill="none" stroke="#05080c" strokeWidth="1.2" />
              {[16, 40, 60].map((d) => <path key={d} d={`M${i * 84 + d} 176 l4 6 M${i * 84 + d + 3} 176 l-4 6`} stroke="#05080c" strokeWidth="1" />)}
            </g>
          ))}
          {/* 참호의 병사 */}
          <path d="M0 240 L0 218 L640 214 L640 240Z" fill="#07090b" />
          {Array.from({ length: 10 }, (_, i) => <Soldier key={i} x={30 + i * 64} y={224 + (i % 2) * 4} s={1.7} rifle />)}
          <Flash x={400} y={170} s={1.2} color="#ff9a3a" />
          <Smoke x={404} y={162} n={4} seed={9} color="#1a1416" />
        </>
      );
  }
}

const Star5 = ({ x, y, r }: { x: number; y: number; r: number }) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.42 : r;
    return `${(x + Math.cos(a) * rr).toFixed(1)},${(y + Math.sin(a) * rr).toFixed(1)}`;
  }).join(' ');
  return <polygon points={pts} fill="#d0252b" />;
};

export default function Scene2({ kind, id }: { kind: NewSceneKind; id: string }) {
  return <Scene2Inner kind={kind} id={id} />;
}

/** 새 장면 목록 (미리보기·FX 매핑용) */
export const NEW_SCENE_KINDS: NewSceneKind[] = [
  'airstrip', 'war_room', 'tokyo_crowd', 'telegram', 'mushroom', 'empty_capital', 'flag_raise', 'railway_retreat', 'river_tank',
  'ship_conference', 'beachhead', 'wreck_beach', 'hotline', 'convoy', 'river_defense', 'command_post', 'victory_street',
  'hilltop', 'bugle_charge', 'rail_yard', 'refugees_ice', 'red_train', 'river_border', 'campaign_map', 'barbed_wire',
];
