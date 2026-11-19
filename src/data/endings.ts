import type { GameOutcome, GameState } from '../game/types';
import type { SceneKind } from '../components/EventScene';
import type { Mood } from '../audio/music';
import { formatDate } from '../game/util';

/**
 * 엔딩 이벤트: 게임이 끝나면 결과 화면 앞에 이 장면이 먼저 나온다.
 * 결과(승패·정전·패배 원인)마다 장면·서술·음악이 다르고, 플레이 중 내린 선택(핵·포로 석방 등)이 후일담에 덧붙는다.
 */
export type EndingKey =
  | 'unification'
  | 'armistice_38'
  | 'armistice_north'
  | 'armistice_seoul'
  | 'armistice_seoul_lost'
  | 'hollow'
  | 'busan_fall'
  | 'collapse'
  | 'annihilated'
  | 'world_war';

export interface Ending {
  key: EndingKey;
  scene: SceneKind;
  kicker: string;
  title: string;
  paragraphs: string[];
  quote?: { text: string; by: string };
  mood: Mood;
  tone: 'win' | 'lose';
}

export function endingKey(o: GameOutcome): EndingKey {
  const t = o.title;
  if (t.includes('세계대전')) return 'world_war';
  if (t.includes('38선에서')) return 'armistice_38';
  if (t.includes('부산')) return 'busan_fall';
  if (t.includes('붕괴')) return 'collapse';
  if (t.includes('전 부대')) return 'annihilated';
  if (t.includes('명목상')) return 'hollow';
  if (t.includes('한반도 전역')) return 'unification';
  if (t.includes('북진')) return 'armistice_north';
  if (t.includes('잃은')) return 'armistice_seoul_lost';
  if (t.includes('서울을 지킨')) return 'armistice_seoul';
  return o.result === 'victory' ? 'armistice_seoul' : 'collapse';
}

const BASE: Record<EndingKey, Omit<Ending, 'key' | 'paragraphs'> & { paragraphs: string[] }> = {
  unification: {
    scene: 'flag_raise',
    kicker: '압록강변, 깃발',
    title: '한반도의 아침',
    mood: 'triumph',
    tone: 'win',
    paragraphs: [
      '압록강 위로 해가 떠오른다. 마지막 거점에 국기가 올라가자 능선마다 환호가 번졌다. 이 땅에서 총성이 멎은 것이 얼마 만인지 아무도 세지 못한다. 피난민 행렬은 남쪽이 아닌 고향 쪽으로 방향을 돌린다.',
      '역사가 가지 않은 길이다. 어느 교과서에도 없는 아침을, 이 전쟁에서 살아남은 사람들이 맞는다. 이제 남은 것은 총이 아니라 폐허를 일으키는 일이다.',
    ],
    quote: { text: '이 강이 더 이상 국경이 아니라는 것을, 믿을 수가 없다.', by: '선두 부대 병사' },
  },
  armistice_38: {
    scene: 'talks',
    kicker: '판문점, 38선 위의 서명',
    title: '38선에서 맺은 정전',
    mood: 'victory',
    tone: 'win',
    paragraphs: [
      '선을 넘지 않기로 한 결정은 오래 논쟁으로 남을 것이다. 천막 회담장의 펜이 종이 위를 지나가자 38선 부근에서 총성이 멎었다. 북진의 기회를 놓쳤다고 한탄하는 이도, 더 큰 전쟁을 피했다고 안도하는 이도 있다.',
      '이 선은 전쟁이 시작된 자리에서 그어졌다. 그러나 이 땅의 사람들에게 이 선은 이제 막 시작되는 다른 시간의 경계다.',
    ],
    quote: { text: '넘지 않은 선이 우리를 구했는지, 가두었는지는 후세가 말할 것이다.', by: '수석 대표' },
  },
  armistice_north: {
    scene: 'talks',
    kicker: '판문점, 서명',
    title: '북진의 성과 속에 맺힌 정전',
    mood: 'victory',
    tone: 'win',
    paragraphs: [
      '천막 회담장의 펜이 종이 위를 지나간다. 서명이 끝나자 전선 전체에 침묵이 내렸다. 38선 너머 더 멀리까지 나아간 선이 휴전선이 되었다. 그러나 이 선이 평화의 선인지 전쟁이 잠시 숨을 고르는 선인지는 아무도 모른다.',
      '북진은 많은 것을 얻게 했지만 많은 것을 잃게도 했다. 전선의 고지마다 이름 없는 무덤이 늘어서 있다. 그들이 지킨 선 위에서 이제 정치가 시작된다.',
    ],
    quote: { text: '선은 그어졌다. 이제 그 선을 지키는 것이 우리의 전쟁이다.', by: '수석 대표' },
  },
  armistice_seoul: {
    scene: 'victory_street',
    kicker: '서울, 정전의 날',
    title: '서울을 지킨 채 맞는 정전',
    mood: 'victory',
    tone: 'win',
    paragraphs: [
      '정전 소식이 라디오를 타고 번지자 피난길에서 돌아온 사람들이 폐허 속에서 서로를 부둥켜안았다. 무너진 건물 사이로 아이들이 달린다. 수도는 살아남았고, 이 나라는 살아남았다.',
      '모두가 이긴 것은 아니다. 그러나 이 전쟁이 시작될 때 사람들이 두려워했던 일, 지도에서 이름이 지워지는 일은 일어나지 않았다.',
    ],
    quote: { text: '살아서 이 거리를 다시 걷게 될 줄 몰랐다.', by: '서울 시민' },
  },
  armistice_seoul_lost: {
    scene: 'empty_capital',
    kicker: '임시 수도, 정전 방송',
    title: '서울을 되찾지 못한 정전',
    mood: 'solemn',
    tone: 'lose',
    paragraphs: [
      '정전 방송이 흘러나오지만 환호는 없다. 부산과 대구의 임시 거처에서 사람들은 지도를 펼쳐 본다. 수도는 여전히 선 너머에 있다. 나라는 지켜냈으나 돌아갈 집은 아직 멀다.',
      '전쟁은 멈췄고 숫자는 남았다. 이 숫자들이 이 나라의 다음 세대가 짊어질 무게다.',
    ],
    quote: { text: '이긴 것이 아니라 버틴 것이다. 그래도 버텼다.', by: '임시정부 관료' },
  },
  hollow: {
    scene: 'memorial',
    kicker: '폐허 위의 정전',
    title: '이름뿐인 생존',
    mood: 'solemn',
    tone: 'lose',
    paragraphs: [
      '정전은 이루어졌지만 환호하는 이가 없다. 병력은 줄었고, 산업은 멈췄고, 사람들은 지쳤다. 지도 위에 나라는 남았지만 그 나라를 일으킬 힘이 거의 남지 않았다.',
      '살아남았다는 사실만으로 이 전쟁을 이겼다고 말할 수 있을까. 폐허 위에서 사람들은 되묻는다.',
    ],
    quote: { text: '나라는 있는데, 나라를 움직일 사람도 물자도 없다.', by: '재건 담당관' },
  },
  busan_fall: {
    scene: 'port',
    kicker: '부산항, 마지막 배',
    title: '부산 함락',
    mood: 'defeat',
    tone: 'lose',
    paragraphs: [
      '마지막 보루가 무너졌다. 부산항 부두에는 배를 기다리는 사람들이 끝없이 늘어서 있고, 멀리서 포성이 가까워진다. 지휘부는 바다 건너로 철수 명령을 내렸다. 이 땅의 모든 저항이 조직을 잃는다.',
      '남은 것은 흩어진 부대와 해외의 임시 정부, 그리고 언젠가 돌아오겠다는 약속뿐이다.',
    ],
    quote: { text: '이 항구가 우리가 밟은 마지막 우리 땅이었다.', by: '철수 지휘관' },
  },
  collapse: {
    scene: 'refugees_ice',
    kicker: '붕괴, 길 위의 사람들',
    title: '전쟁수행능력 붕괴',
    mood: 'defeat',
    tone: 'lose',
    paragraphs: [
      '병력도 물자도 민심도 바닥났다. 전선의 부대는 명령을 기다리다 흩어지고, 후방의 공장은 불이 꺼졌다. 더 이상 전쟁을 이어갈 수 있는 나라가 아니다.',
      '피난민의 행렬이 길 위에서 얼어붙는다. 이 전쟁은 총이 아니라 보급과 민심에서 졌다.',
    ],
    quote: { text: '싸울 병사는 남아 있는데, 싸울 수 있게 해줄 것이 아무것도 없다.', by: '참모총장' },
  },
  annihilated: {
    scene: 'burning_city',
    kicker: '침묵하는 전선',
    title: '전 부대 소멸',
    mood: 'defeat',
    tone: 'lose',
    paragraphs: [
      '무전기에서 더는 응답이 오지 않는다. 마지막 부대가 소멸했다. 전선도, 방어선도, 사령부도 사라졌다. 연기만 오르는 평원에 이 나라의 군대가 있었다는 흔적은 이름뿐이다.',
      '전쟁은 끝났다. 이길 수 있었던 순간들이 몇 번이었는지 세는 일은 이제 아무 의미가 없다.',
    ],
    quote: { text: '더 이상 부를 이름이 없다.', by: '마지막 무전병' },
  },
  world_war: {
    scene: 'mushroom',
    kicker: '핫라인이 끊긴 밤',
    title: '세계대전으로의 확전',
    mood: 'doom',
    tone: 'lose',
    paragraphs: [
      '핫라인은 더 울리지 않는다. 확전을 택한 밤, 유럽과 아시아의 함대가 동시에 항구를 떠났다. 한반도는 이제 거대한 전쟁의 변방일 뿐이다.',
      '이 반도에서 시작된 전쟁은 더 이상 이 반도의 것이 아니다. 누가 이 결정을 내렸는지 역사는 오래 기억할 것이다.',
    ],
    quote: { text: '우리는 전쟁을 끝내러 온 것이 아니라 세계를 열러 왔다.', by: '참모장' },
  },
};

/** 결과에 맞는 엔딩 장면. 플레이 중 내린 중대한 선택은 후일담으로 덧붙는다. */
export function endingFor(o: GameOutcome, state: GameState): Ending {
  const key = endingKey(o);
  const b = BASE[key];
  const extra: string[] = [];
  const f = state.flags;
  if (f.nukeUsed) extra.push('만주에 핵을 쓴 날의 선택은 이후 모든 협상과 평가에 그림자를 드리웠다.');
  else if (f.macarthurFired) extra.push('핵 투하를 거부한 대통령의 결정은 그날의 해임과 함께 오래 논쟁거리로 남았다.');
  if (f.powReleased) extra.push('정전 직전 거제도에서 풀려난 반공 포로들의 석방은 협상 테이블을 흔들었지만, 그들에게는 새로운 삶이 열렸다.');
  else if (f.powKept) extra.push('송환 절차를 따른 거제도 포로들의 운명은 오래도록 풀리지 않은 논쟁으로 남았다.');
  if (f.mobilized) extra.push('총동원령으로 사단급으로 불어난 군대는 이 전쟁의 가장 큰 변화였다.');
  const loss = Math.round(state.nations.south.stats.killed / 100) * 100;
  const tail = `${formatDate(o.date)}, 국군과 UN군의 전사자는 누적 ${loss.toLocaleString('ko-KR')}명에 이르렀다.`;
  return { ...b, key, paragraphs: [...b.paragraphs, ...extra, tail] };
}

/** 결과 화면에서 쓸 음악 분위기 */
export function endingMood(o: GameOutcome): Mood {
  return BASE[endingKey(o)].mood;
}
