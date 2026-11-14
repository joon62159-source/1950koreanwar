import { useEffect, useState } from 'react';

const QUERY = '(max-width: 820px)';

/** 모바일 화면 여부. 주소에 ?m=1 을 붙이면 데스크톱에서도 모바일 화면을, ?m=0 이면 항상 데스크톱 화면을 쓴다. */
export function computeIsMobile(): boolean {
  if (typeof window === 'undefined') return false;
  const m = new URLSearchParams(window.location.search).get('m');
  if (m === '1') return true;
  if (m === '0') return false;
  return window.matchMedia(QUERY).matches;
}

export function useIsMobile(): boolean {
  const [v, setV] = useState(computeIsMobile);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const f = () => setV(computeIsMobile());
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  return v;
}
