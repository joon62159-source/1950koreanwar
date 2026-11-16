// 앱 아이콘·시작 화면 원본 이미지 생성: 한반도 윤곽을 38선 기준으로 남(파랑)·북(빨강)으로 칠한 그림
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const src = fs.readFileSync('src/data/outline.ts', 'utf8');
const m = src.match(/PENINSULA_OUTLINE[^=]*=\s*\[([\s\S]*?)\n\];/)[1];
const pts = [...m.matchAll(/\[(\d+\.\d+),\s*(\d+\.\d+)\]/g)].map((x) => [+x[1], +x[2]]);

const lonMin = Math.min(...pts.map((p) => p[0])), lonMax = Math.max(...pts.map((p) => p[0]));
const latMin = Math.min(...pts.map((p) => p[1])), latMax = Math.max(...pts.map((p) => p[1]));
const COS = 0.79;

/** 윤곽을 size 안의 box(비율)에 맞춰 그린 SVG 조각 */
function peninsula(size, fill, offsetY = 0) {
  const w = (lonMax - lonMin) * COS, h = latMax - latMin;
  const k = (size * fill) / Math.max(w, h);
  const ox = (size - w * k) / 2, oy = (size - h * k) / 2 + offsetY;
  const P = (lon, lat) => [ox + (lon - lonMin) * COS * k, oy + (latMax - lat) * k];
  const d = pts.map(([lo, la], i) => `${i ? 'L' : 'M'}${P(lo, la).map((v) => v.toFixed(1)).join(',')}`).join(' ') + ' Z';
  const y38 = P(0, 38)[1];
  return { d, y38, ox, oy, w: w * k, h: h * k };
}

function iconSvg({ size = 1024, fill = 0.7, bg = true, ring = true }) {
  const p = peninsula(size, fill);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b2735"/><stop offset="1" stop-color="#090c10"/></linearGradient>
    <clipPath id="north"><rect x="0" y="0" width="${size}" height="${p.y38}"/></clipPath>
    <clipPath id="south"><rect x="0" y="${p.y38}" width="${size}" height="${size}"/></clipPath>
    <radialGradient id="glow" cx="0.5" cy="0.45" r="0.6"><stop offset="0" stop-color="#ffd9a0" stop-opacity=".16"/><stop offset="1" stop-color="#ffd9a0" stop-opacity="0"/></radialGradient>
  </defs>
  ${bg ? `<rect width="${size}" height="${size}" fill="url(#bg)"/><rect width="${size}" height="${size}" fill="url(#glow)"/>` : ''}
  ${ring ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.46}" fill="none" stroke="#c9a24b" stroke-opacity=".55" stroke-width="${size * 0.008}"/>` : ''}
  <path d="${p.d}" fill="#c0392b" clip-path="url(#north)"/>
  <path d="${p.d}" fill="#2f6db8" clip-path="url(#south)"/>
  <path d="${p.d}" fill="none" stroke="#f0e6c8" stroke-opacity=".85" stroke-width="${size * 0.006}" stroke-linejoin="round"/>
  <line x1="${p.ox - size * 0.04}" y1="${p.y38}" x2="${p.ox + p.w + size * 0.04}" y2="${p.y38}" stroke="#ffe08a" stroke-width="${size * 0.008}" stroke-dasharray="${size * 0.03} ${size * 0.02}"/>
</svg>`;
}

async function png(svg, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await sharp(Buffer.from(svg)).png().toFile(file);
  console.log('wrote', file);
}

(async () => {
  await png(iconSvg({ size: 1024, fill: 0.62 }), 'assets/icon-only.png');
  await png(iconSvg({ size: 1024, fill: 0.5, bg: false, ring: false }), 'assets/icon-foreground.png');
  await png(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b2735"/><stop offset="1" stop-color="#090c10"/></linearGradient></defs><rect width="1024" height="1024" fill="url(#g)"/></svg>`, 'assets/icon-background.png');
  // 시작 화면: 어두운 배경 가운데에 아이콘
  const splash = `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732"><rect width="2732" height="2732" fill="#0b0f14"/><g transform="translate(866 766) scale(1)">${iconSvg({ size: 1000, fill: 0.62 }).replace(/<\/?svg[^>]*>/g, '')}</g></svg>`;
  await png(splash, 'assets/splash.png');
  await png(splash, 'assets/splash-dark.png');
})();
