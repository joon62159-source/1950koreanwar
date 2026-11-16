import type { BattleReport, GameState, Side } from './types';
import { weatherAt } from './weather';
import { formatDate, turnDaysFor, addDays } from './util';
import { DIFFICULTY } from './balance';
import type { SceneKind } from '../components/EventScene';

/** 한글 단어 끝 글자에 받침이 있는지 */
const hasJong = (w: string) => {
  const c = w.charCodeAt(w.length - 1);
  return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
};
const iga = (w: string) => w + (hasJong(w) ? '이' : '가');
const eunneun = (w: string) => w + (hasJong(w) ? '은' : '는');
const eulreul = (w: string) => w + (hasJong(w) ? '을' : '를');
const pick = <T,>(arr: T[], n: number) => arr[Math.abs(n) % arr.length];
const num = (n: number) => Math.round(n).toLocaleString('ko-KR');
const round100 = (n: number) => (n < 100 ? Math.round(n / 10) * 10 : Math.round(n / 100) * 100);

export interface NewsArticle {
  title: string;
  body: string;
}

export interface Newspaper {
  masthead: string;
  issue: number;
  dateLine: string;
  kicker: string;
  headline: string;
  subhead: string;
  scene: SceneKind;
  lead: string[];
  articles: NewsArticle[];
  brief: string[];
  stats: { label: string; value: string }[];
}

interface Capture {
  id: string;
  name: string;
  to: Side;
  strategic: number;
  restored: boolean;
}

/** 이번 턴 기록(전투·점령)과 브리핑에서 신문 한 부를 만든다. 문장은 템플릿이며, 수치는 모두 실제 게임 결과다. */
export function buildNewspaper(state: GameState): Newspaper {
  const me: Side = state.playerSide;
  const foe: Side = me === 'south' ? 'north' : 'south';
  const turn = state.turn;
  const days = turnDaysFor(addDays(state.date, -1)); // 방금 끝난 턴의 일수 근사
  const steps = state.lastTurn?.steps ?? [];

  // 점령·함락 (이번 턴에 지배가 바뀐 지역, 전략가치 순)
  const captures: Capture[] = [];
  const seen = new Set<string>();
  for (const st of steps) {
    for (const c of st.ownerChanges) {
      if (seen.has(c.province)) continue;
      seen.add(c.province);
      const p = state.provinces[c.province];
      if (!p || p.external) continue;
      captures.push({ id: p.id, name: p.name, to: c.to, strategic: p.strategicValue, restored: p.initialOwner === c.to });
    }
  }
  captures.sort((a, b) => b.strategic - a.strategic);
  const gained = captures.filter((c) => c.to === me);
  const lost = captures.filter((c) => c.to === foe);

  // 전투 정리
  const ours = (r: BattleReport) => (r.attackerSide === me ? { loss: r.attackerCasualty, foe: r.defenderCasualty, myUnits: r.attackerUnits.length, foeUnits: r.defenderUnits.length } : { loss: r.defenderCasualty, foe: r.attackerCasualty, myUnits: r.defenderUnits.length, foeUnits: r.attackerUnits.length });
  const won = (r: BattleReport) => (r.outcome === 'attacker_win') === (r.attackerSide === me);
  const weight = (r: BattleReport) => r.attackerLosses + r.defenderLosses + (r.captured ? 800 : 0);
  const battles = [...state.reports].sort((a, b) => weight(b) - weight(a));
  const top = battles[0];
  const topInfo = top ? ours(top) : null;
  const gone = state.briefing.filter((l) => l.startsWith('【전멸】'));
  const ring = state.briefing.find((l) => l.startsWith('【포위】'));
  const cutLine = state.briefing.find((l) => l.startsWith('【보급】'));

  // 헤드라인
  let headline = '';
  let subhead = '';
  let scene: SceneKind = 'convoy';
  const bigGain = gained.find((c) => c.strategic >= 7);
  const bigLoss = lost.find((c) => c.strategic >= 7);
  if (bigLoss && (!bigGain || bigLoss.strategic >= bigGain.strategic)) {
    headline = pick([`${bigLoss.name} 함락… 전선 크게 흔들려`, `${iga(bigLoss.name)} 적의 손에 넘어갔다`, `비보: ${bigLoss.name} 상실, 방어선 재편 불가피`], turn);
    subhead = `${bigLoss.name}의 전략적 가치는 ${bigLoss.strategic}/10. 정부는 후속 대책을 서두르고 있다.`;
    scene = 'empty_capital';
  } else if (bigGain) {
    const verb = bigGain.restored ? '수복' : '점령';
    headline = pick([`${bigGain.name} ${verb}! 아군 진격`, `${eulreul(bigGain.name)} ${verb}했다 — 전선 북상`, `${bigGain.name}에 아군 깃발`], turn);
    subhead = `${bigGain.name}의 전략적 가치는 ${bigGain.strategic}/10. ${gained.length > 1 ? `이번 주기 아군이 되찾거나 확보한 지역은 모두 ${gained.length}곳.` : '시민들은 환영 속에 아군을 맞았다.'}`;
    scene = 'flag_raise';
  } else if (lost.length > 0) {
    const c = lost[0];
    headline = pick([`${eulreul(c.name)} 내주고 후퇴`, `${c.name} 방면 방어선 무너져`, `${iga(c.name)} 적에게 넘어가…`], turn);
    subhead = `이번 주기 상실한 지역은 ${lost.length}곳. 전선은 재정비에 들어갔다.`;
    scene = 'railway_retreat';
  } else if (gained.length > 0) {
    const c = gained[0];
    headline = pick([`${eulreul(c.name)} ${c.restored ? '수복' : '확보'}, 전선 한 걸음 전진`, `아군, ${c.name}에 진입`], turn);
    subhead = `이번 주기 확보한 지역은 ${gained.length}곳이다.`;
    scene = 'advance';
  } else if (top && topInfo) {
    if (won(top)) {
      headline = pick([`${top.provinceName} 격전 끝에 적 저지`, `${top.provinceName}에서 적 공세 꺾어`, `아군, ${top.provinceName} 전투서 승리`], turn);
      scene = 'victory_street';
    } else if (top.outcome === 'draw') {
      headline = pick([`${top.provinceName} 일대 일진일퇴`, `${top.provinceName}, 승부 가리지 못한 채 대치`], turn);
      scene = 'trench';
    } else {
      headline = pick([`${top.provinceName} 방면 고전… 아군 손실 커`, `${top.provinceName} 전투 패퇴, 방어선 흔들`], turn);
      scene = 'hilltop';
    }
    subhead = `${top.provinceName} 전투에서 아군 전사 ${num(round100(topInfo.loss.killed))}명, 적 전사 ${num(round100(topInfo.foe.killed))}명으로 집계됐다.`;
  } else {
    headline = pick(['전선, 숨 고르기… 양측 재정비', '포성 멎은 전선, 다음 공세 준비', '조용한 한 주, 그러나 긴장은 계속'], turn);
    subhead = '큰 교전 없이 한 주기가 지났다. 병력과 보급을 정비할 기회다.';
    scene = 'convoy';
  }

  // 머리기사 본문
  const lead: string[] = [];
  if (top && topInfo) {
    const att = top.attackerSide === me ? '아군' : '적';
    const result = won(top) ? (top.captured && top.attackerSide === me ? '지역을 점령했다' : '방어에 성공했다') : top.outcome === 'draw' ? '승부를 내지 못했다' : top.captured ? '방어선이 뚫렸다' : '밀려났다';
    lead.push(`${top.provinceName} 방면에서 ${eunneun(att)} ${top.attackerUnits.length}개 부대로 공격에 나섰고, ${top.defenderUnits.length}개 부대가 이를 막았다. 교전의 결과 아군은 ${result}. 아군 부대 ${topInfo.myUnits}개가 투입됐으며 전사 ${num(round100(topInfo.loss.killed))}명, 실종·포로 ${num(round100(topInfo.loss.missing))}명의 피해를 입었다. 적은 전사 ${num(round100(topInfo.foe.killed))}명으로 집계된다.`);
  } else if (captures.length) {
    const c = captures[0];
    lead.push(`${eulreul(c.name)} 둘러싼 지배권이 ${c.to === me ? '아군' : '적'}에게 넘어갔다. 큰 교전 없이 이루어진 이동이어서 양측의 인명 피해는 크지 않은 것으로 보인다.`);
  } else {
    lead.push('양측 모두 대규모 공격을 감행하지 않았다. 일선 부대는 진지를 보강하고 보급을 받으며 다음 움직임을 기다리고 있다.');
  }
  const wx = weatherAt(state.date);
  const sitBits: string[] = [];
  if (gone.length) sitBits.push(`일부 부대는 후퇴로가 막혀 소멸한 것으로 알려졌다(${gone.length}개 부대)`);
  if (ring) sitBits.push('포위된 아군 부대가 있어 구출이 시급하다');
  else if (cutLine) sitBits.push('보급선이 끊긴 부대가 있어 전투력 저하가 우려된다');
  if (wx.id !== 'clear') sitBits.push(`${wx.icon} ${wx.label}의 영향으로 이동과 보급이 평소보다 더디다`);
  if (state.nations[me].supplyStock < 80) sitBits.push('국가 보급 자원이 바닥을 보이고 있다');
  if (sitBits.length) lead.push(sitBits.join(' — ') + '.');

  // 다른 기사: 나머지 전투 요약 (최대 3건)
  const articles: NewsArticle[] = [];
  for (const r of battles.slice(1, 4)) {
    const i = ours(r);
    articles.push({
      title: `${r.provinceName}: ${won(r) ? '아군 우세' : r.outcome === 'draw' ? '교착' : '고전'}`,
      body: `${r.attackerSide === me ? '아군 공격' : '적 공격'}으로 시작된 교전. 투입 아군 ${i.myUnits}개 부대, 적 ${i.foeUnits}개 부대. 아군 전사 ${num(round100(i.loss.killed))}명 · 적 전사 ${num(round100(i.foe.killed))}명.`,
    });
  }
  if (captures.length > 1) {
    articles.push({
      title: '지역 변동',
      body: [gained.length ? `확보·수복: ${gained.slice(0, 5).map((c) => c.name).join(', ')}${gained.length > 5 ? ` 외 ${gained.length - 5}곳` : ''}` : '', lost.length ? `상실: ${lost.slice(0, 5).map((c) => c.name).join(', ')}${lost.length > 5 ? ` 외 ${lost.length - 5}곳` : ''}` : ''].filter(Boolean).join(' / '),
    });
  }

  // 단신: 후방 소식 (브리핑의 증원·보충·원조·협상)
  const brief = state.briefing
    .filter((l) => /^【(증원|UN군 보충|UN 장비 지원|정전협상)】/.test(l))
    .map((l) => l.replace(/^【[^】]+】\s*/, ''))
    .slice(0, 4);
  if (wx.id !== 'clear') brief.push(`${wx.icon} ${wx.label}: ${wx.blurb}`);

  const st = state.nations[me];
  const strength = Object.values(state.units).filter((u) => u.side === me).reduce((a, u) => a + u.strength, 0);
  const stats = [
    { label: '아군 병력', value: num(strength) },
    { label: '보급 자원', value: num(st.supplyStock) },
    { label: '국민 지지', value: String(Math.round(st.popularSupport)) },
    { label: '전쟁수행능력', value: String(st.warCapacity) },
  ];

  return {
    masthead: '전선일보',
    issue: turn,
    dateLine: formatDate(state.date),
    kicker: `${wx.icon} ${wx.label} · 지난 ${days}일의 전황 · 난이도 ${DIFFICULTY[state.difficulty ?? 'normal'].label}`,
    headline,
    subhead,
    scene,
    lead,
    articles,
    brief,
    stats,
  };
}
