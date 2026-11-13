import EventScene, { type SceneKind } from './components/EventScene';
import { NEW_SCENE_KINDS } from './components/EventScenes2';

const OLD: SceneKind[] = ['dawn_barrage', 'headquarters', 'bridge', 'burning_city', 'port', 'trench', 'landing', 'advance', 'winter_march', 'talks', 'conscripts', 'memorial'];

/** 개발 전용: #scenes 는 전체, #scenes:new 는 새 장면, #scene:이름 은 한 장면 확대 */
export default function DevGallery() {
  const h = location.hash;
  if (h.startsWith('#scene:')) {
    return <div className="w-[760px] bg-black"><EventScene kind={h.split(':')[1] as SceneKind} title="장면 확대 점검" date="1950-06-29" kicker="점검" /></div>;
  }
  const kinds: SceneKind[] = h === '#scenes:new' ? NEW_SCENE_KINDS : OLD;
  return (
    <div className="grid grid-cols-3 gap-2 bg-black p-2" style={{ zoom: 0.26 }}>
      {kinds.map((k) => <div key={k} className="relative w-[760px]"><EventScene kind={k} title={k} date="1950-06-25" kicker={k} /></div>)}
    </div>
  );
}
