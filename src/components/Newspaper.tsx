import { useMemo, useState } from 'react';
import { useGame } from '../store/gameStore';
import { buildNewspaper } from '../game/newspaper';
import EventScene from './EventScene';
import { BriefingDetails, Shell } from './Modals';

/** 턴이 끝날 때 뜨는 "오늘의 전황" 신문. 기존 브리핑의 정보를 신문 형식으로 보여 주고, 상세 보고서는 펼쳐서 본다. */
export default function NewspaperModal() {
  const game = useGame((s) => s.game);
  const setModal = useGame((s) => s.setModal);
  const paper = useMemo(() => buildNewspaper(game), [game]);
  const [detail, setDetail] = useState(false);
  const ink = 'text-[#1b1812]';
  return (
    <Shell width={780}>
      <div
        className={'relative rounded border-2 border-[#3a3222] p-3 shadow-[0_12px_50px_rgba(0,0,0,0.8)] sm:p-5 ' + ink}
        style={{ background: 'repeating-linear-gradient(0deg, rgba(120,100,60,.05) 0 2px, transparent 2px 4px), #e9e1c8' }}
      >
        {/* 제호 */}
        <div className="border-b-[3px] border-double border-[#2a2418] pb-2 text-center">
          <div className="flex items-end justify-between text-[10.5px] tracking-wider text-[#5a4e34]">
            <span>제 {paper.issue}호</span>
            <span>{paper.dateLine}</span>
          </div>
          <div className="font-serif text-[38px] font-black leading-none tracking-[0.25em] sm:text-[48px]">{paper.masthead}</div>
          <div className="mt-1 text-[10.5px] tracking-[0.3em] text-[#5a4e34]">戰線日報 · 오늘의 전황</div>
        </div>
        <div className="border-b border-[#2a2418] py-1 text-center text-[11px] text-[#5a4e34]">{paper.kicker}</div>

        {/* 머리기사 */}
        <div className="mt-3">
          <h2 className="font-serif text-[26px] font-black leading-[1.2] sm:text-[34px]">{paper.headline}</h2>
          <p className="mt-1 font-serif text-[14px] italic leading-[1.5] text-[#3a3222] sm:text-[15px]">{paper.subhead}</p>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div>
            <div className="overflow-hidden rounded-sm border border-[#2a2418]" style={{ filter: 'grayscale(1) sepia(.5) contrast(1.15) brightness(1.04)' }}>
              <EventScene kind={paper.scene} title={paper.headline} date={paper.dateLine} hideTitle />
            </div>
            <div className="mt-2 flex flex-col gap-2 font-serif text-[14px] leading-[1.75] [text-align:justify]">
              {paper.lead.map((p, i) => <p key={i} className={i === 0 ? 'first-letter:float-left first-letter:mr-1 first-letter:text-[34px] first-letter:font-black first-letter:leading-[0.9]' : ''}>{p}</p>)}
            </div>
          </div>

          <div className="flex flex-col gap-3 md:border-l md:border-[#2a2418] md:pl-4">
            {paper.articles.map((a) => (
              <div key={a.title} className="border-b border-[#8a7d5c] pb-2">
                <div className="font-serif text-[15px] font-black leading-tight">{a.title}</div>
                <p className="mt-0.5 font-serif text-[12.5px] leading-[1.6] text-[#2f2a1c]">{a.body}</p>
              </div>
            ))}
            {paper.brief.length > 0 && (
              <div className="rounded-sm border border-[#2a2418] bg-[#ddd3b4] p-2">
                <div className="mb-1 text-[11px] font-black tracking-widest">단신</div>
                <ul className="flex flex-col gap-1 font-serif text-[12px] leading-[1.55]">
                  {paper.brief.map((b, i) => <li key={i}>· {b}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* 숫자 요약 */}
        <div className="mt-3 grid grid-cols-2 border-y-2 border-[#2a2418] py-1.5 text-center sm:grid-cols-4">
          {paper.stats.map((s) => (
            <div key={s.label} className="px-1">
              <div className="text-[10.5px] text-[#5a4e34]">{s.label}</div>
              <div className="font-serif text-[18px] font-black tabular-nums">{s.value}</div>
            </div>
          ))}
        </div>

        {detail && (
          <div className="mt-3 rounded bg-[#10161d] p-3 text-slate-200">
            <div className="panel-title mb-2">▍상세 보고서 — 브리핑 원문</div>
            <BriefingDetails />
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button className="btn !border-[#5a4e34] !bg-[#d6ccaa] !text-[#1b1812] hover:!bg-[#cfc39c]" onClick={() => setDetail(!detail)}>{detail ? '상세 보고서 접기 ▲' : '상세 보고서 보기 ▼'}</button>
          <button className="btn btn-primary !px-6 !py-2 !text-[14px]" onClick={() => setModal(null)}>다음 턴 시작</button>
        </div>
      </div>
    </Shell>
  );
}
