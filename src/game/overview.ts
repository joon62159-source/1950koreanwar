import type { GameState } from './types';
import { chinaStatus, daysToTurnText } from './china';
import { armisticeForecast } from './armistice';

export type Tone = 'ok' | 'warn' | 'bad' | 'info';

export interface FrontStatus {
  /** 상단바·시트에 쓰는 짧은 칩 */
  chip: { label: string; value: string; tone: Tone };
  /** 전황 개요에 쓰는 설명 줄 */
  lines: string[];
}

/** 38선 월경·중공군 집결·정전협상의 현재 상태를 한곳에서 요약한다 (화면 표시용, 상태를 바꾸지 않는다) */
export function warFrontStatus(state: GameState): { china: FrontStatus; armistice: FrontStatus | null } {
  const c = chinaStatus(state);
  let china: FrontStatus;
  if (c.arrived) {
    china = { chip: { label: '중국', value: '참전 중', tone: 'bad' }, lines: ['중공군이 참전해 전선에서 싸우고 있습니다.'] };
  } else if (c.phase === 'open') {
    china = {
      chip: { label: '중공군 집결', value: `${c.staged}/${c.total} · ${c.arrivalDaysLeft}일`, tone: 'bad' },
      lines: [`압록강 북안에 중공군 ${c.staged}개 사단급이 집결 (최종 ${c.total}개 예상)`, `도하까지 약 ${daysToTurnText(state, c.arrivalDaysLeft)}`, '그 안에 최대한 북쪽으로 올라가세요.'],
    };
  } else if (c.phase === 'banned') {
    china = c.finalPending
      ? { chip: { label: '38선', value: '최종 결정 대기', tone: 'warn' }, lines: ['월경 제한이 끝났습니다. 최종 결정(이른 정전 / 월경)을 내려야 합니다.'] }
      : { chip: { label: '월경 제한', value: `${daysToTurnText(state, c.banDaysLeft)}`, tone: 'warn' }, lines: [`38선 월경 제한: ${daysToTurnText(state, c.banDaysLeft)} 남음`, '끝나면 최종 결정(이른 정전 / 월경)을 내려야 합니다.'] };
  } else if (c.phase === 'closed') {
    china = { chip: { label: '38선', value: '정전협상 중', tone: 'info' }, lines: ['38선에서 정전협상을 택했습니다. 월경할 수 없습니다.'] };
  } else {
    china = { chip: { label: '38선', value: '미월경', tone: 'info' }, lines: ['38선 이북(지도의 굵은 검은 선 너머)을 처음 공격하면 중국의 경고가 나옵니다.', '넘으면 중공군이 집결해 정해진 시간 뒤 참전하고, 멈추면 한동안 월경이 금지됩니다.'] };
  }
  const f = armisticeForecast(state);
  const armistice: FrontStatus | null = f
    ? {
        chip: { label: '정전협상', value: `${Math.round(state.armisticeProgress)}% · 예상 ${f.turnsLeft}턴`, tone: 'info' },
        lines: [`협상 진척 ${Math.round(state.armisticeProgress)}% · 지금 속도라면 약 ${f.turnsLeft}턴 뒤(${f.daysLeft}일) 타결`, '전쟁 피로가 높을수록 빨라지고, 미국 설득에 성공하면 늦춰집니다.'],
      }
    : null;
  return { china, armistice };
}
