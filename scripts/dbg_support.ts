import { createGame } from '../src/game/engine';
import { endTurn } from '../src/game/turn';
import { planAIOrders } from '../src/game/ai';
import { resolveEvent } from '../src/game/events';
import { EVENT_BY_ID } from '../src/data/events';
import * as man from '../src/game/manpower';
import { usePolicy } from '../src/game/policies';
import { crossPhase, declareCross } from '../src/game/china';

// 국민 지지·전쟁 피로 궤적 확인용 (숙련 자동 플레이어, 몇 개 시드 평균)
const marks = ['1950-08-01', '1950-10-01', '1951-01-01', '1951-06-01', '1952-01-01', '1952-09-01'];
const sums: Record<string, { sup: number; wear: number; cas: number; n: number }> = {};
const seeds = (process.argv[2] ?? '500,501,502,503').split(',').map(Number);
for (const seed of seeds) {
  const s = createGame(seed, 'normal');
  const got = new Set<string>();
  while (!s.outcome && s.date < '1953-01-01') {
    while (s.pendingEvents.length) { const ev = EVENT_BY_ID[s.pendingEvents[0].eventId]; const h = ev.choices.find((c) => !c.isCounterfactual) ?? ev.choices[0]; resolveEvent(s, ev.id, h?.id); }
    if (s.date >= '1950-10-01' && crossPhase(s) === 'idle') declareCross(s);
    usePolicy(s, 'south', 'request_us');
    for (let i = 0; i < 5 && s.nations.south.commandPoints > 0; i++) {
      const t = s.nations.south.trainees;
      if (t.count > 4000) { const needy = Object.values(s.units).filter((u) => u.side === 'south' && u.faction === 'ROK' && u.strength < u.maxStrength * 0.7 && s.provinces[u.location].supplied)[0]; if (needy) { man.reinforceFromPool(s, 'south', needy.id); continue; } man.createFormation(s, 'south', 'busan'); continue; }
      man.nationalDraft(s, 'south');
    }
    for (const u of Object.values(s.units)) if (u.side === 'south' && u.order && u.order.issuedTurn === s.turn) u.order = null;
    planAIOrders(s, 'south', (s.flags.plaIntervened || s.date < '1950-09-15') ? 'defense' : 'offense');
    for (const u of Object.values(s.units)) if (u.side === 'south' && u.order) u.order.issuedTurn = s.turn;
    endTurn(s);
    for (const m of marks) if (!got.has(m) && s.date >= m) {
      got.add(m);
      const e = (sums[m] ??= { sup: 0, wear: 0, cas: 0, n: 0 });
      e.sup += s.nations.south.popularSupport; e.wear += s.warWeariness; e.cas += s.nations.south.casualties; e.n++;
    }
  }
}
for (const m of marks) { const e = sums[m]; if (e) console.log(m, '지지', (e.sup / e.n).toFixed(0), '피로', (e.wear / e.n).toFixed(0), '사상자', Math.round(e.cas / e.n / 1000) + 'k', `(n=${e.n})`); }
