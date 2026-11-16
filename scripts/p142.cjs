const fs = require('fs');
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8');
  for (const [a, b] of pairs) { if (!s.includes(a)) throw new Error(f + ': ' + a.slice(0, 70)); s = s.replace(a, () => b); }
  fs.writeFileSync(f, s);
};

// 상단바(PC): 날짜 칸 오른쪽에 날씨
edit('src/components/TopBar.tsx', [
  ["import { Bar, colorFor, fmt } from './common';", "import { Bar, colorFor, fmt } from './common';\nimport WeatherBadge from './WeatherBadge';"],
  ["      <div className=\"hidden xl:block\"><Metric label=\"국가\"", "      <WeatherBadge />\n      <div className=\"hidden xl:block\"><Metric label=\"국가\""],
]);

// 모바일 상단: 날짜 칸 옆 아이콘
edit('src/mobile/MobileApp.tsx', [
  ["import { Bar, colorFor, fmt } from '../components/common';", "import { Bar, colorFor, fmt } from '../components/common';\nimport WeatherBadge from '../components/WeatherBadge';"],
  ["      <button className=\"flex min-w-0 flex-1 items-center gap-1 rounded bg-ink-800/60 px-1.5 active:bg-ink-700\" onClick={onOpen} aria-label=\"상세 상황\">", "      <WeatherBadge compact />\n      <button className=\"flex min-w-0 flex-1 items-center gap-1 rounded bg-ink-800/60 px-1.5 active:bg-ink-700\" onClick={onOpen} aria-label=\"상세 상황\">"],
]);

// 상황 패널: 날씨 효과
edit('src/components/LeftPanel.tsx', [
  ["import SupplyPanel from './SupplyPanel';", "import SupplyPanel from './SupplyPanel';\nimport { weatherAt, weatherEffectLines } from '../game/weather';"],
  ["      <SupplyPanel />\n", `      {(() => {
        const wx = weatherAt(game.date);
        if (wx.id === 'clear') return null;
        return (
          <section>
            <div className="panel-title mb-1">▍날씨 · 계절</div>
            <div className="rounded border border-ink-600 bg-ink-800/60 p-2 text-[11.5px] leading-[1.55]">
              <div className="font-bold text-brass">{wx.icon} {wx.label}</div>
              <div className="text-slate-300">{wx.blurb}</div>
              <ul className="mt-1 list-disc pl-4 text-slate-400">{weatherEffectLines(wx.id).map((l) => <li key={l}>{l}</li>)}</ul>
              <div className="mt-1 text-[10.5px] text-slate-500">양쪽 모두에 똑같이 적용됩니다. 보급이 좋은 부대일수록 피해가 적습니다.</div>
            </div>
          </section>
        );
      })()}
      <SupplyPanel />
`],
]);

// 이벤트 창 전황: 날씨 이벤트의 영향과 취약 부대
edit('src/data/eventNarrative.ts', [
  ["import { STORY_NARRATIVES } from './eventNarrativeStory';", "import { STORY_NARRATIVES } from './eventNarrativeStory';\nimport { weatherEffectLines } from '../game/weather';"],
  ["  switch (eventId) {\n    case 'bloody_battle': {", `  if (eventId.startsWith('weather_')) {
    const wid = eventId.includes('monsoon') ? 'monsoon' : eventId.includes('thaw') ? 'thaw' : 'cold';
    lines.unshift(\`날씨의 영향: \${weatherEffectLines(wid).join(' · ')}\`);
    if (wid === 'cold') {
      const weak = Object.values(state.units).filter((u) => u.side === side && u.supply < 50).length;
      lines.unshift(\`보급이 약한 아군 부대(보급 50 미만) \${weak}개 — 혹한에 병력을 잃을 위험이 큽니다\`);
    }
  }
  switch (eventId) {
    case 'bloody_battle': {`],
]);
console.log('ok');
