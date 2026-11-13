import type { Effect } from './events';
import type { GameState, Side } from '../game/types';
import type { SceneKind } from '../components/EventScene';
import { MAP } from '../game/map';
import { forceStats, sideTotals } from '../game/casualty';
import { nationalDraftPool } from '../game/manpower';
import { STORY_NARRATIVES } from './eventNarrativeStory';

/**
 * 이벤트 창 연출 데이터 (HOI4식): 장면 그림, 한 줄 제목(kicker), 본문 서술, 인용구.
 * 서술은 게임 속 상황을 몰입감 있게 전하는 이야기이며, 실제 역사 설명·출처는 담지 않는다.
 */
export interface Narrative {
  scene: SceneKind;
  kicker: string;
  paragraphs: string[];
  quote?: { text: string; by: string };
}

export const NARRATIVES: Record<string, Narrative> = {
  kpa_invasion: {
    scene: 'dawn_barrage',
    kicker: '38선, 새벽 4시',
    paragraphs: [
      '안개 낀 임진강 너머에서 불꽃이 일제히 터졌다. 옹진에서 동해안까지, 수백 문의 포가 한꺼번에 어둠을 찢는다. 전방 초소의 전화선은 첫 일제 사격에 끊겼고, 당직 장교는 수화기를 든 채 굳어 있다.',
      '곧 이어 낮고 묵직한 엔진음이 의정부 쪽 도로를 타고 밀려온다. T-34. 대전차포도, 지뢰도, 아군 전차도 없는 전선에서 강철 짐승들은 거침없이 남하한다. 서울은 아직 일요일 아침의 잠에 빠져 있다.',
      '지금 우리에게 필요한 것은 승리가 아니다. 병력을 살려 시간을 버는 것이다.',
    ],
    quote: { text: '정면에서 막으려 들지 마라. 한 걸음 물러설 때마다 한 시간을 벌어라.', by: '전방 사단 참모' },
  },
  unsc_support: {
    scene: 'headquarters',
    kicker: '뉴욕, 밤샘 회의',
    paragraphs: [
      '의사당의 불빛은 새벽까지 꺼지지 않는다. 한 나라가 국경을 넘어 다른 나라를 짓밟았다는 보고가 탁자 위에 쌓인다. 대한민국 대표의 목소리가 떨린다. "우리는 지금 싸우고 있습니다. 시간이 없습니다."',
      '결의안이 통과되었다. 도쿄에서는 수송기의 엔진이 예열되기 시작했다. 아직 지상군은 오지 않는다. 그러나 전쟁의 성격이 바뀌었다 — 이제 이 싸움을 지켜보는 눈이 세계에 있다.',
    ],
  },
  seoul_crisis: {
    scene: 'bridge',
    kicker: '한강, 해질녘',
    paragraphs: [
      '의정부가 무너졌고 북한군 전차의 포탑이 서울 외곽 능선에 모습을 드러냈다. 다리 위는 피난민과 후퇴하는 트럭, 버려진 짐수레로 뒤엉켜 있다. 아이 우는 소리, 경적, 멀리서 들려오는 포성.',
      '공병 장교의 손에는 폭파 스위치가 쥐어져 있다. 다리 너머 북쪽에는 아직 건너오지 못한 우리 부대가 있다. 다리를 살리면 적이 건너온다. 다리를 끊으면 아군이 갇힌다.',
      '서울을 끝까지 지킬 것인가, 병력을 살려 강 남쪽에서 다시 설 것인가.',
    ],
    quote: { text: '명령을 내려 주십시오. 불을 붙이는 건 제 손이지만, 결정하는 건 각하입니다.', by: '공병 장교' },
  },
  un_command: {
    scene: 'port',
    kicker: '부산항, 이른 아침',
    paragraphs: [
      '한 나라의 전쟁이 아니게 되었다. 항구에는 낯선 깃발을 단 수송선이 줄지어 들어오고, 크레인이 쉴 새 없이 상자를 내린다. 처음 보는 철모, 처음 듣는 언어.',
      '통합 사령부 아래 여러 나라의 군대가 모이기 시작한다. 그러나 도착하는 병력은 소수이고, 훈련도 장비도 아직 이 전쟁에 맞춰져 있지 않다. 시간을 버는 자가 이긴다.',
    ],
  },
  us_vanguard: {
    scene: 'port',
    kicker: '선견대',
    paragraphs: [
      '수송기에서 내린 병사들의 얼굴은 앳되다. 대부분 평화로운 점령지 근무에 익숙한 젊은이들이다. 그들 앞에는 전차를 앞세운 노련한 군대가 있다.',
      '지금 이들을 서둘러 최전선에 세워 적의 발을 묶을 것인가, 몇 주를 더 벌어 제대로 된 방어선을 만들게 할 것인가. 선택에 따라 이 청년들 중 몇이 돌아오지 못할지가 달라진다.',
    ],
  },
  walker_stand: {
    scene: 'trench',
    kicker: '낙동강 전선',
    paragraphs: [
      '무전기에서 사령관의 목소리가 흘러나온다. 더는 물러설 곳이 없다는 것, 이 선이 마지막이라는 것. 참호 속의 병사들이 서로를 쳐다본다. 강 건너에서는 하루도 빠짐없이 포성이 울린다.',
      '"한 발짝도 물러서지 마라"는 명령은 병사들의 가슴에 불을 붙일 수도, 퇴로를 잃은 부대를 몰살시킬 수도 있다. 유연하게 물러서며 버틸 것인가, 이 자리를 목숨으로 지킬 것인가.',
    ],
    quote: { text: '이 이상 후퇴는 없다. 죽더라도 이 자리에서 죽는다.', by: '사령관 훈시' },
  },
  naktong_crisis: {
    scene: 'trench',
    kicker: '무너지는 방어선',
    paragraphs: [
      '한 곳을 막으면 다른 곳이 열린다. 야간 정찰 보고가 연이어 들어온다 — 강 남쪽 기슭에 적의 도하 흔적, 능선 뒤에서 늘어나는 전차 엔진음, 끊긴 야전 전화.',
      '예비대는 하나뿐이다. 참모가 지도 위의 세 곳에 압정을 꽂는다. 어디에 이 마지막 카드를 쓸 것인가. 선택하지 않은 두 곳은 스스로 버텨야 한다.',
    ],
  },
  front_crisis: {
    scene: 'trench',
    kicker: '후방이 위험하다',
    paragraphs: [
      '대구와 부산이 적 포병의 사정권에 들어왔다는 보고가 올라온다. 전선과 후방의 경계가 흐려지고, 보급 열차는 밤에만 움직인다. 지휘소의 지도에는 붉은 핀이 눈에 띄게 늘었다.',
      '예비대를 재배치하고 방어선을 다시 짜야 한다. 지금은 전선 한 곳의 승리보다, 후방이 무너지지 않는 것이 더 중요하다.',
    ],
  },
  incheon_preparation: {
    scene: 'landing',
    kicker: '작전실, 심야',
    paragraphs: [
      '탁자 위 지도에 붉은 화살표가 그려진다. 낙동강 정면이 아니라, 적의 등 뒤. 도박에 가까운 계획이다. 조수와 갯벌, 월미도의 포대, 그리고 항상 변덕스러운 날씨.',
      '그러나 성공한다면 적의 보급선이 끊기고 전선 전체가 뒤집힐 것이다. 실패한다면 막대한 병력과 물자를 한꺼번에 잃고 낙동강 전선은 홀로 남는다.',
      '목표를 정하라. 이 한 수가 전쟁의 방향을 바꿀 수 있다.',
    ],
    quote: { text: '가장 위험해 보이는 곳이 적이 가장 방심한 곳이다.', by: '작전 참모' },
  },
  incheon_landing: {
    scene: 'landing',
    kicker: '상륙 D-day',
    paragraphs: [
      '새벽 어둠 속, 함포가 일제히 불을 뿜는다. 해안선이 불길에 물들고, 상륙정의 엔진 소리가 바다를 가득 채운다. 병사들은 젖은 철모를 단단히 눌러쓰고 도어가 열리기만을 기다린다.',
      '이 한 번의 파도가 낙동강 전선의 모든 희생에 의미를 부여할 수 있다. 계획은 확정되었다. 이제 실행만이 남았다.',
    ],
  },
  gunsan_landing: {
    scene: 'landing',
    kicker: '서해 상륙 (가상)',
    paragraphs: [
      '대안으로 택한 서남해안 상륙. 파도는 상대적으로 잔잔하고 방어는 느슨하다. 그러나 이 선택은 적의 심장이 아니라 옆구리를 찌른다. 전과는 작을 것이다. 위험도 작다.',
    ],
  },
  naktong_breakout: {
    scene: 'advance',
    kicker: '반격의 아침',
    paragraphs: [
      '포성의 방향이 바뀌었다. 몇 주 동안 우리를 향해 쏟아지던 포탄이 이제는 적 후방으로 날아간다. 참호에서 올라온 병사들이 처음으로 앞을 향해 달린다. 적의 병참선이 흔들리고 조직이 무너져 가는 것이 느껴진다.',
      '하지만 달콤한 승리감에 취하기에는 이르다. 너무 깊이 북진하면 보급선이 늘어지고, 북쪽 국경 너머에서도 누군가 이 전쟁을 지켜보고 있다.',
    ],
  },
  seoul_recaptured: {
    scene: 'burning_city',
    kicker: '수도 탈환',
    paragraphs: [
      '잿더미와 연기 속에서도 깃발은 올라간다. 부서진 건물 사이로 시민들이 하나둘 거리로 나온다. 몇 달 만에 처음으로 사람들이 길 한복판에서 환호성을 지른다.',
      '정부는 수도로 돌아올 채비를 한다. 이 도시의 폐허 위에서 다시 시작해야 한다. 그러나 오늘 이 하루만큼은, 이 승리를 즐겨도 좋다.',
    ],
  },
  china_warning: {
    scene: 'headquarters',
    kicker: '국경 너머의 경고',
    paragraphs: [
      '외교 통로를 통해 전달된 말은 짧고 분명했다 — 선을 넘으면 더는 지켜보지 않겠다. 사령부의 공기가 무겁다. 누군가는 허세라고 말하고 누군가는 이를 갈며 지도의 북쪽 끝을 쳐다본다.',
      '38선을 넘어 북진하면 한반도 전체를 되찾을 기회를 잡는다. 그러나 압록강 너머에서 더 큰 군대가 깨어날 수도 있다.',
    ],
  },
  phase1_review: {
    scene: 'advance',
    kicker: '첫 국면의 끝',
    paragraphs: [
      '여름이 끝나고, 전선은 한 바퀴를 돌았다. 우리가 지켜낸 것과 잃은 것의 목록이 참모 탁자 위에 쌓인다. 그러나 전쟁은 이제 막 다른 얼굴을 드러내려 하고 있다.',
    ],
  },
  china_intervention: {
    scene: 'winter_march',
    kicker: '압록강을 건너는 그림자',
    paragraphs: [
      '정찰기는 아무것도 보지 못했다. 그런데 능선 너머에서는 매일 밤 불빛 없는 행렬이 내려오고 있었다. 눈 쌓인 산등성이를 따라, 말없이, 수십만의 발소리가.',
      '어느 새벽, 사방에서 호각과 꽹과리가 울린다. 눈앞의 어둠이 일제히 움직인다. 야간 공격, 침투, 측면 포위 — 숫자는 압도적이다. 하지만 그들도 사람이다. 포가 부족하고, 보급선은 길고, 겨울의 산은 누구에게도 자비롭지 않다.',
      '지형을 이용하라. 지연전으로 그들의 보급선을 끌어당기고, 포병과 항공으로 때려라.',
    ],
    quote: { text: '보이지 않는다고 없는 것이 아니다. 오히려 지금 이 산이 전부 그들이다.', by: '정찰대원 보고' },
  },
  china_second_offensive: {
    scene: 'winter_march',
    kicker: '두 번째 파도',
    paragraphs: [
      '첫 번째 파도를 간신히 버텼다고 생각한 순간, 더 큰 파도가 밀려온다. 전 전선에서 동시에 호각이 울린다. 눈보라 속에서 무선은 끊기고, 부대는 서로의 위치를 잃는다.',
      '포위의 위험이 어느 때보다 크다. 후퇴로를 잃은 부대는 겨울의 산에서 사라질 것이다. 지금은 땅이 아니라 병력을 지켜야 한다.',
    ],
  },
  trench_warfare: {
    scene: 'trench',
    kicker: '교착',
    paragraphs: [
      '전선은 더 이상 움직이지 않는다. 양측은 산등성이를 따라 참호를 파고, 철조망을 치고, 포탄으로 서로를 밤낮없이 두드린다. 고지 하나를 빼앗기 위해 한 개 대대가 사라진다. 다음 날 그 고지는 다시 적의 것이 된다.',
      '전쟁 피로가 쌓인다. 편지는 줄어들고, 후방의 목소리는 커진다. 이기는 것이 곧 얻는 것은 아니다.',
    ],
  },
  armistice_talks: {
    scene: 'talks',
    kicker: '회담 천막',
    paragraphs: [
      '비가 천막 지붕을 두드린다. 탁자 한가운데에 그어진 선 위로 두 깃발이 서로를 마주 본다. 총성은 멈추지 않았지만, 이제 이 전쟁에는 다른 종류의 전투가 시작되었다 — 말과 말, 지도 위의 선.',
      '협상에 응하면 시간이 갈수록 타결에 가까워진다. 그러나 전선에서 흘리는 피가 협상 테이블에서의 선이 된다.',
    ],
  },
  general_mobilization: {
    scene: 'conscripts',
    kicker: '총동원령',
    paragraphs: [
      '라디오가 전한다 — 모든 청년은 소집에 응하라. 논밭에서 낫을 내려놓고 온 얼굴, 책가방을 메고 나온 얼굴이 마을 광장에 줄지어 선다. 군복이 모자라 일부는 사복 위에 철모만 얹었다.',
      '훈련은 길어야 며칠. 총은 모자라고, 탄띠도 모자라다. 그러나 이들이 있기에 전선은 끊어지지 않을 것이다. 서둘러 늘어난 병력은 처음에는 강하지 않다 — 장비와 시간이 따라와야 한다.',
      '남쪽이 일어서면, 북쪽도 가만있지 않을 것이다.',
    ],
    quote: { text: '총이 없는 자는 삽을 들어라. 삽이 없는 자는 곁의 전우를 지켜라.', by: '동원 포고문' },
  },
  casualty_report_seoul: { scene: 'memorial', kicker: '전사자 명부', paragraphs: ['수도를 잃은 밤. 참모부 사무실에는 아직 꺼지지 않은 등이 하나 켜져 있다. 책상 위에 놓인 종이의 숫자 하나하나가 이름이 있는 사람이었다.'] },
  casualty_report_mobilization: { scene: 'memorial', kicker: '동원 이후', paragraphs: ['대규모 동원이 이루어졌다. 병력이 늘어난 만큼 앞으로의 손실도 커질 것이다. 이 숫자를 기억하라.'] },
  casualty_report_naktong: { scene: 'memorial', kicker: '낙동강의 밤', paragraphs: ['낙동강 전선에서 지금까지 치른 대가다. 강물은 더 이상 맑지 않다.'] },
  casualty_report_landing: { scene: 'memorial', kicker: '상륙 이후', paragraphs: ['상륙작전이 끝났다. 승패와 상관없이, 이 작전에 올랐던 병사들의 이름이 이 명부에 오른다.'] },
  casualty_report_china: { scene: 'memorial', kicker: '겨울 전선', paragraphs: ['겨울 전투가 한 차례 휩쓸고 지나갔다. 눈 속에 남은 이름들을 이 종이가 대신 기억한다.'] },
  casualty_report_talks: { scene: 'memorial', kicker: '회담 테이블의 무게', paragraphs: ['협상이 시작되었다. 이 탁자 위의 모든 선은 이 숫자들의 대가 위에 그어진다.'] },
};

Object.assign(NARRATIVES, STORY_NARRATIVES);

/** 이벤트마다 서로 다른 장면을 쓰도록 지정 (같은 그림을 여러 이벤트가 돌려 쓰지 않는다) */
const SCENE_BY_EVENT: Record<string, SceneKind> = {
  macarthur_arrives: 'airstrip',
  macarthur_relieved: 'tokyo_crowd',
  nuclear_debate: 'war_room',
  china_warning: 'telegram',
  nuclear_aftermath: 'mushroom',
  seoul_fall: 'empty_capital',
  seoul_recaptured: 'flag_raise',
  daejeon_fall: 'railway_retreat',
  pyongyang_fall: 'river_tank',
  incheon_preparation: 'ship_conference',
  incheon_success: 'beachhead',
  incheon_failure: 'wreck_beach',
  world_war_risk: 'hotline',
  us_vanguard: 'convoy',
  naktong_crisis: 'river_defense',
  walker_stand: 'command_post',
  seoul_defense_held: 'victory_street',
  front_crisis: 'hilltop',
  china_second_offensive: 'bugle_charge',
  pla_massing: 'rail_yard',
  seoul_second_fall: 'refugees_ice',
  soviet_intervention: 'red_train',
  yalu_reached: 'river_border',
  phase1_review: 'campaign_map',
  trench_warfare: 'barbed_wire',
};
for (const [id, scene] of Object.entries(SCENE_BY_EVENT)) if (NARRATIVES[id]) NARRATIVES[id].scene = scene;


// ───────── 효과 요약 (HOI4의 선택지 효과 목록) ─────────
export interface EffectLine {
  text: string;
  tone: 'good' | 'bad' | 'neutral';
}

const sgn = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const DIP: Record<string, [string, boolean]> = {
  usCommitment: ['미국 개입도', true],
  unSupport: ['UN 지지', true],
  chinaThreat: ['중국 개입 위험', false],
  sovietSupport: ['소련 지원(적)', false],
};

export function describeEffect(e: Effect, state: GameState): EffectLine | null {
  const pname = (ids: string[]) => {
    const names = ids.slice(0, 3).map((id) => state.provinces[id]?.name ?? id);
    return names.join('·') + (ids.length > 3 ? ` 등 ${ids.length}곳` : '');
  };
  switch (e.kind) {
    case 'nation': {
      const label = { popularSupport: '국민 지지', supplyStock: '보급 자원', commandPoints: '행정 점수' }[e.field];
      return { text: `${e.side === 'north' ? '북한 ' : ''}${label} ${sgn(e.delta)}`, tone: (e.delta > 0) === (e.side === 'south') ? 'good' : 'bad' };
    }
    case 'diplomacy': {
      const [label, goodUp] = DIP[e.field];
      return { text: `${label} ${sgn(e.delta)}`, tone: (e.delta > 0) === goodUp ? 'good' : 'bad' };
    }
    case 'units': {
      const who = e.side === 'south' ? '아군' : '북한군';
      const where = e.area === 'all' ? '전 부대' : pname(e.area) + ' 일대';
      const parts: string[] = [];
      if (e.lossFraction) parts.push(`병력 -${Math.round(e.lossFraction * 100)}%`);
      if (e.equipLossFraction) parts.push(`장비 -${Math.round(e.equipLossFraction * 100)}%`);
      if (e.morale) parts.push(`사기 ${sgn(e.morale)}`);
      if (e.organization) parts.push(`조직력 ${sgn(e.organization)}`);
      if (e.fatigue) parts.push(`피로 ${sgn(e.fatigue)}`);
      if (e.recovery) parts.push(`회복 ${sgn(e.recovery)}`);
      if (e.supply) parts.push(`보급 ${sgn(e.supply)}`);
      if (!parts.length) return null;
      const bad = !!e.lossFraction || (e.morale ?? 0) < 0 || (e.organization ?? 0) < 0 || (e.fatigue ?? 0) > 0;
      const good = !bad;
      return { text: `${who} ${where}: ${parts.join(' · ')}`, tone: good === (e.side === 'south') ? 'good' : 'bad' };
    }
    case 'province': {
      const label = { fortification: '방어시설', warDamage: '전쟁 피해', controlStability: '통제 안정도', infrastructure: '기반시설' }[e.field];
      const goodUp = e.field !== 'warDamage';
      return { text: `${state.provinces[e.province]?.name ?? e.province} ${label} ${sgn(e.delta)}`, tone: (e.delta > 0) === goodUp ? 'good' : 'bad' };
    }
    case 'setOwner':
      return { text: `${state.provinces[e.province]?.name ?? e.province} 점령 (${e.side === 'south' ? '아군' : '북한'} 통제)`, tone: e.side === 'south' ? 'good' : 'bad' };
    case 'spawn':
      return { text: `증원 ${e.templates.length}개 부대 편성`, tone: 'good' };
    case 'relocate':
      return { text: `부대 이동 → ${state.provinces[e.to]?.name ?? e.to}`, tone: 'neutral' };
    case 'interdiction':
      return { text: `북한군 보급선 폭격 효과 ${sgn(Math.round(e.delta * 100))}%`, tone: 'good' };
    case 'airSupport':
      return { text: '항공 지원 확보', tone: 'good' };
    case 'destroyEnemy':
      return { text: `${state.provinces[e.province]?.name ?? e.province} 적 수비대 ${Math.round(e.fraction * 100)}% 격멸`, tone: 'good' };
    case 'landing':
      return { text: '상륙작전 실행 (부대 차출·결과 판정)', tone: 'neutral' };
    case 'mobilize':
      return { text: e.profile === 'kpa' ? '북한군 총동원령 (여단→사단)' : '국군 총동원령 (여단→사단, 긴급 동원병 충원)', tone: e.profile === 'kpa' ? 'bad' : 'good' };
    case 'spawnPla':
      return { text: e.provinces[0] === 'china' ? `중국군 ${e.count}개 사단급이 중국 영내(만주)에 집결 시작` : `중국군 ${e.count}개 사단급 부대 투입`, tone: 'bad' };
    case 'nuke':
      return { text: '만주 핵 투하: 중국군 병력 -30%·사기 -25·조직력 -35, 이후 중국군 회복·보충 불가', tone: 'good' };
    case 'sovietJoin':
      return { text: `소련군 ${e.count}개 사단 참전`, tone: 'bad' };
    case 'chance': {
      const inner = e.then.map((x) => describeEffect(x, state)).filter((x): x is EffectLine => !!x).map((x) => x.text);
      return { text: `${Math.round(e.p * 100)}% 확률로 ${inner.length ? inner.join(', ') : '소련 개입 위기 발생'}`, tone: 'bad' };
    }
    case 'plaCross':
      return { text: `중국군 총 ${e.total}개 사단급이 압록강·두만강을 건너 북한 영토로 진입`, tone: 'bad' };
    case 'fortifyFront':
      return { text: '전선 전 지역 방어시설 +1 (양측)', tone: 'neutral' };
    case 'weariness':
      return { text: `전쟁 피로도 ${sgn(e.delta)}`, tone: e.delta > 0 ? 'bad' : 'good' };
    case 'postpone':
      return { text: '다음 턴에 다시 결정해야 함', tone: 'neutral' };
    case 'reinforce':
    case 'stock':
    case 'flag':
    case 'flagTurn':
      return null;
  }
}

export function describeEffects(effects: Effect[], state: GameState): EffectLine[] {
  return effects.map((e) => describeEffect(e, state)).filter((x): x is EffectLine => !!x);
}

// ───────── 전황 보고 (현재 게임 상태에서 계산) ─────────
const NORTH_BANK = ['seoul', 'uijeongbu', 'dongducheon', 'paju', 'gimpo', 'gaeseong'];
const RING = ['waegwan', 'daegu', 'yeongcheon', 'pohang', 'changnyeong', 'masan', 'jinju', 'miryang', 'gyeongju'];

export function situationLines(state: GameState, eventId: string): string[] {
  const side: Side = state.playerSide;
  const lines: string[] = [];
  const all = Object.values(state.provinces);
  const own = all.filter((p) => p.owner === side);
  const init = state.initialTotals.southProvinces;
  lines.push(`아군 통제 지역 ${own.length}곳 (개전 시 ${init}곳${own.length >= init ? ', +' : ', '}${own.length - init})`);
  const front = own
    .filter((p) => MAP.adjacency[p.id].some((n) => state.provinces[n].owner !== side))
    .sort((a, b) => b.strategicValue - a.strategicValue)
    .slice(0, 4)
    .map((p) => p.name);
  if (front.length) lines.push(`최전선 요충: ${front.join(' · ')}`);
  const enemyAdj = Object.values(state.units).filter((u) => u.side !== side && MAP.adjacency[u.location].some((n) => state.provinces[n].owner === side)).length;
  if (enemyAdj) lines.push(`전선에 접한 적 부대 ${enemyAdj}개`);
  const f = forceStats(state, side);
  lines.push(`아군 가용 병력 ${f.available.toLocaleString('ko-KR')}명 (편제 정원 대비 ${Math.round((f.available / Math.max(1, f.authorized)) * 100)}%)`);
  const t = sideTotals(state, side);
  if (t.total > 0) lines.push(`누적 손실: 전사 ${t.killed.toLocaleString('ko-KR')} · 부상 ${t.wounded.toLocaleString('ko-KR')} · 포로 ${t.prisoners.toLocaleString('ko-KR')}`);
  const cut = Object.values(state.units).filter((u) => u.side === side && !state.provinces[u.location].supplied).length;
  if (cut) lines.push(`보급이 끊긴 아군 부대 ${cut}개`);

  switch (eventId) {
    case 'seoul_crisis': {
      const trapped = Object.values(state.units).filter((u) => u.side === side && NORTH_BANK.includes(u.location));
      lines.push(`한강 이북에 남은 아군 부대 ${trapped.length}개 (병력 ${trapped.reduce((s, u) => s + u.strength, 0).toLocaleString('ko-KR')}명)`);
      break;
    }
    case 'naktong_crisis':
    case 'front_crisis':
    case 'walker_stand': {
      const mine = Object.values(state.units).filter((u) => u.side === side && RING.includes(u.location)).length;
      const theirs = Object.values(state.units).filter((u) => u.side !== side && (RING.includes(u.location) || MAP.adjacency[u.location].some((n) => RING.includes(n)))).length;
      lines.push(`방어선 일대: 아군 ${mine}개 부대 vs 적 ${theirs}개 부대`);
      break;
    }
    case 'china_intervention':
    case 'china_second_offensive': {
      const pla = Object.values(state.units).filter((u) => u.faction === 'PLA');
      lines.push(`중국군 ${pla.length}개 사단급 부대 (병력 ${pla.reduce((s, u) => s + u.strength, 0).toLocaleString('ko-KR')}명) 전개 중`);
      break;
    }
    case 'bloody_battle': {
      try {
        const b = JSON.parse(String(state.flags.bloodyBattleInfo ?? '{}'));
        lines.unshift(`격전지: ${state.flags.bloodyBattle} — 공격 ${b.a}개 부대 vs 방어 ${b.d}개 부대, 이 전투의 전사자 ${Number(b.killed).toLocaleString('ko-KR')}명`);
      } catch { /* 기록 없음 */ }
      break;
    }
    case 'seoul_defense_held':
    case 'seoul_fall_battle': {
      const last = [...state.reports].reverse().find((r) => r.province === 'seoul');
      if (last) lines.unshift(`서울 전투: 공격 ${last.attackerUnits.length}개 부대 vs 방어 ${last.defenderUnits.length}개 부대 (손실 ${last.attackerLosses.toLocaleString('ko-KR')} / ${last.defenderLosses.toLocaleString('ko-KR')}명)`);
      break;
    }
    case 'general_mobilization':
      lines.push(`동원 가능한 징병 인구 ${nationalDraftPool(state, side).toLocaleString('ko-KR')}명`);
      break;
    case 'armistice_talks':
    case 'trench_warfare':
      lines.push(`전쟁 피로도 ${Math.round(state.warWeariness)} · 협상 진척 ${Math.round(state.armisticeProgress)}%`);
      break;
  }
  return lines;
}
