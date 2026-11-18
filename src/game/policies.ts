import type { GameState, Side } from './types';
import { ARMISTICE, ECONOMY } from './balance';
import { spendCP } from './economy';
import { addLog, clamp, nextRandom } from './util';
import type { Result } from './orders';

export interface Policy {
  id: string;
  name: string;
  description: string;
  cost: number;
  cooldownTurns: number;
  apply: (state: GameState, side: Side) => string | void; // 돌려주는 문장은 시행 직후 화면에 알린다
  /** true 이면 정책 목록에 보이지 않는다 (아직 쓸 수 없는 단계) */
  hidden?: (state: GameState) => boolean;
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
    description: `민간 물자를 동원해 보급 자원 +${ECONOMY.rearSupplyBoost}. 국민 지지 -1.`,
    cost: 1,
    cooldownTurns: 2,
    apply(state, side) {
      state.nations[side].supplyStock += ECONOMY.rearSupplyBoost;
      state.nations[side].popularSupport = clamp(state.nations[side].popularSupport - 1, 0, 100);
    },
  },
  {
    id: 'push_talks',
    name: '정전협상 추진',
    description: '외교력을 집중해 협상 진척도 +6. (협상 개시 후에만, 국민 지지는 떨어지지 않음)',
    cost: 2,
    cooldownTurns: 3,
    hidden: (state) => state.flags.talks !== 'on',
    available: (state) => (state.flags.talks === 'on' ? null : '정전협상이 시작되지 않았습니다.'),
    apply(state) {
      state.armisticeProgress = clamp(state.armisticeProgress + 6, 0, 100);
    },
  },
  {
    id: 'persuade_us',
    name: '미국 설득 (협상 지연)',
    description: `북진을 이어가도록 미국을 설득합니다. 성공하면 협상 예상 완료가 약 ${Math.round(ARMISTICE.persuadeDelayDays / 14)}턴 늦춰지고, 실패하면 약 ${Math.round(ARMISTICE.persuadeBackfireDays / 14)}턴 앞당겨집니다. 북쪽으로 많이 올라가 있고 미국 개입도가 높을수록 성공하기 쉽습니다.`,
    cost: 2,
    cooldownTurns: 4,
    hidden: (state) => state.flags.talks !== 'on' || !!state.flags.earlyArmistice,
    available: (state) => (state.flags.talks === 'on' && !state.flags.earlyArmistice ? null : '협상이 진행 중일 때만 쓸 수 있습니다.'),
    apply(state) {
      const north = Object.values(state.provinces).filter((p) => p.initialOwner === 'north' && !p.external);
      const gain = north.length ? north.filter((p) => p.owner === 'south').length / north.length : 0;
      const chance = clamp(0.35 + 0.5 * gain + (state.diplomacy.usCommitment - 50) / 200, 0.15, 0.85);
      const pct = Math.round(chance * 100);
      let msg: string;
      if (nextRandom(state) < chance) {
        state.flags.armisticeDelayDays = Number(state.flags.armisticeDelayDays ?? 0) + ARMISTICE.persuadeDelayDays;
        msg = `미국 설득 성공 (확률 ${pct}%): 협상 예상 완료가 약 ${Math.round(ARMISTICE.persuadeDelayDays / 14)}턴 늦춰졌습니다.`;
        addLog(state, 'good', msg);
      } else {
        state.flags.armisticeDelayDays = Number(state.flags.armisticeDelayDays ?? 0) - ARMISTICE.persuadeBackfireDays;
        state.diplomacy.usCommitment = clamp(state.diplomacy.usCommitment - 3, 0, 100);
        msg = `미국 설득 실패 (확률 ${pct}%): 협상 예상 완료가 약 ${Math.round(ARMISTICE.persuadeBackfireDays / 14)}턴 앞당겨지고 미국 개입도가 떨어졌습니다.`;
        addLog(state, 'warn', msg);
      }
      return msg;
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
  const note = pol.apply(state, side);
  n.policyCooldowns[id] = state.turn + pol.cooldownTurns;
  addLog(state, 'info', `정책 시행: ${pol.name}`);
  return { ok: true, reason: typeof note === 'string' ? note : undefined };
}
