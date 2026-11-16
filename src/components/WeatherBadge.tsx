import { useGame } from '../store/gameStore';
import { weatherAt, weatherEffectLines, weatherIdAt } from '../game/weather';
import { WEATHER } from '../game/balance';
import { addDays } from '../game/util';

/** 현재 날씨(없으면 숨김)와 곧 바뀌는 날씨 예보. compact 는 아이콘만 보여 주는 모바일용. */
export function useWeatherView() {
  const date = useGame((s) => s.game.date);
  const now = weatherAt(date);
  // 앞으로 약 3주 안에 날씨가 바뀌면 예보한다
  let next: { id: ReturnType<typeof weatherIdAt>; days: number } | null = null;
  for (const d of [7, 14, 21]) {
    const id = weatherIdAt(addDays(date, d));
    if (id !== now.id) {
      next = { id, days: d };
      break;
    }
  }
  return { now, next };
}

export default function WeatherBadge({ compact = false }: { compact?: boolean }) {
  const { now, next } = useWeatherView();
  const showNow = now.id !== 'clear';
  const showNext = next && next.id !== 'clear';
  if (!showNow && !showNext) return null;
  const tip = [showNow ? `${now.label}: ${now.blurb}\n· ${weatherEffectLines(now.id).join('\n· ')}` : '', showNext ? `예보: 약 ${next!.days}일 안에 ${WEATHER[next!.id].label}이(가) 시작됩니다.` : ''].filter(Boolean).join('\n');
  const cold = now.id === 'cold';
  return (
    <div
      className={'flex shrink-0 flex-col justify-center whitespace-nowrap leading-tight ' + (compact ? 'px-1' : 'px-3')}
      title={tip}
      aria-label={tip}
    >
      {showNow && (
        <span className={'font-bold ' + (compact ? 'text-[13px]' : 'text-[13px]') + (cold ? ' text-sky-200' : now.id === 'monsoon' ? ' text-teal-200' : ' text-amber-200')}>
          {now.icon} {now.label}
        </span>
      )}
      {showNext && (
        <span className="text-[10px] text-slate-400">
          예보 {WEATHER[next!.id].icon}{compact ? '' : ` ${WEATHER[next!.id].label} (${next!.days}일 내)`}
        </span>
      )}
    </div>
  );
}
