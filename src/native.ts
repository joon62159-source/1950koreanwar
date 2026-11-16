import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { useGame } from './store/gameStore';

/** 앱(안드로이드)으로 실행 중인지 */
export const isNativeApp = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

/** 웹 폰트: 웹 브라우저에서만 불러온다. 앱은 기기 기본 글꼴(한글 노토)을 써서 외부 서버로 요청을 보내지 않는다. */
export function loadWebFonts(): void {
  if (isNativeApp()) return;
  const pre = document.createElement('link');
  pre.rel = 'preconnect';
  pre.href = 'https://fonts.googleapis.com';
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&family=Noto+Serif+KR:wght@600;900&display=swap';
  document.head.append(pre, css);
}

/** 화면 안쪽 요소(시트 등)가 뒤로가기를 처리할 수 있게 하는 이벤트 이름 */
export const APP_BACK_EVENT = 'app-back';

let lastBackAt = 0;

/** 앱 전용 초기화: 상태바 색, 뒤로가기 버튼(창 닫기 → 시트 닫기 → 두 번 눌러 종료) */
export function initNative(): void {
  loadWebFonts();
  if (!isNativeApp()) return;
  void StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
  void StatusBar.setBackgroundColor({ color: '#0f151c' }).catch(() => undefined);

  void App.addListener('backButton', () => {
    const s = useGame.getState();
    // 1) 튜토리얼
    if (s.tutorial) return s.setTutorial(false);
    // 2) 결정해야 할 이벤트가 있으면 닫을 수 없다 (선택을 해야 한다)
    if (s.game.pendingEvents.length > 0 && !s.playback) {
      s.notify('먼저 결정을 내려 주세요.', 'err');
      return;
    }
    // 3) 열려 있는 팝업
    if (s.modal) return s.setModal(null);
    // 4) 화면 안쪽: 상황·기록 시트, 명령 취소, 지역 선택 해제
    const ev = new CustomEvent(APP_BACK_EVENT, { detail: { handled: false } });
    window.dispatchEvent(ev);
    if ((ev.detail as { handled: boolean }).handled) return;
    // 5) 두 번 연속 누르면 종료
    const now = Date.now();
    if (now - lastBackAt < 2000) {
      void App.exitApp();
      return;
    }
    lastBackAt = now;
    s.notify('한 번 더 누르면 종료됩니다.');
  });
}
