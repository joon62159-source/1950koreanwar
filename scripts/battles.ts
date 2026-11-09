import { createGame } from '../src/game/engine';
import { endTurn } from '../src/game/turn';
import { planAIOrders } from '../src/game/ai';
import { resolveEvent } from '../src/game/events';
import { EVENT_BY_ID } from '../src/data/events';
const s = createGame(1950);
const turns = Number(process.argv[2] ?? 3);
for (let t=0;t<turns && !s.outcome;t++){
  while (s.pendingEvents.length) { const ev=EVENT_BY_ID[s.pendingEvents[0].eventId]; const h=ev.choices.find(c=>!c.isCounterfactual)??ev.choices[0]; resolveEvent(s,ev.id,h?.id); }
  planAIOrders(s,'south', 'defense');
  for (const u of Object.values(s.units)) if (u.side==='south'&&u.order) u.order.issuedTurn=s.turn;
  endTurn(s);
  console.log('--- after turn', s.turn-1, s.date);
  for (const r of s.reports) console.log(r.provinceName.padEnd(6), r.outcome.padEnd(14), 'A', r.attackerPower, 'D', r.defenderPower, 'loss A/D', r.attackerLosses, r.defenderLosses, r.captured?'CAP':'', r.surrounded?'SURR':'', r.attackerSide);
  console.log(s.briefing.join(' | '));
}
