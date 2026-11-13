import { useId } from 'react';

/**
 * 인물 초상 (SVG 일러스트). 실제 사진이 아니라 코드로 그린 그림이다.
 * HOI4 이벤트 창처럼 인물 이름·직함 명패와 함께 보여 준다.
 */
export type PortraitId = 'macarthur' | 'rhee' | 'truman' | 'walker' | 'kim' | 'peng' | 'mao' | 'stalin';

export const PORTRAITS: Record<PortraitId, { name: string; title: string }> = {
  macarthur: { name: '더글러스 맥아더', title: 'UN군 총사령관 · 원수' },
  rhee: { name: '이승만', title: '대한민국 대통령' },
  truman: { name: '해리 트루먼', title: '미합중국 대통령' },
  walker: { name: '월턴 워커', title: '미 제8군 사령관 · 중장' },
  kim: { name: '김일성', title: '북한 최고 지도자' },
  peng: { name: '펑더화이', title: '중국인민지원군 사령원' },
  mao: { name: '마오쩌둥', title: '중화인민공화국 주석' },
  stalin: { name: '이오시프 스탈린', title: '소련 최고 지도자' },
};

/** 얼굴 외곽선: w=광대 반폭, j=턱 반폭 */
const facePath = (w: number, j: number, top = 40, chin = 154) => {
  const c = 100;
  return `M${c} ${top} C${c + w * 0.85} ${top} ${c + w} ${top + 22} ${c + w} ${top + 50} C${c + w} ${top + 78} ${c + j} ${chin - 26} ${c + j * 0.5} ${chin - 8} C${c + j * 0.28} ${chin} ${c + j * 0.12} ${chin + 1} ${c} ${chin + 1} C${c - j * 0.12} ${chin + 1} ${c - j * 0.28} ${chin} ${c - j * 0.5} ${chin - 8} C${c - j} ${chin - 26} ${c - w} ${top + 78} ${c - w} ${top + 50} C${c - w} ${top + 22} ${c - w * 0.85} ${top} ${c} ${top} Z`;
};

interface Look {
  skin: string;
  shade: string;
  w: number;
  j: number;
  top?: number;
  chin?: number;
  bg: [string, string];
}

const LOOK: Record<PortraitId, Look> = {
  macarthur: { skin: '#e8c6a4', shade: '#a77455', w: 46, j: 34, top: 44, chin: 156, bg: ['#5b4a32', '#1e1a14'] },
  rhee: { skin: '#e5c4a2', shade: '#a47a5b', w: 37, j: 30, top: 42, chin: 154, bg: ['#40505a', '#141a1f'] },
  truman: { skin: '#edc9ad', shade: '#b07e62', w: 45, j: 37, top: 44, chin: 154, bg: ['#3d4a63', '#131824'] },
  walker: { skin: '#dfb18f', shade: '#9c6b4b', w: 50, j: 46, top: 46, chin: 156, bg: ['#4a5236', '#161a10'] },
  kim: { skin: '#e8c7a3', shade: '#a77a5a', w: 48, j: 40, top: 42, chin: 154, bg: ['#6a3030', '#1d1010'] },
  peng: { skin: '#c99a72', shade: '#8a5c3d', w: 46, j: 40, top: 46, chin: 155, bg: ['#5f2e24', '#1a0f0c'] },
  mao: { skin: '#e4c19b', shade: '#a67a58', w: 50, j: 43, top: 40, chin: 156, bg: ['#6e2a22', '#1b0e0c'] },
  stalin: { skin: '#dcb594', shade: '#9a6d4f', w: 44, j: 37, top: 42, chin: 155, bg: ['#5a2320', '#170b0a'] },
};

function Star({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.42 : r;
    return `${(x + Math.cos(a) * rr).toFixed(1)},${(y + Math.sin(a) * rr).toFixed(1)}`;
  }).join(' ');
  return <polygon points={pts} fill={fill} />;
}

/** 눈·눈썹·코·입 (선글라스를 쓰지 않는 인물용) */
function Features({ look, brow = '#2a2118', eyeY = 94, mouthY = 136, mood = 'calm', nose = 1, p }: { look: Look; brow?: string; eyeY?: number; mouthY?: number; mood?: 'calm' | 'stern' | 'smile'; nose?: number; p: string }) {
  const sx = 19;
  const eye = (dx: number) => (
    <g key={dx} transform={`translate(${100 + dx} ${eyeY})`}>
      <path d="M-9 1 Q0 -6 9 1 Q0 5 -9 1Z" fill="#f4ece0" />
      <circle cx={dx < 0 ? 0.6 : -0.6} cy="0" r="3.2" fill="#2a1d14" />
      <circle cx={dx < 0 ? 1.4 : -0.2} cy="-1" r="0.9" fill="#fff" fillOpacity=".8" />
      <path d="M-10 1.4 Q0 -7.5 10 1.4" fill="none" stroke="#2b1c14" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M-8 4 Q0 7 8 4" fill="none" stroke={look.shade} strokeOpacity=".55" strokeWidth="1.1" />
    </g>
  );
  const browPath = (dx: number) => {
    const s = dx < 0 ? -1 : 1;
    const lift = mood === 'stern' ? 4 : 0;
    return (
      <path
        key={'b' + dx}
        d={`M${100 + dx - 12 * s} ${eyeY - 11 + (mood === 'stern' ? 2 : 0)} Q${100 + dx} ${eyeY - 16 - lift * 0.4} ${100 + dx + 13 * s} ${eyeY - 10 - (mood === 'stern' ? -lift * 0.6 : 0)}`}
        fill="none"
        stroke={brow}
        strokeWidth={mood === 'stern' ? 4.2 : 3.2}
        strokeLinecap="round"
      />
    );
  };
  const nw = 7 * nose;
  return (
    <g>
      {eye(-sx)}
      {eye(sx)}
      {browPath(-sx)}
      {browPath(sx)}
      {/* 코 */}
      <path d={`M100 ${eyeY - 2} C${100 - 2} ${eyeY + 12} ${100 - 4} ${eyeY + 20} ${100 - nw} ${eyeY + 25} Q100 ${eyeY + 30} ${100 + nw} ${eyeY + 25}`} fill="none" stroke={look.shade} strokeOpacity=".8" strokeWidth="1.8" strokeLinecap="round" />
      <path d={`M${100 + 2} ${eyeY + 2} C${100 + 4} ${eyeY + 14} ${100 + 6} ${eyeY + 20} ${100 + nw + 2} ${eyeY + 25}`} fill="none" stroke="#fff" strokeOpacity=".18" strokeWidth="2" strokeLinecap="round" />
      {/* 입 */}
      {mood === 'smile' ? (
        <path d={`M86 ${mouthY - 1} Q100 ${mouthY + 7} 114 ${mouthY - 1}`} fill="none" stroke="#6b3a2c" strokeWidth="2.2" strokeLinecap="round" />
      ) : mood === 'stern' ? (
        <path d={`M87 ${mouthY + 1} Q100 ${mouthY - 2} 113 ${mouthY + 1}`} fill="none" stroke="#5a2f24" strokeWidth="2.6" strokeLinecap="round" />
      ) : (
        <path d={`M88 ${mouthY} Q100 ${mouthY + 3} 112 ${mouthY}`} fill="none" stroke="#6b3a2c" strokeWidth="2.2" strokeLinecap="round" />
      )}
      <path d={`M93 ${mouthY + 6} Q100 ${mouthY + 9} 107 ${mouthY + 6}`} fill="none" stroke={look.shade} strokeOpacity=".35" strokeWidth="1.4" />
      {/* 입가 주름 */}
      <path d={`M${100 - nw - 3} ${eyeY + 23} Q${100 - 17} ${mouthY - 8} ${100 - 17} ${mouthY + 2}`} fill="none" stroke={look.shade} strokeOpacity=".4" strokeWidth="1.2" />
      <path d={`M${100 + nw + 3} ${eyeY + 23} Q${100 + 17} ${mouthY - 8} ${100 + 17} ${mouthY + 2}`} fill="none" stroke={look.shade} strokeOpacity=".4" strokeWidth="1.2" />
      <ellipse cx="100" cy={eyeY + 36} rx="6" ry="2.6" fill={look.shade} fillOpacity=".12" id={p + 'philtrum'} />
    </g>
  );
}

/** 귀 */
const Ears = ({ look }: { look: Look }) => (
  <g fill={look.skin} stroke={look.shade} strokeOpacity=".7" strokeWidth="1.2">
    <path d={`M${100 - look.w + 1} 88 C${100 - look.w - 9} 86 ${100 - look.w - 8} 112 ${100 - look.w + 3} 114Z`} />
    <path d={`M${100 + look.w - 1} 88 C${100 + look.w + 9} 86 ${100 + look.w + 8} 112 ${100 + look.w - 3} 114Z`} />
  </g>
);

/** 인물별 몸(어깨·옷). 얼굴보다 먼저 그린다. */
function Body({ id, look, p }: { id: PortraitId; look: Look; p: string }) {
  const neck = (
    <g>
      <path d="M82 138 L82 186 C90 196 110 196 118 186 L118 138Z" fill={look.skin} />
      <path d="M100 150 L118 138 L118 186 C112 193 106 195 100 195Z" fill={look.shade} fillOpacity=".4" />
    </g>
  );
  const shoulders = (fill: string, dark: string, y = 178) => (
    <g>
      <path d={`M-6 250 C4 ${y + 8} 46 ${y - 2} 100 ${y - 2} C154 ${y - 2} 196 ${y + 8} 206 250Z`} fill={fill} />
      <path d={`M100 ${y - 2} C154 ${y - 2} 196 ${y + 8} 206 250 L100 250Z`} fill={dark} fillOpacity=".55" />
    </g>
  );
  switch (id) {
    case 'macarthur':
      return (
        <g>
          {shoulders('#a89463', '#3a2e1a')}
          {neck}
          {/* 카키 셔츠 칼라 (열린 깃) */}
          <path d="M78 176 L100 214 L88 182Z" fill="#c4ae78" />
          <path d="M122 176 L100 214 L112 182Z" fill="#b39d68" />
          <path d="M72 168 L90 200 L82 224 L60 190Z" fill="#bba670" stroke="#7a6840" strokeWidth="1" />
          <path d="M128 168 L110 200 L118 224 L140 190Z" fill="#a8935f" stroke="#7a6840" strokeWidth="1" />
          <path d="M100 196 L100 250" stroke="#6b5a35" strokeWidth="1.6" />
          {/* 칼라의 오성장 */}
          <Star x={74} y={196} r={3.4} fill="#f4d77a" />
          <Star x={82} y={201} r={3.4} fill="#f4d77a" />
          <Star x={68} y={191} r={3.4} fill="#f4d77a" />
          <Star x={126} y={196} r={3.4} fill="#f4d77a" />
          <Star x={118} y={201} r={3.4} fill="#f4d77a" />
          {/* 가슴 주머니·약장 */}
          <rect x="44" y="214" width="26" height="9" rx="1" fill="#2b4a7a" opacity=".9" />
          <rect x="44" y="223" width="26" height="9" rx="1" fill="#8a2a2a" opacity=".9" />
          <rect x="44" y="232" width="26" height="9" rx="1" fill="#d7b44a" opacity=".9" />
        </g>
      );
    case 'truman':
      return (
        <g>
          {shoulders('#26303f', '#0e131b')}
          {neck}
          <path d="M82 170 L100 208 L118 170 L108 166 L100 178 L92 166Z" fill="#f3efe6" />
          <path d="M100 178 L94 190 L100 232 L106 190Z" fill="#7a2330" />
          <path d="M82 170 L66 196 L84 238 L100 208Z" fill="#1d2532" />
          <path d="M118 170 L134 196 L116 238 L100 208Z" fill="#161c27" />
          <circle cx="68" cy="214" r="2.4" fill="#d7b44a" />
        </g>
      );
    case 'rhee':
      return (
        <g>
          {shoulders('#2c333a', '#10151a')}
          {neck}
          <path d="M82 170 L100 206 L118 170 L108 166 L100 176 L92 166Z" fill="#f2efe8" />
          <path d="M100 176 L95 188 L100 226 L105 188Z" fill="#3b4a5a" />
          <path d="M82 170 L66 198 L84 240 L100 206Z" fill="#232a31" />
          <path d="M118 170 L134 198 L116 240 L100 206Z" fill="#1a2025" />
        </g>
      );
    case 'walker':
      return (
        <g>
          {shoulders('#5d6a3a', '#232a12')}
          {neck}
          <path d="M80 172 L100 206 L92 176Z" fill="#78854a" />
          <path d="M120 172 L100 206 L108 176Z" fill="#6a773f" />
          <path d="M74 168 L92 202 L84 226 L62 192Z" fill="#6e7b42" stroke="#3a431f" strokeWidth="1" />
          <path d="M126 168 L108 202 L116 226 L138 192Z" fill="#5c6937" stroke="#3a431f" strokeWidth="1" />
          <Star x={72} y={196} r={3.2} fill="#e6e6e6" />
          <Star x={80} y={202} r={3.2} fill="#e6e6e6" />
          <Star x={128} y={196} r={3.2} fill="#e6e6e6" />
        </g>
      );
    case 'kim':
      return (
        <g>
          {shoulders('#6c6a55', '#272618')}
          {neck}
          <path d="M80 166 L80 184 L100 192 L120 184 L120 166Z" fill="#7d7b63" stroke="#3a392a" strokeWidth="1" />
          <path d="M100 192 L100 250" stroke="#3a392a" strokeWidth="1.6" />
          <circle cx="100" cy="208" r="2" fill="#c9b36a" />
          <circle cx="100" cy="226" r="2" fill="#c9b36a" />
          <rect x="46" y="212" width="22" height="7" fill="#b02a2a" />
          <rect x="46" y="219" width="22" height="7" fill="#d7b44a" />
        </g>
      );
    case 'peng':
      return (
        <g>
          {shoulders('#6f7a52', '#262c17')}
          {neck}
          <path d="M80 166 L80 186 L100 194 L120 186 L120 166Z" fill="#7d8860" stroke="#3a431f" strokeWidth="1" />
          <path d="M80 168 L92 186 L80 188Z" fill="#c2242a" />
          <path d="M120 168 L108 186 L120 188Z" fill="#c2242a" />
          <path d="M100 194 L100 250" stroke="#3a431f" strokeWidth="1.6" />
          <circle cx="100" cy="210" r="2" fill="#2b2b2b" />
          <circle cx="100" cy="228" r="2" fill="#2b2b2b" />
        </g>
      );
    case 'mao':
      return (
        <g>
          {shoulders('#6c7072', '#202324')}
          {neck}
          <path d="M80 164 L80 186 L100 194 L120 186 L120 164Z" fill="#7b7f81" stroke="#33383a" strokeWidth="1" />
          <path d="M100 194 L100 250" stroke="#33383a" strokeWidth="1.6" />
          <circle cx="100" cy="210" r="2" fill="#2b2b2b" />
          <circle cx="100" cy="228" r="2" fill="#2b2b2b" />
          <rect x="52" y="214" width="26" height="22" fill="none" stroke="#3a3f41" strokeWidth="1.2" />
        </g>
      );
    case 'stalin':
      return (
        <g>
          {shoulders('#8a8672', '#2c2a20')}
          {neck}
          <path d="M80 164 L80 186 L100 194 L120 186 L120 164Z" fill="#9a9680" stroke="#3a382c" strokeWidth="1" />
          <path d="M100 194 L100 250" stroke="#3a382c" strokeWidth="1.6" />
          {[206, 222, 238].map((y) => <circle key={y} cx="100" cy={y} r="2.2" fill="#d4b455" />)}
          <path d="M44 204 L72 196 L70 212 L46 218Z" fill="#c9a636" />
          <path d="M156 204 L128 196 L130 212 L154 218Z" fill="#c9a636" />
          <Star x={58} y={208} r={5} fill="#c0272d" />
          <Star x={142} y={208} r={5} fill="#c0272d" />
          <circle cx="76" cy="226" r="0" fill="none" id={p + 'x'} />
        </g>
      );
  }
}

/** 머리카락·모자·장신구. 얼굴 위에 그린다. */
function Headgear({ id, look, p }: { id: PortraitId; look: Look; p: string }) {
  const c = 100;
  switch (id) {
    case 'macarthur':
      return (
        <g>
          {/* 모자 크라운 */}
          <path d="M44 66 C40 22 74 4 112 6 C152 8 164 36 156 66 C132 58 70 58 44 66Z" fill="#3d3c31" />
          <path d="M44 66 C40 22 74 4 112 6 C94 14 70 30 64 62Z" fill="#fff" fillOpacity=".1" />
          <path d="M134 12 C158 26 160 48 156 66 C146 62 138 60 130 60Z" fill="#000" fillOpacity=".32" />
          {/* 모자 띠와 금장 */}
          <path d="M42 62 C70 54 132 54 158 62 L158 72 C132 64 70 64 42 72Z" fill="#1f1e18" />
          <path d="M42 62 C70 54 132 54 158 62" fill="none" stroke="#e6c25a" strokeWidth="2" />
          <path d="M42 72 C70 64 132 64 158 72" fill="none" stroke="#e6c25a" strokeWidth="1.6" />
          {/* 챙(바이저) */}
          <path d="M40 72 C66 64 136 64 162 72 C170 80 152 84 100 83 C50 83 30 80 40 72Z" fill="#17160f" />
          <path d="M40 72 C66 64 136 64 162 72" fill="none" stroke="#e6c25a" strokeWidth="2.2" />
          {Array.from({ length: 11 }, (_, i) => {
            const t = i / 10;
            const x = 52 + t * 96;
            const y = 75.5 + Math.sin(t * Math.PI) * 3;
            return <circle key={i} cx={x} cy={y} r="2" fill="#e6c25a" opacity=".9" />;
          })}
          {/* 금장 모표 */}
          <ellipse cx="100" cy="57" rx="15" ry="11" fill="#d9b24a" stroke="#8a6d20" strokeWidth="1.2" />
          <ellipse cx="100" cy="57" rx="9.5" ry="6.5" fill="#f1d27a" />
          <path d="M91 57 L100 49 L109 57 L100 65Z" fill="#8a6d20" opacity=".8" />
          {/* 구레나룻 */}
          <path d="M60 94 C58 104 60 112 62 118 L67 112 L66 96Z" fill="#6b5e4a" opacity=".85" />
          <path d="M140 94 C142 104 140 112 138 118 L133 112 L134 96Z" fill="#6b5e4a" opacity=".85" />
        </g>
      );
    case 'truman':
      return (
        <g>
          <path d={`M${c - 46} 70 C${c - 46} 34 ${c - 20} 26 ${c + 8} 28 C${c + 36} 30 ${c + 48} 46 ${c + 46} 72 C${c + 44} 56 ${c + 38} 48 ${c + 20} 46 C${c} 44 ${c - 26} 46 ${c - 46} 70Z`} fill="#8e8e90" />
          <path d={`M${c - 14} 38 C${c - 2} 44 ${c + 20} 44 ${c + 36} 40`} fill="none" stroke="#c8c8ca" strokeWidth="2" strokeLinecap="round" />
          <path d={`M${c + 46} 72 C${c + 40} 60 ${c + 36} 56 ${c + 34} 56 L${c + 38} 78Z`} fill="#6f6f72" />
          {/* 동그란 안경 */}
          <g fill="#cfe6f6" fillOpacity=".18" stroke="#2a2a2e" strokeWidth="2">
            <circle cx={c - 19} cy="94" r="12.5" />
            <circle cx={c + 19} cy="94" r="12.5" />
          </g>
          <path d={`M${c - 6.5} 93 Q${c} 89 ${c + 6.5} 93`} fill="none" stroke="#2a2a2e" strokeWidth="2" />
          <path d={`M${c - 31} 92 L${c - 41} 90`} stroke="#2a2a2e" strokeWidth="2" />
          <path d={`M${c + 31} 92 L${c + 41} 90`} stroke="#2a2a2e" strokeWidth="2" />
          <path d={`M${c - 25} 87 L${c - 15} 84`} stroke="#fff" strokeOpacity=".55" strokeWidth="1.6" strokeLinecap="round" />
          <path d={`M${c + 13} 87 L${c + 23} 84`} stroke="#fff" strokeOpacity=".55" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );
    case 'rhee':
      return (
        <g>
          {/* 대머리, 양옆 흰 머리 */}
          <path d={`M${c - 37} 84 C${c - 40} 70 ${c - 38} 62 ${c - 32} 58 C${c - 34} 70 ${c - 33} 80 ${c - 30} 92Z`} fill="#ececec" />
          <path d={`M${c + 37} 84 C${c + 40} 70 ${c + 38} 62 ${c + 32} 58 C${c + 34} 70 ${c + 33} 80 ${c + 30} 92Z`} fill="#d8d8d8" />
          <path d={`M${c - 24} 52 C${c - 10} 44 ${c + 10} 44 ${c + 24} 52`} fill="none" stroke="#fff" strokeOpacity=".22" strokeWidth="6" strokeLinecap="round" />
          {/* 가는 동그란 안경 */}
          <g fill="#cfe6f6" fillOpacity=".15" stroke="#2f2f33" strokeWidth="1.5">
            <circle cx={c - 17} cy="94" r="10.5" />
            <circle cx={c + 17} cy="94" r="10.5" />
          </g>
          <path d={`M${c - 6.5} 93 Q${c} 90 ${c + 6.5} 93`} fill="none" stroke="#2f2f33" strokeWidth="1.5" />
          {/* 이마·눈가 주름 */}
          {[56, 62, 68].map((y) => <path key={y} d={`M${c - 22} ${y} Q${c} ${y - 4} ${c + 22} ${y}`} fill="none" stroke={look.shade} strokeOpacity=".4" strokeWidth="1.1" />)}
        </g>
      );
    case 'walker':
      return (
        <g>
          <path d="M48 74 C46 36 74 22 104 22 C136 22 156 40 152 74 C130 66 72 66 48 74Z" fill="#4a5430" />
          <path d="M48 74 C46 36 74 22 104 22 C90 28 72 40 68 70Z" fill="#fff" fillOpacity=".1" />
          <path d="M40 76 C64 68 138 68 160 76 C166 88 140 94 100 92 C60 92 34 88 40 76Z" fill="#2f3820" />
          <path d="M40 76 C64 68 138 68 160 76" fill="none" stroke="#c9b36a" strokeWidth="2" />
          <Star x={100} y={58} r={8} fill="#e8e8e8" />
          <Star x={86} y={52} r={4.5} fill="#e8e8e8" />
          <Star x={114} y={52} r={4.5} fill="#e8e8e8" />
          {/* 무겁게 내려앉은 눈썹 그림자 */}
          <path d={`M${c - 34} 92 Q${c} 80 ${c + 34} 92`} fill="#000" fillOpacity=".18" />
        </g>
      );
    case 'kim':
      return (
        <g>
          <path d={`M${c - 48} 78 C${c - 54} 34 ${c - 20} 22 ${c + 6} 24 C${c + 40} 26 ${c + 54} 44 ${c + 48} 80 C${c + 46} 58 ${c + 36} 46 ${c + 16} 44 C${c - 6} 42 ${c - 34} 48 ${c - 48} 78Z`} fill="#16120f" />
          <path d={`M${c - 24} 34 C${c - 8} 28 ${c + 18} 30 ${c + 34} 38`} fill="none" stroke="#fff" strokeOpacity=".16" strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case 'peng':
      return (
        <g>
          <path d="M52 70 C50 34 74 22 102 22 C132 22 152 36 148 70 C128 62 74 62 52 70Z" fill="#6d7a4e" />
          <path d="M52 70 C50 34 74 22 102 22 C88 28 72 38 68 66Z" fill="#fff" fillOpacity=".1" />
          <path d="M46 70 C72 62 130 62 154 70 L154 76 C130 69 72 69 46 76Z" fill="#4a5535" />
          <Star x={100} y={44} r={9} fill="#d0252b" />
          <circle cx="100" cy="44" r="12" fill="none" stroke="#e8d08a" strokeWidth="1" opacity=".7" />
          <path d={`M${c - 40} 88 L${c - 40} 74`} stroke="#2b221b" strokeWidth="0" />
        </g>
      );
    case 'mao':
      return (
        <g>
          <path d={`M${c - 50} 74 C${c - 52} 36 ${c - 22} 26 ${c + 4} 26 C${c + 34} 26 ${c + 52} 40 ${c + 50} 76 C${c + 46} 56 ${c + 34} 46 ${c + 14} 44 C${c - 8} 44 ${c - 34} 50 ${c - 50} 74Z`} fill="#17120e" />
          <path d={`M${c - 24} 38 C${c - 6} 32 ${c + 16} 34 ${c + 32} 42`} fill="none" stroke="#fff" strokeOpacity=".14" strokeWidth="3" strokeLinecap="round" />
          {/* 턱의 점 */}
          <circle cx={c + 6} cy="150" r="2.2" fill="#6a3a2a" />
        </g>
      );
    case 'stalin':
      return (
        <g>
          <path d={`M${c - 44} 78 C${c - 50} 34 ${c - 20} 24 ${c + 6} 26 C${c + 36} 28 ${c + 50} 44 ${c + 44} 80 C${c + 42} 58 ${c + 32} 46 ${c + 14} 44 C${c - 6} 42 ${c - 30} 48 ${c - 44} 78Z`} fill="#bdb7ab" />
          <path d={`M${c - 24} 36 C${c - 8} 30 ${c + 16} 32 ${c + 32} 40`} fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="3" strokeLinecap="round" />
          {/* 굵은 콧수염 */}
          <path d={`M${c - 24} 128 C${c - 16} 119 ${c - 4} 122 ${c} 124 C${c + 4} 122 ${c + 16} 119 ${c + 24} 128 C${c + 14} 134 ${c + 4} 130 ${c} 129 C${c - 4} 130 ${c - 14} 134 ${c - 24} 128Z`} fill="#8e887c" />
          <path d={`M${c - 22} 126 C${c - 14} 120 ${c - 4} 122 ${c} 124`} fill="none" stroke="#e2ddd2" strokeOpacity=".5" strokeWidth="1.2" />
        </g>
      );
  }
}

/** 맥아더 전용: 선글라스, 옥수수 파이프, 연기 */
function MacArthurFace({ look, p }: { look: Look; p: string }) {
  return (
    <g>
      {/* 광대·볼 그림자와 주름 */}
      <path d="M62 112 Q70 128 82 140" fill="none" stroke={look.shade} strokeOpacity=".45" strokeWidth="1.4" />
      <path d="M138 112 Q132 126 122 138" fill="none" stroke={look.shade} strokeOpacity=".45" strokeWidth="1.4" />
      {/* 길고 높은 코 */}
      <path d="M99 94 C97 108 95 120 90 126 Q100 134 110 126" fill="none" stroke={look.shade} strokeOpacity=".85" strokeWidth="2" strokeLinecap="round" />
      <path d="M103 96 C105 108 107 118 110 124" fill="none" stroke="#fff" strokeOpacity=".2" strokeWidth="2" strokeLinecap="round" />
      <path d="M84 124 C90 132 98 134 100 134 C104 134 111 132 117 124" fill="none" stroke={look.shade} strokeOpacity=".5" strokeWidth="1.2" />
      {/* 입과 턱선: 굳게 다문 얇은 입 */}
      <path d="M86 142 Q96 146 106 144" fill="none" stroke="#5a2f24" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M92 152 Q100 156 108 152" fill="none" stroke={look.shade} strokeOpacity=".4" strokeWidth="1.4" />
      {/* 에비에이터 선글라스 */}
      <defs>
        <linearGradient id={p + 'lens'} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4b5560" />
          <stop offset="0.45" stopColor="#15191e" />
          <stop offset="1" stopColor="#07090b" />
        </linearGradient>
      </defs>
      <path d="M62 90 C62 88 70 86 79 86 C90 86 96 92 95 100 C94 110 86 116 76 115 C66 113 61 104 62 90Z" fill={`url(#${p}lens)`} stroke="#d9b24a" strokeWidth="1.8" />
      <path d="M138 90 C138 88 130 86 121 86 C110 86 104 92 105 100 C106 110 114 116 124 115 C134 113 139 104 138 90Z" fill={`url(#${p}lens)`} stroke="#d9b24a" strokeWidth="1.8" />
      <path d="M95 92 C97 90 103 90 105 92" fill="none" stroke="#d9b24a" strokeWidth="1.8" />
      <path d="M62 91 L55 92 M138 91 L145 92" stroke="#d9b24a" strokeWidth="1.8" />
      <path d="M68 92 C71 90 76 89 80 90" fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M112 92 C115 90 120 89 124 90" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="1.8" strokeLinecap="round" />
      {/* 옥수수 파이프 */}
      <path d="M104 144 C116 146 124 148 132 146" fill="none" stroke="#2b1c12" strokeWidth="3.4" strokeLinecap="round" />
      <g transform="rotate(-14 142 140)">
        <rect x="132" y="120" width="19" height="30" rx="7" fill="#d9b25a" stroke="#8a6a26" strokeWidth="1.2" />
        <rect x="132" y="120" width="8" height="30" rx="5" fill="#fff" fillOpacity=".22" />
        {[126, 132, 138, 144].map((y) => (
          <g key={y}>
            <circle cx="138" cy={y} r="1.6" fill="#b88c34" />
            <circle cx="144" cy={y + 2} r="1.6" fill="#b88c34" />
            <circle cx="149" cy={y} r="1.4" fill="#a67a2a" />
          </g>
        ))}
        <ellipse cx="141.5" cy="120.5" rx="8" ry="3" fill="#2b1810" />
        <ellipse cx="141.5" cy="120.8" rx="5" ry="1.8" fill="#ff7a2a" opacity=".85" />
      </g>
      {/* 연기 */}
      <g fill="none" stroke="#e8e8f0" strokeLinecap="round">
        <path d="M144 112 C138 100 152 92 146 80 C142 70 154 64 150 52" strokeOpacity=".38" strokeWidth="4" />
        <path d="M148 110 C156 100 144 90 154 80 C160 72 150 64 156 56" strokeOpacity=".22" strokeWidth="6" />
        <path d="M140 114 C134 104 144 98 140 88" strokeOpacity=".28" strokeWidth="2.4" />
      </g>
    </g>
  );
}

/** 인물별 추가 디테일(수염·주름·그림자) — 얼굴 위, 모자 아래 */
function Extra({ id, look }: { id: PortraitId; look: Look }) {
  switch (id) {
    case 'walker':
      return (
        <g>
          {/* 불독 같은 늘어진 볼 */}
          <path d="M58 118 C56 136 68 150 82 152" fill="none" stroke={look.shade} strokeOpacity=".55" strokeWidth="2" />
          <path d="M142 118 C144 136 132 150 118 152" fill="none" stroke={look.shade} strokeOpacity=".55" strokeWidth="2" />
          <path d="M74 140 Q100 150 126 140" fill="none" stroke={look.shade} strokeOpacity=".4" strokeWidth="1.5" />
        </g>
      );
    case 'rhee':
      return (
        <g fill="none" stroke={look.shade} strokeOpacity=".45" strokeWidth="1.1">
          <path d="M72 104 Q78 110 86 110" />
          <path d="M128 104 Q122 110 114 110" />
          <path d="M70 124 Q76 138 88 146" />
          <path d="M130 124 Q124 138 112 146" />
        </g>
      );
    case 'peng':
      return (
        <g fill="none" stroke={look.shade} strokeOpacity=".5" strokeWidth="1.3">
          <path d="M66 112 Q72 132 86 144" />
          <path d="M134 112 Q128 132 114 144" />
          <path d="M80 76 Q100 70 120 76" />
        </g>
      );
    case 'truman':
      return (
        <path d="M84 138 Q100 146 116 138" fill="none" stroke={look.shade} strokeOpacity=".35" strokeWidth="1.4" />
      );
    default:
      return null;
  }
}

export default function Portrait({ id, className }: { id: PortraitId; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const p = `pt${uid}${id}`;
  const look = LOOK[id];
  const fp = facePath(look.w, look.j, look.top ?? 42, look.chin ?? 154);
  return (
    <svg viewBox="0 0 200 250" className={className} role="img" aria-label={PORTRAITS[id].name} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={p + 'bg'} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={look.bg[0]} />
          <stop offset="1" stopColor={look.bg[1]} />
        </linearGradient>
        <radialGradient id={p + 'glow'} cx="0.3" cy="0.25" r="0.75">
          <stop offset="0" stopColor="#ffe9b8" stopOpacity=".42" />
          <stop offset="1" stopColor="#ffe9b8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={p + 'vig'} cx="0.5" cy="0.45" r="0.78">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".7" />
        </radialGradient>
        <linearGradient id={p + 'lit'} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity=".16" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.62" stopColor={look.shade} stopOpacity=".1" />
          <stop offset="1" stopColor={look.shade} stopOpacity=".6" />
        </linearGradient>
        <radialGradient id={p + 'cheek'} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#d9695a" stopOpacity=".22" />
          <stop offset="1" stopColor="#d9695a" stopOpacity="0" />
        </radialGradient>
        <pattern id={p + 'dots'} width="4" height="4" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r=".6" fill="#000" fillOpacity=".22" />
        </pattern>
        <clipPath id={p + 'clip'}>
          <path d={fp} />
        </clipPath>
      </defs>
      <rect width="200" height="250" fill={`url(#${p}bg)`} />
      <rect width="200" height="250" fill={`url(#${p}glow)`} />
      {/* 뒤쪽 빛줄기 */}
      <path d="M-20 -10 L60 -10 L170 260 L40 260Z" fill="#fff" fillOpacity=".035" />
      <Body id={id} look={look} p={p} />
      <path d={fp} fill={look.skin} />
      <g clipPath={`url(#${p}clip)`}>
        <rect x="0" y="0" width="200" height="250" fill={`url(#${p}lit)`} />
        <ellipse cx="72" cy="116" rx="14" ry="10" fill={`url(#${p}cheek)`} />
        <ellipse cx="128" cy="116" rx="14" ry="10" fill={`url(#${p}cheek)`} />
        <ellipse cx="100" cy="60" rx="34" ry="12" fill="#000" fillOpacity=".12" />
        <ellipse cx="100" cy="160" rx="40" ry="14" fill="#000" fillOpacity=".12" />
      </g>
      <Ears look={look} />
      {id === 'macarthur' ? <MacArthurFace look={look} p={p} /> : <Features look={look} p={p} mood={id === 'truman' || id === 'kim' ? 'smile' : id === 'walker' || id === 'peng' ? 'stern' : 'calm'} nose={id === 'walker' ? 1.3 : 1} brow={id === 'stalin' || id === 'rhee' ? '#9a948a' : id === 'truman' ? '#7a7a7c' : '#241a14'} />}
      <Extra id={id} look={look} />
      <Headgear id={id} look={look} p={p} />
      {/* 인쇄 질감과 비네팅 */}
      <rect width="200" height="250" fill={`url(#${p}dots)`} />
      <rect width="200" height="250" fill={`url(#${p}vig)`} />
    </svg>
  );
}

/** HOI4식 인물 명패가 붙은 초상 프레임 */
export function PortraitFrame({ id }: { id: PortraitId }) {
  const info = PORTRAITS[id];
  return (
    <figure className="m-0 w-[132px] shrink-0 overflow-hidden rounded-[3px] border-2 border-[#b79a52] bg-black shadow-[0_6px_22px_rgba(0,0,0,.65)]">
      <div className="h-[158px] w-full">
        <Portrait id={id} className="h-full w-full" />
      </div>
      <figcaption className="border-t border-[#b79a52]/70 bg-[#161008] px-2 py-1.5 text-center">
        <div className="font-serif text-[12.5px] font-bold leading-tight text-[#f1e3b7]">{info.name}</div>
        <div className="mt-0.5 text-[9.5px] leading-tight text-[#b6a679]">{info.title}</div>
      </figcaption>
    </figure>
  );
}
