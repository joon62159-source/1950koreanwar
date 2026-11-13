import { useGame } from '../store/gameStore';
import { POLICIES } from '../game/policies';
import { currentPhase } from '../game/ai';
import { totalStrength } from '../game/units';
import { Bar, colorFor, fmt, Stat } from './common';
import type { GameState } from '../game/types';

const PHASE_TEXT: Record<string, { title: string; body: string }> = {
  blitz: { title: '1950년 6월~7월 · 압도적 열세', body: '북한군의 기습·기갑·화력 우위가 압도적입니다. 정면 사수보다 병력을 보존하며 지연전을 펼치세요. 서울을 끝까지 사수하면 주력이 포위될 수 있습니다.' },
  naktong: { title: '1950년 8월~9월 · 낙동강 방어전', body: '미군 증원이 도착하고 있지만 북한군은 여러 축선에서 돌파를 노립니다. 기동 예비대를 어디에 투입할지가 승패를 가릅니다.' },
  counter: { title: '1950년 9월~ · 반격과 북진', body: '북한군의 보급선이 흔들립니다. 하지만 과도한 북진은 보급 부담과 중국 개입 위험을 키웁니다.' },
  chinese: { title: '1950년 10월~ · 중국군 참전', body: '압도적인 중국군 병력이 야간 공격·침투·측면 포위로 밀려옵니다. 하지만 포·대전차·보급이 약합니다. 지연전, 지형, 포병·항공 지원, 보급선 공격으로 막으세요.' },
  stalemate: { title: '1951년 6월~ · 교착기와 정전협상', body: '참호전과 고지전이 이어집니다. 전쟁 피로도가 쌓이고 협상이 진행됩니다. 군사적 승리가 곧 국가 이익은 아닙니다.' },
};

function objectives(g: GameState) {
  const own = (id: string) => g.provinces[id].owner === g.playerSide;
  const list: { text: string; state: 'ok' | 'warn' | 'bad' | 'info' }[] = [];
  list.push({ text: '부산 사수 (패배 조건)', state: own('busan') ? 'ok' : 'bad' });
  list.push({ text: '병력 보존 — 부대를 정면에서 소모시키지 말 것', state: totalStrength(g, g.playerSide) > g.initialTotals.southStrength * 0.7 ? 'ok' : 'warn' });
  list.push({ text: '대구·대전 등 주요 거점 유지', state: own('daegu') && own('daejeon') ? 'ok' : own('daegu') ? 'warn' : 'bad' });
  const cut = Object.values(g.units).filter((u) => u.side === g.playerSide && !g.provinces[u.location].supplied).length;
  if (cut) list.push({ text: `보급 단절 부대 ${cut}개 구제`, state: 'bad' });
  if (!g.flags.incheonPlan && g.date >= '1950-08-12') list.push({ text: '상륙작전 계획 결정 대기', state: 'info' });
  if (g.flags.counteroffensive) list.push({ text: '서울 수복 · 북한군 보급선 차단', state: own('seoul') ? 'ok' : 'info' });
  if (g.diplomacy.chinaThreat >= 50) list.push({ text: '중국 개입 위험 관리', state: 'warn' });
  return list;
}

export default function LeftPanel() {
  const game = useGame((s) => s.game);
  const policy = useGame((s) => s.policy);
  const setFog = useGame((s) => s.setFog);
  const me = game.nations[game.playerSide];
  const phase = currentPhase(game);
  const txt = PHASE_TEXT[phase];
  const units = Object.values(game.units).filter((u) => u.side === game.playerSide);
  const avg = (f: (u: (typeof units)[number]) => number) => (units.length ? units.reduce((a, u) => a + f(u) * u.strength, 0) / units.reduce((a, u) => a + u.strength, 0) : 0);
  return (
    <aside data-tour="left" className="panel flex w-[250px] shrink-0 flex-col gap-3 overflow-y-auto border-y-0 border-l-0 p-3">
      <section>
        <div className="panel-title mb-1">▍전황 개요</div>
        <div className="rounded border border-ink-600 bg-ink-800/60 p-2">
          <div className="text-[12px] font-bold text-brass">{txt.title}</div>
          <p className="mt-1 text-[11.5px] leading-[1.45] text-slate-300">{txt.body}</p>
        </div>
      </section>

      <section>
        <div className="panel-title mb-1">▍군사 상황</div>
        <Stat label="행정 점수 (명령권)" value={<b className="text-brass">{me.commandPoints}</b>} />
        <Stat label="가용 여단" value={units.length} />
        <Stat label="평균 훈련도" value={avg((u) => u.training).toFixed(0)} />
        <Stat label="평균 사기" value={avg((u) => u.morale).toFixed(0)} />
        <Stat label="평균 보급" value={avg((u) => u.supply).toFixed(0)} />
        <Stat label="누적 인명 손실" value={fmt(me.casualties)} />
        <div className="mt-1"><Bar value={avg((u) => u.supply)} color={colorFor(avg((u) => u.supply))} /></div>
      </section>

      {(game.flags.talks === 'on' || game.warWeariness > 5) && (
        <section>
          <div className="panel-title mb-1">▍정전협상 · 전쟁 피로</div>
          <Stat label="협상 진척도" value={game.flags.talks === 'on' ? `${Math.round(game.armisticeProgress)}%` : '미개시'} />
          {game.flags.talks === 'on' && <Bar value={game.armisticeProgress} color="#c9a24b" />}
          <Stat label="전쟁 피로도" value={Math.round(game.warWeariness)} />
          <Bar value={game.warWeariness} color={colorFor(game.warWeariness, true)} />
        </section>
      )}

      <section>
        <div className="panel-title mb-1">▍표시 설정</div>
        <button className={'btn w-full text-left ' + (game.settings?.fog ? 'btn-blue' : '')} onClick={() => setFog(!game.settings?.fog)} title="정보 표시만 제한합니다. 적의 실제 전투력은 변하지 않습니다.">전장의 안개: {game.settings?.fog ? '켜짐' : '꺼짐 (기본)'}</button>
      </section>

      <section>
        <div className="panel-title mb-1">▍정책 · 외교 (행정 점수 소모)</div>
        <div className="flex flex-col gap-1.5">
          {POLICIES.map((p) => {
            const cd = (me.policyCooldowns[p.id] ?? 0) - game.turn;
            return (
              <button key={p.id} className="btn text-left" disabled={cd > 0 || me.commandPoints < p.cost || !!game.outcome} title={p.description} onClick={() => policy(p.id)}>
                <div className="flex justify-between text-[12px] font-bold"><span>{p.name}</span><span className="text-brass">{cd > 0 ? `${cd}턴 후` : `CP ${p.cost}`}</span></div>
                <div className="text-[10.5px] font-normal leading-tight text-slate-400">{p.description}</div>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="panel-title mb-1">▍당면 과제</div>
        <ul className="flex flex-col gap-1">
          {objectives(game).map((o, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[11.5px]">
              <span className={{ ok: 'text-emerald-400', warn: 'text-amber-300', bad: 'text-red-400', info: 'text-sky-300' }[o.state]}>{{ ok: '●', warn: '▲', bad: '■', info: '◆' }[o.state]}</span>
              <span className="text-slate-300">{o.text}</span>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
