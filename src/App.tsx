import { useIsMobile } from './components/useIsMobile';
import { useGame } from './store/gameStore';
import TopBar from './components/TopBar';
import LeftPanel from './components/LeftPanel';
import RightPanel from './components/RightPanel';
import BottomPanel from './components/BottomPanel';
import MapView from './components/MapView';
import PlaybackPanel from './components/PlaybackPanel';
import ModalLayer from './components/ModalLayer';
import MobileApp from './mobile/MobileApp';
import TitleScreen from './components/TitleScreen';
import { MusicControl, MusicDirector } from './components/MusicControl';

function DesktopApp() {
  const playing = useGame((s) => s.playback !== null);
  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <LeftPanel />
        <main className="relative min-w-0 flex-1" data-tour="map">
          <MapView />
        </main>
        <RightPanel />
      </div>
      {playing && <PlaybackPanel />}
      <BottomPanel />
      <ModalLayer />
    </div>
  );
}

/** 화면 폭에 따라 모바일(세로) 화면 또는 데스크톱 화면을 보여 준다 */
export default function App() {
  const mobile = useIsMobile();
  const screen = useGame((s) => s.screen);
  return (
    <>
      {mobile ? <MobileApp /> : <DesktopApp />}
      {screen === 'title' && <TitleScreen />}
      <MusicDirector />
      {screen === 'title' && <MusicControl className="fixed bottom-3 left-3 z-[90] w-[230px] rounded border border-ink-600 bg-[#0f151c]/90 p-1.5" />}
    </>
  );
}
