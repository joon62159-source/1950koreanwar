import type { GameState, Side } from './types';
import { spendCP } from './economy';
import { addLog, clamp } from './util';
import type { Result } from './orders';

export interface Policy {
  id: string;
  name: string;
  description: string;
  cost: number;
  cooldownTurns: number;
  apply: (state: GameState, side: Side) => void;
  available?: (state: GameState, side: Side) => string | null; // 불가 사유 반환
}

export const POLICIES: Policy[] = [
  {
    id: 'request_us',
    name: '미국에 증원 요청',
    description: '외교 채널로 미국의 개입도와 UN 지지를 높입니다. (이미 높으면 효과 감소)',
    cost: 1,
    cooldownTurns: 3,
    apply(state) {
      const d = state.diplomacy;
      d.usCommitment = clamp(d.usCommitment + (d.usCommitment > 70 ? 3 : 10), 0, 100);
      d.unSupport = clamp(d.unSupport + 4, 0, 100);
    },
  },
  {
    id: 'rear_supply',
    name: '후방 보급 집중',
    description: '민간 물자를 동원해 보급 자원 +45. 국민 지지 -1.',
    cost: 1,
    cooldownTurns: 2,
    apply(state, side) {
      state.nations[side].supplyStock += 45;
      state.nations[side].popularSupport = clamp(state.nations[side].popularSupport - 1, 0, 100);
    },
  },
  {
    id: 'push_talks',
    name: '정전협상 추진',
    description: '외교력을 집중해 협상 진척도 +6. 국민 지지 -2. (협상 개시 후에만)',
    cost: 2,
    cooldownTurns: 3,
    available: (state) => (state.flags.talks === 'on' ? null : '정전협상이 시작되지 않았습니다.'),
    apply(state, side) {
      state.armisticeProgress = clamp(state.armisticeProgress + 6, 0, 100);
      state.nations[side].popularSupport = clamp(state.nations[side].popularSupport - 2, 0, 100);
    },
  },
  {
    id: 'morale_campaign',
    name: '민심 안정 캠페인',
    description: '피난민 지원과 방송으로 국민 지지 +5.',
    cost: 1,
    cooldownTurns: 3,
    apply(state, side) {
      state.nations[side].popularSupport = clamp(state.nations[side].popularSupport + 5, 0, 100);
    },
  },
];

export function usePolicy(state: GameState, side: Side, id: string): Result {
  const pol = POLICIES.find((p) => p.id === id);
  if (!pol) return { ok: false, reason: '알 수 없는 정책입니다.' };
  const n = state.nations[side];
  const cd = n.policyCooldowns[id] ?? 0;
  if (cd > state.turn) return { ok: false, reason: `재사용까지 ${cd - state.turn}턴 남았습니다.` };
  const why = pol.available?.(state, side);
  if (why) return { ok: false, reason: why };
  const cp = spendCP(state, side, pol.cost);
  if (!cp.ok) return cp;
  pol.apply(state, side);
  n.policyCooldowns[id] = state.turn + pol.cooldownTurns;
  addLog(state, 'info', `정책 시행: ${pol.name}`);
  return { ok: true };
}
