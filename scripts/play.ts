/**
 * 글자만으로 한 턴씩 진행하는 플레이 도구 (AI 플레이테스트용).
 * 사용:  npx vite-node scripts/play.ts <명령> [인자...]
 * 상태는 .playtest/state.json 에 저장되어 명령 사이에 이어진다. 처음에는 `help` 를 실행한다.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { createGame } from '../src/game/engine';
import { endTurn } from '../src/game/turn';
import { cancelOrder, issueOrder, attackableTargets, reachableTargets } from '../src/game/orders';
import { resolveEvent } from '../src/game/events';
import * as eco from '../src/game/economy';
import * as man from '../src/game/manpower';
import { buildDepot, removeDepot } from '../src/game/supply';
import { POLICIES, usePolicy } from '../src/game/policies';
import { deserialize, serialize } from '../src/game/save';
import { EVENT_BY_ID } from '../src/data/events';
import { NARRATIVES, describeEffects, situationLines } from '../src/data/eventNarrative';
import { endingFor } from '../src/data/endings';
import { needsRest, unitsAt } from '../src/game/units';
import { MAP } from '../src/game/map';
import { formatDate, turnDaysFor } from '../src/game/util';
import { crossGate, declareCross, declareHalt } from '../src/game/china';
import { warFrontStatus } from '../src/game/overview';
import { supplyBalance } from '../src/game/economy';
import { weatherAt } from '../src/game/weather';
import { totalStrength } from '../src/game/units';
import { forceStats } from '../src/game/casualty';
import type { Difficulty, GameState, OrderType, Unit } from '../src/game/types';

const DIR = '.playtest';
const FILE = `${DIR}/state.json`;
const LOG = `${DIR}/log.jsonl`;
const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');
const out: string[] = [];
const say = (s = '') => out.push(s);

function load(): GameState {
  if (!existsSync(FILE)) throw new Error('진행 중인 게임이 없습니다. 먼저 `new [easy|normal|hard] [시드]` 를 실행하세요.');
  const s = deserialize(readFileSync(FILE, 'utf-8'));
  if (!s) throw new Error('저장된 게임을 읽을 수 없습니다. `new` 로 새로 시작하세요.');
  return s;
}
function save(s: GameState) {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, serialize(s));
}
function log(kind: string, s: GameState, extra: unknown = {}) {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
  appendFileSync(LOG, JSON.stringify({ kind, turn: s.turn, date: s.date, ...((extra as object) ?? {}) }) + '\n');
}

const pname = (s: GameState, id: string) => `${s.provinces[id]?.name ?? id}(${id})`;
const side = (s: GameState) => s.playerSide;

function unitLine(s: GameState, u: Unit): string {
  const o = u.order ? ` ▶${u.order.type}${u.order.target ? ':' + pname(s, u.order.target) : ''}` : '';
  const flags = [needsRest(u) ? '휴식필요' : '', (u.encircledTurns ?? 0) > 0 ? `포위${u.encircledTurns}턴` : '', !s.provinces[u.location].supplied ? '보급단절' : ''].filter(Boolean).join(',');
  return `  ${u.id} ${u.name} [${u.echelon === 'division' ? '사단' : '여단'}/${u.kind}] @${pname(s, u.location)} 병력 ${fmt(u.strength)}/${fmt(u.maxStrength)}(부상 ${fmt(u.wounded)}) 훈련 ${Math.round(u.training)} 경험 ${Math.round(u.experience)} 사기 ${Math.round(u.morale)} 조직 ${Math.round(u.organization)} 피로 ${Math.round(u.fatigue)} 보급 ${Math.round(u.supply)}${flags ? ' {' + flags + '}' : ''}${o}`;
}

function status(s: GameState) {
  const me = s.nations[side(s)];
  const d = s.diplomacy;
  const wx = weatherAt(s.date);
  const bal = supplyBalance(s, side(s));
  const fs = warFrontStatus(s);
  say(`■ ${formatDate(s.date)} · 턴 ${s.turn} (1턴=${turnDaysFor(s.date)}일) · 난이도 ${s.difficulty} · 날씨 ${wx.label}`);
  say(`  병력 ${fmt(totalStrength(s, side(s)))} · 보급자원 ${fmt(me.supplyStock)}(하루 ${bal.net >= 0 ? '+' : ''}${bal.net.toFixed(1)}) · 행정점수(CP) ${me.commandPoints} · 국민지지 ${Math.round(me.popularSupport)} · 전쟁수행능력 ${me.warCapacity} · 전쟁피로 ${Math.round(s.warWeariness)}`);
  say(`  미국개입 ${Math.round(d.usCommitment)} · UN지지 ${Math.round(d.unSupport)} · 훈련병 ${fmt(me.trainees.count)}명(훈련도 ${Math.round(me.trainees.training)}) · UN보충풀 ${fmt(me.replacementPool)}`);
  say(`  아군 지역 ${Object.values(s.provinces).filter((p) => p.owner === side(s)).length}/${Object.values(s.provinces).filter((p) => !p.external).length} · 38선: ${fs.china.chip.label} ${fs.china.chip.value}${fs.armistice ? ` · ${fs.armistice.chip.label} ${fs.armistice.chip.value}` : ''}`);
  for (const l of fs.china.lines) say(`  · ${l}`);
  if (s.outcome) say(`★ 게임 종료: ${s.outcome.title} (${s.outcome.result === 'victory' ? '승리' : '패배'}${s.outcome.grade !== '-' ? ' 등급 ' + s.outcome.grade : ''})`);
}

function showEvents(s: GameState) {
  if (!s.pendingEvents.length) return;
  say('');
  say(`⚠ 결정/확인할 사건 ${s.pendingEvents.length}건 (끝내려면 모두 처리해야 턴을 넘길 수 있습니다):`);
  for (const p of s.pendingEvents) {
    const ev = EVENT_BY_ID[p.eventId];
    const nar = NARRATIVES[p.eventId];
    say(`── [${p.eventId}] ${ev.title}`);
    for (const para of nar?.paragraphs ?? [ev.description]) say('   ' + para);
    for (const l of situationLines(s, p.eventId)) say(`   · ${l}`);
    const fx = describeEffects(ev.effects, s).map((e) => e.text);
    if (fx.length) say(`   즉시 반영: ${fx.join(' / ')}`);
    if (ev.choices.length) {
      say('   선택지: `choose <사건id> <선택id>`');
      for (const c of ev.choices) say(`    - ${c.id}: ${c.label} — ${c.description} ${describeEffects(c.effects, s).map((e) => '[' + e.text + ']').join('')}`);
    } else say(`   확인: \`choose ${p.eventId}\``);
  }
}

function front(s: GameState) {
  const me = side(s);
  say('■ 전선(아군 지역 중 적 지역과 맞닿은 곳). 형식: 지역 | 아군 부대 수 | 인접 적 지역(적 부대 수)');
  const rows: string[] = [];
  for (const p of Object.values(s.provinces)) {
    if (p.owner !== me || p.external) continue;
    const enemyN = MAP.adjacency[p.id].filter((n) => s.provinces[n].owner !== me && !s.provinces[n].external);
    if (!enemyN.length && !unitsAt(s, p.id, me === 'south' ? 'north' : 'south').length) continue;
    const mine = unitsAt(s, p.id, me).length;
    const foes = enemyN.map((n) => `${s.provinces[n].name}(${unitsAt(s, n, me === 'south' ? 'north' : 'south').length})`).join(', ');
    rows.push(`  ${p.name}(${p.id}) 가치${p.strategicValue} ${p.terrain} 방어시설${p.fortification} ${p.supplied ? '' : '[보급단절]'} | 아군 ${mine} | → ${foes}`);
  }
  for (const r of rows) say(r);
  const inChina = unitsAt(s, 'china').length;
  if (inChina) say(`  (중국 영내 중공군 ${inChina}개 사단급 — 참전 전에는 움직이지 않고, 참전 후 압록강 너머에서 직접 공격할 수 있음)`);
}

function parseUnits(s: GameState, arg: string): string[] {
  // "S001,S002" 또는 "@지역id"(그 지역의 명령 가능한 아군 부대 전부) 또는 "@지역id:N"(앞의 N개)
  if (arg.startsWith('@')) {
    const [pid, n] = arg.slice(1).split(':');
    const ids = unitsAt(s, pid, side(s)).filter((u) => !(u.order && u.order.issuedTurn === s.turn)).map((u) => u.id);
    return n ? ids.slice(0, Number(n)) : ids;
  }
  return arg.split(',').filter(Boolean);
}

function order(s: GameState, type: OrderType, unitsArg: string, target?: string) {
  const ids = parseUnits(s, unitsArg);
  if (!ids.length) return say('명령할 부대가 없습니다. (이미 명령을 받았거나 아군 부대가 없음)');
  if (type === 'attack' && target) {
    const g = crossGate(s, side(s), target);
    if (g?.kind === 'warn') {
      say('⚠ [중국의 경고] 원래 북한 영토(38선 이북)를 처음 공격하려 합니다. 명령은 보류되었습니다.');
      say('  선택: `cross yes <부대> <목표>` → 월경(중공군 집결 시작, 정해진 시간 뒤 참전) / `cross no` → 38선에서 멈춤(56일간 월경 금지, 이후 최종 결정)');
      say(`  (이번 명령: 부대 ${unitsArg} → ${target})`);
      return;
    }
  }
  let ok = 0;
  for (const id of ids) {
    const r = issueOrder(s, id, type, target);
    if (r.ok) ok++;
    else say(`  ✗ ${id}: ${r.reason}`);
  }
  say(`${ok}/${ids.length}개 부대에 ${type}${target ? ' → ' + pname(s, target) : ''} 명령.`);
}

function briefing(s: GameState) {
  say(`── 지난 턴 요약`);
  for (const l of s.briefing.slice(0, 14)) say('  ' + l);
  if (s.briefing.length > 14) say(`  … 외 ${s.briefing.length - 14}줄 (\`briefing\` 으로 전체 보기)`);
  const wins = s.reports.length;
  if (wins) {
    say(`── 전투 ${wins}건`);
    for (const r of s.reports.slice(0, 12)) {
      const ours = r.attackerSide === side(s);
      const won = (r.outcome === 'attacker_win') === ours;
      say(`  ${r.provinceName}: ${ours ? '아군 공격' : '적 공격'} → ${r.outcome === 'draw' ? '교착' : won ? '아군 승' : '아군 패'}${r.captured ? '(점령 변경)' : ''} · 손실 아군 ${fmt(ours ? r.attackerLosses : r.defenderLosses)} / 적 ${fmt(ours ? r.defenderLosses : r.attackerLosses)}`);
    }
  }
}

const HELP = `
[플레이 도구 명령]  (모든 명령: npx vite-node scripts/play.ts <명령> ...)
 new [easy|normal|hard] [시드]   새 게임 시작 (기본 normal, 시드 무작위)
 status                          현재 상황(날짜·병력·보급·지지·38선/협상 상태)
 events                          처리해야 할 사건(이벤트)과 선택지 보기
 choose <사건id> [선택id]        사건 처리 (선택지가 없으면 선택id 생략)
 front                           전선 요약(아군 지역·인접 적 지역·부대 수)
 units [지역id]                  아군 부대 목록 (지역을 주면 그 지역만)
 enemies [지역id]                적 부대 목록
 province <지역id>               지역 상세(소유·지형·보급·인접)
 targets <부대id>                그 부대가 공격 가능한 지역 / 이동 가능한 지역
 attack <부대|@지역[:N]> <목표>   공격 (같은 목표를 여러 부대가 함께 공격하면 유리)
 move <부대|@지역[:N]> <목표>     이동 (아군 지역만 통과)
 defend|rest|train <부대|@지역>   방어선 강화 / 휴식 / 훈련 (한 턴 지속)
 cancel <부대>                   명령 취소
 cross yes <부대> <목표>         38선 경고에서 월경 / cross no  멈춤 / cross final yes|armistice  (최종 결정은 사건 선택지로)
 draft | traintrainees | reinforce <부대> | create <지역> | fortify <지역> | repair <지역> | depot <지역> [remove]
 policy <정책id>                 정책 (policies 로 목록)
 policies                        정책 목록
 end                             턴 종료 (결과 요약 + 새 사건 표시)
 briefing                        직전 턴 전체 브리핑
 report                          지금까지의 기록 요약(플레이테스트 보고서용)
 note <메모>                     플레이 중 발견한 문제를 기록(.playtest/notes.md)
 map                             전체 지역 소유 한눈에 보기

팁: 명령(attack 등)은 턴 종료 전까지 쌓이고, end 를 하면 한꺼번에 실행됩니다. 사건이 남아 있으면 end 가 거부됩니다.
`;

function main() {
  const [cmd = 'help', ...a] = process.argv.slice(2);
  try {
    if (cmd === 'help') return say(HELP);
    if (cmd === 'new') {
      const diff = (['easy', 'normal', 'hard'].includes(a[0]) ? a[0] : 'normal') as Difficulty;
      const seed = Number(a[1] ?? a[0]) || Math.floor(Math.random() * 1e9);
      const s = createGame(seed, diff);
      save(s);
      writeFileSync(LOG, '');
      writeFileSync(`${DIR}/notes.md`, ''); // 새 판을 시작하면 이전 메모는 비운다
      log('new', s, { seed, difficulty: diff });
      say(`새 게임 (난이도 ${diff}, 시드 ${seed})`);
      status(s);
      showEvents(s);
      return;
    }
    const s = load();
    const me = side(s);
    switch (cmd) {
      case 'status': status(s); showEvents(s); break;
      case 'events': showEvents(s); if (!s.pendingEvents.length) say('처리할 사건이 없습니다.'); break;
      case 'choose': {
        const [id, ch] = a;
        const r = resolveEvent(s, id, ch);
        if (!r.ok) say(`✗ ${r.reason}`);
        else { say(`처리했습니다: ${id}${ch ? ' → ' + ch : ''}`); log('choose', s, { id, ch }); }
        if (s.pendingEvents.length) say(`남은 사건 ${s.pendingEvents.length}건 (\`events\`)`);
        break;
      }
      case 'front': front(s); break;
      case 'map': {
        const rows = Object.values(s.provinces).filter((p) => !p.external).map((p) => `${p.name}(${p.id}):${p.owner === 'south' ? '남' : '북'}${p.initialOwner !== p.owner ? '*' : ''}`);
        say('(* = 시작 때와 소유가 바뀐 곳)'); say(rows.join('  '));
        break;
      }
      case 'units': {
        const list = Object.values(s.units).filter((u) => u.side === me && (!a[0] || u.location === a[0]));
        say(`아군 부대 ${list.length}개`);
        for (const u of list) say(unitLine(s, u));
        break;
      }
      case 'enemies': {
        const list = Object.values(s.units).filter((u) => u.side !== me && (!a[0] || u.location === a[0]));
        say(`적 부대 ${list.length}개`);
        for (const u of list) say(unitLine(s, u));
        break;
      }
      case 'province': {
        const p = s.provinces[a[0]];
        if (!p) { say('없는 지역 id 입니다. `map` 으로 id 를 확인하세요.'); break; }
        say(`${p.name}(${p.id}) 소유 ${p.owner} · ${p.terrain} · 가치 ${p.strategicValue} · 인구 ${fmt(p.population)} · 산업 ${Math.round(p.industrialCapacity)} · 기반시설 ${Math.round(p.infrastructure)} · 전쟁피해 ${Math.round(p.warDamage)} · 안정도 ${Math.round(p.controlStability)} · 방어시설 ${p.fortification} · 보급 ${p.supplied ? Math.round(p.supplyLevel) : '단절'}`);
        say(`  인접: ${MAP.adjacency[p.id].map((n) => `${s.provinces[n].name}(${n}:${s.provinces[n].owner === 'south' ? '남' : '북'})`).join(', ')}`);
        say(`  주둔: 아군 ${unitsAt(s, p.id, 'south').length} / 북·중 ${unitsAt(s, p.id, 'north').length}`);
        break;
      }
      case 'targets': {
        const u = s.units[a[0]];
        if (!u) { say('없는 부대입니다.'); break; }
        say(`${u.name} 공격 가능: ${attackableTargets(s, u).map((t) => pname(s, t)).join(', ') || '없음'}`);
        say(`이동 가능(경로 비용순): ${reachableTargets(s, u).sort((x, y) => x.cost - y.cost).slice(0, 14).map((t) => `${pname(s, t.id)}(${t.turns}턴)`).join(', ')}`);
        break;
      }
      case 'attack': order(s, 'attack', a[0], a[1]); break;
      case 'move': order(s, 'move', a[0], a[1]); break;
      case 'defend': order(s, 'defend', a[0]); break;
      case 'rest': order(s, 'rest', a[0]); break;
      case 'train': order(s, 'train', a[0]); break;
      case 'cancel': for (const id of parseUnits(s, a[0])) cancelOrder(s, id); say('취소했습니다.'); break;
      case 'cross': {
        if (a[0] === 'no') { declareHalt(s); say('38선에서 멈춥니다. 56일간 월경이 금지되고, 끝나면 최종 결정 사건이 뜹니다.'); log('cross', s, { choice: 'halt' }); break; }
        if (a[0] === 'yes') {
          declareCross(s);
          log('cross', s, { choice: 'cross' });
          say('38선을 넘기로 했습니다. 중공군이 압록강 너머에 집결하기 시작합니다.');
          if (a[1] && a[2]) order(s, 'attack', a[1], a[2]);
          break;
        }
        say('사용법: cross yes <부대> <목표> | cross no');
        break;
      }
      case 'draft': say(man.nationalDraft(s, me).reason ?? '징집'); break;
      case 'traintrainees': say(man.trainTrainees(s, me).reason ?? '훈련병 훈련'); break;
      case 'reinforce': { const r = man.reinforceFromPool(s, me, a[0]); say(r.ok ? (r.reason ?? '보충') : `✗ ${r.reason}`); break; }
      case 'create': { const r = man.createFormation(s, me, a[0]); say(r.ok ? (r.reason ?? '창설') : `✗ ${r.reason}`); break; }
      case 'fortify': { const r = eco.fortify(s, me, a[0]); say(r.ok ? '방어시설 강화' : `✗ ${r.reason}`); break; }
      case 'repair': { const r = eco.repairInfrastructure(s, me, a[0]); say(r.ok ? '복구' : `✗ ${r.reason}`); break; }
      case 'depot': { const r = a[1] === 'remove' ? removeDepot(s, me, a[0]) : buildDepot(s, me, a[0]); say(r.ok ? (r.reason ?? '완료') : `✗ ${r.reason}`); break; }
      case 'policies':
        for (const p of POLICIES.filter((x) => !x.hidden?.(s))) say(`  ${p.id}: ${p.name} (CP ${p.cost}, 재사용 ${p.cooldownTurns}턴) — ${p.description}`);
        break;
      case 'policy': { const r = usePolicy(s, me, a[0]); say(r.ok ? (r.reason ?? '시행했습니다.') : `✗ ${r.reason}`); if (r.ok) log('policy', s, { id: a[0] }); break; }
      case 'end': {
        if (s.pendingEvents.length) { say('✗ 먼저 사건을 처리하세요.'); showEvents(s); break; }
        const before = { cas: s.nations.south.casualties, prov: Object.values(s.provinces).filter((p) => p.owner === me).length };
        const r = endTurn(s);
        if (!r.ok) { say(`✗ ${r.reason}`); break; }
        log('end', s, { support: Math.round(s.nations.south.popularSupport), weariness: Math.round(s.warWeariness), strength: totalStrength(s, me), prov: Object.values(s.provinces).filter((p) => p.owner === me).length, stock: Math.round(s.nations.south.supplyStock), casDelta: s.nations.south.casualties - before.cas });
        briefing(s);
        say('');
        status(s);
        showEvents(s);
        if (s.outcome) {
          const e = endingFor(s.outcome, s);
          say('');
          say(`══ 엔딩: ${e.title} ══`);
          for (const p of e.paragraphs) say('  ' + p);
          for (const rs of s.outcome.reasons) say(`  - ${rs}`);
          if (s.outcome.score) say(`  종합 점수 ${s.outcome.score.total}/100 (병력 ${s.outcome.score.remainingForce.toFixed(1)} · 영토 ${s.outcome.score.territory.toFixed(1)} · 지지 ${s.outcome.score.popularSupport.toFixed(1)} · 피해 ${s.outcome.score.warDamage.toFixed(1)} · 손실 -${s.outcome.score.casualtyPenalty.toFixed(1)} · 보너스 +${s.outcome.score.bonus})`);
        }
        break;
      }
      case 'briefing': for (const l of s.briefing) say('  ' + l); break;
      case 'note': {
        if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
        appendFileSync(`${DIR}/notes.md`, `- [${formatDate(s.date)} 턴${s.turn}] ${a.join(' ')}\n`);
        say('메모했습니다.');
        break;
      }
      case 'report': {
        const rows = readFileSync(LOG, 'utf-8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
        const ends = rows.filter((r) => r.kind === 'end');
        say(`진행한 턴 ${ends.length} · 현재 ${formatDate(s.date)} · 이벤트 ${s.firedEvents.length}개 발동: ${s.firedEvents.join(', ')}`);
        say('시점별 (턴 | 날짜 | 지지 | 피로 | 병력 | 아군 지역 | 보급자원):');
        for (let i = 0; i < ends.length; i += Math.max(1, Math.floor(ends.length / 14))) { const r = ends[i]; say(`  T${r.turn} ${r.date} | ${r.support} | ${r.weariness} | ${fmt(r.strength)} | ${r.prov} | ${r.stock}`); }
        const fs = forceStats(s, me);
        say(`현재 부대: 여단 ${fs.brigades} · 사단 ${fs.divisions}`);
        if (s.outcome) say(`결과: ${s.outcome.title}`);
        if (existsSync(`${DIR}/notes.md`)) { say('--- 메모 ---'); say(readFileSync(`${DIR}/notes.md`, 'utf-8')); }
        break;
      }
      default:
        say(`알 수 없는 명령: ${cmd}`);
        say(HELP);
    }
    save(s);
  } catch (e) {
    say(`오류: ${(e as Error).message}`);
  }
}

main();
console.log(out.join('\n'));
