import { create } from 'zustand';
import type { GameState, OrderType } from '../game/types';
import { createGame } from '../game/engine';
import { endTurn as runEndTurn } from '../game/turn';
import { cancelOrder, issueOrder, type Result } from '../game/orders';
import { resolveEvent } from '../game/events';
import * as eco from '../game/economy';
import * as man from '../game/manpower';
import { needsRest, unitsAt } from '../game/units';
import { usePolicy } from '../game/policies';
import { loadFromStorage, peekSave, saveToStorage, type SaveSlotInfo } from '../game/save';
import { updateIntel } from '../game/visibility';
import { selectableUnitIds } from '../game/selection';
import { EVENT_BY_ID } from '../data/events';

export type MapMode = 'select' | 'move' | 'attack';
export type MapLayer = 'control' | 'supply' | 'stability' | 'terrain';
export type Modal = 'menu' | 'help' | 'briefing' | 'gameover' | 'battle' | 'allBattles' | 'landing' | 'manage' | 'mobilized' | null;

export interface Playback {
  index: number; // 현재 단계(steps 인덱스)
  phase: 'intro' | 'result';
  auto: boolean;
}

interface Store {
  game: GameState;
  selectedProvince: string | null;
  selectedUnits: string[];
  mode: MapMode;
  layer: MapLayer;
  modal: Modal;
  battleFocus: string | null;
  toast: { text: string; kind: 'ok' | 'err' } | null;
  saveInfo: SaveSlotInfo;
  flashTurn: number;
  playback: Playback | null;
  focus: { province: string; nonce: number } | null;
  landingToggled: string[];
  hoverTarget: string | null;
  orderScope: string[] | null;

  selectProvince: (id: string | null) => void;
  toggleUnit: (id: string) => void;
  setUnits: (ids: string[]) => void;
  selectAllHere: () => void;
  /** 현재 선택된 부대 중 목록 순서 기준 앞의 절반(올림)만 남긴다 */
  selectHalf: () => void;
  /** 이 지역 부대 중 휴식이 필요한 부대만 선택 */
  selectNeedsRest: () => void;
  setFog: (on: boolean) => void;
  nation: (action: string, arg?: string) => void;
  /** scope: 선택 중인 부대 전체가 아니라 일부 부대에만 다음 명령을 적용할 때 지정 */
  setMode: (m: MapMode, scope?: string[]) => void;
  setLayer: (l: MapLayer) => void;
  setModal: (m: Modal) => void;
  showBattle: (id: string | null) => void;
  notify: (text: string, kind?: 'ok' | 'err') => void;
  setHoverTarget: (id: string | null) => void;

  orderUnits: (type: OrderType, target?: string) => void;
  cancelUnits: (ids: string[]) => void;
  mapClick: (provinceId: string) => void;
  province: (action: string) => void;
  policy: (id: string) => void;
  chooseEvent: (eventId: string, choiceId?: string) => void;
  toggleLanding: (key: string) => void;
  endTurn: () => void;

  playNext: () => void;
  playToResult: () => void;
  setAuto: (a: boolean) => void;
  skipPlayback: () => void;

  newGame: () => void;
  save: () => void;
  load: () => void;
  restart: () => void;
}

function mutate(get: () => Store, set: (p: Partial<Store>) => void, fn: (g: GameState) => Result | void): Result | void {
  const g = structuredClone(get().game);
  const r = fn(g);
  updateIntel(g);
  set({ game: g });
  return r;
}

const fresh = () => createGame(Math.floor(Math.random() * 1e9));

/** 재생 종료 후 보여줄 모달을 결정 */
const afterPlaybackModal = (g: GameState): Modal => (g.outcome ? 'gameover' : 'briefing');

export const useGame = create<Store>((set, get) => ({
  game: fresh(),
  selectedProvince: null,
  selectedUnits: [],
  mode: 'select',
  layer: 'control',
  modal: null,
  battleFocus: null,
  toast: null,
  saveInfo: peekSave(),
  flashTurn: 0,
  playback: null,
  focus: null,
  landingToggled: [],
  hoverTarget: null,
  orderScope: null,

  // 아군 주둔 지역을 클릭하면 명령 가능한 아군 부대를 전부 선택한다. 적 지역은 정보만 표시하고 아무것도 선택하지 않는다.
  selectProvince: (id) => {
    const g = get().game;
    set({ selectedProvince: id, selectedUnits: id ? selectableUnitIds(g, id) : [], mode: 'select' });
  },
  toggleUnit: (id) => {
    const g = get().game;
    const sel = get().selectedProvince;
    const ok = sel && selectableUnitIds(g, sel).includes(id);
    if (!ok) return; // 적 부대·이미 명령받은 부대는 선택할 수 없다
    const cur = get().selectedUnits;
    set({ selectedUnits: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
  },
  setUnits: (ids) => {
    const g = get().game;
    const sel = get().selectedProvince;
    const allowed = new Set(sel ? selectableUnitIds(g, sel) : []);
    set({ selectedUnits: ids.filter((i) => allowed.has(i)) });
  },
  selectHalf: () => {
    const g = get().game;
    const sel = get().selectedProvince;
    if (!sel) return;
    // 목록에 표시되는 순서(unitsAt 순서)를 기준으로 하며 무작위로 바꾸지 않는다
    const cur = unitsAt(g, sel, g.playerSide).map((u) => u.id).filter((id) => get().selectedUnits.includes(id));
    set({ selectedUnits: cur.slice(0, Math.ceil(cur.length / 2)) });
  },
  selectNeedsRest: () => {
    const g = get().game;
    const sel = get().selectedProvince;
    if (!sel) return;
    const ids = unitsAt(g, sel, g.playerSide).filter((u) => selectableUnitIds(g, sel).includes(u.id) && needsRest(u)).map((u) => u.id);
    set({ selectedUnits: ids });
    if (!ids.length) get().notify('휴식이 필요한 부대가 없습니다. (피로·조직력·사기·부상병·손상 장비 기준)', 'err');
    else get().notify(`휴식이 필요한 부대 ${ids.length}개를 선택했습니다.`);
  },
  setFog: (on) => {
    mutate(get, set, (g) => {
      g.settings = { ...(g.settings ?? { fog: false }), fog: on };
    });
    get().notify(on ? '전장의 안개를 켰습니다. (정보 표시만 제한됩니다)' : '전장의 안개를 껐습니다.');
  },
  nation: (action, arg) => {
    const side = get().game.playerSide;
    const res = mutate(get, set, (g) => {
      switch (action) {
        case 'draft': return man.nationalDraft(g, side);
        case 'train': return man.trainTrainees(g, side);
        case 'reinforce': return arg ? man.reinforceFromPool(g, side, arg) : undefined;
        case 'create': return arg ? man.createFormation(g, side, arg) : undefined;
      }
    });
    const sel = get().selectedProvince;
    if (sel) set({ selectedUnits: selectableUnitIds(get().game, sel).filter((i) => get().selectedUnits.includes(i)) });
    if (res && !res.ok) get().notify(res.reason ?? '실행할 수 없습니다.', 'err');
    else get().notify(res?.reason ?? '실행했습니다.');
  },
  selectAllHere: () => {
    const sel = get().selectedProvince;
    set({ selectedUnits: sel ? selectableUnitIds(get().game, sel) : [] });
  },
  setMode: (mode, scope) => set({ mode, orderScope: mode === 'select' ? null : scope ?? null }),
  setLayer: (layer) => set({ layer }),
  setModal: (modal) => set({ modal }),
  showBattle: (id) => set({ battleFocus: id, modal: id ? 'battle' : get().playback ? null : 'briefing' }),
  setHoverTarget: (hoverTarget) => set({ hoverTarget }),
  notify: (text, kind = 'ok') => {
    set({ toast: { text, kind } });
    setTimeout(() => {
      if (get().toast?.text === text) set({ toast: null });
    }, 3200);
  },

  orderUnits: (type, target) => {
    if (get().playback) return;
    const scope = get().orderScope;
    const ids = scope ?? get().selectedUnits;
    if (!ids.length) return get().notify('먼저 부대를 선택하세요.', 'err');
    const okIds: string[] = [];
    let firstErr = '';
    mutate(get, set, (g) => {
      for (const id of ids) {
        const r = issueOrder(g, id, type, target);
        if (r.ok) okIds.push(id);
        else if (!firstErr) firstErr = r.reason ?? '';
      }
    });
    // 명령을 받은 부대는 즉시 선택 해제, 못 받은 부대는 선택 유지
    const remaining = get().selectedUnits.filter((i) => !okIds.includes(i));
    set({ selectedUnits: remaining, mode: 'select', orderScope: null });
    if (okIds.length) get().notify(`${okIds.length}개 부대에 명령을 내렸습니다. (선택된 부대 ${remaining.length}개 남음)`);
    if (firstErr) get().notify(firstErr, 'err');
  },
  cancelUnits: (ids) => {
    mutate(get, set, (g) => ids.forEach((id) => cancelOrder(g, id)));
    // 취소한 부대는 다시 선택할 수 있다 (현재 선택 지역에 있는 부대는 자동으로 선택 상태로 복귀)
    const g = get().game;
    const sel = get().selectedProvince;
    const back = sel ? selectableUnitIds(g, sel).filter((i) => ids.includes(i)) : [];
    set({ selectedUnits: [...new Set([...get().selectedUnits, ...back])] });
  },
  mapClick: (pid) => {
    if (get().playback) return;
    const { mode } = get();
    if (mode === 'move') get().orderUnits('move', pid);
    else if (mode === 'attack') get().orderUnits('attack', pid);
    else get().selectProvince(pid);
  },

  province: (action) => {
    const pid = get().selectedProvince;
    if (!pid) return;
    const side = get().game.playerSide;
    const res = mutate(get, set, (g) => {
      switch (action) {
        case 'repair': return eco.repairInfrastructure(g, side, pid);
        case 'fortify': return eco.fortify(g, side, pid);
      }
    });
    // 새로 창설된 부대가 선택 목록에 반영되도록 갱신
    set({ selectedUnits: selectableUnitIds(get().game, pid).filter((i) => get().selectedUnits.includes(i)) });
    if (res && !res.ok) get().notify(res.reason ?? '실행할 수 없습니다.', 'err');
    else get().notify(res?.reason ?? '실행했습니다.');
  },

  policy: (id) => {
    const r = mutate(get, set, (g) => usePolicy(g, g.playerSide, id));
    if (r && !r.ok) get().notify(r.reason ?? '시행할 수 없습니다.', 'err');
    else get().notify('정책을 시행했습니다.');
  },

  toggleLanding: (key) => {
    const cur = get().landingToggled;
    set({ landingToggled: cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key] });
  },

  chooseEvent: (eventId, choiceId) => {
    const ev = EVENT_BY_ID[eventId];
    const before = get().game.flags.landingReport;
    const mobBefore = get().game.flags.mobilizationReport;
    const r = mutate(get, set, (g) => {
      if (ev.operation) g.flags.landingToggle = get().landingToggled.join(',');
      return resolveEvent(g, eventId, choiceId);
    });
    if (r && !r.ok) return get().notify(r.reason ?? '', 'err');
    const after = get().game.flags.landingReport;
    if (get().game.flags.mobilizationReport && get().game.flags.mobilizationReport !== mobBefore) set({ modal: 'mobilized' });
    else if (after && after !== before) set({ modal: 'landing', landingToggled: [] });
    else if (ev.operation) set({ landingToggled: [] });
  },

  endTurn: () => {
    if (get().playback) return;
    const g = structuredClone(get().game);
    const r = runEndTurn(g);
    if (!r.ok) return get().notify(r.reason ?? '턴을 종료할 수 없습니다.', 'err');
    saveToStorage(g, undefined, 'auto');
    const steps = g.lastTurn?.steps ?? [];
    set({
      game: g,
      selectedUnits: get().selectedProvince ? selectableUnitIds(g, get().selectedProvince!) : [],
      mode: 'select',
      flashTurn: g.turn,
      modal: afterPlaybackModal(g),
      saveInfo: peekSave(),
      // 최종 상태는 이미 확정되었고, 재생은 기록된 단계를 UI에서 보여주기만 한다
      playback: steps.length ? { index: 0, phase: steps[0].kind === 'movement' ? 'result' : 'intro', auto: false } : null,
      focus: steps.length && steps[0].province ? { province: steps[0].province, nonce: Date.now() } : null,
    });
  },

  // ── 전투 순차 재생 (게임 로직은 변경하지 않음) ──
  playToResult: () => {
    const p = get().playback;
    if (p && p.phase === 'intro') set({ playback: { ...p, phase: 'result' } });
  },
  playNext: () => {
    const p = get().playback;
    if (!p) return;
    const steps = get().game.lastTurn?.steps ?? [];
    if (p.phase === 'intro') return get().playToResult();
    const next = p.index + 1;
    if (next >= steps.length) {
      set({ playback: null, focus: null, modal: afterPlaybackModal(get().game) });
      return;
    }
    const st = steps[next];
    set({
      playback: { ...p, index: next, phase: st.kind === 'movement' ? 'result' : 'intro' },
      focus: st.province ? { province: st.province, nonce: Date.now() } : get().focus,
    });
  },
  setAuto: (auto) => {
    const p = get().playback;
    if (p) set({ playback: { ...p, auto } });
  },
  skipPlayback: () => set({ playback: null, focus: null, modal: afterPlaybackModal(get().game) }),

  newGame: () => set({ game: fresh(), selectedProvince: null, selectedUnits: [], mode: 'select', modal: null, flashTurn: 0, playback: null, focus: null, landingToggled: [] }),
  save: () => {
    const ok = saveToStorage(get().game);
    set({ saveInfo: peekSave() });
    get().notify(ok ? '저장했습니다.' : '저장에 실패했습니다.', ok ? 'ok' : 'err');
  },
  load: () => {
    const g = loadFromStorage();
    if (!g) return get().notify('불러올 저장 데이터가 없거나 형식이 맞지 않습니다.', 'err');
    set({ game: g, selectedProvince: null, selectedUnits: [], mode: 'select', modal: null, playback: null, focus: null });
    get().notify('불러왔습니다.');
  },
  restart: () => {
    get().newGame();
    get().notify('처음부터 다시 시작합니다.');
  },
}));
