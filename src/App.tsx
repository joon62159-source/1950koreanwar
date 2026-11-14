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
  return useIsMobile() ? <MobileApp /> : <DesktopApp />;
}
