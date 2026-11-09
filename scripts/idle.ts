import { createGame } from '../src/game/engine';
import { endTurn } from '../src/game/turn';
import { resolveEvent } from '../src/game/events';
import { EVENT_BY_ID } from '../src/data/events';
for (const seed of [1,2,3]) {
  const s = createGame(seed);
  let last='';
  while (!s.outcome) {
    while (s.pendingEvents.length) { const ev=EVENT_BY_ID[s.pendingEvents[0].eventId]; const h=ev.choices.find(c=>!c.isCounterfactual)??ev.choices[0]; resolveEvent(s,ev.id,h?.id); }
    endTurn(s);
    last = s.date+' '+Object.values(s.provinces).filter(p=>p.owner==='south').length;
  }
  console.log('idle seed',seed, s.outcome.result, s.outcome.title, last, s.outcome.score?.total);
}
