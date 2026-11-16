import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../store/gameStore';
import { MAP, MAP_HEIGHT, MAP_WIDTH } from '../game/map';
import { ownerChanges } from '../game/history';
import { formatDate } from '../game/util';
import { EVENT_BY_ID } from '../data/events';
import { DIFFICULTY } from '../game/balance';
import { fmt } from './common';

const SOUTH = '#2f6db8';
const NORTH = '#b23a3a';
const SPEEDS = [1, 2, 4] as const;

/** 눈에 띄는 사건만 차트·자막에 표시 (편지·날씨·사상자 보고는 제외) */
const notable = (id: string) => !id.startsWith('letter_') && !id.startsWith('weather_') && !id.startsWith('casualty_report') && !!EVENT_BY_ID[id];

/** 꺾은선 차트: 값 배열, 현재 위치 표시, 사건 표시 */
function Chart({ title, series, colors, max, cursor, marks, labels }: { title: string; series: number[][]; colors: string[]; max: number; cursor: number; marks: number[]; labels?: string[] }) {
  const W = 320, H = 74, P = 4;
  const n = series[0].length;
  const x = (i: number) => P + (n <= 1 ? 0 : (i / (n - 1)) * (W - P * 2));
  const y = (v: number) => H - P - (max <= 0 ? 0 : (v / max) * (H - P * 2));
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-[11px] text-slate-400">
        <span>{title}</span>
        {labels && <span className="flex gap-2">{labels.map((l, i) => <span key={l} style={{ color: colors[i] }}>● {l}</span>)}</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded border border-ink-600 bg-[#0c1219]">
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={P} x2={W - P} y1={H * f} y2={H * f} stroke="#1c2733" strokeWidth="1" />)}
        {marks.map((i) => <line key={i} x1={x(i)} x2={x(i)} y1={P} y2={H - P} stroke="#c9a24b" strokeOpacity=".35" strokeWidth="1" />)}
        {series.map((s, k) => (
          <polyline key={k} fill="none" stroke={colors[k]} strokeWidth="1.8" strokeLinejoin="round" points={s.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} />
        ))}
        <line x1={x(cursor)} x2={x(cursor)} y1={P} y2={H - P} stroke="#ffe08a" strokeWidth="1.4" />
        {series.map((s, k) => <circle key={k} cx={x(cursor)} cy={y(s[cursor])} r="3" fill={colors[k]} stroke="#000" strokeWidth=".6" />)}
      </svg>
    </div>
  );
}

/** 게임이 끝난 뒤(또는 도중에) 전쟁의 흐름을 영토 변화 애니메이션으로 다시 보는 화면 */
export default function ReplayScreen({ onClose }: { onClose: () => void }) {
  const game = useGame((s) => s.game);
  const hist = game.history;
  const last = hist.length - 1;
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(2);
  const timer = useRef<number | null>(null);

  // 자동 재생
  useEffect(() => {
    if (!playing) return;
    timer.current = window.setInterval(() => {
      setIdx((i) => {
        if (i >= last) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 520 / speed);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [playing, speed, last]);

  const provs = useMemo(() => Object.values(game.provinces).filter((p) => !p.external), [game.provinces]);
  const cur = hist[Math.min(idx, last)];
  const changes = useMemo(() => ownerChanges(game, idx), [game, idx]);
  const polys = useMemo(() => Object.fromEntries(Object.values(MAP.geometry).map((g) => [g.id, 'M' + g.polygon.map((p) => p.map((v) => v.toFixed(1)).join(',')).join('L') + 'Z'])), []);

  // 이번 칸의 자막: 사건, 점령·함락
  const caption = useMemo(() => {
    const out: { kind: 'event' | 'up' | 'down'; text: string }[] = [];
    for (const id of cur.events.filter(notable)) out.push({ kind: 'event', text: EVENT_BY_ID[id].title });
    const big = [...changes].sort((a, b) => game.provinces[b.id].strategicValue - game.provinces[a.id].strategicValue).slice(0, 4);
    for (const c of big) {
      const p = game.provinces[c.id];
      if (c.to === 'south') out.push({ kind: 'up', text: `${p.name} ${p.initialOwner === 'south' ? '수복' : '점령'}${changes.length > big.length ? '' : ''}` });
      else out.push({ kind: 'down', text: `${p.name} 함락` });
    }
    if (changes.length > 4) out.push({ kind: changes.filter((c) => c.to === 'south').length >= changes.length / 2 ? 'up' : 'down', text: `그 밖에 ${changes.length - 4}곳의 지배가 바뀜` });
    return out;
  }, [cur, changes, game.provinces]);

  const marks = useMemo(() => hist.map((h, i) => (h.events.some(notable) ? i : -1)).filter((i) => i >= 0), [hist]);
  const southSeries = hist.map((h) => h.south);
  const total = provs.length;
  const owners = cur.owners;
  const flash = new Set(changes.map((c) => c.id));
  const finished = idx >= last;
  const o = game.outcome;
  const btn = 'btn !px-3 !py-2 !text-[14px]';

  return (
    <div className="fixed inset-0 z-[72] flex flex-col bg-[#070a0e]" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex shrink-0 items-center justify-between border-b border-ink-700 bg-[#0f151c] px-3 py-2">
        <div>
          <div className="font-serif text-[17px] font-black text-brass">전쟁의 기록 — 진행 다시 보기</div>
          <div className="text-[11px] text-slate-500">난이도 {DIFFICULTY[game.difficulty ?? 'normal'].label} · {hist.length - 1}턴</div>
        </div>
        <button className="btn !px-4 !py-2 !text-[14px]" onClick={onClose}>닫기 ✕</button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 md:grid-cols-[minmax(0,1fr)_360px] md:overflow-hidden">
        {/* 지도 */}
        <div className="relative flex min-h-[48vh] items-center justify-center overflow-hidden rounded border border-ink-600 bg-[#0a1118] md:min-h-0">
          <svg viewBox={`40 120 ${MAP_WIDTH - 20} ${MAP_HEIGHT - 150}`} className="h-full max-h-[78vh] w-full" role="img" aria-label="진행 다시 보기 지도">
            <defs>
              <clipPath id="rp-land"><path d={MAP.outlinePath} /><path d={MAP.jejuPath} /></clipPath>
            </defs>
            <rect x="-800" y="-800" width={MAP_WIDTH + 1600} height={MAP_HEIGHT + 1600} fill="#0c1a27" />
            {MAP.geometry.china && <path d={polys.china} fill="#3a2622" fillOpacity=".95" stroke="#c9885a" strokeOpacity=".5" />}
            <g clipPath="url(#rp-land)">
              {provs.map((p, i) => (
                <path key={p.id} d={polys[p.id]} fill={owners[i] === 's' ? SOUTH : NORTH} fillOpacity=".72" stroke="#0a1118" strokeWidth=".9" style={{ transition: 'fill .5s ease' }} />
              ))}
              {provs.filter((p) => flash.has(p.id)).map((p) => (
                <path key={'f' + p.id + idx} d={polys[p.id]} fill="#ffe08a" className="capture-flash" />
              ))}
            </g>
            <path d={MAP.outlinePath} fill="none" stroke="#9fb5c9" strokeOpacity=".7" strokeWidth="1.6" />
            <path d={MAP.jejuPath} fill="none" stroke="#9fb5c9" strokeOpacity=".7" strokeWidth="1.6" />
            <line x1={MAP.parallel38[0][0]} y1={MAP.parallel38[0][1]} x2={MAP.parallel38[1][0]} y2={MAP.parallel38[1][1]} stroke="#e1c274" strokeOpacity=".5" strokeDasharray="6 5" />
            {provs.filter((p) => p.strategicValue >= 8).map((p) => {
              const [x, y] = MAP.geometry[p.id].seat;
              return (
                <g key={'l' + p.id}>
                  <circle cx={x} cy={y} r="3" fill="#ffe08a" stroke="#000" strokeWidth=".6" />
                  <text x={x} y={y - 6} textAnchor="middle" fontSize="11" fill="#f0ead8" stroke="#05080c" strokeWidth="2.6" paintOrder="stroke">{p.name}</text>
                </g>
              );
            })}
          </svg>
          <div className="pointer-events-none absolute left-3 top-3 rounded bg-black/55 px-3 py-1.5">
            <div className="font-serif text-[22px] font-black leading-tight text-[#f4ead0]">{formatDate(cur.date)}</div>
            <div className="text-[11px] text-slate-400">{cur.turn}턴째</div>
          </div>
          {finished && o && (
            <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded border border-[#8a7a4f] bg-[#16130c]/92 px-3 py-2 text-center">
              <div className="text-[11px] tracking-widest text-[#e1c274]">{o.result === 'victory' ? '최종 결과 · 승리' : '최종 결과 · 패배'}</div>
              <div className="font-serif text-[20px] font-black text-[#f4ead0]">{o.title}</div>
            </div>
          )}
        </div>

        {/* 정보·차트·조작 */}
        <div className="flex min-h-0 flex-col gap-3 md:overflow-y-auto">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded border border-sky-800 bg-[#0e1c30] p-2">
              <div className="text-[11px] text-sky-300">국군·UN군 지역</div>
              <div className="text-[24px] font-bold tabular-nums text-sky-100">{cur.south}<span className="text-[12px] text-slate-500"> / {total}</span></div>
              <div className="text-[10.5px] text-slate-400">누적 전사 {fmt(cur.killedS)}</div>
            </div>
            <div className="rounded border border-red-900 bg-[#2a1214] p-2">
              <div className="text-[11px] text-red-300">북한·중공군 지역</div>
              <div className="text-[24px] font-bold tabular-nums text-red-100">{cur.north}<span className="text-[12px] text-slate-500"> / {total}</span></div>
              <div className="text-[10.5px] text-slate-400">누적 전사 {fmt(cur.killedN)}</div>
            </div>
          </div>

          <div className="min-h-[74px] rounded border border-ink-600 bg-ink-800/60 p-2 text-[12.5px] leading-[1.6]">
            {caption.length === 0 && <div className="text-slate-500">큰 변화 없는 시기입니다.</div>}
            {caption.map((c, i) => (
              <div key={i} className={c.kind === 'up' ? 'text-sky-300' : c.kind === 'down' ? 'text-red-300' : 'text-yellow-200'}>
                {c.kind === 'event' ? '★' : c.kind === 'up' ? '▲' : '▼'} {c.text}
              </div>
            ))}
          </div>

          <Chart title="국군·UN군 지역 수" series={[southSeries]} colors={['#6fb6ff']} max={total} cursor={Math.min(idx, last)} marks={marks} />
          <Chart title="누적 전사자" series={[hist.map((h) => h.killedS), hist.map((h) => h.killedN)]} colors={['#6fb6ff', '#ff8a8a']} max={Math.max(1, ...hist.map((h) => Math.max(h.killedS, h.killedN)))} cursor={Math.min(idx, last)} marks={[]} labels={['한국·UN', '북한·중공']} />
          <div className="text-[10.5px] text-slate-500">차트의 금빛 세로선은 주요 사건이 있었던 시점입니다.</div>

          <div className="mt-auto flex flex-col gap-2 rounded border border-ink-600 bg-[#0f151c] p-2">
            <input type="range" min={0} max={last} value={Math.min(idx, last)} onChange={(e) => { setPlaying(false); setIdx(Number(e.target.value)); }} className="w-full accent-yellow-400" aria-label="시점" />
            <div className="flex items-center justify-between gap-1">
              <div className="flex gap-1">
                <button className={btn} onClick={() => { setPlaying(false); setIdx(0); }} aria-label="처음">⏮</button>
                <button className={btn} onClick={() => { setPlaying(false); setIdx((i) => Math.max(0, i - 1)); }} aria-label="이전 턴">◀</button>
                <button className={btn + ' btn-blue'} onClick={() => { if (finished) setIdx(0); setPlaying((p) => !p || finished); }}>{playing && !finished ? '⏸' : '▶'}</button>
                <button className={btn} onClick={() => { setPlaying(false); setIdx((i) => Math.min(last, i + 1)); }} aria-label="다음 턴">▶|</button>
                <button className={btn} onClick={() => { setPlaying(false); setIdx(last); }} aria-label="끝">⏭</button>
              </div>
              <button className={btn} onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}>{speed}×</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
