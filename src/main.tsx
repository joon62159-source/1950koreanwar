import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import DevGallery from './dev-gallery';
import { useGame } from './store/gameStore';

// 개발 모드에서만 콘솔 디버깅용으로 스토어를 노출한다
if (import.meta.env.DEV) (window as unknown as { __game: typeof useGame }).__game = useGame;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {import.meta.env.DEV && (location.hash === '#scenes' || location.hash.startsWith('#portrait') || location.hash.startsWith('#scene:')) ? <DevGallery /> : <App />}
  </StrictMode>,
);
