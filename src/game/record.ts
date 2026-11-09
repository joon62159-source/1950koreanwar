import type { GameState, PlaybackStep, Side } from './types';

export interface Snap {
  owners: Record<string, Side>;
  locs: Record<string, string>;
}

export function takeSnap(state: GameState): Snap {
  return {
    owners: Object.fromEntries(Object.values(state.provinces).map((p) => [p.id, p.owner])),
    locs: Object.fromEntries(Object.values(state.units).map((u) => [u.id, u.location])),
  };
}

/** 두 스냅샷의 차이를 재생 단계의 상태 변화로 만든다 */
export function diffSnap(a: Snap, b: Snap): Pick<PlaybackStep, 'ownerChanges' | 'unitMoves' | 'unitsRemoved'> {
  const ownerChanges = Object.keys(b.owners)
    .filter((id) => a.owners[id] !== b.owners[id])
    .map((id) => ({ province: id, from: a.owners[id], to: b.owners[id] }));
  const unitMoves: PlaybackStep['unitMoves'] = [];
  const unitsRemoved: string[] = [];
  for (const id of Object.keys(a.locs)) {
    if (!(id in b.locs)) unitsRemoved.push(id);
    else if (a.locs[id] !== b.locs[id]) unitMoves.push({ id, from: a.locs[id], to: b.locs[id] });
  }
  return { ownerChanges, unitMoves, unitsRemoved };
}

/** 재생 지점 k(마지막으로 적용한 단계 인덱스, -1=턴 시작)의 표시용 상태를 계산한다. 게임 상태는 변경하지 않는다. */
export function viewAt(state: GameState, k: number): { owners: Record<string, Side>; units: { id: string; loc: string; side: Side }[] } {
  const rec = state.lastTurn;
  if (!rec || k >= rec.steps.length) {
    return {
      owners: Object.fromEntries(Object.values(state.provinces).map((p) => [p.id, p.owner])),
      units: Object.values(state.units).map((u) => ({ id: u.id, loc: u.location, side: u.side })),
    };
  }
  const owners = { ...rec.initialOwners };
  const locs: Record<string, string> = Object.fromEntries(Object.entries(rec.initialUnits).map(([id, u]) => [id, u.loc]));
  for (let i = 0; i <= k; i++) {
    const st = rec.steps[i];
    for (const c of st.ownerChanges) owners[c.province] = c.to;
    for (const m of st.unitMoves) locs[m.id] = m.to;
    for (const r of st.unitsRemoved) delete locs[r];
  }
  return { owners, units: Object.entries(locs).map(([id, loc]) => ({ id, loc, side: rec.initialUnits[id].side })) };
}
