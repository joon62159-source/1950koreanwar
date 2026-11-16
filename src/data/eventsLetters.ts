import type { Condition, HistoricalEvent } from './events';
import type { Narrative } from './eventNarrative';

/**
 * 전선 편지: 4턴 동안 아무 이벤트도 없을 때(quietTurns) 상황에 맞는 편지가 한 통 뜬다.
 * 편지의 인물과 사연은 모두 가상이다. 아군(남측)이 받는 편지는 사기를 조금 올려 준다.
 */
const BEGIN = '1950-06-25';
const END = '1953-07-27';
const MORALE: HistoricalEvent['effects'] = [{ kind: 'units', side: 'south', area: 'all', morale: 2 }];
const QUIET: Condition = { kind: 'quietTurns', min: 4 };

interface Letter {
  id: string;
  title: string;
  desc: string;
  conds: Condition[];
  window?: [string, string];
  effects?: HistoricalEvent['effects'];
  narrative: Narrative;
}

const LETTERS: Letter[] = [
  {
    id: 'letter_01', title: '어머니의 편지', desc: '고향의 어머니가 보낸 편지가 전선에 닿았습니다.',
    conds: [{ kind: 'dateAtLeast', date: '1950-07-10' }], window: ['1950-07-10', '1950-10-31'],
    narrative: { scene: 'home_letter', kicker: '고향에서 온 편지', paragraphs: [
      '아들아, 밥은 거르지 않고 먹고 있느냐. 마을에는 군인들이 지나다니고 밤마다 먼 데서 쿵쿵 소리가 난다. 네 아버지는 말이 없어졌고, 나는 새벽마다 장독대에 물을 떠놓는다.',
      '옆집 순이가 네 안부를 묻더구나. 양말을 두 켤레 떠서 같이 보낸다. 발이 젖으면 꼭 갈아 신어라. 다치지 말고, 다치더라도 걸어서 돌아오너라.',
      '— 고향의 어머니가' ] },
  },
  {
    id: 'letter_02', title: '장마철 참호에서', desc: '비 내리는 참호에서 쓴 병사의 편지입니다.',
    conds: [{ kind: 'weatherIs', id: 'monsoon' }],
    narrative: { scene: 'front_letter', kicker: '전선에서 온 편지', paragraphs: [
      '비가 열흘째 그치지 않습니다. 참호에는 무릎까지 물이 차서, 번갈아 철모로 물을 퍼내며 잠을 잡니다. 건빵이 젖어 죽처럼 풀어져도 그걸 삼킵니다.',
      '그래도 우스운 일이 있었습니다. 분대장님이 비 맞은 닭 같다고 우리를 놀리다가, 본인이 제일 먼저 미끄러져 진창에 앉았습니다. 오랜만에 다 같이 웃었습니다.',
      '— 3분대 일등병 올림' ] },
  },
  {
    id: 'letter_03', title: '얼어붙은 손으로', desc: '혹한 속의 병사가 쓴 짧은 편지입니다.',
    conds: [{ kind: 'weatherIs', id: 'cold' }],
    narrative: { scene: 'front_letter', kicker: '전선에서 온 편지', paragraphs: [
      '손이 얼어서 글씨가 삐뚤어졌습니다. 용서하십시오. 연필심이 자꾸 부러져 이빨로 깎아 쓰고 있습니다.',
      '밤에는 서로 등을 맞대고 잡니다. 누구 하나가 일어나 발을 구르면 전부 깨어나 같이 구릅니다. 이렇게라도 안 하면 아침에 못 일어나는 사람이 생긴다고 선임이 말했습니다.',
      '고향의 겨울이 이렇게 그리울 줄 몰랐습니다. 따뜻한 아랫목에 누워 보는 게 소원입니다.',
      '— 두 번째 겨울을 보내는 병사 올림' ] },
  },
  {
    id: 'letter_04', title: '진흙길의 봄', desc: '해빙기 진창 속에서 쓴 편지입니다.',
    conds: [{ kind: 'weatherIs', id: 'thaw' }],
    narrative: { scene: 'front_letter', kicker: '전선에서 온 편지', paragraphs: [
      '눈이 녹으니 길이 길이 아닙니다. 보급 트럭이 사흘째 오지 못하고, 우리는 통나무를 깔아 겨우 다리를 놓았습니다.',
      '그런데도 진달래가 피었습니다. 포탄 구덩이 옆에 분홍빛이 번지는 걸 보고 누가 먼저 울었는지 모르겠습니다. 봄은 오는데 우리는 여기 있습니다.',
      '— 공병 일등병 올림' ] },
  },
  {
    id: 'letter_05', title: '가을 하늘', desc: '고지에서 하늘을 올려다보며 쓴 편지입니다.',
    conds: [{ kind: 'dateAtLeast', date: '1950-09-15' }], window: ['1950-09-15', '1950-11-20'],
    narrative: { scene: 'front_letter', kicker: '전선에서 온 편지', paragraphs: [
      '하늘이 어찌나 높고 파란지, 전쟁 중이라는 사실을 잠깐 잊을 뻔했습니다. 고지 위에서 바라보니 낙엽 진 산등성이가 붉고 노랗게 타오릅니다.',
      '한참을 바라보다 문득 알았습니다. 이 아름다운 산에 우리가 포탄을 퍼붓고 있다는 것을. 그래서 더 빨리 끝나길 바랍니다.',
      '— 보병 상등병 올림' ] },
  },
  {
    id: 'letter_06', title: 'Home by Christmas', desc: '한국에 파병된 미군 병사의 편지입니다.',
    conds: [{ kind: 'dateAtLeast', date: '1950-12-15' }], window: ['1950-12-15', '1951-01-20'],
    narrative: { scene: 'front_letter', kicker: '한 미군 병사의 편지', paragraphs: [
      '엄마, 크리스마스에는 집에 갈 수 있을 거라고들 했는데 저는 아직 이름도 외우지 못한 산골짜기에 있어요. 여기 추위는 오하이오와는 비교가 안 돼요.',
      '어제 한국 아이가 제 초콜릿 한 조각에 크게 웃었어요. 그 웃음을 보니 내가 왜 여기 와 있는지 조금은 알 것 같았습니다.',
      '동생에게 제 트럭 모형을 잘 간수하라고 전해 주세요.',
      '— 당신의 아들 톰이' ] },
  },
  {
    id: 'letter_07', title: '서울에 두고 온 가족', desc: '서울을 잃은 뒤 가족 걱정에 쓴 편지입니다.',
    conds: [{ kind: 'owner', province: 'seoul', side: 'north' }],
    effects: [],
    narrative: { scene: 'home_letter', kicker: '전선에서 온 편지', paragraphs: [
      '서울에 있는 처자식 소식을 들은 지 오래입니다. 피난을 갔는지, 집에 그대로 있는지도 모릅니다. 낮에는 총을 들고 있으니 견디는데 밤이 되면 가슴이 내려앉습니다.',
      '서울이 우리 손에 다시 들어오는 날이 오면 제일 먼저 집 대문을 두드릴 것입니다. 그날까지 살아서 버티겠습니다.',
      '— 한 중사의 편지' ] },
  },
  {
    id: 'letter_08', title: '돌아온 서울에서', desc: '수복된 서울에서 가족을 찾은 병사의 편지입니다.',
    conds: [{ kind: 'eventFired', id: 'seoul_recaptured' }, { kind: 'owner', province: 'seoul', side: 'south' }],
    narrative: { scene: 'home_letter', kicker: '전선에서 온 편지', paragraphs: [
      '서울 집에 다녀왔습니다. 지붕은 반쯤 날아갔지만 대문은 서 있었고, 어머니가 마당에서 빨래를 하고 계셨습니다. 서로 아무 말도 못하고 한참을 안고 서 있었습니다.',
      '살아 있다는 것만으로도 기적입니다. 이웃의 절반은 소식을 모릅니다. 저는 내일 다시 올라갑니다. 어머니, 이번에는 대문을 꼭 걸어 잠그고 계세요.',
      '— 서울에서 돌아온 병사' ] },
  },
  {
    id: 'letter_09', title: '전우를 보내며', desc: '전우를 잃은 병사의 편지입니다.',
    conds: [{ kind: 'casualtiesAtLeast', side: 'south', min: 40000 }],
    narrative: { scene: 'front_letter', kicker: '전선에서 온 편지', paragraphs: [
      '철수는 오늘 아침 총에 맞았습니다. 같은 마을 출신이라 입대도 같이 했는데, 손에 쥔 건 제가 준 건빵 반 봉지였습니다.',
      '어머니께는 아직 말씀드리지 못했습니다. 철수네 어머니가 저를 보면 제일 먼저 물으실 겁니다. 그 대답을 어떻게 해야 할지 몰라 밤새 이 편지를 씁니다.',
      '— 철수의 친구 올림' ] },
  },
  {
    id: 'letter_10', title: '주먹밥 반 개', desc: '보급이 끊긴 부대의 병사가 쓴 편지입니다.',
    conds: [{ kind: 'unitsCutAtLeast', side: 'south', min: 1 }],
    narrative: { scene: 'front_letter', kicker: '전선에서 온 편지', paragraphs: [
      '사흘째 보급이 오지 않습니다. 오늘은 주먹밥 반 개로 버텼습니다. 배가 고픈 것보다 더 힘든 건, 뒤에서 아무도 우리를 찾아오지 않을 것 같다는 생각입니다.',
      '그래도 대대장님은 매일 우리 호를 일일이 돌며 "조금만 더"라고 하십니다. 그 말을 믿고 오늘도 총을 놓지 않았습니다. 보급선이 이어지기를 기도합니다.',
      '— 고립된 중대의 병사' ] },
  },
  {
    id: 'letter_11', title: '어제까지 학생이었는데', desc: '징집된 젊은이의 편지입니다.',
    conds: [{ kind: 'flagSet', key: 'mobilized' }],
    narrative: { scene: 'home_letter', kicker: '전선에서 온 편지', paragraphs: [
      '선생님, 어제까지 교실에서 공책을 펴고 있었는데 오늘은 총을 받았습니다. 총이 이렇게 무거운 줄 몰랐습니다. 교련 시간에 배운 것보다 훨씬 무겁고 차갑습니다.',
      '이 총으로 무엇을 지키는지 이제야 알 것 같습니다. 선생님이 가르쳐주신 대로 침착하게 하겠습니다. 졸업식에는 못 가지만 꼭 돌아가겠습니다.',
      '— 제자 올림' ] },
  },
  {
    id: 'letter_12', title: 'A Country I Cannot Pronounce', desc: '한 UN군 병사가 고향에 보낸 편지입니다.',
    conds: [{ kind: 'dateAtLeast', date: '1950-08-10' }], window: ['1950-08-10', '1952-12-31'],
    narrative: { scene: 'front_letter', kicker: '한 미군 병사의 편지', paragraphs: [
      '아버지, 지도에서 한참을 찾아야 보이는 나라에 와 있습니다. 이름조차 입에 익지 않고, 사람들은 가난한데도 우리에게 김치를 나눠주며 웃습니다.',
      '왜 이곳을 지켜야 하는지 아직 설명하기 어렵습니다. 다만 피난길에 아이를 업고 걷는 어머니들을 보면 지켜야 한다는 생각이 듭니다. 걱정 마세요. 무사히 돌아가겠습니다.',
      '— 아들 짐' ] },
  },
  {
    id: 'letter_13', title: '야전병원의 밤', desc: '야전병원 간호장교가 쓴 편지입니다.',
    conds: [{ kind: 'casualtiesAtLeast', side: 'south', min: 25000 }],
    narrative: { scene: 'front_letter', kicker: '야전병원의 기록', paragraphs: [
      '하룻밤에 들것이 서른 개가 들어왔습니다. 이름을 물으면 대답하는 병사보다 대답하지 못하는 병사가 많았습니다. 손에서 피 냄새가 가시질 않습니다.',
      '그런데도 아침이 되면 살아난 병사가 제 손을 꼭 잡고 고맙다고 합니다. 그 한 마디가 다음 밤을 버티게 합니다.',
      '— 야전병원 간호장교' ] },
  },
  {
    id: 'letter_14', title: '피난길의 아이', desc: '피난길의 아이가 군인 아저씨에게 보낸 편지입니다.',
    conds: [{ kind: 'dateAtLeast', date: '1950-07-20' }], window: ['1950-07-20', '1951-12-31'],
    narrative: { scene: 'home_letter', kicker: '피난민이 보낸 편지', paragraphs: [
      '군인 아저씨, 저는 순이라고 해요. 우리는 걸어서 남쪽까지 왔어요. 아버지가 업어주다가 이제는 제가 걸어요. 발이 아프지만 울지 않았어요.',
      '아저씨들이 지켜주셔서 우리가 이만큼 올 수 있었다고 엄마가 말했어요. 고맙습니다. 전쟁이 끝나면 우리 마을 감나무 아래에서 만나요.',
      '— 순이 드림' ] },
  },
  {
    id: 'letter_15', title: '다른 편의 병사', desc: '북한군 병사가 고향에 쓴 편지입니다.',
    conds: [{ kind: 'dateAtLeast', date: '1950-09-20' }], window: ['1950-09-20', '1952-12-31'], effects: [],
    narrative: { scene: 'front_letter', kicker: '적진에서 발견된 편지', paragraphs: [
      '어머니, 우리는 금방 끝날 줄 알았는데 이렇게 길어졌습니다. 낮에는 하늘에서 쏟아지는 폭격이 무섭고, 밤에는 어느 쪽 총소리인지 몰라 잠을 못 이룹니다.',
      '이 전쟁이 누구를 위한 것인지는 모르겠습니다. 다만 같은 말을 쓰는 사람들이 서로를 향해 총을 쏘고 있다는 것이 믿어지지 않습니다. 건강하세요.',
      '— 아들 올림 (참호 속에서 수습된 서신)' ] },
  },
  {
    id: 'letter_16', title: '압록강 건너의 편지', desc: '중국인민지원군 병사의 편지입니다.',
    conds: [{ kind: 'flagSet', key: 'plaIntervened' }], effects: [],
    narrative: { scene: 'front_letter', kicker: '노획한 편지', paragraphs: [
      '아버지, 우리는 눈 덮인 산을 며칠 밤낮으로 걸었습니다. 솜옷은 얇아 동상 걸린 동료가 많습니다. 주먹밥은 얼어 돌처럼 굳었지만 씹어 삼킵니다.',
      '이곳이 어디인지 정확히는 모릅니다. 다만 우리는 낯선 땅의 사람들과 같은 하늘 아래 추위를 견디고 있다는 생각이 듭니다. 건강히 계세요.',
      '— 아들 올림 (전사자의 주머니에서 발견된 서신)' ] },
  },
  {
    id: 'letter_17', title: '한 달째 같은 고지', desc: '고지전에 지친 병사의 편지입니다.',
    conds: [{ kind: 'flagSet', key: 'trenchWar' }],
    narrative: { scene: 'front_letter', kicker: '전선에서 온 편지', paragraphs: [
      '한 달째 같은 고지를 두고 싸우고 있습니다. 낮에 빼앗으면 밤에 빼앗기고, 다음 날 다시 빼앗습니다. 이름 없는 능선인데 이곳에서 이미 많은 사람이 죽었습니다.',
      '무엇을 위해 이 흙 한 줌을 지키는지 가끔 헷갈립니다. 하지만 등 뒤에 마을이 있다는 걸 압니다. 그래서 오늘도 호 속에서 버팁니다.',
      '— 고지의 병사' ] },
  },
  {
    id: 'letter_18', title: '협상 소식', desc: '정전협상 소식에 대한 병사들의 마음을 담은 편지입니다.',
    conds: [{ kind: 'flagEquals', key: 'talks', value: 'on' }],
    narrative: { scene: 'front_letter', kicker: '전선에서 온 편지', paragraphs: [
      '정전 협상이 시작되었다는 소문이 전선에 퍼졌습니다. 병사들은 기뻐하면서도 조심합니다. 이런 소문이 몇 번이나 돌았다가 사라졌기 때문입니다.',
      '그래도 오늘 밤은 총소리가 적었습니다. 별이 보이는 것이 오랜만이라 한참 올려다보았습니다. 집에 갈 수 있을까요.',
      '— 이등병 올림' ] },
  },
  {
    id: 'letter_19', title: '고향이 가까워졌다', desc: '평양에 입성한 이북 출신 병사의 편지입니다.',
    conds: [{ kind: 'flagSet', key: 'pyongyangFallTurn' }], window: ['1950-10-10', '1951-06-30'],
    narrative: { scene: 'front_letter', kicker: '전선에서 온 편지', paragraphs: [
      '평양에 들어왔습니다. 제 고향은 여기서 백 리 북쪽입니다. 육 년 만에 가까워진 땅인데 산천이 낯설면서도 눈에 익습니다.',
      '고향 어머니가 살아 계신지도 모르는데, 그래도 이 길을 따라 올라가면 닿을 수 있을 것만 같습니다. 부디 전쟁이 이곳에서 끝나기를 바랍니다.',
      '— 이북 출신 병사' ] },
  },
  {
    id: 'letter_20', title: '해병의 편지', desc: '인천상륙작전에 참가한 병사의 편지입니다.',
    conds: [{ kind: 'flagSet', key: 'incheonHub' }], window: ['1950-09-25', '1951-03-31'],
    narrative: { scene: 'front_letter', kicker: '전선에서 온 편지', paragraphs: [
      '인천 앞바다의 새벽을 평생 잊지 못할 것입니다. 상륙정의 문이 열리고 모래사장으로 뛰어내리던 그 순간에, 아무 소리도 들리지 않았습니다. 그저 앞으로 달렸습니다.',
      '살아남은 것이 미안하기도 합니다. 그러나 우리가 열어놓은 길로 많은 사람이 뒤따라 오는 걸 보니, 우리가 뛰어내린 보람이 있다고 생각합니다.',
      '— 상륙부대 병사' ] },
  },
  {
    id: 'letter_21', title: '동생의 편지', desc: '고향의 어린 동생이 형에게 보낸 편지입니다.',
    conds: [{ kind: 'dateAtLeast', date: '1951-01-10' }], window: ['1951-01-10', '1953-06-30'],
    narrative: { scene: 'home_letter', kicker: '고향에서 온 편지', paragraphs: [
      '형, 나 이제 구구단 다 외웠어. 선생님이 칭찬하셨는데 아버지는 아무 말 없이 웃기만 했어. 학교는 천막에서 해. 비가 오면 천막이 새서 우산을 쓰고 공부해.',
      '엄마가 형 이야기만 나오면 부엌으로 가셔. 형, 빨리 와. 나 형이 만들어준 팽이 아직 갖고 있어.',
      '— 동생 영수' ] },
  },
  {
    id: 'letter_22', title: '세 번째 여름', desc: '오랜 전쟁에 지친 병사의 편지입니다.',
    conds: [{ kind: 'dateAtLeast', date: '1952-06-01' }], window: ['1952-06-01', '1952-09-30'],
    narrative: { scene: 'front_letter', kicker: '전선에서 온 편지', paragraphs: [
      '이 전선에서 세 번째 여름을 맞습니다. 처음 왔을 땐 열아홉이었는데 이제 스물하나입니다. 거울을 못 본 지 오래라 제 얼굴이 어떻게 변했는지 모르겠습니다.',
      '그래도 매미 소리는 여전합니다. 세상은 아무 일 없다는 듯 돌아가는 것 같아 이상하게 위로가 됩니다. 곧 끝나겠지요.',
      '— 고참 병사' ] },
  },
  {
    id: 'letter_23', title: '아내의 편지', desc: '아내가 전선의 남편에게 보낸 편지입니다.',
    conds: [{ kind: 'dateAtLeast', date: '1950-08-20' }], window: ['1950-08-20', '1953-05-31'],
    narrative: { scene: 'home_letter', kicker: '고향에서 온 편지', paragraphs: [
      '여보, 아기가 처음으로 일어서서 한 발을 떼었어요. 당신이 계셨다면 얼마나 좋아했을까요. 저는 사진 속 얼굴을 보여주며 아빠라고 가르치고 있어요.',
      '밤마다 당신이 돌아오는 꿈을 꿔요. 꿈에서는 항상 현관 문이 열려 있어요. 그러니 꼭 열린 문으로 돌아오세요.',
      '— 아내가' ] },
  },
  {
    id: 'letter_24', title: '휴전의 소문', desc: '전쟁이 끝나간다는 소문 속에서 쓴 편지입니다.',
    conds: [{ kind: 'dateAtLeast', date: '1953-03-01' }], window: ['1953-03-01', END],
    narrative: { scene: 'front_letter', kicker: '전선에서 온 편지', paragraphs: [
      '휴전이 곧 될 거라는 소문이 돕니다. 믿어도 되는지 모르겠습니다. 하지만 막사에서는 누구도 입 밖에 내지 않는 말이 하나 있습니다. 집에 간다는 말입니다. 말하는 순간 깨질 것 같아서입니다.',
      '혹시 이 편지가 닿을 때쯤 전쟁이 끝나 있다면, 제가 도착하기 전에 대문 앞에 불을 하나 켜 두세요.',
      '— 전선의 병사' ] },
  },
];

export const LETTER_EVENTS: HistoricalEvent[] = LETTERS.map((l) => ({
  id: l.id,
  title: `전선 편지 — ${l.title}`,
  description: l.desc,
  earliestDate: l.window?.[0] ?? BEGIN,
  latestDate: l.window?.[1] ?? END,
  conditions: [QUIET, ...l.conds],
  choices: [],
  effects: l.effects ?? MORALE,
  historicalContext: '',
  historicalDate: '(전황 연동)',
  source: '',
  needsVerification: false,
  isCounterfactual: false,
}));

export const LETTER_NARRATIVES: Record<string, Narrative> = Object.fromEntries(LETTERS.map((l) => [l.id, l.narrative]));
