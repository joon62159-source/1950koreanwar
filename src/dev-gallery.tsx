import EventScene, { type SceneKind } from './components/EventScene';

const KINDS: SceneKind[] = ['dawn_barrage', 'headquarters', 'bridge', 'burning_city', 'port', 'trench', 'landing', 'advance', 'winter_march', 'talks', 'conscripts', 'memorial'];

/** 개발 전용: #scenes 주소에서 모든 이벤트 장면을 한 화면에 확인한다 */
export default function DevGallery() {
  return (
    <div className="grid grid-cols-3 gap-2 bg-black p-2" style={{ zoom: 0.2 }}>
      {KINDS.map((k) => <div key={k} className="w-[760px]"><EventScene kind={k} title={k} date="1950-06-25" kicker="장면 점검" /></div>)}
    </div>
  );
}
