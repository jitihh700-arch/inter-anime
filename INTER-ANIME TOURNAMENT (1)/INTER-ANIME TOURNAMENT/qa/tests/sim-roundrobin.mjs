import { PLAYABLE } from '../../js/engine/roster.js';
import { simulateBout, Match } from '../../js/engine/sim.js';
import { makeAI } from '../../js/engine/ai.js';
const wins = {}; let times = [], ko = 0, total = 0;
const t0 = Date.now();
for (const a of PLAYABLE) for (const b of PLAYABLE) {
  if (a === b) continue;
  const r = simulateBout(a, b, makeAI, 1, 1);
  total++; if (r.reason === 'KO') ko++; times.push(r.time);
  const w = r.winner === 0 ? a.id : b.id; wins[w] = (wins[w] || 0) + 1;
}
times.sort((x,y)=>x-y);
console.log('bouts', total, 'KO', ko, 'median time', times[times.length>>1].toFixed(1), 'max', times.at(-1).toFixed(1), 'ms', Date.now()-t0);
console.log(Object.entries(wins).sort((x,y)=>y[1]-x[1]).map(([k,v])=>k+':'+v).join(' '));
// special usage check: each fighter's special lands damage on a stationary dummy
for (const a of PLAYABLE) {
  const dummy = PLAYABLE.find(x => x.id !== a.id);
  const m = new Match(a, dummy, { startImmediately: true });
  const [f, d] = m.fighters; f.x = 0; f.z = -2.2; d.x = 0; d.z = 0; m.faceOpp(f, 99); m.faceOpp(d, 99);
  if (['projectile','beam','teleport','dash','clones','gojo'].includes(a.special.type)) { f.z = -6; }
  f.intent.special = true;
  for (let i = 0; i < 240; i++) { m.step(1/60); }
  console.log(a.id.padEnd(8), a.special.type.padEnd(10), 'dummy hp', d.hp, 'cd', f.cd.special.toFixed(1));
}
