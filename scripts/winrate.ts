import { createGame } from '../src/game/engine';
import { endTurn } from '../src/game/turn';
import { planAIOrders } from '../src/game/ai';
import { resolveEvent } from '../src/game/events';
import { EVENT_BY_ID } from '../src/data/events';
import * as man from '../src/game/manpower';
import { usePolicy } from '../src/game/policies';

type Bot = 'skilled' | 'passive' | 'idle';
const bot = (process.argv[2] ?? 'skilled') as Bot;
const N = Number(process.argv[3] ?? 40);
const start = Number(process.argv[4] ?? 100);
const cnt = { A: 0, B: 0, C: 0, D: 0 };
let provSum = 0, seoulKept = 0, mob = 0;
for (let seed = start; seed < start + N; seed++) {
  const s = createGame(seed);
  while (!s.outcome) {
    while (s.pendingEvents.length) { const ev = EVENT_BY_ID[s.pendingEvents[0].eventId]; const h = ev.choices.find((c) => !c.isCounterfactual) ?? ev.choices[0]; resolveEvent(s, ev.id, h?.id); }
    if (bot !== 'idle') {
      if (bot === 'skilled') {
        usePolicy(s, 'south', 'request_us');
        for (let i = 0; i < 5 && s.nations.south.commandPoints > 0; i++) {
          const t = s.nations.south.trainees;
          if (t.count > 4000) {
            const needy = Object.values(s.units).filter((u) => u.side === 'south' && u.faction === 'ROK' && u.strength < u.maxStrength * 0.7 && s.provinces[u.location].supplied)[0];
            if (needy) { man.reinforceFromPool(s, 'south', needy.id); continue; }
            man.createFormation(s, 'south', 'busan'); continue;
          }
          man.nationalDraft(s, 'south');
        }
      }
      for (const u of Object.values(s.units)) if (u.side === 'south' && u.order && u.order.issuedTurn === s.turn) u.order = null;
      planAIOrders(s, 'south', (s.flags.plaIntervened || s.date < '1950-09-15') ? 'defense' : 'offense');
      for (const u of Object.values(s.units)) if (u.side === 'south' && u.order) u.order.issuedTurn = s.turn;
    }
    endTurn(s);
  }
  const o = s.outcome;
  const owned = Object.values(s.provinces).filter((p) => p.owner === 'south').length;
  const seoul = s.provinces.seoul.owner === 'south';
  let k: 'A' | 'B' | 'C' | 'D';
  if (o.title.includes('대체역사')) k = 'A';
  else if (['부산 함락', '전쟁수행능력 붕괴', '전 부대 소멸'].includes(o.title)) k = 'D';
  else if (owned >= 62 && seoul) k = 'B';
  else k = 'C';
  cnt[k]++; provSum += owned; if (seoul) seoulKept++; if (s.flags.mobilized) mob++;
}
const pct = (n: number) => `${n} (${((n / N) * 100).toFixed(0)}%)`;
console.log(`BOT=${bot} N=${N}`, JSON.stringify({ '국군 완전점령': pct(cnt.A), '국군 우세 정전': pct(cnt.B), '북한 우세 정전': pct(cnt.C), '북한 완전점령': pct(cnt.D), 평균_국군지역: (provSum / N).toFixed(1), 서울보유: pct(seoulKept), 총동원령: pct(mob) }));
