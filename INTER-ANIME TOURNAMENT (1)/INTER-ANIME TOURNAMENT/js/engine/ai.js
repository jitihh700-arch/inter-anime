// CPU opponent. Produces the same intent object a human player produces, so the AI
// obeys exactly the same HP, damage, cooldown and movement rules.

const RANGED = new Set(['beam', 'projectile', 'flurry', 'gojo']);

export const AI_LEVELS = [
  { name: 'Easy', react: [0.32, 0.5], block: 0.18, dodge: 0.08, aggr: 0.45, heavy: 0.18, special: 0.35, combo: 0.4 },
  { name: 'Normal', react: [0.18, 0.32], block: 0.38, dodge: 0.16, aggr: 0.65, heavy: 0.26, special: 0.6, combo: 0.7 },
  { name: 'Hard', react: [0.1, 0.2], block: 0.55, dodge: 0.26, aggr: 0.8, heavy: 0.3, special: 0.85, combo: 0.92 },
];

export function makeAI(level = 1) { return new AIController(level); }

export class AIController {
  constructor(level = 1) {
    this.L = AI_LEVELS[Math.max(0, Math.min(2, level))];
    this.timer = 0;
    this.plan = 'approach';
    this.strafe = Math.random() < 0.5 ? 1 : -1;
    this.strafeT = 0;
    this.holdBlock = 0;
    this.rng = Math.random;
  }

  update(me, opp, match, dt) {
    const it = me.intent;
    const L = this.L;
    it.block = false;
    if (me.state === 'ko' || me.state === 'win' || opp.state === 'ko') { it.mx = it.mz = 0; return; }

    const dx = opp.x - me.x, dz = opp.z - me.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const nx = dx / dist, nz = dz / dist;
    const sp = me.def.special;
    const reach = me.def.stats.lightRange + 0.35;

    // keep holding guard for a short while once decided
    if (this.holdBlock > 0) { this.holdBlock -= dt; it.block = true; it.mx = it.mz = 0; }

    // combo continuation: keep pressing light while the target is reeling
    if (me.state === 'attack' && me.act && me.act.kind === 'light' && opp.state === 'hitstun' && this.rng() < L.combo * dt * 12) it.light = true;

    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = L.react[0] + this.rng() * (L.react[1] - L.react[0]);

    // --- threats -------------------------------------------------------
    const oppAttacking = (opp.state === 'attack' && opp.act && opp.act.t < opp.act.startup + 0.05) || (opp.state === 'special' && opp.act && opp.act.t < opp.def.special.charge + 0.1);
    const threatRange = opp.state === 'special' ? (RANGED.has(opp.def.special.type) ? 20 : 7) : (opp.def.stats.heavyRange + 1.2);
    const incoming = match.projectiles.some((p) => p.owner === opp.side && Math.hypot(p.x - me.x, p.z - me.z) < 7 && ((me.x - p.x) * p.vx + (me.z - p.z) * p.vz) > 0);
    if (!me.busy && (oppAttacking && dist < threatRange || incoming)) {
      const r = this.rng();
      if (r < L.dodge && me.cd.dodge <= 0) {
        const side = this.rng() < 0.5 ? 1 : -1;
        it.mx = -nz * side; it.mz = nx * side; it.dodge = true; return;
      }
      if (r < L.dodge + L.block) { this.holdBlock = 0.35 + this.rng() * 0.3; it.block = true; it.mx = it.mz = 0; return; }
    }
    if (this.holdBlock > 0) return;

    // --- getting up / after being hit: sometimes escape -----------------
    if (me.state === 'getup' && this.rng() < L.dodge * 1.5) { it.dodge = true; it.mx = -nx; it.mz = -nz; return; }
    if (me.busy) { it.mx = it.mz = 0; return; }

    // --- special --------------------------------------------------------
    if (sp && me.specialReady() && this.rng() < L.special) {
      const t = sp.type;
      let good = false;
      if (t === 'beam') good = dist < sp.length - 2 && dist > 2.5;
      else if (t === 'projectile') good = dist > 3 && dist < 15;
      else if (t === 'flurry') good = dist < sp.range - 0.5;
      else if (t === 'gojo') good = dist < sp.pullRange - 1 || oppAttacking;
      else if (t === 'teleport') good = dist < 12;
      else if (t === 'dash' || t === 'clones') good = dist > 2 && dist < 9;
      else if (t === 'punch') good = dist < sp.range + 0.2 && opp.state !== 'down';
      else if (t === 'aoe' || t === 'spin') good = dist < (sp.radius || 3) - 0.4;
      if (good && opp.state !== 'getup' && opp.state !== 'down') { it.special = true; it.mx = it.mz = 0; return; }
    }

    // --- neutral game ---------------------------------------------------
    this.strafeT -= this.timer;
    if (this.strafeT <= 0) { this.strafe = -this.strafe; this.strafeT = 1 + this.rng() * 2; }
    const lowHp = me.hp < 300;
    const aggr = L.aggr + (lowHp ? 0.1 : 0) - (opp.state === 'getup' ? 0.4 : 0);

    if (dist <= reach) {
      if (opp.state === 'down' || opp.state === 'getup') { it.mx = -nx * 0.6 - nz * this.strafe * 0.6; it.mz = -nz * 0.6 + nx * this.strafe * 0.6; return; }
      if (this.rng() < aggr) {
        if (this.rng() < L.heavy && me.cd.heavy <= 0) it.heavy = true; else it.light = true;
        it.mx = nx * 0.3; it.mz = nz * 0.3;
      } else if (this.rng() < 0.5) {
        this.holdBlock = 0.25; it.block = true; it.mx = it.mz = 0;
      } else {
        it.mx = -nx * 0.7 - nz * this.strafe; it.mz = -nz * 0.7 + nx * this.strafe; // back off and circle
      }
      return;
    }

    // keep a reasonable fighting distance: approach, with some circling
    const circ = dist < 4 ? 0.6 : 0.25;
    if (dist > 6 && this.rng() < 0.08 && me.grounded) it.jump = true;
    if (dist > 7 && this.rng() < 0.12 && me.cd.dodge <= 0) it.dodge = true; // dash in
    it.mx = nx - nz * this.strafe * circ;
    it.mz = nz + nx * this.strafe * circ;
  }
}
