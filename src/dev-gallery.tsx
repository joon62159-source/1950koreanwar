import EventScene, { type SceneKind } from './components/EventScene';
import Portrait, { PortraitFrame, type PortraitId } from './components/Portrait';

const KINDS: SceneKind[] = ['dawn_barrage', 'headquarters', 'bridge', 'burning_city', 'port', 'trench', 'landing', 'advance', 'winter_march', 'talks', 'conscripts', 'memorial'];
const FACES: PortraitId[] = ['macarthur', 'rhee', 'truman', 'walker', 'kim', 'peng', 'mao', 'stalin'];

/** 개발 전용: #scenes 는 장면, #portraits 는 인물 초상, #portrait-big 은 맥아더 확대 */
export default function DevGallery() {
  if (location.hash === '#portrait-big') {
    return (
      <div className="flex gap-4 bg-black p-4">
        <div style={{ width: 480, height: 600 }}><Portrait id="macarthur" className="h-full w-full" /></div>
        <div style={{ width: 360, height: 450 }}><Portrait id="stalin" className="h-full w-full" /></div>
      </div>
    );
  }
  if (location.hash.startsWith('#scene:')) {
    const [, kind, portrait] = location.hash.split(':');
    return <div className="w-[760px] bg-black"><EventScene kind={kind as SceneKind} title="장면 확대 점검" date="1950-06-29" kicker="점검" portrait={portrait as PortraitId | undefined} /></div>;
  }
  if (location.hash === '#portraits') {
    return (
      <div className="grid grid-cols-4 gap-3 bg-black p-3">
        {FACES.map((f) => <PortraitFrame key={f} id={f} />)}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-2 bg-black p-2" style={{ zoom: 0.2 }}>
      {KINDS.map((k) => <div key={k} className="w-[760px]"><EventScene kind={k} title={k} date="1950-06-25" kicker="장면 점검" /></div>)}
    </div>
  );
}
