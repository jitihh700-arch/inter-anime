import * as THREE from '../vendor/three.module.min.js';
import { buildArena } from './arena.js';
import { buildFighter, animateRig } from './models.js';
import { VFX } from './vfx.js';
import { ARENA_R } from '../engine/sim.js';
import { PLAYABLE } from '../engine/roster.js';

export class Stage {
  constructor(canvas) {
  this.renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true,
  powerPreference: 'high-performance'
});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
    this.camera.position.set(0, 6, 14);
    this.arena = buildArena(this.scene);
    this.vfx = new VFX(this.scene);
    this.vfx.defs = Object.fromEntries(PLAYABLE.map((d) => [d.id, d]));
    this.rigs = [];
    this.match = null;
    this.orbitYaw = 0; this.orbitPitch = 0; this.zoom = 1;
    this.shake = 0;
    this.camPos = new THREE.Vector3(0, 6, 14);
    this.camLook = new THREE.Vector3(0, 1, 0);
    this.idleSpin = 0;
    this.onEvent = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1 ? 70 : 55;
    this.camera.updateProjectionMatrix();
  }

  setMatch(match) {
    for (const r of this.rigs) this.scene.remove(r.root);
    this.vfx.clear();
    this.match = match;
    this.rigs = match ? match.fighters.map((f) => { const r = buildFighter(f.def); this.scene.add(r.root); return r; }) : [];
    this.orbitYaw = 0; this.orbitPitch = 0; this.shake = 0;
    if (match) this.snapCamera();
  }

  // camera-relative movement basis for the human player's WASD
  basis() {
    const f = new THREE.Vector3(); this.camera.getWorldDirection(f); f.y = 0; f.normalize();
    return { fx: f.x, fz: f.z, rx: -f.z, rz: f.x };
  }

  desiredCamera(out, look) {
    const [p, o] = this.match.fighters;
    let dx = p.x - o.x, dz = p.z - o.z;
    let sep = Math.hypot(dx, dz);
    if (sep < 0.01) { dx = -Math.sin(p.facing); dz = -Math.cos(p.facing); sep = 0.01; }
    dx /= Math.max(sep, 0.01); dz /= Math.max(sep, 0.01);
    const c = Math.cos(this.orbitYaw), s = Math.sin(this.orbitYaw);
    const rx = dx * c - dz * s, rz = dx * s + dz * c;
    const dist = Math.min(12, (4.4 + sep * 0.4)) * this.zoom;
    const h = (2.1 + sep * 0.13 + this.orbitPitch * 4) * this.zoom;
    out.set(p.x + rx * dist, p.y * 0.5 + h, p.z + rz * dist);
    // keep the camera inside the stands
    const r = Math.hypot(out.x, out.z), lim = ARENA_R + 5.5;
    if (r > lim) { out.x *= lim / r; out.z *= lim / r; out.y += (r - lim) * 0.35; }
    look.set(p.x + (o.x - p.x) * 0.42, 1.1 + Math.max(p.y, o.y) * 0.4, p.z + (o.z - p.z) * 0.42);
  }
  snapCamera() { this.desiredCamera(this.camPos, this.camLook); }

  project(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return { x: (v.x + 1) / 2 * window.innerWidth, y: (1 - v.y) / 2 * window.innerHeight, behind: v.z > 1 };
  }

  handleEvents() {
    const m = this.match; if (!m) return;
    for (const e of m.events) {
      const f = e.side !== undefined ? m.fighters[e.side] : null;
      switch (e.type) {
        case 'hit': this.vfx.hit(e); this.shake = Math.max(this.shake, e.blocked ? 0.05 : e.heavy ? 0.28 : 0.1); break;
        case 'shock': this.vfx.shock(e); this.shake = Math.max(this.shake, 0.3); this.arena.pulse(); break;
        case 'beam': this.vfx.beam(f, e); this.shake = Math.max(this.shake, 0.2); break;
        case 'slash': this.vfx.slash(f, e); break;
        case 'spinSlash': this.vfx.spinSlash(f, e); break;
        case 'swing': this.vfx.swing(f, e.kind); break;
        case 'burst': this.vfx.sparks(e.x, e.y, e.z, e.color, 14, 8); this.vfx.orb(e.x, e.y, e.z, e.color, 0.9, 0.25); break;
        case 'poof': this.vfx.orb(e.x, e.y, e.z, 0xffffff, 0.9, 0.3); this.vfx.sparks(e.x, e.y, e.z, 0xffffff, 8, 4); break;
        case 'vanish': case 'appear': this.vfx.ring(e.x, e.y, e.z, e.color, 1.6, false, 0.3); this.vfx.sparks(e.x, e.y, e.z, e.color, 10, 6); break;
        case 'nullify': this.vfx.ring(e.x, e.y, e.z, 0x9fe0ff, 1.4, false, 0.25); break;
        case 'special': this.vfx.ring(f.x, 0.05, f.z, e.color, 2.4, true, 0.5); this.vfx.sparks(f.x, 1, f.z, e.color, 10, 5); break;
        case 'pull': if (e.active) { const o = m.opp(f); this.vfx.ring(o.x, 1, o.z, e.color, 2, false, 0.5); } break;
        case 'dodge': this.vfx.ring(e.x, 0.05, e.z, 0xffffff, 1.2, true, 0.25); break;
        case 'land': this.vfx.ring(e.x, 0.05, e.z, 0xd8c8ff, 1.6, true, 0.3); this.shake = Math.max(this.shake, 0.12); break;
        case 'wall': this.vfx.sparks(e.x, e.y, e.z, 0x9fe8ff, 10, 6); this.arena.pulse(); break;
        case 'ko': this.shake = 0.5; this.arena.pulse(); break;
      }
      if (this.onEvent) this.onEvent(e);
    }
    m.events.length = 0;
  }

  render(dt, time) {
    this.arena.update(dt, time);
    if (this.match) {
      this.handleEvents();
      const m = this.match;
      m.fighters.forEach((f, i) => {
        const r = this.rigs[i];
        r.root.position.set(f.x, f.y, f.z);
        r.root.rotation.y = f.facing;
        r.root.visible = !f.hidden;
        animateRig(r, f, time, dt);
        const charging = f.state === 'special';
        let aura = charging ? 0.13 + Math.sin(time * 30) * 0.04 : f.state === 'win' ? 0.08 : 0;
        if (f.flash > 0) { aura = 0.2; r.aura.material.color.set(0xffe0c0); } else r.aura.material.color.set(f.def.aura);
        r.aura.material.opacity += (aura - r.aura.material.opacity) * Math.min(1, dt * 20);
        r.aura.visible = r.aura.material.opacity > 0.01;
        if (f.invuln > 0 && f.state === 'getup') r.root.visible = Math.floor(time * 20) % 2 === 0;
        if (r.infinity) { const on = f.infinity > 0; r.infinity.material.opacity = on ? 0.35 + Math.sin(time * 12) * 0.1 : 0; r.infinity.rotation.y += dt; r.infinity.visible = on; }
      });
      this.vfx.syncProjectiles(m.projectiles, time);
      const want = new THREE.Vector3(), look = new THREE.Vector3();
      this.desiredCamera(want, look);
      const k = Math.min(1, dt * 5);
      this.camPos.lerp(want, k); this.camLook.lerp(look, Math.min(1, dt * 8));
    } else {
      // attract mode: slow orbit around the empty arena
      this.idleSpin += dt * 0.08;
      this.camPos.set(Math.sin(this.idleSpin) * 17, 6.5, Math.cos(this.idleSpin) * 17);
      this.camLook.set(0, 0.5, 0);
    }
    this.vfx.update(dt, time);
    this.shake = Math.max(0, this.shake - dt * 1.6);
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    this.camera.position.set(this.camPos.x + sx, this.camPos.y + sy, this.camPos.z);
    this.camera.lookAt(this.camLook);
    this.renderer.render(this.scene, this.camera);
  }
}
