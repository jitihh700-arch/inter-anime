// Shared real-time combat simulation. Rendering-independent: the same code runs
// live matches (rendered) and CPU-vs-CPU tournament bouts (headless, same rules).

export const ARENA_R = 13.5;      // fighters are clamped inside this radius
export const MAX_HP = 1000;
export const TIME_LIMIT = 99;
const GRAV = 26;
const BODY_R = 0.55;

let projSeq = 1;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

export function emptyIntent() {
  return { mx: 0, mz: 0, block: false, jump: false, light: false, heavy: false, special: false, dodge: false };
}

export class Fighter {
  constructor(def, side) {
    this.def = def;
    this.side = side;
    this.hp = MAX_HP;
    this.x = side === 0 ? -4.5 : 4.5; this.z = 0; this.y = 0;
    this.mvx = 0; this.mvz = 0;        // locomotion velocity
    this.vx = 0; this.vz = 0; this.vy = 0; // impulse (knockback / dodge) velocity
    this.facing = side === 0 ? Math.PI / 2 : -Math.PI / 2;
    this.state = 'idle'; this.t = 0; this.stun = 0;
    this.act = null;
    this.cd = { light: 0, heavy: 0, special: 0, dodge: 0 };
    this.buf = { light: 0, heavy: 0, special: 0, dodge: 0, jump: 0 };
    this.invuln = 0; this.infinity = 0; this.hidden = false;
    this.comboStep = 0; this.comboWindow = 0;
    this.combo = 0; this.comboTimer = 0;
    this.intent = emptyIntent();
    this.stats = { dealt: 0, hits: 0, maxCombo: 0, blocked: 0 };
    this.flash = 0;
  }
  get grounded() { return this.y <= 0.0001; }
  get fx() { return Math.sin(this.facing); }
  get fz() { return Math.cos(this.facing); }
  get busy() { return ['attack', 'special', 'hitstun', 'down', 'getup', 'dodge', 'ko', 'win'].includes(this.state); }
  specialReady() { return this.cd.special <= 0; }
}

function attackDef(f, kind, step) {
  const s = f.def.stats;
  if (kind === 'light') {
    const fin = step === 2;
    return { kind, startup: 0.085, active: 0.08, recovery: fin ? 0.3 : 0.17, dmg: Math.round(s.light * (fin ? 1.35 : 1)),
      range: s.lightRange, arc: 80, knock: fin ? 6.5 : 2.2, stun: fin ? 0.42 : 0.3, launch: fin ? 2.5 : 0, lunge: 3, step };
  }
  return { kind, startup: 0.3, active: 0.1, recovery: 0.4, dmg: s.heavy, range: s.heavyRange, arc: 90, knock: 9.5, stun: 0.55, launch: 5.5, lunge: 4.5 };
}

export class Match {
  constructor(defA, defB, opts = {}) {
    this.fighters = [new Fighter(defA, 0), new Fighter(defB, 1)];
    this.controllers = [opts.ctrlA || null, opts.ctrlB || null];
    this.projectiles = [];
    this.events = [];
    this.time = 0;
    this.timeLimit = opts.timeLimit ?? TIME_LIMIT;
    this.suddenDeath = false;
    this.koTimer = -1;
    this.over = false;
    this.winner = -1;
    this.reason = '';
    this.started = opts.startImmediately ?? false;
    this.introTimer = opts.intro ?? 0;
  }

  opp(f) { return this.fighters[1 - f.side]; }
  emit(e) { this.events.push(e); }

  step(dt) {
    if (this.over) return;
    if (!this.started) {
      this.introTimer -= dt;
      for (const f of this.fighters) { this.faceOpp(f, 99); }
      if (this.introTimer <= 0) { this.started = true; this.emit({ type: 'fight' }); }
      return;
    }
    const ending = this.koTimer >= 0;
    if (!ending) {
      this.time += dt;
      if (this.time >= this.timeLimit && !this.suddenDeath) this.timeUp();
    }
    for (const f of this.fighters) {
      const c = this.controllers[f.side];
      if (c && !ending) c.update(f, this.opp(f), this, dt);
      else if (ending) f.intent = emptyIntent();
      this.bufferInput(f, dt);
    }
    for (const f of this.fighters) this.updateFighter(f, dt);
    this.separate();
    this.updateProjectiles(dt);
    for (const f of this.fighters) this.intent0(f);
    if (ending) {
      this.koTimer -= dt;
      if (this.koTimer <= 0) this.over = true;
    }
  }

  timeUp() {
    const [a, b] = this.fighters;
    if (a.hp === b.hp) { this.suddenDeath = true; this.emit({ type: 'suddenDeath' }); return; }
    this.finish(a.hp > b.hp ? 0 : 1, 'TIME');
  }

  finish(winner, reason) {
    if (this.koTimer >= 0) return;
    this.winner = winner; this.reason = reason; this.koTimer = reason === 'KO' ? 2.2 : 1.6;
    const w = this.fighters[winner], l = this.fighters[1 - winner];
    if (l.state !== 'ko') { l.state = 'ko'; l.t = 0; }
    l.act = null;
    w.act = null; w.state = 'win'; w.t = 0; w.infinity = 0; w.hidden = false;
    this.projectiles.length = 0;
    this.emit({ type: 'ko', winner, reason });
  }

  bufferInput(f, dt) {
    for (const k of ['light', 'heavy', 'special', 'dodge', 'jump']) {
      if (f.intent[k]) f.buf[k] = 0.18; else f.buf[k] = Math.max(0, f.buf[k] - dt);
    }
  }
  intent0(f) { f.intent.light = f.intent.heavy = f.intent.special = f.intent.dodge = f.intent.jump = false; }

  faceOpp(f, rate) {
    const o = this.opp(f);
    const target = Math.atan2(o.x - f.x, o.z - f.z);
    const d = angDiff(target, f.facing);
    f.facing += clamp(d, -rate, rate);
  }

  // ---------------------------------------------------------------- fighter
  updateFighter(f, dt) {
    f.t += dt;
    for (const k in f.cd) f.cd[k] = Math.max(0, f.cd[k] - dt);
    f.invuln = Math.max(0, f.invuln - dt);
    f.infinity = Math.max(0, f.infinity - dt);
    f.flash = Math.max(0, f.flash - dt);
    f.comboWindow = Math.max(0, f.comboWindow - dt);
    f.comboTimer -= dt; if (f.comboTimer <= 0) f.combo = 0;
    let wantMove = false;

    switch (f.state) {
      case 'ko': case 'win':
        break;
      case 'hitstun':
        if (f.t >= f.stun && f.grounded) this.toIdle(f);
        break;
      case 'down':
        if (f.t >= f.stun && f.grounded) { f.state = 'getup'; f.t = 0; f.invuln = 0.55; }
        break;
      case 'getup':
        if (f.t >= 0.4) this.toIdle(f);
        break;
      case 'blockstun':
        if (f.t >= f.stun) { f.state = 'block'; f.t = 0; }
        break;
      case 'dodge':
        if (f.t >= 0.32) { this.toIdle(f); f.vx *= 0.3; f.vz *= 0.3; }
        break;
      case 'attack':
        this.updateAttack(f, dt);
        break;
      case 'special':
        this.updateSpecial(f, dt);
        break;
      default: { // idle / move / block / air
        this.faceOpp(f, 14 * dt);
        if (f.buf.special && f.specialReady() && f.def.special) { this.startSpecial(f); break; }
        if (f.buf.heavy && f.cd.heavy <= 0) { this.startAttack(f, 'heavy'); break; }
        if (f.buf.light && f.cd.light <= 0) { this.startAttack(f, 'light'); break; }
        if (f.buf.dodge && f.cd.dodge <= 0 && f.grounded) { this.startDodge(f); break; }
        if (f.buf.jump && f.grounded && !f.intent.block) { f.vy = 10; f.buf.jump = 0; this.emit({ type: 'jump', side: f.side }); }
        if (f.intent.block && f.grounded) { if (f.state !== 'block') { f.state = 'block'; f.t = 0; } }
        else if (f.state === 'block') this.toIdle(f);
        if (f.state !== 'block') {
          wantMove = true;
          const m = Math.hypot(f.intent.mx, f.intent.mz);
          f.state = m > 0.1 ? 'move' : 'idle';
        }
      }
    }

    // locomotion
    const sp = f.def.stats.speed * (f.grounded ? 1 : 0.85);
    let tx = 0, tz = 0;
    if (wantMove) {
      const m = Math.hypot(f.intent.mx, f.intent.mz);
      if (m > 0.1) { const n = Math.min(1, m) / m; tx = f.intent.mx * n * sp; tz = f.intent.mz * n * sp; }
    }
    const acc = Math.min(1, dt * 14);
    f.mvx += (tx - f.mvx) * acc; f.mvz += (tz - f.mvz) * acc;

    // integrate
    f.x += (f.mvx + f.vx) * dt; f.z += (f.mvz + f.vz) * dt;
    if (!f.grounded || f.vy > 0) {
      const floating = f.state === 'special' && f.act && f.act.float;
      if (!floating) f.vy -= GRAV * dt;
      f.y += f.vy * dt;
      if (f.y <= 0) { f.y = 0; if (f.vy < -6 && (f.state === 'down' || f.state === 'ko')) this.emit({ type: 'land', side: f.side, x: f.x, z: f.z }); f.vy = 0; }
    }
    const fr = f.grounded ? 7 : 1.5;
    const k = Math.max(0, 1 - fr * dt);
    if (f.state !== 'dodge' && !(f.act && f.act.dashing)) { f.vx *= k; f.vz *= k; }

    // arena boundary — fighters can never leave the ring
    const r = Math.hypot(f.x, f.z), lim = ARENA_R - BODY_R;
    if (r > lim) {
      const nx = f.x / r, nz = f.z / r;
      f.x = nx * lim; f.z = nz * lim;
      const out = f.vx * nx + f.vz * nz; if (out > 0) { f.vx -= out * nx * 1.6; f.vz -= out * nz * 1.6; if (out > 6) this.emit({ type: 'wall', x: f.x, z: f.z, y: f.y + 1 }); }
      const mo = f.mvx * nx + f.mvz * nz; if (mo > 0) { f.mvx -= mo * nx; f.mvz -= mo * nz; }
    }
  }

  toIdle(f) { f.state = 'idle'; f.t = 0; f.act = null; f.hidden = false; }

  startDodge(f) {
    let dx = f.intent.mx, dz = f.intent.mz;
    const m = Math.hypot(dx, dz);
    if (m < 0.1) { dx = -f.fx; dz = -f.fz; } else { dx /= m; dz /= m; }
    f.state = 'dodge'; f.t = 0; f.cd.dodge = 0.85; f.invuln = 0.26; f.buf.dodge = 0;
    f.vx = dx * 14; f.vz = dz * 14; f.mvx = 0; f.mvz = 0;
    this.emit({ type: 'dodge', side: f.side, x: f.x, z: f.z });
  }

  startAttack(f, kind) {
    let step = 0;
    if (kind === 'light') { step = f.comboWindow > 0 ? (f.comboStep + 1) % 3 : 0; f.comboStep = step; }
    const a = attackDef(f, kind, step);
    f.state = 'attack'; f.t = 0; f.buf[kind] = 0;
    f.act = { ...a, t: 0, hit: new Set(), air: !f.grounded };
    f.mvx *= 0.3; f.mvz *= 0.3;
    if (kind === 'heavy') f.cd.heavy = 1.1;
    this.emit({ type: 'swing', side: f.side, kind });
  }

  updateAttack(f, dt) {
    const a = f.act; a.t += dt;
    if (a.t < a.startup) { this.faceOpp(f, 10 * dt); }
    if (a.t < a.startup + a.active && !a.air) { const l = a.lunge * dt; f.x += f.fx * l; f.z += f.fz * l; }
    if (a.t >= a.startup && a.t < a.startup + a.active) {
      this.meleeCheck(f, { range: a.range, arc: a.arc }, (o) => ({ dmg: a.dmg, knock: a.knock, stun: a.stun, launch: a.launch, kind: a.kind }), a.hit);
    }
    if (a.t >= a.startup + a.active + a.recovery) {
      if (a.kind === 'light') {
        f.comboWindow = 0.35;
        f.cd.light = a.step === 2 ? 0.45 : 0.02;
        if (a.step === 2) f.comboWindow = 0;
      }
      this.toIdle(f);
    }
  }

  // Melee hit check: XZ distance + facing arc + height. `hitSet` guarantees one hit per target per swing.
  meleeCheck(f, { range, arc, around }, make, hitSet, colorOverride) {
    const o = this.opp(f);
    if (hitSet && hitSet.has(o.side)) return false;
    const dx = o.x - f.x, dz = o.z - f.z;
    const d = Math.hypot(dx, dz);
    if (d > range + BODY_R) return false;
    if (Math.abs(o.y - f.y) > 1.7) return false;
    if (!around && d > 0.35) {
      const ang = Math.abs(angDiff(Math.atan2(dx, dz), f.facing));
      if (ang > (arc * Math.PI / 180) / 2) return false;
    }
    const h = make(o);
    const nd = d > 0.01 ? d : 1;
    const landed = this.applyHit(f, o, { ...h, dirX: d > 0.01 ? dx / nd : f.fx, dirZ: d > 0.01 ? dz / nd : f.fz, color: colorOverride });
    if (landed !== null && hitSet) hitSet.add(o.side);
    return landed;
  }

  // returns null when the attack passed through (invulnerable), true/false otherwise
  applyHit(att, tgt, h) {
    if (this.koTimer >= 0) return null;
    if (tgt.state === 'ko' || tgt.invuln > 0 || tgt.hidden) return null;
    if (tgt.infinity > 0) {
      this.emit({ type: 'nullify', x: tgt.x, y: tgt.y + 1.2, z: tgt.z, side: tgt.side });
      return false;
    }
    const toAtt = Math.atan2(att.x - tgt.x, att.z - tgt.z);
    const frontal = Math.abs(angDiff(toAtt, tgt.facing)) < 1.4 || h.fromProjectile;
    const blocked = (tgt.state === 'block' || tgt.state === 'blockstun') && frontal && !h.unblockable;
    let dmg = h.dmg;
    if (blocked) dmg = Math.max(1, Math.round(dmg * (h.kind === 'light' ? 0.15 : h.kind === 'heavy' ? 0.25 : 0.35)));
    dmg = Math.round(dmg);
    att.stats.dealt += Math.min(dmg, tgt.hp);
    tgt.hp = Math.max(0, tgt.hp - dmg);
    tgt.flash = 0.12;
    if (blocked) {
      att.stats.blocked++;
      tgt.state = 'blockstun'; tgt.t = 0; tgt.stun = h.kind === 'light' ? 0.14 : 0.24;
      tgt.vx += h.dirX * h.knock * 0.35; tgt.vz += h.dirZ * h.knock * 0.35;
      this.emit({ type: 'hit', blocked: true, dmg, kind: h.kind, x: tgt.x, y: tgt.y + 1.2, z: tgt.z, side: tgt.side, color: h.color });
    } else {
      const wasStunned = tgt.state === 'hitstun' || tgt.state === 'down' || (tgt.state === 'special' && tgt.act && tgt.act.pulled);
      const resist = 1 - tgt.def.stats.weight * 0.45;
      const kb = h.knock * resist;
      tgt.act = null; tgt.hidden = false;
      tgt.state = kb >= 10 ? 'down' : 'hitstun';
      tgt.t = 0; tgt.stun = tgt.state === 'down' ? 0.75 : h.stun;
      tgt.vx = h.dirX * kb; tgt.vz = h.dirZ * kb;
      tgt.vy = Math.max(tgt.vy, (h.launch || 0) + (tgt.state === 'down' ? 4 : 0));
      if (tgt.vy > 0 && tgt.y <= 0) tgt.y = 0.001;
      tgt.mvx = 0; tgt.mvz = 0;
      att.combo = wasStunned ? att.combo + 1 : 1; att.comboTimer = 1.1;
      att.stats.hits++; att.stats.maxCombo = Math.max(att.stats.maxCombo, att.combo);
      this.emit({ type: 'hit', blocked: false, dmg, kind: h.kind, heavy: kb >= 8, x: tgt.x, y: tgt.y + 1.2, z: tgt.z, side: tgt.side, combo: att.combo, color: h.color });
    }
    if (tgt.hp <= 0) {
      tgt.state = 'ko'; tgt.t = 0; tgt.act = null;
      tgt.vx = h.dirX * 9; tgt.vz = h.dirZ * 9; tgt.vy = 6; tgt.y = Math.max(tgt.y, 0.001);
      this.finish(att.side, 'KO');
    } else if (this.suddenDeath && this.fighters[0].hp !== this.fighters[1].hp) {
      this.finish(att.side, 'SUDDEN DEATH');
    }
    return !blocked;
  }

  // ---------------------------------------------------------------- specials
  startSpecial(f) {
    const s = f.def.special;
    f.state = 'special'; f.t = 0; f.buf.special = 0;
    f.cd.special = s.cooldown;
    f.mvx = 0; f.mvz = 0;
    f.act = { kind: 'special', type: s.type, t: 0, hit: new Set(), tick: 0, n: 0, phase: 0, float: !f.grounded };
    if (s.type === 'gojo') f.infinity = s.guard + s.charge;
    this.emit({ type: 'special', side: f.side, name: s.name, color: s.color });
  }

  updateSpecial(f, dt) {
    const s = f.def.special, a = f.act, o = this.opp(f);
    a.t += dt;
    const tc = a.t - s.charge; // time since charge finished
    if (tc < 0) { this.faceOpp(f, 12 * dt); f.vx *= 0.8; f.vz *= 0.8; return; }

    switch (s.type) {
      case 'beam': {
        if (a.phase === 0) { a.phase = 1; a.dx = f.fx; a.dz = f.fz; a.ox = f.x; a.oz = f.z; a.oy = f.y; this.emit({ type: 'beam', side: f.side, color: s.color, length: s.length, width: s.width, duration: s.duration }); }
        a.tick -= dt;
        if (tc < s.duration && a.tick <= 0) {
          a.tick = 0.1;
          const rx = o.x - f.x, rz = o.z - f.z;
          const along = rx * a.dx + rz * a.dz;
          const perp = Math.abs(rx * a.dz - rz * a.dx);
          if (along > 0 && along < s.length && perp < s.width * 0.5 + BODY_R && Math.abs(o.y - f.y) < 1.8) {
            const last = tc + 0.1 >= s.duration;
            this.applyHit(f, o, { dmg: s.damage / 9, knock: last ? 13 : 3, stun: 0.25, launch: last ? 4 : 0, kind: 'special', dirX: a.dx, dirZ: a.dz, color: s.color });
          }
        }
        if (tc >= s.duration + 0.35) this.toIdle(f);
        break;
      }
      case 'projectile': {
        const count = s.count || 1, interval = s.interval || 0;
        while (a.n < count && tc >= a.n * interval) {
          this.faceOpp(f, 99);
          const spread = count > 1 ? (a.n - (count - 1) / 2) * 0.05 : 0;
          const ang = f.facing + spread;
          this.projectiles.push({ id: projSeq++, owner: f.side, x: f.x + Math.sin(ang) * 0.9, y: f.y + 1.25, z: f.z + Math.cos(ang) * 0.9,
            vx: Math.sin(ang) * s.speed, vz: Math.cos(ang) * s.speed, speed: s.speed, r: s.radius, dmg: s.damage, life: 2.6,
            explode: s.explode || 0, homing: s.homing || 0, color: s.color, flat: !!s.flat, kind: 'orb', fighter: f.def.id });
          a.n++;
          this.emit({ type: 'shoot', side: f.side, color: s.color });
        }
        if (tc >= (count - 1) * interval + 0.4) this.toIdle(f);
        break;
      }
      case 'punch': {
        if (tc < 0.14) this.meleeCheck(f, { range: s.range, arc: s.arc }, () => ({ dmg: s.damage, knock: s.knock, stun: 0.8, launch: 7, kind: 'special' }), a.hit, s.color);
        if (a.phase === 0) { a.phase = 1; this.emit({ type: 'shock', side: f.side, x: f.x + f.fx * 1.5, y: f.y + 1.2, z: f.z + f.fz * 1.5, color: s.color, size: 4 }); }
        if (tc >= 0.75) this.toIdle(f);
        break;
      }
      case 'aoe': {
        if (a.phase === 0) {
          a.phase = 1;
          this.emit({ type: 'shock', side: f.side, x: f.x, y: f.y + 1, z: f.z, color: s.color, size: s.radius });
          this.meleeCheck(f, { range: s.radius, around: true }, () => ({ dmg: s.damage, knock: s.knock, stun: 0.7, launch: 6, kind: 'special' }), a.hit, s.color);
        }
        if (tc >= 0.5) this.toIdle(f);
        break;
      }
      case 'clones': {
        if (a.phase === 0) {
          a.phase = 1;
          for (let i = 0; i < s.clones; i++) {
            const side = i % 2 === 0 ? 1 : -1;
            const lx = Math.cos(f.facing) * side * 1.3, lz = -Math.sin(f.facing) * side * 1.3;
            this.projectiles.push({ id: projSeq++, owner: f.side, x: f.x + lx, y: f.y + 0.9, z: f.z + lz,
              vx: 0, vz: 0, speed: s.dashSpeed, r: 0.75, dmg: s.cloneDamage, life: 1.1, explode: 0, homing: 6, color: f.def.aura,
              kind: 'clone', fighter: f.def.id, delay: i * 0.08 });
          }
          this.emit({ type: 'poof', side: f.side, x: f.x, y: f.y + 1, z: f.z });
        }
        // after the clones go in, Naruto rushes with the Rasengan-style strike
        if (tc >= 0.35 && tc < 0.75) {
          if (!a.dashing) { a.dashing = true; this.faceOpp(f, 99); }
          f.vx = f.fx * s.dashSpeed; f.vz = f.fz * s.dashSpeed;
          this.meleeCheck(f, { range: s.range, arc: 120 }, () => ({ dmg: s.damage, knock: 13, stun: 0.7, launch: 5, kind: 'special' }), a.hit, s.color);
          if (a.hit.size) { a.dashing = false; f.vx *= 0.2; f.vz *= 0.2; a.t = s.charge + 0.75; }
        }
        if (tc >= 0.75 && a.dashing) { a.dashing = false; f.vx *= 0.2; f.vz *= 0.2; }
        if (tc >= 1.05) this.toIdle(f);
        break;
      }
      case 'dash': {
        const multi = s.hits || 1, interval = s.interval || 0.05;
        if (tc < s.dashTime) {
          if (!a.dashing) { a.dashing = true; this.faceOpp(f, 99); a.dx = f.fx; a.dz = f.fz; }
          f.vx = a.dx * s.dashSpeed; f.vz = a.dz * s.dashSpeed;
          if (multi > 1) {
            a.tick -= dt;
            if (a.tick <= 0 && a.n < multi) {
              a.hit.clear(); a.tick = interval;
              this.meleeCheck(f, { range: s.range, around: true }, () => ({ dmg: s.damage, knock: a.n === multi - 1 ? 11 : s.knock, stun: 0.35, launch: a.n === multi - 1 ? 5 : 1, kind: 'special' }), a.hit, s.color);
              if (a.hit.size) { a.n++; this.emit({ type: 'slash', side: f.side, color: s.color, range: s.range }); }
            }
            if (a.hit.size) { f.vx *= 0.35; f.vz *= 0.35; }
          } else {
            this.meleeCheck(f, { range: s.range, arc: 140 }, () => ({ dmg: s.damage, knock: s.knock, stun: 0.6, launch: 4, kind: 'special' }), a.hit, s.color);
          }
        } else if (a.dashing) { a.dashing = false; f.vx *= 0.15; f.vz *= 0.15; }
        // multi-hit dash keeps cutting a moment after the dash ends if the target stays close
        if (multi > 1 && tc >= s.dashTime && tc < s.dashTime + 0.3 && a.n < multi) {
          a.tick -= dt;
          if (a.tick <= 0) { a.hit.clear(); a.tick = interval; this.meleeCheck(f, { range: s.range, around: true }, () => ({ dmg: s.damage, knock: a.n === multi - 1 ? 11 : s.knock, stun: 0.35, launch: a.n === multi - 1 ? 5 : 1, kind: 'special' }), a.hit, s.color); if (a.hit.size) a.n++; }
        }
        if (tc >= s.dashTime + 0.4) this.toIdle(f);
        break;
      }
      case 'flurry': {
        a.tick -= dt;
        if (a.n < s.hits && a.tick <= 0) {
          a.tick = s.interval; a.n++; a.hit.clear();
          this.faceOpp(f, 0.08);
          const last = a.n === s.hits;
          this.meleeCheck(f, { range: s.range, arc: s.arc }, () => ({ dmg: s.damage, knock: last ? 9 : s.knock, stun: 0.3, launch: last ? 4 : 0, kind: 'special' }), a.hit, s.color);
          this.emit({ type: 'slash', side: f.side, color: s.color, range: s.range, stretch: !!s.stretch });
        }
        if (a.n >= s.hits && a.tick <= -0.3) this.toIdle(f);
        break;
      }
      case 'spin': {
        a.tick -= dt;
        f.mvx = f.intent.mx * 2.5; f.mvz = f.intent.mz * 2.5;
        if (a.n < s.hits && a.tick <= 0) {
          a.tick = s.interval; a.n++; a.hit.clear();
          const last = a.n === s.hits;
          this.meleeCheck(f, { range: s.radius, around: true }, () => ({ dmg: s.damage, knock: last ? 12 : s.knock, stun: 0.4, launch: last ? 5 : 1, kind: 'special' }), a.hit, s.color);
          this.emit({ type: 'spinSlash', side: f.side, color: s.color, radius: s.radius });
        }
        if (a.n >= s.hits && a.tick <= -0.25) this.toIdle(f);
        break;
      }
      case 'teleport': {
        if (a.phase === 0) { a.phase = 1; f.hidden = true; f.invuln = 0.35; this.emit({ type: 'vanish', side: f.side, x: f.x, y: f.y + 1, z: f.z, color: s.color }); }
        if (a.phase === 1 && tc >= 0.15) {
          a.phase = 2; f.hidden = false;
          let bx = o.x - o.fx * 1.6, bz = o.z - o.fz * 1.6;
          const r = Math.hypot(bx, bz), lim = ARENA_R - 1;
          if (r > lim) { bx = bx / r * lim; bz = bz / r * lim; }
          f.x = bx; f.z = bz; f.y = o.y; f.vy = 0; f.vx = f.vz = 0;
          this.faceOpp(f, 99);
          this.emit({ type: 'appear', side: f.side, x: f.x, y: f.y + 1, z: f.z, color: s.color });
        }
        if (a.phase === 2 && tc >= 0.32 && tc < 0.46) {
          this.meleeCheck(f, { range: s.range, arc: 160 }, () => ({ dmg: s.damage, knock: s.knock, stun: 0.8, launch: 7, kind: 'special' }), a.hit, s.color);
          if (!a.boom) { a.boom = true; this.emit({ type: 'shock', side: f.side, x: f.x + f.fx * 1.3, y: f.y + 1.2, z: f.z + f.fz * 1.3, color: s.color, size: 2.5, rainbow: true }); }
        }
        if (tc >= 0.85) this.toIdle(f);
        break;
      }
      case 'gojo': {
        // phase 1: spatial pull, phase 2: repelling burst. Infinity blocks all damage meanwhile.
        if (a.phase === 0) {
          a.phase = 1;
          const d = Math.hypot(o.x - f.x, o.z - f.z);
          a.pulling = d < s.pullRange && o.state !== 'ko' && o.invuln <= 0 && !o.hidden;
          this.emit({ type: 'pull', side: f.side, color: s.color, active: a.pulling });
          if (a.pulling) { o.act = null; o.state = 'hitstun'; o.t = 0; o.stun = 0.75; }
        }
        if (a.phase === 1 && tc < 0.5 && a.pulling && o.state === 'hitstun') {
          const dx = f.x - o.x, dz = f.z - o.z, d = Math.hypot(dx, dz);
          if (d > 1.4) { o.vx = dx / d * 15; o.vz = dz / d * 15; } else { o.vx *= 0.3; o.vz *= 0.3; }
        }
        if (a.phase === 1 && tc >= 0.5) {
          a.phase = 2;
          this.emit({ type: 'shock', side: f.side, x: f.x, y: f.y + 1, z: f.z, color: s.color, size: s.radius });
          this.meleeCheck(f, { range: s.radius, around: true }, () => ({ dmg: s.damage, knock: s.knock, stun: 0.7, launch: 6, kind: 'special' }), a.hit, s.color);
        }
        if (tc >= 0.95) this.toIdle(f);
        break;
      }
    }
  }

  // ---------------------------------------------------------------- projectiles
  updateProjectiles(dt) {
    const keep = [];
    for (const p of this.projectiles) {
      if (p.delay > 0) { p.delay -= dt; keep.push(p); continue; }
      const tgt = this.fighters[1 - p.owner];
      if (p.homing) {
        const want = Math.atan2(tgt.x - p.x, tgt.z - p.z);
        const cur = Math.atan2(p.vx, p.vz);
        const n = cur + clamp(angDiff(want, cur), -p.homing * dt, p.homing * dt);
        const sp = p.speed;
        if (p.kind === 'clone' && Math.hypot(p.vx, p.vz) < 0.1) { p.vx = Math.sin(want) * sp; p.vz = Math.cos(want) * sp; }
        else { p.vx = Math.sin(n) * sp; p.vz = Math.cos(n) * sp; }
        if (p.kind !== 'clone') p.y += ((tgt.y + 1.2) - p.y) * Math.min(1, dt * 2);
      }
      p.x += p.vx * dt; p.z += p.vz * dt;
      p.life -= dt;
      let alive = p.life > 0 && Math.hypot(p.x, p.z) < ARENA_R + 4;
      if (alive) {
        const dx = tgt.x - p.x, dz = tgt.z - p.z;
        const d = Math.hypot(dx, dz);
        const yIn = p.y > tgt.y - p.r && p.y < tgt.y + 2.0 + p.r;
        if (d < p.r + BODY_R && yIn) {
          const sp = Math.hypot(p.vx, p.vz) || 1;
          const res = this.applyHit(this.fighters[p.owner], tgt, {
            dmg: p.dmg, knock: p.explode ? 12 : (p.kind === 'clone' ? 5 : (p.dmg > 100 ? 11 : 3.5)), stun: p.dmg > 100 ? 0.7 : 0.3,
            launch: p.explode ? 6 : (p.dmg > 100 ? 4 : 0), kind: 'special', dirX: p.vx / sp, dirZ: p.vz / sp, color: p.color, fromProjectile: true });
          if (res !== null) {
            alive = false;
            if (p.explode) this.emit({ type: 'shock', x: p.x, y: p.y, z: p.z, color: p.color, size: p.explode });
            else this.emit({ type: p.kind === 'clone' ? 'poof' : 'burst', x: p.x, y: p.y, z: p.z, color: p.color });
          }
        }
      } else if (p.kind === 'clone') this.emit({ type: 'poof', x: p.x, y: p.y, z: p.z, color: p.color });
      else if (p.explode) this.emit({ type: 'shock', x: p.x, y: p.y, z: p.z, color: p.color, size: p.explode * 0.6 });
      if (alive) keep.push(p);
    }
    this.projectiles = keep;
  }

  separate() {
    const [a, b] = this.fighters;
    if (a.hidden || b.hidden) return;
    if ((a.act && a.act.dashing) || (b.act && b.act.dashing)) return;
    if (Math.abs(a.y - b.y) > 1.6) return;
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = BODY_R * 2;
    if (d < min) {
      const nx = d > 0.001 ? dx / d : 1, nz = d > 0.001 ? dz / d : 0;
      const push = (min - d) / 2;
      a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push;
    }
  }
}

// Run a full CPU-vs-CPU bout with the exact same rules and AI as a live match.
// Used for tournament bracket matches that don't involve the player.
export function simulateBout(defA, defB, makeAI, levelA = 1, levelB = 1) {
  const m = new Match(defA, defB, { ctrlA: makeAI(levelA), ctrlB: makeAI(levelB), startImmediately: true });
  const dt = 1 / 60;
  let guard = 0;
  while (!m.over && guard < 60 * 400) { m.step(dt); m.events.length = 0; guard++; }
  if (!m.over) { // pathological stalemate guard: decide by remaining HP, then by damage dealt
    const [a, b] = m.fighters;
    m.winner = a.hp !== b.hp ? (a.hp > b.hp ? 0 : 1) : (a.stats.dealt >= b.stats.dealt ? 0 : 1);
    m.reason = 'TIME';
  }
  return { winner: m.winner, reason: m.reason, hp: m.fighters.map((f) => f.hp), time: m.time };
}
