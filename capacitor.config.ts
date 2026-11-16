import type { CapacitorConfig } from '@capacitor/cli';

/**
 * 안드로이드 앱 설정 (Capacitor).
 * appId(패키지명)는 구글 플레이에 올린 뒤에는 바꿀 수 없다. 첫 업로드 전에 원하는 이름으로 바꿔도 된다.
 */
const config: CapacitorConfig = {
  appId: 'com.joon62159.korean625',
  appName: '6.25: 운명의 한반도',
  webDir: 'dist',
  backgroundColor: '#0b0f14',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#0b0f14',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f151c',
      overlaysWebView: false,
    },
  },
};

export default config;
