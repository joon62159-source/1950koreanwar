import { WEATHER, type WeatherId } from './balance';

export interface WeatherInfo {
  id: WeatherId;
  label: string;
  icon: string;
  moveMult: number;
  roadSupplyMult: number;
  attackMult: number;
  lossPerDay: number;
  consumptionMult: number;
  recoveryMult: number;
  /** 한 줄 설명 */
  blurb: string;
}

/** 날짜(yyyy-mm-dd)로 정해지는 날씨. 매년 같은 시기에 장마·혹한·해빙기가 온다. */
export function weatherIdAt(date: string): WeatherId {
  const md = date.slice(5);
  for (const id of ['monsoon', 'cold', 'thaw'] as const) {
    const w = WEATHER[id];
    const inRange = w.from <= w.to ? md >= w.from && md <= w.to : md >= w.from || md <= w.to;
    if (inRange) return id;
  }
  return 'clear';
}

export function weatherAt(date: string): WeatherInfo {
  const id = weatherIdAt(date);
  return { id, ...WEATHER[id] };
}

/** 날씨의 효과를 사람이 읽을 수 있는 줄로 */
export function weatherEffectLines(id: WeatherId): string[] {
  const w = WEATHER[id];
  const pct = (v: number) => `${v > 1 ? '+' : '−'}${Math.round(Math.abs(v - 1) * 100)}%`;
  const out: string[] = [];
  if (w.moveMult !== 1) out.push(`부대 이동력 ${pct(w.moveMult)}`);
  if (w.roadSupplyMult !== 1) out.push(`도로 보급 효율 ${pct(1 / w.roadSupplyMult)} (철도는 영향 적음)`);
  if (w.attackMult !== 1) out.push(`공격 전투력 ${pct(w.attackMult)}`);
  if (w.lossPerDay > 0) out.push('보급이 약한 부대는 동상·질병으로 병력·조직력 손실');
  if (w.consumptionMult !== 1) out.push(`보급 자원 소모 ${pct(w.consumptionMult)}`);
  if (w.recoveryMult !== 1) out.push(`부상병 회복 ${pct(w.recoveryMult)}`);
  return out;
}
