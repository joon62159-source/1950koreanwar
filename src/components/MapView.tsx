import { useEffect, useMemo, useRef, useState } from 'react';
import { MAP, MAP_HEIGHT, MAP_WIDTH } from '../game/map';
import { useGame } from '../store/gameStore';
import { attackableTargets, findPath, reachableTargets } from '../game/orders';
import { viewAt } from '../game/record';
import { fogOn } from '../game/visibility';
import type { GameState, Province, Side } from '../game/types';
import { useIsMobile } from './useIsMobile';
import { routeToHub, supplyInfo } from '../game/supply';
import { COMBAT, ECONOMY, MOVEMENT } from '../game/balance';
import { TERRAIN_KO } from './common';
import type { Terrain } from '../game/types';

const SOUTH = '#2f6db8';
const NORTH = '#b23a3a';

function terrainTint(p: Province): string {
  return { plain: '#6b7a4a', paddy: '#5e8052', hills: '#7a6a45', mountain: '#6b5a52', urban: '#6d7078', river: '#3e6f87', coastal: '#4e7a7a' }[p.terrain];
}

function fillFor(p: Province, owner: Side, layer: string): { fill: string; opacity: number } {
  if (layer === 'supply') {
    const v = p.supplyLevel / 100;
    const c = p.owner === 'south' ? [60, 140, 220] : [220, 80, 80];
    return { fill: p.supplied ? `rgb(${c.map((x) => Math.round(x * (0.35 + 0.65 * v))).join(',')})` : '#3a2a2a', opacity: 0.85 };
  }
  if (layer === 'stability') {
    const v = p.controlStability / 100;
    return { fill: `hsl(${Math.round(v * 110)} 55% ${30 + v * 12}%)`, opacity: 0.85 };
  }
  if (layer === 'terrain') return { fill: terrainTint(p), opacity: 0.85 };
  return { fill: owner === 'south' ? SOUTH : NORTH, opacity: 0.38 + 0.32 * (p.controlStability / 100) };
}

/** 두 프로빈스 중심 사이 선분을 양 끝에서 gap 만큼 줄여 점·이름과 겹치지 않게 한다 */
function trim(a: [number, number], b: [number, number], gap: number): [number, number, number, number] {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const g = Math.min(gap, len / 3);
  return [a[0] + (dx / len) * g, a[1] + (dy / len) * g, b[0] - (dx / len) * g, b[1] - (dy / len) * g];
}

/** 별(★) 다각형 점 목록: 주 보급 거점 표시용 */
function starPts(x: number, y: number, r: number): string {
  return Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    return `${(x + Math.cos(a) * rr).toFixed(1)},${(y + Math.sin(a) * rr).toFixed(1)}`;
  }).join(' ');
}

function visibleFromView(g: GameState, units: { loc: string; side: Side }[], owners: Record<string, Side>, side: Side): Set<string> {
  const vis = new Set<string>();
  for (const u of units) {
    if (u.side !== side) continue;
    vis.add(u.loc);
    MAP.adjacency[u.loc].forEach((n) => vis.add(n));
    MAP.sea[u.loc].forEach((n) => vis.add(n));
  }
  for (const id of Object.keys(owners)) if (owners[id] === side) vis.add(id);
  void g;
  return vis;
}

export default function MapView() {
  const mobile = useIsMobile();
  const game = useGame((s) => s.game);
  const selected = useGame((s) => s.selectedProvince);
  const selectedUnits = useGame((s) => s.selectedUnits);
  const mode = useGame((s) => s.mode);
  const layer = useGame((s) => s.layer);
  const mapClick = useGame((s) => s.mapClick);
  const setLayer = useGame((s) => s.setLayer);
  const playback = useGame((s) => s.playback);
  const focus = useGame((s) => s.focus);
  const hover = useGame((s) => s.hoverTarget);
  const orderScope = useGame((s) => s.orderScope);
  const setHover = useGame((s) => s.setHoverTarget);

  const wrap = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const [size, setSize] = useState({ w: 800, h: 700 });
  const [animating, setAnimating] = useState(false);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  // 두 손가락 확대·축소(핀치)를 위한 포인터 추적
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; k: number; vx: number; vy: number; cx: number; cy: number } | null>(null);

  const fit = (w = size.w, h = size.h) => {
    if (w < 50 || h < 50) return;
    if (mobile) {
      // 세로 화면: 가로 폭에 맞추고 한반도 중앙(38°N 부근)을 화면 가운데에 둔다
      const km = Math.min((w / MAP_WIDTH) * 1.12, (h * 0.98) / 1010);
      setView({ k: km, x: (w - MAP_WIDTH * km) / 2, y: h * 0.5 - 640 * km });
      return;
    }
    const k = Math.min(w / MAP_WIDTH, h / MAP_HEIGHT) * 0.96;
    setView({ k, x: (w - MAP_WIDTH * k) / 2, y: (h - MAP_HEIGHT * k) / 2 });
  };
  useEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      if (r.width < 50 || r.height < 50) return;
      setSize({ w: r.width, h: r.height });
      fit(r.width, r.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 전투 카메라: 전투 지역으로 시점 이동
  useEffect(() => {
    if (!focus) return;
    const seat = MAP.geometry[focus.province].seat;
    setAnimating(true);
    setView((v) => {
      const k = Math.max(v.k, 2.3);
      return { k, x: size.w / 2 - seat[0] * k, y: size.h / 2 - seat[1] * k };
    });
    const t = setTimeout(() => setAnimating(false), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce]);

  // 재생이 끝나면(또는 건너뛰면) 전체 지도 시점으로 부드럽게 복귀하고 최종 상태로 색상이 전환된다
  const wasPlaying = useRef(false);
  useEffect(() => {
    if (wasPlaying.current && !playback) {
      setAnimating(true);
      fit();
      const t = setTimeout(() => setAnimating(false), 900);
      wasPlaying.current = false;
      return () => clearTimeout(t);
    }
    wasPlaying.current = !!playback;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback === null]);

  useEffect(() => {
    if (!mobile || !selected || playback) return;
    const seat = MAP.geometry[selected].seat;
    setView((v) => {
      const sx = seat[0] * v.k + v.x, sy = seat[1] * v.k + v.y;
      const limit = size.h - 260; // 아래 시트가 가리는 영역을 뺀 가시 높이
      let { x, y } = v;
      if (sy > limit) y = v.y + (limit * 0.5 - sy);
      else if (sy < 50) y = v.y + (limit * 0.4 - sy);
      if (sx < 30 || sx > size.w - 30) x = v.x + (size.w / 2 - sx);
      if (x === v.x && y === v.y) return v;
      setAnimating(true);
      setTimeout(() => setAnimating(false), 450);
      return { ...v, x, y };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, mobile]);

  const onWheel = (e: React.WheelEvent) => {
    const r = wrap.current!.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    setAnimating(false);
    setView((v) => {
      const k = Math.max(0.5, Math.min(7, v.k * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
      return { k, x: mx - ((mx - v.x) / v.k) * k, y: my - ((my - v.y) / v.k) * k };
    });
  };
  const zoomBy = (f: number) =>
    setView((v) => {
      const k = Math.max(0.5, Math.min(7, v.k * f));
      const mx = size.w / 2, my = size.h / 2;
      return { k, x: mx - ((mx - v.x) / v.k) * k, y: my - ((my - v.y) / v.k) * k };
    });

  const polys = useMemo(
    () => Object.fromEntries(Object.values(MAP.geometry).map((g) => [g.id, 'M' + g.polygon.map((p) => p.map((v) => v.toFixed(1)).join(',')).join('L') + 'Z'])),
    [],
  );
  // 지도에 그리는 연결선은 실제 이동에 쓰이는 인접 데이터(MAP)에서만 만든다
  const links = useMemo(() => {
    const road: [string, string][] = [];
    const rail: [string, string][] = [];
    const sea: [string, string][] = [];
    for (const a of Object.keys(MAP.adjacency)) {
      for (const b of MAP.adjacency[a]) if (a < b) road.push([a, b]);
      for (const b of MAP.rail[a]) if (a < b) rail.push([a, b]);
      for (const b of MAP.sea[a]) if (a < b) sea.push([a, b]);
    }
    return { road, rail, sea };
  }, []);

  // 재생 중이면 기록된 단계까지 적용한 표시용 상태를 사용한다 (게임 상태는 바뀌지 않음)
  const stepIdx = playback ? (playback.phase === 'intro' ? playback.index - 1 : playback.index) : Infinity;
  const vw = useMemo(() => (playback ? viewAt(game, stepIdx) : null), [game, playback, stepIdx]);
  const owners: Record<string, Side> = useMemo(
    () => vw?.owners ?? Object.fromEntries(Object.values(game.provinces).map((p) => [p.id, p.owner])),
    [vw, game],
  );
  const unitList = useMemo(
    () => vw?.units.map((u) => ({ id: u.id, loc: u.loc, side: u.side })) ?? Object.values(game.units).map((u) => ({ id: u.id, loc: u.location, side: u.side })),
    [vw, game],
  );
  const fog = fogOn(game);
  // 안개가 꺼져 있으면(기본) 모든 지역이 보인다. 표시만 바뀌며 게임 계산에는 영향이 없다.
  const vis = useMemo(
    () => (fog ? visibleFromView(game, unitList, owners, game.playerSide) : new Set(Object.keys(game.provinces))),
    [game, unitList, owners, fog],
  );
  const counts = useMemo(() => {
    const m: Record<string, { own: number; enemy: number }> = {};
    for (const u of unitList) {
      const e = (m[u.loc] ??= { own: 0, enemy: 0 });
      if (u.side === game.playerSide) e.own++;
      else e.enemy++;
    }
    return m;
  }, [unitList, game.playerSide]);

  // 보급 레이어: 거점·보급선(거점에서 뻗어 나가는 트리). 안개가 켜져 있으면 아군 것만 보인다.
  const supplyView = useMemo(() => {
    if (layer !== 'supply' || playback) return null;
    const sides: Side[] = fog ? [game.playerSide] : ['south', 'north'];
    return sides.map((side) => ({ side, ...supplyInfo(game, side) }));
  }, [layer, playback, game, fog]);
  const supplyRoute = useMemo(() => {
    if (!supplyView || !selected) return [] as string[];
    const sv = supplyView.find((x) => x.side === game.provinces[selected].owner);
    return sv ? routeToHub(sv.parent, new Set(sv.hubs.map((h) => h.id)), selected) : [];
  }, [supplyView, selected, game]);

  const step = playback ? game.lastTurn?.steps[playback.index] : null;
  const stepReport = step?.reportId ? game.reports.find((r) => r.id === step.reportId) : null;

  // 선택한 부대의 이동/공격 가능 지역
  const targets = useMemo(() => {
    const set = new Set<string>();
    const actors = orderScope ?? selectedUnits;
    if (playback || mode === 'select' || !actors.length) return set;
    for (const id of actors) {
      const u = game.units[id];
      if (!u) continue;
      if (mode === 'move') reachableTargets(game, u).forEach((t) => set.add(t.id));
      else attackableTargets(game, u).forEach((t) => set.add(t));
    }
    return set;
  }, [game, mode, selectedUnits, orderScope, playback]);

  // 선택 지역과 직접 연결된 인접 지역 (실제 이동·공격 가능 관계)
  const neighborInfo = useMemo(() => {
    if (!selected || playback) return [];
    const out: { id: string; kind: 'road' | 'rail' | 'sea'; friendly: boolean }[] = [];
    const me = game.provinces[selected];
    for (const n of MAP.adjacency[selected]) out.push({ id: n, kind: MAP.rail[selected].includes(n) ? 'rail' : 'road', friendly: game.provinces[n].owner === me.owner });
    for (const n of MAP.sea[selected]) if (me.portCapacity > 0 && game.provinces[n].portCapacity > 0) out.push({ id: n, kind: 'sea', friendly: game.provinces[n].owner === me.owner });
    return out;
  }, [selected, game, playback]);

  // 이동 명령 경로 미리보기(이동 모드에서 목적지에 마우스를 올렸을 때)
  const preview = useMemo(() => {
    const actors = orderScope ?? selectedUnits;
    if (mode !== 'move' || !hover || !actors.length || playback) return null;
    const u = game.units[actors[0]];
    if (!u || hover === u.location) return null;
    const r = findPath(game, u.side, u.location, hover);
    return r ? { path: r.path, cost: r.cost } : null;
  }, [mode, hover, selectedUnits, orderScope, game, playback]);

  // 확정된 명령의 실제 이동 경로(인접 관계를 따른 경로)
  const orderPaths = useMemo(() => {
    const out: { key: string; path: string[]; kind: string }[] = [];
    if (playback) return out;
    for (const u of Object.values(game.units)) {
      if (u.side !== game.playerSide || !u.order?.target) continue;
      if (u.order.type === 'move') {
        const r = findPath(game, u.side, u.location, u.order.target);
        if (r) out.push({ key: u.id, path: r.path, kind: 'move' });
      } else if (u.order.type === 'attack') out.push({ key: u.id, path: [u.location, u.order.target], kind: 'attack' });
    }
    return out;
  }, [game, playback]);

  const k = Math.max(0.2, view.k);
  const labelSize = 10.5 / Math.pow(k, 0.55);
  const R = 8.5 / Math.pow(k, 0.4);
  const gap = 5 / Math.pow(k, 0.7);
  const showLabel = (p: Province) => (k < 0.95 ? p.strategicValue >= 7 : k < 1.5 ? p.strategicValue >= 5 : true);
  const seatOf = (id: string) => MAP.geometry[id].seat;
  const pathD = (path: string[]) => path.map((id, i) => `${i ? 'L' : 'M'}${seatOf(id)[0].toFixed(1)},${seatOf(id)[1].toFixed(1)}`).join(' ');

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-[#0a1118]" ref={wrap}>
      <svg
        width={size.w}
        height={size.h}
        className="touch-none cursor-grab active:cursor-grabbing"
        onWheel={onWheel}
        onPointerDown={(e) => {
          setAnimating(false);
          ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (ptrs.current.size === 2) {
            const [a, b] = [...ptrs.current.values()];
            pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, k: view.k, vx: view.x, vy: view.y, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
            drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: true };
          } else {
            drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
          }
        }}
        onPointerMove={(e) => {
          if (ptrs.current.has(e.pointerId)) ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (ptrs.current.size >= 2 && pinch.current) {
            const [a, b] = [...ptrs.current.values()];
            const p = pinch.current;
            const r = wrap.current!.getBoundingClientRect();
            const k = Math.max(0.4, Math.min(7, (p.k * (Math.hypot(a.x - b.x, a.y - b.y) || 1)) / p.dist));
            const wx = (p.cx - r.left - p.vx) / p.k, wy = (p.cy - r.top - p.vy) / p.k; // 처음 두 손가락 중심 아래의 지도 좌표
            setView({ k, x: (a.x + b.x) / 2 - r.left - wx * k, y: (a.y + b.y) / 2 - r.top - wy * k });
            if (drag.current) drag.current.moved = true;
            return;
          }
          const d = drag.current;
          if (!d) return;
          const dx = e.clientX - d.x, dy = e.clientY - d.y;
          if (Math.abs(dx) + Math.abs(dy) > (e.pointerType === 'touch' ? 9 : 4)) d.moved = true;
          if (d.moved) setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }));
        }}
        onPointerUp={(e) => {
          ptrs.current.delete(e.pointerId);
          if (ptrs.current.size < 2) pinch.current = null;
          if (ptrs.current.size === 1) {
            const [rest] = [...ptrs.current.values()];
            drag.current = { x: rest.x, y: rest.y, vx: view.x, vy: view.y, moved: true }; // 남은 한 손가락으로 이어서 이동
          } else setTimeout(() => (drag.current = null), 0);
        }}
        onPointerCancel={(e) => {
          ptrs.current.delete(e.pointerId);
          pinch.current = null;
          drag.current = null;
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === 'touch') return;
          ptrs.current.delete(e.pointerId);
          drag.current = null;
        }}
      >
        <defs>
          <clipPath id="land">
            <path d={MAP.outlinePath} />
            <path d={MAP.jejuPath} />
          </clipPath>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#000" strokeOpacity=".28" strokeWidth="2" />
          </pattern>
          <pattern id="mtn" width="9" height="9" patternUnits="userSpaceOnUse">
            <path d="M1 7 L4.5 2 L8 7" fill="none" stroke="#e6dcc3" strokeOpacity=".25" strokeWidth=".8" />
          </pattern>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" stroke="#1b2b3a" strokeWidth=".5" />
          </pattern>
          <filter id="glow"><feGaussianBlur stdDeviation="2.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <g style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${k})`, transition: animating ? 'transform .7s ease-in-out' : 'none' }}>
          <rect x={-800} y={-800} width={MAP_WIDTH + 1600} height={MAP_HEIGHT + 1600} fill="#0c1a27" />
          <rect x={-800} y={-800} width={MAP_WIDTH + 1600} height={MAP_HEIGHT + 1600} fill="url(#grid)" />
          {/* 한반도 밖 외부 지역: 중국 (압록강·두만강 건너편). 육지 윤곽 밖이므로 따로 그린다 */}
          {game.provinces.china && (
            <g>
              <path
                d={polys.china}
                fill="#3a2622"
                fillOpacity=".95"
                stroke="#c9885a"
                strokeOpacity=".75"
                strokeWidth={1.4 / Math.sqrt(k)}
                style={{ cursor: 'pointer' }}
                onPointerEnter={() => setHover('china')}
                onPointerLeave={() => setHover(null)}
                onClick={() => {
                  if (!drag.current?.moved) mapClick('china');
                }}
              />
              {selected === 'china' && <path d={polys.china} fill="none" stroke="#ffe08a" strokeWidth={2.6 / Math.sqrt(k)} pointerEvents="none" />}
              <text x={seatOf('china')[0]} y={seatOf('china')[1] - 34} textAnchor="middle" fontSize={22 / Math.pow(k, 0.4)} fill="#e8b48a" fillOpacity=".55" fontWeight={700} pointerEvents="none" letterSpacing="4">
                중 국
              </text>
              <text x={seatOf('china')[0]} y={seatOf('china')[1] - 16} textAnchor="middle" fontSize={9.5 / Math.pow(k, 0.4)} fill="#e8b48a" fillOpacity=".55" pointerEvents="none">
                (만주) · 아군 진입 불가
              </text>
            </g>
          )}
          <g clipPath="url(#land)">
            {Object.values(game.provinces).filter((p) => !p.external).map((p) => {
              const f = fillFor(p, owners[p.id], layer);
              return (
                <path
                  key={p.id}
                  d={polys[p.id]}
                  style={{ fill: f.fill, fillOpacity: f.opacity, transition: 'fill .9s ease, fill-opacity .9s ease', cursor: targets.has(p.id) ? 'crosshair' : 'pointer' }}
                  stroke="#0a1118"
                  strokeWidth={0.9 / Math.sqrt(k)}
                  onPointerEnter={() => setHover(p.id)}
                  onPointerLeave={() => setHover(null)}
                  onClick={() => {
                    if (!drag.current?.moved) mapClick(p.id);
                  }}
                />
              );
            })}
            {layer === 'control' &&
              Object.values(game.provinces)
                .filter((p) => p.terrain === 'mountain')
                .map((p) => <path key={'m' + p.id} d={polys[p.id]} fill="url(#mtn)" pointerEvents="none" />)}
            {Object.values(game.provinces)
              .filter((p) => !p.supplied)
              .map((p) => <path key={'h' + p.id} d={polys[p.id]} fill="url(#hatch)" pointerEvents="none" />)}
          </g>
          <path d={MAP.outlinePath} fill="none" stroke="#9fb5c9" strokeOpacity=".7" strokeWidth={1.6 / Math.sqrt(k)} pointerEvents="none" />
          <path d={MAP.jejuPath} fill="none" stroke="#9fb5c9" strokeOpacity=".7" strokeWidth={1.6 / Math.sqrt(k)} pointerEvents="none" />
          {/* 원래 국경: 해안선 밖(바다)으로 뻗지 않도록 육지 영역으로 자른다 */}
          <g clipPath="url(#land)" pointerEvents="none">
            <path d={MAP.originalBorder} fill="none" stroke="#f1e3b7" strokeOpacity=".55" strokeWidth={5.2 / Math.sqrt(k)} strokeLinecap="round" strokeLinejoin="round" />
            <path d={MAP.originalBorder} fill="none" stroke="#000" strokeWidth={2.8 / Math.sqrt(k)} strokeLinecap="round" strokeLinejoin="round" />
          </g>
          <line x1={MAP.parallel38[0][0]} y1={MAP.parallel38[0][1]} x2={MAP.parallel38[1][0]} y2={MAP.parallel38[1][1]} stroke="#e1c274" strokeOpacity=".55" strokeDasharray="6 5" strokeWidth={1 / Math.sqrt(k)} pointerEvents="none" />
          <text x={MAP.parallel38[1][0] + 6} y={MAP.parallel38[1][1] + 3} fontSize={9 / Math.sqrt(k)} fill="#e1c274" fillOpacity=".8" pointerEvents="none">38°N</text>

          {/* 선택·대상 강조 (육지에만) */}
          <g clipPath="url(#land)" pointerEvents="none">
            {neighborInfo.map((n) => (
              <path key={'n' + n.id} d={polys[n.id]} fill={n.friendly ? '#5fe08a' : '#ff9a5a'} fillOpacity=".13" stroke={n.friendly ? '#7ff0a2' : '#ffb07a'} strokeOpacity=".8" strokeWidth={1.6 / Math.sqrt(k)} />
            ))}
            {[...targets].map((id) => (
              <path key={'t' + id} d={polys[id]} fill={mode === 'attack' ? '#ff7a3a' : '#5fe08a'} fillOpacity=".24" stroke={mode === 'attack' ? '#ff9a5a' : '#7ff0a2'} strokeWidth={2 / Math.sqrt(k)} strokeDasharray="5 3" className="march" />
            ))}
            {selected && <path d={polys[selected]} fill="none" stroke="#ffe08a" strokeWidth={2.6 / Math.sqrt(k)} filter="url(#glow)" />}
            {hover && hover !== selected && <path d={polys[hover]} fill="#fff" fillOpacity=".08" stroke="#fff" strokeOpacity=".5" strokeWidth={1.4 / Math.sqrt(k)} />}
            {/* 점령 순간 색상 변화 애니메이션 */}
            {playback?.phase === 'result' && step?.ownerChanges.map((c) => (
              <path key={`cf${playback.index}${c.province}`} d={polys[c.province]} fill={c.to === 'south' ? '#8fc4ff' : '#ff9a9a'} className="capture-flash" />
            ))}
          </g>

          {/* 연결선: 모두 실제 인접 데이터에서 생성. 화면상 굵기는 확대·축소와 무관하게 일정(non-scaling-stroke) */}
          <g pointerEvents="none" fill="none">
            {links.road.map(([a, b]) => {
              const [x1, y1, x2, y2] = trim(seatOf(a), seatOf(b), gap);
              const hot = selected && (a === selected || b === selected);
              return <line key={a + b} x1={x1} y1={y1} x2={x2} y2={y2} stroke={hot ? '#ffffff' : '#b9c7d6'} strokeOpacity={hot ? 0.95 : 0.5} strokeWidth={hot ? 2.6 : 1.3} vectorEffect="non-scaling-stroke" strokeLinecap="round" />;
            })}
            {links.rail.map(([a, b]) => {
              const [x1, y1, x2, y2] = trim(seatOf(a), seatOf(b), gap);
              const hot = selected && (a === selected || b === selected);
              return (
                <g key={'r' + a + b}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#05080c" strokeOpacity=".9" strokeWidth={hot ? 5 : 3.6} vectorEffect="non-scaling-stroke" />
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={hot ? '#fff3b8' : '#f0c75a'} strokeWidth={hot ? 3 : 2.1} strokeDasharray="7 5" vectorEffect="non-scaling-stroke" />
                </g>
              );
            })}
            {links.sea.map(([a, b]) => {
              const [x1, y1, x2, y2] = trim(seatOf(a), seatOf(b), gap);
              const hot = selected && (a === selected || b === selected);
              return <line key={'s' + a + b} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#6fd0ff" strokeOpacity={hot ? 1 : 0.75} strokeWidth={hot ? 3 : 2} strokeDasharray="1 6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />;
            })}
          </g>

          {/* 이동 경로 미리보기 · 확정된 명령 경로 */}
          <g pointerEvents="none" fill="none">
            {orderPaths.map((o) => (
              <g key={o.key}>
                <path d={pathD(o.path)} stroke="#05080c" strokeWidth={5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                <path d={pathD(o.path)} stroke={o.kind === 'attack' ? '#ff8a4a' : '#7fd0ff'} strokeWidth={3} strokeDasharray="9 6" className="march" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                <circle cx={seatOf(o.path[o.path.length - 1])[0]} cy={seatOf(o.path[o.path.length - 1])[1]} r={4 / Math.pow(k, 0.5)} fill={o.kind === 'attack' ? '#ff8a4a' : '#7fd0ff'} stroke="#000" strokeWidth=".8" />
                <circle cx={seatOf(o.path[0])[0]} cy={seatOf(o.path[0])[1]} r={3 / Math.pow(k, 0.5)} fill="#fff" stroke="#000" strokeWidth=".8" />
              </g>
            ))}
            {preview && (
              <g>
                <path d={pathD(preview.path)} stroke="#05080c" strokeWidth={6} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                <path d={pathD(preview.path)} stroke="#5fe08a" strokeWidth={3.6} strokeDasharray="10 6" className="march" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                <circle cx={seatOf(preview.path[preview.path.length - 1])[0]} cy={seatOf(preview.path[preview.path.length - 1])[1]} r={5 / Math.pow(k, 0.5)} fill="#5fe08a" stroke="#000" strokeWidth=".8" />
              </g>
            )}
            {stepReport?.retreatTo && playback?.phase === 'result' && (
              <g>
                <path d={pathD([stepReport.province, stepReport.retreatTo])} stroke="#ffd36a" strokeWidth={3} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
                <circle cx={seatOf(stepReport.retreatTo)[0]} cy={seatOf(stepReport.retreatTo)[1]} r={4 / Math.pow(k, 0.5)} fill="#ffd36a" />
              </g>
            )}
          </g>

          {/* 전투 연출 */}
          {playback && step?.kind === 'battle' && step.province && (
            <g pointerEvents="none">
              {playback.phase === 'intro' ? (
                <>
                  <circle cx={seatOf(step.province)[0]} cy={seatOf(step.province)[1]} className="battle-loop" stroke="#ff6a6a" />
                  <circle cx={seatOf(step.province)[0]} cy={seatOf(step.province)[1]} className="battle-loop" stroke="#7fb8ff" style={{ animationDelay: '.45s' }} />
                  <text x={seatOf(step.province)[0]} y={seatOf(step.province)[1] + 4} textAnchor="middle" fontSize={16 / Math.pow(k, 0.5)}>⚔</text>
                </>
              ) : (
                stepReport && (
                  <g className="float-up" key={stepReport.id}>
                    <text x={seatOf(step.province)[0]} y={seatOf(step.province)[1] - 18 / Math.pow(k, 0.5)} textAnchor="middle" fontSize={11 / Math.pow(k, 0.5)} fill="#ffe08a" stroke="#05080c" strokeWidth={2.5 / Math.pow(k, 0.5)} paintOrder="stroke" fontWeight={700}>
                      {stepReport.outcome === 'attacker_win' ? '점령' : stepReport.outcome === 'defender_win' ? '방어 성공' : '교착'} · 손실 {stepReport.attackerLosses}/{stepReport.defenderLosses}
                    </text>
                  </g>
                )
              )}
            </g>
          )}
          {playback?.phase === 'result' && step?.kind === 'occupy' && step.province && (
            <circle cx={seatOf(step.province)[0]} cy={seatOf(step.province)[1]} className="battle-ring" stroke="#ffe08a" pointerEvents="none" />
          )}

          {/* 보급 레이어: 보급선(거점에서 뻗는 선), 선택 지역의 보급 경로, 거점 표시 */}
          {supplyView && (
            <g pointerEvents="none" fill="none">
              {supplyView.map((sv) =>
                Object.entries(sv.parent).map(([id, par]) => {
                  const lv = game.provinces[id].supplyLevel / 100;
                  const [x1, y1, x2, y2] = trim(seatOf(par), seatOf(id), gap * 0.6);
                  return <line key={sv.side + id} x1={x1} y1={y1} x2={x2} y2={y2} stroke={sv.side === 'south' ? '#6fb6ff' : '#ff8a8a'} strokeOpacity={0.3 + 0.6 * lv} strokeWidth={1.4 + 3 * lv} vectorEffect="non-scaling-stroke" strokeLinecap="round" />;
                }),
              )}
              {supplyRoute.length > 1 && <path d={pathD(supplyRoute)} stroke="#ffe08a" strokeWidth={3.4} strokeDasharray="8 5" vectorEffect="non-scaling-stroke" strokeLinecap="round" className="march" />}
              {supplyView.flatMap((sv) =>
                sv.hubs.map((h) => {
                  const [x, y] = seatOf(h.id);
                  const S = (h.kind === 'main' ? 13 : 10) / Math.pow(k, 0.35);
                  const own = sv.side === 'south';
                  return (
                    <g key={sv.side + h.id + 'hub'} transform={`translate(${x} ${y})`}>
                      <circle r={S * 1.5} fill="#000" fillOpacity=".45" />
                      {h.kind === 'main' && <polygon points={starPts(0, 0, S)} fill={own ? '#ffe08a' : '#ff9a9a'} stroke="#000" strokeWidth=".8" />}
                      {h.kind === 'depot' && <path d={`M0 ${-S} L${S * 0.95} ${S * 0.7} L${-S * 0.95} ${S * 0.7}Z`} fill={own ? '#9fd0ff' : '#ff9a9a'} stroke={h.cut ? '#ff5a5a' : '#000'} strokeWidth={h.cut ? 1.8 : 0.8} strokeDasharray={h.cut ? '3 2' : undefined} />}
                      {h.kind === 'built' && <path d={`M0 ${-S} L${S} 0 L0 ${S} L${-S} 0Z`} fill="#7ff0a2" stroke={h.cut ? '#ff5a5a' : '#000'} strokeWidth={h.cut ? 1.8 : 0.8} strokeDasharray={h.cut ? '3 2' : undefined} />}
                      <text y={S + 11 / Math.pow(k, 0.5)} textAnchor="middle" fontSize={10 / Math.pow(k, 0.55)} fill={h.cut ? '#ffb0b0' : '#fff'} stroke="#05080c" strokeWidth={2.6 / Math.pow(k, 0.55)} paintOrder="stroke" fontWeight={700}>
                        {h.cut ? `고립 ${h.turnsLeft}턴` : h.level}
                      </text>
                    </g>
                  );
                }),
              )}
            </g>
          )}

          {/* 지역 점·이름 */}
          {Object.values(game.provinces).map((p) => {
            const [x, y] = seatOf(p.id);
            return (
              <g key={'l' + p.id} pointerEvents="none">
                <circle cx={x} cy={y} r={(p.strategicValue >= 8 ? 3.4 : 2.1) / Math.pow(k, 0.3)} fill={p.strategicValue >= 8 ? '#ffe08a' : '#e6dcc3'} stroke="#000" strokeWidth=".6" />
                {showLabel(p) && (
                  <text x={x} y={y - 6 / Math.pow(k, 0.3)} textAnchor="middle" fontSize={labelSize} fill="#f0ead8" stroke="#05080c" strokeWidth={2.6 / Math.pow(k, 0.55)} paintOrder="stroke" fontWeight={p.strategicValue >= 8 ? 700 : 400}>
                    {p.name}
                  </text>
                )}
              </g>
            );
          })}

          {/* 부대 아이콘: 부대 수 표시 (병력·전투력 아님) */}
          {Object.entries(counts).map(([pid, c]) => {
            const [x, y] = seatOf(pid);
            const out = [];
            if (c.own > 0) {
              const hasSel = selectedUnits.some((id) => game.units[id]?.location === pid);
              out.push(
                <g key={pid + 'o'} transform={`translate(${x + R * 0.9} ${y + R * 1.05})`} pointerEvents="none">
                  <circle r={R} fill="#1f5fae" stroke={hasSel ? '#ffe08a' : '#cfe3ff'} strokeWidth={hasSel ? 2.4 / Math.pow(k, 0.4) : 1.2 / Math.pow(k, 0.4)} />
                  <text textAnchor="middle" dy=".35em" fontSize={R * 1.15} fill="#fff" fontWeight={700}>{c.own}</text>
                </g>,
              );
            }
            if (c.enemy > 0) {
              const seen = vis.has(pid);
              const stale = game.intel[pid];
              if (seen) {
                out.push(
                  <g key={pid + 'e'} transform={`translate(${x + R * 0.9} ${y - R * 1.0})`} pointerEvents="none">
                    <circle r={R} fill="#b22d2d" stroke="#ffd0d0" strokeWidth={1.2 / Math.pow(k, 0.4)} />
                    <text textAnchor="middle" dy=".35em" fontSize={R * 1.15} fill="#fff" fontWeight={700}>{c.enemy}</text>
                  </g>,
                );
              } else if (fog && stale) {
                out.push(
                  <g key={pid + 'e'} transform={`translate(${x + R * 0.9} ${y - R * 1.0})`} pointerEvents="none" opacity=".75">
                    <circle r={R} fill="#4a1e1e" stroke="#ff9a9a" strokeDasharray="2 2" strokeWidth={1.3 / Math.pow(k, 0.4)} />
                    <text textAnchor="middle" dy=".35em" fontSize={R * 1.15} fill="#ffb0b0" fontWeight={700}>?</text>
                  </g>,
                );
              }
            }
            return out;
          })}
          {fog && Object.entries(game.intel)
            .filter(([pid]) => !vis.has(pid) && !counts[pid]?.enemy)
            .map(([pid]) => {
              const [x, y] = seatOf(pid);
              return (
                <g key={pid + 'ghost'} transform={`translate(${x + R * 0.9} ${y - R * 1.0})`} pointerEvents="none" opacity=".5">
                  <circle r={R} fill="#3a1d1d" stroke="#ff9a9a" strokeDasharray="2 2" strokeWidth={1.1 / Math.pow(k, 0.4)} />
                  <text textAnchor="middle" dy=".35em" fontSize={R * 1.15} fill="#ffb0b0" fontWeight={700}>?</text>
                </g>
              );
            })}
        </g>
      </svg>

      <div className="absolute right-2 top-2 flex flex-col gap-1.5">
        <button className={'btn ' + (mobile ? '!h-11 !w-11 !p-0 !text-[20px]' : '')} onClick={() => zoomBy(1.3)} title="확대">＋</button>
        <button className={'btn ' + (mobile ? '!h-11 !w-11 !p-0 !text-[20px]' : '')} onClick={() => zoomBy(1 / 1.3)} title="축소">－</button>
        <button className={'btn ' + (mobile ? '!h-11 !w-11 !p-0 !text-[18px]' : '')} onClick={() => fit()} title="전체 보기">⌂</button>
      </div>
      <div data-tour="layers" className={'absolute left-2 top-2 flex gap-1 rounded border border-ink-600 bg-ink-900/85 p-1 text-[11px] ' + (mobile ? 'max-w-[calc(100%-70px)]' : '')}>
        {([['control', '통제'], ['supply', '보급'], ['stability', mobile ? '안정' : '안정도'], ['terrain', '지형']] as const).map(([id, label]) => (
          <button key={id} className={'btn ' + (mobile ? '!px-2.5 !py-2 !text-[13px] ' : '') + (layer === id ? 'btn-blue' : '')} onClick={() => setLayer(id)}>{label}</button>
        ))}
      </div>
      <div className={'pointer-events-none absolute bottom-2 left-3 flex-wrap items-center gap-x-3 gap-y-1 rounded bg-ink-900/85 px-2 py-1 text-[10px] text-slate-300 ' + (mobile ? 'hidden' : 'flex')}>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[#1f5fae] align-middle" />아군 여단 수</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-[#b22d2d] align-middle" />적 여단 수(정찰됨)</span>
        <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full border border-dashed border-red-300 bg-[#4a1e1e] align-middle" />? 정찰 안 됨</span>
        <span><i className="mr-1 inline-block h-0 w-5 border-t-2 border-[#b9c7d6] align-middle" />도로</span>
        <span><i className="mr-1 inline-block h-0 w-5 border-t-[3px] border-dashed border-[#f0c75a] align-middle" />철도</span>
        <span><i className="mr-1 inline-block h-0 w-5 border-t-2 border-dotted border-[#6fd0ff] align-middle" />해상</span>
        <span className="text-yellow-200/80">해칭 = 보급 단절</span>
      </div>
      {layer === 'stability' && !playback && (
        <div className={'pointer-events-none absolute left-2 max-w-[calc(100%-70px)] rounded border border-ink-600 bg-ink-900/90 px-2 py-1.5 text-[10.5px] leading-[1.5] text-slate-300 ' + (mobile ? 'top-[58px]' : 'top-12')}>
          <div className="mb-0.5 font-bold text-brass">안정도 보기</div>
          <div className="h-3 w-full min-w-[190px] rounded-sm border border-black/40" style={{ background: `linear-gradient(90deg, ${[0, 25, 50, 75, 100].map((p) => `hsl(${Math.round((p / 100) * 110)} 55% ${30 + (p / 100) * 12}%) ${p}%`).join(', ')})` }} />
          <div className="mt-0.5 flex justify-between text-slate-400"><span>0 불안</span><span>50</span><span>100 안정</span></div>
          <div className="mt-1">안정도가 낮을수록 <b className="text-red-300">붉게</b>, 높을수록 <b className="text-emerald-300">초록</b>으로 보입니다.</div>
          <ul className="mt-0.5 list-disc pl-4 text-slate-400">
            <li>점령 직후에는 {ECONOMY.stabilityOccupiedStart}에서 시작해 시간이 지나며 회복됩니다.</li>
            <li>{ECONOMY.draftMinStability} 미만이면 징병 접근률이 낮거나 0이고 산업 생산도 줄어듭니다.</li>
            <li>원래 내 영토가 아닌 점령지는 안정도가 최대 85까지만 오릅니다.</li>
          </ul>
        </div>
      )}
      {layer === 'terrain' && !playback && (
        <div className={'pointer-events-none absolute left-2 max-w-[calc(100%-70px)] rounded border border-ink-600 bg-ink-900/90 px-2 py-1.5 text-[10.5px] leading-[1.5] text-slate-300 ' + (mobile ? 'top-[58px]' : 'top-12')}>
          <div className="mb-0.5 font-bold text-brass">지형 보기</div>
          <div className="grid grid-cols-1 gap-x-3 gap-y-0.5 min-[480px]:grid-cols-2">
            {(['plain', 'paddy', 'hills', 'mountain', 'urban', 'river', 'coastal'] as Terrain[]).map((t) => (
              <div key={t} className="flex items-center gap-1.5 whitespace-nowrap">
                <i className="inline-block h-3 w-3 shrink-0 rounded-sm border border-black/40" style={{ background: terrainTint({ terrain: t } as Province) }} />
                <b className="text-slate-100">{TERRAIN_KO[t]}</b>
                <span className="text-slate-400">방어 ×{COMBAT.terrainDefense[t]} · 이동 ×{MOVEMENT.terrainCost[t]}</span>
              </div>
            ))}
          </div>
          <div className="mt-0.5 text-slate-500">방어 수치가 클수록 지키기 유리하고, 이동 수치가 클수록 행군이 느립니다.</div>
        </div>
      )}
      {layer === 'supply' && !playback && (
        <div className={'pointer-events-none absolute left-2 max-w-[calc(100%-70px)] rounded border border-ink-600 bg-ink-900/90 px-2 py-1.5 text-[10.5px] leading-[1.55] text-slate-300 ' + (mobile ? 'top-[58px]' : 'top-12')}>
          <div className="font-bold text-brass">보급 보기</div>
          <div><span className="text-[#ffe08a]">★</span> 주 거점 · <span className="text-[#9fd0ff]">▲</span> 전진 보급소 · <span className="text-[#7ff0a2]">◆</span> 설치한 보급소</div>
          <div>굵고 밝은 선 = 보급이 잘 닿는 길 · 빗금 = 보급 단절(포위)</div>
          <div className="text-yellow-200/90">지역을 누르면 그곳의 보급 경로가 노란 점선으로 보입니다</div>
        </div>
      )}
      {hover && !playback && !mobile && (
        <div className="pointer-events-none absolute bottom-10 right-3 rounded border border-ink-600 bg-ink-900/90 px-2 py-1 text-[11px]">
          <b>{game.provinces[hover].name}</b> · {game.provinces[hover].owner === 'south' ? '대한민국' : '북한'} · 보급 {game.provinces[hover].supplied ? game.provinces[hover].supplyLevel : '단절'}
          {preview && <span className="ml-2 text-emerald-300">경로 {preview.path.length - 1}칸</span>}
        </div>
      )}
    </div>
  );
}
