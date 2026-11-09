import { createGame } from '../src/game/engine';
import { endTurn } from '../src/game/turn';
import { planAIOrders } from '../src/game/ai';
import { resolveEvent } from '../src/game/events';
import { EVENT_BY_ID } from '../src/data/events';
import * as man from '../src/game/manpower';
import { usePolicy } from '../src/game/policies';
import { forceStats } from '../src/game/casualty';
const res: string[] = [];
for (const seed of [1,2,3,4]) {
  const s = createGame(seed);
  let mobTurn = -1;
  while (!s.outcome) {
    while (s.pendingEvents.length) { const ev=EVENT_BY_ID[s.pendingEvents[0].eventId]; const h=ev.choices.find(c=>!c.isCounterfactual)??ev.choices[0]; resolveEvent(s,ev.id,h?.id); if (ev.id==='general_mobilization') mobTurn = s.turn; }
    usePolicy(s,'south','request_us');
    // 국가 징집 → 보충 → 창설
    for (let i=0;i<5 && s.nations.south.commandPoints>0;i++) {
      const t = s.nations.south.trainees;
      if (t.count > 4000) {
        const needy = Object.values(s.units).filter(u=>u.side==='south' && u.strength<u.maxStrength*0.7 && s.provinces[u.location].supplied)[0];
        if (needy) { man.reinforceFromPool(s,'south',needy.id); continue; }
        man.createFormation(s,'south','busan'); continue;
      }
      man.nationalDraft(s,'south');
    }
    for (const u of Object.values(s.units)) if (u.side==='south' && u.order && u.order.issuedTurn===s.turn) u.order=null;
    planAIOrders(s,'south', (s.flags.plaIntervened||s.date<'1950-09-15')?'defense':'offense');
    for (const u of Object.values(s.units)) if (u.side==='south'&&u.order) u.order.issuedTurn=s.turn;
    endTurn(s);
  }
  const f = forceStats(s,'south'); const st = s.nations.south.stats;
  res.push(`seed ${seed}: ${s.outcome.result} ${s.outcome.title} score=${s.outcome.score?.total} T${s.turn} mob@T${mobTurn} units=${f.units}(사단${f.divisions}) avail=${f.available} auth=${f.authorized} killed=${st.killed} wounded=${st.wounded} ret=${st.returned} missing=${st.missing} destroyed=${st.unitsDestroyed} N-str=${Object.values(s.units).filter(u=>u.side==='north').reduce((a,u)=>a+u.strength,0)}`);
}
console.log(res.join('\n'));
