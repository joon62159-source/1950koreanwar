import type { GameState } from './types';
import { SAVE_VERSION } from './scenario';
import { PROVINCE_SEEDS } from '../data/provinceSeeds';

const KEY = 'korea1950.save.v1';

/** 브라우저 밖(테스트 등)에서는 저장소가 없으므로 아무것도 저장하지 않는 대체 객체를 쓴다 */
const noStorage = { getItem: () => null, setItem: () => undefined };
const defaultStorage = (): Pick<Storage, 'getItem' | 'setItem'> => (typeof localStorage === 'undefined' ? noStorage : localStorage);

export interface SaveSlotInfo {
  exists: boolean;
  date?: string;
  turn?: number;
}

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

/** 저장 데이터를 검증하여 복원한다. 실패하면 null. */
export function deserialize(raw: string): GameState | null {
  try {
    const s = JSON.parse(raw) as GameState;
    if (!s || s.version !== SAVE_VERSION) return null;
    if (!s.provinces || !s.units || !s.nations || typeof s.turn !== 'number') return null;
    for (const seed of PROVINCE_SEEDS) if (!s.provinces[seed.id]) return null;
    return s;
  } catch {
    return null;
  }
}

export function saveToStorage(state: GameState, storage: Pick<Storage, 'setItem'> = defaultStorage(), slot = 'main'): boolean {
  try {
    storage.setItem(`${KEY}.${slot}`, serialize(state));
    return true;
  } catch {
    return false;
  }
}

export function loadFromStorage(storage: Pick<Storage, 'getItem'> = defaultStorage(), slot = 'main'): GameState | null {
  try {
    const raw = storage.getItem(`${KEY}.${slot}`);
    return raw ? deserialize(raw) : null;
  } catch {
    return null;
  }
}

export function peekSave(storage: Pick<Storage, 'getItem'> = defaultStorage(), slot = 'main'): SaveSlotInfo {
  const s = loadFromStorage(storage, slot);
  return s ? { exists: true, date: s.date, turn: s.turn } : { exists: false };
}
