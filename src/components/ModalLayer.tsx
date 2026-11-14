import { useEffect, useRef } from 'react';
import { useGame } from '../store/gameStore';
import Tutorial, { tutorialSeen } from './Tutorial';
import { AllBattlesModal, BattleModal, BriefingModal, EventModal, GameOverModal, HelpModal, LandingReportModal, ManagementModal, MenuModal, MobilizedModal } from './Modals';

/** 데스크톱·모바일이 함께 쓰는 팝업 계층: 모달, 이벤트 창, 토스트, 튜토리얼 */
export default function ModalLayer() {
  const modal = useGame((s) => s.modal);
  const pending = useGame((s) => s.game.pendingEvents.length);
  const toast = useGame((s) => s.toast);
  const outcome = useGame((s) => s.game.outcome);
  const playing = useGame((s) => s.playback !== null);
  const turn = useGame((s) => s.game.turn);
  const setTutorial = useGame((s) => s.setTutorial);
  const tutorialAsked = useRef(false);
  // 첫 플레이: 첫 이벤트·브리핑을 닫은 뒤 한 번만 안내를 띄운다 (건너뛰기 가능)
  useEffect(() => {
    if (tutorialAsked.current || turn !== 1 || tutorialSeen()) return;
    if (modal === null && pending === 0 && !playing && !outcome) {
      tutorialAsked.current = true;
      setTutorial(true);
    }
  }, [modal, pending, playing, outcome, turn, setTutorial]);
  return (
    <>
      <Tutorial />
      {toast && (
        <div className={'fade-in fixed left-1/2 top-16 z-[80] max-w-[92vw] -translate-x-1/2 rounded border px-4 py-2 text-[13px] shadow-lg ' + (toast.kind === 'ok' ? 'border-emerald-700 bg-emerald-950/95 text-emerald-100' : 'border-red-700 bg-red-950/95 text-red-100')}>
          {toast.text}
        </div>
      )}
      {modal === 'menu' && <MenuModal />}
      {modal === 'help' && <HelpModal />}
      {!playing && modal === 'briefing' && pending === 0 && !outcome && <BriefingModal />}
      {modal === 'battle' && <BattleModal />}
      {modal === 'allBattles' && <AllBattlesModal />}
      {modal === 'landing' && <LandingReportModal />}
      {modal === 'manage' && <ManagementModal />}
      {modal === 'mobilized' && <MobilizedModal />}
      {!playing && modal === 'gameover' && <GameOverModal />}
      {!playing && pending > 0 && modal !== 'landing' && modal !== 'mobilized' && modal !== 'manage' && <EventModal />}
    </>
  );
}
