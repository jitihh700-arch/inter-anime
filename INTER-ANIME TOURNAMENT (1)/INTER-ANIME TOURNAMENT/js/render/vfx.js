import * as THREE from '../vendor/three.module.min.js';
import { buildFighter } from './models.js';

// Lightweight impact effects: sparks, shock rings, beams, projectile orbs, slash arcs.
const add = THREE.AdditiveBlending;

export class VFX {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.proj = new Map();
    this.sparkGeo = new THREE.OctahedronGeometry(0.08, 0);
    this.ringGeo = new THREE.RingGeometry(0.85, 1, 48);
    this.sphereGeo = new THREE.SphereGeometry(1, 20, 14);
    this.arcGeo = new THREE.RingGeometry(1.2, 1.55, 24, 1, -Math.PI * 0.35, Math.PI * 0.7);
    this.shared = new Set([this.sparkGeo, this.ringGeo, this.sphereGeo, this.arcGeo]);
  }
  dispose(obj) {
    this.scene.remove(obj);
    obj.traverse((o) => {
      if (!o.isMesh) return;
      if (o.material && o.material.blending === add) o.material.dispose();
      if (o.geometry && !this.shared.has(o.geometry) && !o.userData.keepGeo) o.geometry.dispose();
    });
  }
  mat(color, opacity = 1) { return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: add, depthWrite: false, side: THREE.DoubleSide }); }
  push(obj, life, update) { this.scene.add(obj); this.items.push({ obj, life, max: life, update }); }

  sparks(x, y, z, color = 0xffffff, n = 12, speed = 7) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.sparkGeo, this.mat(color));
      m.position.set(x, y, z);
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.5 + Math.random()));
      this.push(m, 0.35 + Math.random() * 0.2, (it, dt) => { m.position.addScaledVector(v, dt); v.y -= 12 * dt; m.material.opacity = it.life / it.max; m.scale.setScalar(0.5 + it.life / it.max); });
    }
  }
  ring(x, y, z, color, size = 2, flat = true, life = 0.4) {
    const m = new THREE.Mesh(this.ringGeo, this.mat(color));
    m.position.set(x, y, z);
    if (flat) m.rotation.x = -Math.PI / 2;
    this.push(m, life, (it) => { const k = 1 - it.life / it.max; m.scale.setScalar(0.2 + k * size); m.material.opacity = (1 - k) * 0.9; });
  }
  orb(x, y, z, color, size = 1, life = 0.35) {
    const m = new THREE.Mesh(this.sphereGeo, this.mat(color, 0.8));
    m.position.set(x, y, z);
    this.push(m, life, (it) => { const k = 1 - it.life / it.max; m.scale.setScalar(size * (0.3 + k)); m.material.opacity = (1 - k) * 0.8; });
  }
  hit(e) {
    const c = e.color ?? (e.blocked ? 0x9fd8ff : e.heavy ? 0xffc04a : 0xffffff);
    this.sparks(e.x, e.y, e.z, c, e.blocked ? 6 : e.heavy ? 18 : 10, e.heavy ? 10 : 7);
    this.ring(e.x, e.y, e.z, e.blocked ? 0x7fc8ff : c, e.heavy ? 2.2 : 1.2, false, 0.25);
    if (e.blocked) this.orb(e.x, e.y, e.z, 0x7fc8ff, 0.6, 0.18);
  }
  shock(e) {
    this.ring(e.x, 0.05, e.z, e.color, e.size * 1.3, true, 0.5);
    this.orb(e.x, e.y, e.z, e.color, e.size * 0.7, 0.45);
    if (e.rainbow) { for (let i = 0; i < 5; i++) this.ring(e.x, e.y, e.z, new THREE.Color().setHSL(i / 5, 1, 0.6).getHex(), e.size * (0.8 + i * 0.25), false, 0.5 + i * 0.05); }
    this.sparks(e.x, e.y, e.z, e.color, 20, 12);
  }
  beam(f, e) {
    const len = e.length, w = e.width;
    const g = new THREE.Group();
    const coreCol = new THREE.Color(e.color).lerp(new THREE.Color(0xffffff), 0.55).getHex();
    const core = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.22, w * 0.22, len, 16, 1, true), this.mat(coreCol, 0.6));
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.5, w * 0.5, len, 16, 1, true), this.mat(e.color, 0.3));
    core.rotation.x = glow.rotation.x = Math.PI / 2; core.position.z = glow.position.z = len / 2 + 1.0;
    const head = new THREE.Mesh(this.sphereGeo, this.mat(e.color, 0.45)); head.scale.setScalar(w * 0.5); head.position.z = 0.9;
    g.add(core, glow, head);
    g.position.set(f.x, f.y + 1.25, f.z); g.rotation.y = f.facing;
    this.push(g, e.duration, (it, dt, time) => {
      const k = it.life / it.max;
      const s = 0.85 + Math.sin(time * 60) * 0.15;
      core.scale.set(s, 1, s); glow.scale.set(s * (0.6 + k * 0.4), 1, s * (0.6 + k * 0.4));
      glow.material.opacity = 0.3 * Math.min(1, k * 4); core.material.opacity = 0.6 * Math.min(1, k * 4);
    });
  }
  slash(f, e) {
    const m = new THREE.Mesh(this.arcGeo, this.mat(e.color, 0.9));
    const r = Math.min(e.range, 7);
    m.position.set(f.x + f.fx * r * 0.45, f.y + 1.1 + (Math.random() - 0.5) * 0.6, f.z + f.fz * r * 0.45);
    m.rotation.set(-Math.PI / 2 + (Math.random() - 0.5) * 1.2, 0, f.facing + Math.PI / 2 + (Math.random() - 0.5));
    if (e.stretch) {
      const fist = new THREE.Mesh(this.sphereGeo, this.mat(0xffe0c0, 0.9));
      const d = 1 + Math.random() * (r - 1);
      fist.position.set(f.x + f.fx * d + (Math.random() - 0.5), f.y + 1.2 + (Math.random() - 0.5) * 0.6, f.z + f.fz * d + (Math.random() - 0.5));
      fist.scale.setScalar(0.22);
      this.push(fist, 0.12, (it) => { fist.material.opacity = it.life / it.max; });
      return;
    }
    m.scale.setScalar(r * 0.45);
    this.push(m, 0.16, (it) => { m.material.opacity = it.life / it.max; });
  }
  spinSlash(f, e) {
    const m = new THREE.Mesh(new THREE.RingGeometry(e.radius * 0.8, e.radius, 48), this.mat(e.color, 0.8));
    m.rotation.x = -Math.PI / 2; m.position.set(f.x, f.y + 0.9, f.z);
    this.push(m, 0.18, (it) => { m.material.opacity = it.life / it.max * 0.8; m.rotation.z += 0.4; });
  }
  swing(f, kind) {
    if (kind !== 'heavy') return;
    const m = new THREE.Mesh(this.arcGeo, this.mat(0xffffff, 0.5));
    m.position.set(f.x + f.fx * 0.8, f.y + 1.0, f.z + f.fz * 0.8);
    m.rotation.set(-Math.PI / 2, 0, f.facing + Math.PI / 2);
    m.scale.setScalar(1.1);
    this.push(m, 0.2, (it) => { m.material.opacity = it.life / it.max * 0.5; });
  }

  // projectiles are owned by the sim; we mirror them each frame
  syncProjectiles(list, time) {
    const seen = new Set();
    for (const p of list) {
      seen.add(p.id);
      let v = this.proj.get(p.id);
      if (!v) {
        if (p.kind === 'clone') {
          const rig = buildFighter({ ...this.defs[p.fighter] }, { ghost: true });
          rig.root.scale.setScalar(0.95);
          v = { obj: rig.root, rig, clone: true };
        } else {
          const g = new THREE.Group();
          const core = new THREE.Mesh(this.sphereGeo, this.mat(0xffffff, 0.95));
          const glow = new THREE.Mesh(this.sphereGeo, this.mat(p.color, 0.6));
          core.scale.setScalar(p.r * 0.55); glow.scale.setScalar(p.r);
          if (p.flat) { core.scale.set(p.r * 1.4, p.r * 0.12, p.r * 0.35); glow.scale.set(p.r * 1.8, p.r * 0.3, p.r * 0.6); }
          g.add(core, glow);
          v = { obj: g, glow };
        }
        this.scene.add(v.obj);
        this.proj.set(p.id, v);
      }
      if (v.clone) {
        v.obj.position.set(p.x, 0, p.z); v.obj.rotation.y = Math.atan2(p.vx, p.vz);
        v.obj.visible = !(p.delay > 0);
        const ph = time * 14;
        v.rig.hipL.rotation.x = Math.sin(ph) * 0.9; v.rig.hipR.rotation.x = -Math.sin(ph) * 0.9;
        v.rig.shR.rotation.x = -1.5; v.rig.torso.rotation.x = 0.5;
      } else {
        v.obj.position.set(p.x, p.y, p.z);
        v.obj.rotation.y = Math.atan2(p.vx, p.vz);
        v.glow.material.opacity = 0.5 + Math.sin(time * 40 + p.id) * 0.15;
        if (Math.random() < 0.5) this.sparks(p.x, p.y, p.z, p.color, 1, 1.5);
      }
    }
    for (const [id, v] of this.proj) if (!seen.has(id)) { if (v.clone) this.scene.remove(v.obj); else this.dispose(v.obj); this.proj.delete(id); }
  }

  clear() {
    for (const it of this.items) this.dispose(it.obj);
    this.items = [];
    for (const v of this.proj.values()) { if (v.clone) this.scene.remove(v.obj); else this.dispose(v.obj); }
    this.proj.clear();
  }

  update(dt, time) {
    const keep = [];
    for (const it of this.items) {
      it.life -= dt;
      if (it.life <= 0) { this.dispose(it.obj); continue; }
      it.update(it, dt, time);
      keep.push(it);
    }
    this.items = keep;
  }
}
