import { useEffect, useSyncExternalStore } from 'react';
import { music, type Mood } from '../audio/music';
import { useGame } from '../store/gameStore';

function useMusic() {
  return useSyncExternalStore(
    (cb) => music.subscribe(cb),
    () => `${music.on}|${music.volume}`,
  );
}

/** 화면 상태에 맞춰 음악 분위기를 바꾸고, 첫 터치/클릭에서 소리를 켠다. 화면에는 아무것도 그리지 않는다. */
export function MusicDirector() {
  const screen = useGame((s) => s.screen);
  const playing = useGame((s) => s.playback !== null);
  const result = useGame((s) => s.game.outcome?.result ?? null);
  useEffect(() => {
    const go = () => music.unlock();
    window.addEventListener('pointerdown', go, { once: true });
    window.addEventListener('keydown', go, { once: true });
    return () => {
      window.removeEventListener('pointerdown', go);
      window.removeEventListener('keydown', go);
    };
  }, []);
  useEffect(() => {
    let m: Mood = 'campaign';
    if (screen === 'title') m = 'title';
    else if (result) m = result === 'victory' ? 'victory' : 'defeat';
    else if (playing) m = 'battle';
    music.setMood(m);
  }, [screen, playing, result]);
  return null;
}

/** 메뉴·시작 화면에 놓는 음악 켜기/끄기와 음량 조절 */
export function MusicControl({ className = '' }: { className?: string }) {
  useMusic();
  return (
    <div className={'flex items-center gap-2 ' + className}>
      <button className="btn !px-3 !py-2" onClick={() => { music.unlock(); music.setOn(!music.on); }}>
        {music.on ? '🔊 음악 끄기' : '🔇 음악 켜기'}
      </button>
      <input
        type="range" min={0} max={100} value={Math.round(music.volume * 100)} disabled={!music.on}
        aria-label="음량" className="h-1 min-w-0 flex-1 accent-[#c9a24b]"
        onChange={(e) => { music.unlock(); music.setVolume(Number(e.target.value) / 100); }}
      />
    </div>
  );
}
