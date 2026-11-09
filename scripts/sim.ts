import { createGame } from '../src/game/engine';
import { endTurn } from '../src/game/turn';
import { planAIOrders } from '../src/game/ai';
import { resolveEvent } from '../src/game/events';
import { EVENT_BY_ID } from '../src/data/events';
import { totalStrength } from '../src/game/units';
import { formatDate } from '../src/game/util';

const seed = Number(process.argv[2] ?? 1950);
const verbose = process.argv[3] !== 'q';
const s = createGame(seed);
const watch = ['seoul','suwon','daejeon','daegu','waegwan','pohang','masan','busan','incheon'];
let guard = 0;
while (!s.outcome && guard++ < 150) {
  while (s.pendingEvents.length) {
    const ev = EVENT_BY_ID[s.pendingEvents[0].eventId];
    const hist = ev.choices.find(c => !c.isCounterfactual) ?? ev.choices[0];
    resolveEvent(s, ev.id, hist?.id);
  }
  planAIOrders(s, 'south', (s.flags.plaIntervened || s.date < '1950-09-15') ? 'defense' : 'offense');
  for (const u of Object.values(s.units)) if (u.side==='south' && u.order) u.order.issuedTurn = s.turn;
  endTurn(s);
  if (verbose && s.turn % 4 === 0) {
    const own = Object.values(s.provinces).filter(p=>p.owner==='south').length;
    console.log(formatDate(s.date), 'T'+s.turn, 'S지역', own, '남군', Math.round(totalStrength(s,'south')/1000)+'k', '북군', Math.round(totalStrength(s,'north')/1000)+'k',
      'WC', s.nations.south.warCapacity, s.nations.north.warCapacity, '|', watch.map(w=>s.provinces[w].owner==='south'?'S':'N').join(''), 'btl', s.reports.length, 'PLA', Object.values(s.units).filter(u=>u.faction==='PLA').length, 'ap', Math.round(s.armisticeProgress), 'wear', Math.round(s.warWeariness));
  }
}
console.log('RESULT', s.outcome?.result, s.outcome?.title, s.outcome?.grade, s.outcome?.score?.total, 'turn', s.turn, 'date', s.date);
