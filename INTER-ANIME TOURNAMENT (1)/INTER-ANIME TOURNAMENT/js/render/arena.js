import * as THREE from '../vendor/three.module.min.js';
import { ARENA_R } from '../engine/sim.js';
import { toon } from './models.js';

// The Tournament Arena: large circular floor, glowing segmented rim, tiered stands,
// spotlights and an energy sky — reused for every match.
export function buildArena(scene) {
  const group = new THREE.Group();
  scene.add(group);

  scene.background = new THREE.Color(0x0c0a1f);
  scene.fog = new THREE.Fog(0x0e0a24, 30, 90);

  // sky dome with vertical gradient (violet → deep blue → gold horizon haze)
  const skyGeo = new THREE.SphereGeometry(120, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { t: { value: 0 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float t; varying vec3 vP;
      void main(){ float h = normalize(vP).y;
        vec3 top = vec3(0.05,0.03,0.14), mid = vec3(0.07,0.07,0.22), hor = vec3(0.32,0.16,0.32);
        vec3 c = mix(hor, mid, smoothstep(-0.05, 0.25, h)); c = mix(c, top, smoothstep(0.25, 0.9, h));
        float band = sin(atan(vP.z, vP.x) * 6.0 + t * 0.2 + h * 8.0) * 0.5 + 0.5;
        c += vec3(0.25,0.5,0.9) * pow(band, 6.0) * smoothstep(0.15, 0.6, h) * 0.35;
        gl_FragColor = vec4(c, 1.0); }`
  });
  const sky = new THREE.Mesh(skyGeo, skyMat); group.add(sky);

  // floor — radial tiles with vertex colours: pale centre, blue-violet outer field
  const floorGeo = new THREE.CircleGeometry(ARENA_R + 0.6, 96, 0, Math.PI * 2);
  const pos = floorGeo.attributes.position;
  const cols = [];
  const cA = new THREE.Color(0xc9b48c), cB = new THREE.Color(0x3a3f8e), cC = new THREE.Color(0x6a4fa8);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const r = Math.hypot(x, y) / (ARENA_R + 0.6);
    const c = cA.clone().lerp(cB, Math.min(1, Math.max(0, (r - 0.25) / 0.6)));
    c.lerp(cC, Math.max(0, Math.sin(Math.atan2(y, x) * 3) * 0.25 * r));
    cols.push(c.r, c.g, c.b);
  }
  floorGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const floorMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toon(0xffffff).gradientMap });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; group.add(floor);

  // tile seams: concentric rings + radial lines
  const lineMat = new THREE.LineBasicMaterial({ color: 0x2a2450, transparent: true, opacity: 0.55 });
  for (const r of [3.2, 6.4, 9.6, 12.4]) {
    const g = new THREE.BufferGeometry().setFromPoints(new THREE.Path().absarc(0, 0, r, 0, Math.PI * 2).getSpacedPoints(96).map((p) => new THREE.Vector3(p.x, 0.012, p.y)));
    group.add(new THREE.Line(g, lineMat));
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(Math.cos(a) * 3.2, 0.012, Math.sin(a) * 3.2), new THREE.Vector3(Math.cos(a) * ARENA_R, 0.012, Math.sin(a) * ARENA_R)]);
    group.add(new THREE.Line(g, lineMat));
  }
  // centre emblem
  const emb = new THREE.Mesh(new THREE.RingGeometry(1.6, 1.85, 64), new THREE.MeshBasicMaterial({ color: 0xd9a63a, transparent: true, opacity: 0.8 }));
  emb.rotation.x = -Math.PI / 2; emb.position.y = 0.015; group.add(emb);
  const emb2 = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.7, 6), new THREE.MeshBasicMaterial({ color: 0xd9a63a, transparent: true, opacity: 0.7 }));
  emb2.rotation.x = -Math.PI / 2; emb2.position.y = 0.016; group.add(emb2);

  // platform side wall
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(ARENA_R + 0.6, ARENA_R + 1.2, 1.2, 96, 1, true), toon(0x2a2650));
  wall.position.y = -0.6; group.add(wall);

  // glowing rim — segmented light panels in shifting rainbow hues
  const segs = 48, rim = [];
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2 + 0.01, len = (Math.PI * 2) / segs - 0.02;
    const geo = new THREE.RingGeometry(ARENA_R + 0.05, ARENA_R + 0.55, 3, 1, a0, len);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });
    const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.y = 0.02;
    group.add(m); rim.push({ m, a: a0 });
  }
  // light curtain marking the boundary
  const curtainMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { t: { value: 0 }, flash: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float t; uniform float flash; varying vec2 vUv;
      void main(){ float a = (1.0 - vUv.y); a = pow(a, 3.0) * (0.22 + flash);
        vec3 c = 0.5 + 0.5 * cos(6.2831 * (vUv.x * 3.0 + t * 0.1 + vec3(0.0, 0.33, 0.67)));
        gl_FragColor = vec4(mix(c, vec3(0.6,0.9,1.0), 0.5) * a, a); }`
  });
  const curtain = new THREE.Mesh(new THREE.CylinderGeometry(ARENA_R + 0.3, ARENA_R + 0.3, 2.2, 96, 1, true), curtainMat);
  curtain.position.y = 1.1; group.add(curtain);

  // stands: tiered rings with crowd light specks
  const standMat = toon(0x120f28);
  for (let i = 0; i < 6; i++) {
    const r0 = ARENA_R + 7 + i * 2.6;
    const tier = new THREE.Mesh(new THREE.CylinderGeometry(r0 + 2.6, r0 + 2.6, 1.6, 64, 1, true), standMat);
    tier.position.y = -0.2 + i * 1.6; group.add(tier);
    const top = new THREE.Mesh(new THREE.RingGeometry(r0, r0 + 2.6, 64), toon(i % 2 ? 0x221d45 : 0x1a1636, { params: { side: THREE.DoubleSide } }));
    top.rotation.x = -Math.PI / 2; top.position.y = 0.6 + i * 1.6; group.add(top);
  }
  const N = 1400, ppos = new Float32Array(N * 3), pcol = new Float32Array(N * 3);
  const pal = [0xffd27a, 0x8fd8ff, 0xff8fd0, 0xffffff, 0xb08aff].map((c) => new THREE.Color(c));
  for (let i = 0; i < N; i++) {
    const tier = Math.floor(Math.random() * 6), a = Math.random() * Math.PI * 2, r = ARENA_R + 7.6 + tier * 2.6 + Math.random() * 1.6;
    ppos.set([Math.cos(a) * r, 0.9 + tier * 1.6 + Math.random() * 0.3, Math.sin(a) * r], i * 3);
    const c = pal[(Math.random() * pal.length) | 0]; pcol.set([c.r, c.g, c.b], i * 3);
  }
  const crowdGeo = new THREE.BufferGeometry();
  crowdGeo.setAttribute('position', new THREE.BufferAttribute(ppos, 3));
  crowdGeo.setAttribute('color', new THREE.BufferAttribute(pcol, 3));
  const crowd = new THREE.Points(crowdGeo, new THREE.PointsMaterial({ size: 0.22, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false }));
  group.add(crowd);

  // stadium floodlight towers + beams
  const beamMat = new THREE.MeshBasicMaterial({ color: 0x9fc8ff, transparent: true, opacity: 0.022, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3, r = ARENA_R + 26;
    const tower = new THREE.Mesh(new THREE.BoxGeometry(1.2, 24, 1.2), toon(0x15132b));
    tower.position.set(Math.cos(a) * r, 10, Math.sin(a) * r); group.add(tower);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 0.6), new THREE.MeshBasicMaterial({ color: 0xfff3d0 }));
    lamp.position.set(Math.cos(a) * r, 22, Math.sin(a) * r); lamp.lookAt(0, 0, 0); group.add(lamp);
    const len = Math.hypot(r, 22);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(2.6, len, 16, 1, true), beamMat);
    beam.position.set(Math.cos(a) * r / 2, 11, Math.sin(a) * r / 2);
    beam.lookAt(Math.cos(a) * r, 22, Math.sin(a) * r); beam.rotateX(Math.PI / 2);
    group.add(beam);
  }

  // lighting
  scene.add(new THREE.HemisphereLight(0x9fb0ff, 0x2a1a45, 0.75));
  const key = new THREE.DirectionalLight(0xfff0e0, 2.3);
  key.position.set(8, 18, 6); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  const sc = key.shadow.camera; sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 50;
  key.shadow.bias = -0.0008;
  scene.add(key);
  const rimL = new THREE.DirectionalLight(0x8fb8ff, 0.9); rimL.position.set(-10, 6, -12); scene.add(rimL);

  let hue = 0, flash = 0;
  return {
    group,
    pulse() { flash = 0.6; },
    update(dt, time) {
      skyMat.uniforms.t.value = time;
      curtainMat.uniforms.t.value = time;
      flash = Math.max(0, flash - dt * 1.5);
      curtainMat.uniforms.flash.value = flash;
      hue += dt * 0.05;
      for (const r of rim) r.m.material.color.setHSL((hue + r.a / (Math.PI * 2)) % 1, 0.85, 0.62 + flash * 0.2);
      crowd.material.opacity = 0.7 + Math.sin(time * 6) * 0.08 + flash * 0.3;
    }
  };
}
