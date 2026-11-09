import { MAP, isLand, neighbors } from '../src/game/map';
import { PROVINCE_SEEDS } from '../src/data/provinceSeeds';
const out = PROVINCE_SEEDS.filter(s=>!isLand(s.lon,s.lat)).map(s=>s.id);
console.log('count', PROVINCE_SEEDS.length, 'seats outside land:', out.join(','));
// connectivity (land+sea)
const start='seoul'; const seen=new Set([start]); const q=[start];
while(q.length){const c=q.pop()!; for(const n of neighbors(c)) if(!seen.has(n)){seen.add(n);q.push(n);}}
console.log('unreachable', PROVINCE_SEEDS.filter(s=>!seen.has(s.id)).map(s=>s.id).join(','));
for (const s of PROVINCE_SEEDS) console.log(s.id.padEnd(12), neighbors(s.id).length, neighbors(s.id).join(' '));
