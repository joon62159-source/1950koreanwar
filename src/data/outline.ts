/** 단순화한 한반도 윤곽선 (경도, 위도). 정밀 해안선이 아니라 전략 지도용 근사입니다. */
export const PENINSULA_OUTLINE: [number, number][] = [
  // 서해안 (북→남)
  [124.30, 40.12], [124.60, 39.88], [125.00, 39.62], [125.30, 39.50], [125.20, 39.20],
  [125.28, 38.92], [125.20, 38.72], [125.00, 38.60], [124.85, 38.30], [125.10, 38.00],
  [125.20, 37.75], [125.55, 37.58], [126.00, 37.65], [126.35, 37.70], [126.40, 37.55],
  [126.50, 37.38], [126.60, 37.20], [126.75, 37.05], [126.50, 36.95], [126.15, 36.72],
  [126.40, 36.50], [126.48, 36.22], [126.50, 36.00], [126.55, 35.85], [126.50, 35.60],
  [126.42, 35.35], [126.33, 35.15], [126.28, 34.85], [126.28, 34.60], [126.50, 34.30],
  [126.80, 34.40], [127.10, 34.45], [127.35, 34.55], [127.60, 34.60], [127.78, 34.62],
  [127.95, 34.75], [128.20, 34.72], [128.45, 34.70], [128.75, 34.68], [128.90, 34.80],
  [128.95, 34.98], [129.12, 35.02], [129.28, 35.18],
  // 동해안 (남→북)
  [129.40, 35.45], [129.48, 35.75], [129.60, 36.00], [129.50, 36.40], [129.50, 36.95],
  [129.30, 37.40], [129.10, 37.70], [128.95, 37.85], [128.75, 38.05], [128.66, 38.22],
  [128.44, 38.60], [128.15, 38.85], [127.95, 39.00], [127.62, 39.20], [127.62, 39.45],
  [127.72, 39.70], [127.80, 39.90], [128.00, 40.08], [128.30, 40.12], [128.60, 40.28],
  [128.95, 40.42], [129.22, 40.62], [129.28, 40.85], [129.48, 41.10], [129.70, 41.30],
  [129.90, 41.55], [129.85, 41.88], [130.05, 42.10], [130.30, 42.28], [130.52, 42.36],
  // 북동 국경 (두만강) → 압록강
  [130.55, 42.65], [130.25, 42.90], [129.95, 42.98], [129.70, 42.60], [129.35, 42.45],
  [129.00, 42.30], [128.55, 42.05], [128.08, 42.00], [128.30, 41.70], [128.20, 41.40],
  [127.70, 41.45], [127.20, 41.65], [126.90, 41.75], [126.45, 41.35], [126.15, 41.10],
  [125.90, 40.80], [125.55, 40.55], [125.00, 40.45], [124.75, 40.32], [124.50, 40.18],
];

export const JEJU_OUTLINE: [number, number][] = [
  [126.15, 33.42], [126.32, 33.56], [126.70, 33.56], [126.95, 33.45],
  [126.88, 33.30], [126.58, 33.20], [126.25, 33.27],
];

/** 태백산맥·낭림/마식령 산맥 근사 능선 (경도, 위도). 능선을 가로지르는 인접은 지정된 고갯길만 허용. */
export const RIDGES: { name: string; line: [number, number][]; passes: [string, string][] }[] = [
  {
    name: '태백산맥',
    line: [[128.2, 38.8], [128.45, 38.1], [128.65, 37.7], [128.95, 37.1], [129.15, 36.5], [129.0, 36.1]],
    passes: [['gangneung', 'hoengseong'], ['samcheok', 'yeongwol'], ['sokcho', 'inje'], ['goseong', 'inje'], ['gangneung', 'hongcheon']],
  },
  {
    name: '마식령·낭림산맥',
    line: [[126.55, 41.2], [126.85, 40.5], [127.05, 39.9], [127.15, 39.4], [127.3, 38.9]],
    passes: [['pyeongwon', 'wonsan'], ['huichon', 'hamheung'], ['huichon', 'jangjin'], ['gaecheon', 'hamheung']],
  },
];

/** 철도 간선 (1950년 전후 주요 노선의 근사). 순서대로 이어진 프로빈스 id. */
export const RAIL_LINES: { name: string; chain: string[] }[] = [
  { name: '경부선', chain: ['seoul', 'suwon', 'osan', 'pyeongtaek', 'cheonan', 'jochiwon', 'daejeon', 'yeongdong', 'waegwan', 'daegu', 'miryang', 'busan'] },
  { name: '경의선(남)', chain: ['seoul', 'paju', 'gaeseong', 'geumcheon', 'sariwon', 'hwangju', 'pyongyang'] },
  { name: '경원선', chain: ['seoul', 'uijeongbu', 'dongducheon', 'cheorwon', 'pyeonggang', 'wonsan'] },
  { name: '경의선(북)', chain: ['pyongyang', 'anju', 'jeongju', 'sinuiju'] },
  { name: '평원선', chain: ['pyongyang', 'pyeongwon', 'wonsan'] },
  { name: '함경선', chain: ['wonsan', 'hamheung', 'bukcheong', 'tanchon', 'seongjin', 'gilju', 'cheongjin', 'najin'] },
  { name: '흥남지선', chain: ['hamheung', 'hungnam'] },
  { name: '중앙선', chain: ['seoul', 'yeoju', 'wonju', 'jecheon', 'yeongju', 'andong', 'yeongcheon', 'gyeongju', 'pohang'] },
  { name: '대구선', chain: ['daegu', 'yeongcheon'] },
  { name: '호남선', chain: ['daejeon', 'nonsan', 'iksan', 'jeongeup', 'naju', 'mokpo'] },
  { name: '전라선', chain: ['iksan', 'jeonju'] },
  { name: '군산선', chain: ['iksan', 'gunsan'] },
  { name: '광주선', chain: ['naju', 'gwangju'] },
  { name: '전라선(남)', chain: ['iksan', 'namwon', 'suncheon', 'yeosu'] },
  { name: '경전선', chain: ['miryang', 'masan', 'jinju'] },
  { name: '황해선', chain: ['sariwon', 'songnim', 'jinnampo'] },
  { name: '만포선', chain: ['pyongyang', 'sunchon_n', 'gaecheon', 'huichon', 'gangye'] },
  { name: '평남지선', chain: ['pyongyang', 'jinnampo'] },
];

/** 해상 연결(항구 필요). 해안선을 따라 이동 가능한 쌍. */
export const SEA_LINKS: [string, string][] = [
  ['ongjin', 'incheon'],
  ['mokpo', 'jeju'],
  ['masan', 'geoje'],
  ['tongyeong', 'geoje'],
  ['jeju', 'seogwipo'],
  ['busan', 'geoje'],
];

/** 산악 오지의 희소한 프로빈스를 잇는 강제 육로 연결 */
export const FORCED_LINKS: [string, string][] = [
  ['gapsan', 'hyesan'], ['gapsan', 'gangye'], ['gapsan', 'gilju'], ['gapsan', 'jangjin'], ['gapsan', 'bukcheong'],
  ['sinpo', 'bukcheong'], ['sinpo', 'hungnam'],
];

/** 압록강·두만강 국경 너머 중국 영역 (경도, 위도). 앞부분은 PENINSULA_OUTLINE 의 북쪽 국경선과 같다. */
export const CHINA_OUTLINE: [number, number][] = [
  [130.55, 42.65], [130.25, 42.90], [129.95, 42.98], [129.70, 42.60], [129.35, 42.45],
  [129.00, 42.30], [128.55, 42.05], [128.08, 42.00], [128.30, 41.70], [128.20, 41.40],
  [127.70, 41.45], [127.20, 41.65], [126.90, 41.75], [126.45, 41.35], [126.15, 41.10],
  [125.90, 40.80], [125.55, 40.55], [125.00, 40.45], [124.75, 40.32], [124.50, 40.18],
  [124.30, 40.12], [123.40, 40.05], [122.50, 45.00], [131.00, 45.00], [131.00, 42.70],
];

/** 중국과 맞닿은 북한 프로빈스: 압록강·두만강 유역 전부 */
export const CHINA_BORDER_PROVINCES = ['sinuiju', 'gusong', 'unsan', 'huichon', 'gangye', 'hyesan', 'gapsan', 'musan', 'hoeryong', 'najin'];
