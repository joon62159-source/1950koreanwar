import { createGame } from '../src/game/engine';
import { endTurn } from '../src/game/turn';
import { planAIOrders } from '../src/game/ai';
import { resolveEvent } from '../src/game/events';
import { EVENT_BY_ID } from '../src/data/events';
const stopAt = process.argv[2] ?? '1950-08-05';
const s = createGame(Number(process.argv[3] ?? 1950));
while (!s.outcome && s.date < stopAt) {
  while (s.pendingEvents.length) { const ev=EVENT_BY_ID[s.pendingEvents[0].eventId]; const h=ev.choices.find(c=>!c.isCounterfactual)??ev.choices[0]; resolveEvent(s,ev.id,h?.id); }
  planAIOrders(s,'south', s.date<'1950-09-15'?'defense':'offense');
  for (const u of Object.values(s.units)) if (u.side==='south'&&u.order) u.order.issuedTurn=s.turn;
  endTurn(s);
}
console.log(s.date);
const south = Object.values(s.provinces).filter(p=>p.owner==='south').map(p=>p.name);
console.log('SOUTH owns', south.length, south.join(' '));
const byLoc: Record<string,string[]> = {};
for (const u of Object.values(s.units)) (byLoc[u.location]??=[]).push((u.side==='north'?'N':'S')+Math.round(u.strength/100)/10);
console.log(Object.entries(byLoc).map(([k,v])=>s.provinces[k].name+':'+v.join(',')).join(' | '));
