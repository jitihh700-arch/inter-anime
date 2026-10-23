import * as THREE from '../vendor/three.module.min.js';

// --------------------------------------------------------------------------
// Cel-shaded fighter rigs built from lightweight shared geometry.
// Every fighter shares one skeleton layout (so one animation set drives all 16);
// silhouettes differ through hair, outfit colours, armour, capes, tails and weapons.
// --------------------------------------------------------------------------

let gradientMap = null;
function toonGradient() {
  if (gradientMap) return gradientMap;
  const data = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  gradientMap = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  gradientMap.minFilter = gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.needsUpdate = true;
  return gradientMap;
}

const matCache = new Map();
export function toon(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!opts.unique && matCache.has(key)) return matCache.get(key);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...opts.params });
  if (opts.emissive) { m.emissive = new THREE.Color(opts.emissive); m.emissiveIntensity = opts.emissiveIntensity ?? 0.6; }
  if (!opts.unique) matCache.set(key, m);
  return m;
}
const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x0b0b14, side: THREE.BackSide });

const G = {
  capsule: (r, l) => new THREE.CapsuleGeometry(r, l, 4, 10),
  sphere: new THREE.SphereGeometry(1, 16, 12),
  cone: new THREE.ConeGeometry(1, 1, 6),
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 14),
};
const capsCache = new Map();
function caps(r, l) { const k = r + ':' + l; if (!capsCache.has(k)) capsCache.set(k, G.capsule(r, l)); return capsCache.get(k); }

function mesh(geo, mat, { outline = true, scale = null, pos = null, rot = null, ow = 0.035 } = {}) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  g.add(m);
  if (outline) {
    const o = new THREE.Mesh(geo, OUTLINE);
    if (scale) { const k = 1 + ow * 1.6; o.scale.set(scale[0] * k + 0.006, scale[1] * k + 0.006, scale[2] * k + 0.006); }
    else o.scale.setScalar(1 + ow * 2.2);
    g.add(o);
    g.userData.outline = o;
  }
  if (scale) m.scale.set(...scale);
  if (pos) g.position.set(...pos);
  if (rot) g.rotation.set(...rot);
  g.userData.mesh = m;
  return g;
}

const UP = new THREE.Vector3(0, 1, 0);
// a hair spike: cone placed at `at` (head-local) pointing along `dir`
function spike(parent, mat, at, dir, len, rad) {
  const d = new THREE.Vector3(...dir).normalize();
  const g = mesh(G.cone, mat, { scale: [rad, len, rad], ow: 0.02 });
  g.position.set(at[0] + d.x * len * 0.45, at[1] + d.y * len * 0.45, at[2] + d.z * len * 0.45);
  g.quaternion.setFromUnitVectors(UP, d);
  parent.add(g);
  return g;
}

const SLEEVES = {
  goku: 'none', vegeta: 'long', saitama: 'long', beerus: 'none', frieza: 'skin', naruto: 'long', sasuke: 'short',
  anos: 'long', gojo: 'long', sukuna: 'long', tanjiro: 'long', ichigo: 'long', luffy: 'none', zoro: 'long', madara: 'long', gogeta: 'none'
};

function checkerTexture(a, b) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? a : b; x.fillRect(i * 16, j * 16, 16, 16); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2);
  t.magFilter = THREE.NearestFilter;
  return t;
}

export function buildFighter(def, { ghost = false } = {}) {
  const M = def.model;
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const rig = { root, body, def, sword: [] };
  const skin = toon(M.skin);
  const hairM = toon(M.hairColor);
  const topM = M.haori === 'checker'
    ? new THREE.MeshToonMaterial({ map: checkerTexture('#1f7a4a', '#121214'), gradientMap: toonGradient() })
    : toon(M.top);
  const pantsM = toon(M.pants);
  const beltM = toon(M.belt);
  const bootM = toon(M.boots);
  const sleeve = SLEEVES[def.id] || 'long';
  const armM = sleeve === 'skin' ? skin : sleeve === 'none' ? skin : topM;
  const foreM = sleeve === 'long' ? topM : skin;
  const handM = M.gloves ? toon(M.gloves) : skin;

  // hips
  const hips = new THREE.Group(); hips.position.y = 0.98; body.add(hips); rig.hips = hips;
  hips.add(mesh(caps(0.17, 0.12), pantsM, { scale: [1.15, 1, 0.85], rot: [0, 0, Math.PI / 2] }));
  const belt = mesh(G.cyl, beltM, { scale: [0.2, 0.07, 0.15], pos: [0, 0.1, 0], outline: false }); hips.add(belt);

  // torso
  const torso = new THREE.Group(); torso.position.y = 0.08; hips.add(torso); rig.torso = torso;
  const chestM = (def.id === 'gogeta' || def.id === 'luffy') ? skin : topM;
  torso.add(mesh(caps(0.2, 0.26), chestM, { scale: [1.12, 1, 0.78], pos: [0, 0.3, 0] }));
  if (def.id === 'goku') torso.add(mesh(caps(0.19, 0.18), toon(M.under), { scale: [1.05, 1, 0.7], pos: [0, 0.38, 0.02], outline: false }));
  if (def.id === 'luffy') { // open red vest
    torso.add(mesh(G.box, topM, { scale: [0.17, 0.46, 0.34], pos: [-0.16, 0.32, 0] }));
    torso.add(mesh(G.box, topM, { scale: [0.17, 0.46, 0.34], pos: [0.16, 0.32, 0] }));
  }
  if (def.id === 'gogeta') {
    torso.add(mesh(G.box, toon(M.top), { scale: [0.16, 0.46, 0.34], pos: [-0.17, 0.32, 0] }));
    torso.add(mesh(G.box, toon(M.top), { scale: [0.16, 0.46, 0.34], pos: [0.17, 0.32, 0] }));
    for (const s of [-1, 1]) torso.add(mesh(G.sphere, toon(M.vest), { scale: [0.14, 0.09, 0.13], pos: [0.27 * s, 0.56, 0] }));
    hips.add(mesh(G.cyl, toon(M.belt), { scale: [0.22, 0.09, 0.17], pos: [0, 0.1, 0] }));
  }
  if (M.armor) {
    torso.add(mesh(G.box, toon(M.armor), { scale: [0.46, 0.34, 0.36], pos: [0, 0.38, 0] }));
    for (const s of [-1, 1]) torso.add(mesh(G.box, toon(M.armor), { scale: [0.18, 0.08, 0.26], pos: [0.3 * s, 0.56, 0], rot: [0, 0, -0.35 * s] }));
  }
  if (M.coat || def.id === 'sukuna' || def.id === 'zoro' || def.id === 'tanjiro' || def.id === 'ichigo' || def.id === 'madara') {
    const skirt = new THREE.CylinderGeometry(0.21, 0.32, 0.55, 12, 1, true);
    const skirtM = def.id === 'tanjiro' ? topM : toon(M.coat || M.top, { params: { side: THREE.DoubleSide } });
    const sk = mesh(skirt, def.id === 'ichigo' ? toon(M.pants, { params: { side: THREE.DoubleSide } }) : skirtM, { pos: [0, -0.2, 0] });
    hips.add(sk);
  }
  if (M.cape) {
    const capeM = toon(M.cape, { params: { side: THREE.DoubleSide } });
    const cape = mesh(new THREE.PlaneGeometry(0.62, 1.05, 1, 4), capeM, { pos: [0, 0.05, -0.2], outline: false });
    cape.userData.mesh.position.y = -0.48;
    const capeRoot = new THREE.Group(); capeRoot.position.set(0, 0.6, -0.02); capeRoot.add(cape); torso.add(capeRoot);
    rig.cape = capeRoot;
  }
  if (M.tail) {
    const tail = new THREE.Group(); tail.position.set(0, -0.02, -0.15); hips.add(tail); rig.tail = tail;
    let p = tail;
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.Group(); seg.position.set(0, 0, i === 0 ? 0 : -0.17); seg.rotation.x = 0.25;
      seg.add(mesh(caps(0.06 - i * 0.006, 0.12), toon(M.tail), { rot: [Math.PI / 2, 0, 0], pos: [0, 0, -0.08] }));
      p.add(seg); p = seg;
    }
    if (def.id === 'frieza') p.add(mesh(G.sphere, toon(M.accent), { scale: [0.06, 0.06, 0.06], pos: [0, 0, -0.17] }));
  }

  // head
  const neck = new THREE.Group(); neck.position.y = 0.62; torso.add(neck); rig.head = neck;
  neck.add(mesh(caps(0.06, 0.06), skin, { pos: [0, 0, 0], outline: false }));
  const head = new THREE.Group(); head.position.y = 0.17; neck.add(head);
  head.add(mesh(G.sphere, skin, { scale: [0.155, 0.175, 0.16] }));
  const eyeM = new THREE.MeshBasicMaterial({ color: def.id === 'sasuke' || def.id === 'madara' ? 0xb0101a : 0x111118 });
  if (!M.blindfold) for (const s of [-1, 1]) head.add(mesh(G.box, eyeM, { scale: [0.045, 0.05, 0.02], pos: [0.058 * s, 0.01, 0.148], outline: false }));
  buildHair(def, head, hairM, M);

  // arms
  const arm = (s) => {
    const sh = new THREE.Group(); sh.position.set(0.27 * s, 0.53, 0); torso.add(sh);
    sh.add(mesh(caps(0.075, 0.2), armM, { pos: [0, -0.15, 0] }));
    if (def.id === 'goku') sh.add(mesh(G.sphere, toon(M.under), { scale: [0.1, 0.08, 0.1], pos: [0, -0.02, 0], outline: false }));
    const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
    el.add(mesh(caps(0.065, 0.19), foreM, { pos: [0, -0.13, 0] }));
    if (def.id === 'goku') el.add(mesh(G.cyl, toon(M.under), { scale: [0.075, 0.07, 0.075], pos: [0, -0.2, 0], outline: false }));
    const hand = new THREE.Group(); hand.position.y = -0.3; el.add(hand);
    hand.add(mesh(G.sphere, handM, { scale: [0.075, 0.08, 0.075] }));
    return { sh, el, hand };
  };
  const L = arm(1), R = arm(-1); // +x is the model's left when facing +z
  rig.shL = L.sh; rig.elL = L.el; rig.handL = L.hand;
  rig.shR = R.sh; rig.elR = R.el; rig.handR = R.hand;

  // legs
  const leg = (s) => {
    const hp = new THREE.Group(); hp.position.set(0.11 * s, -0.04, 0); hips.add(hp);
    hp.add(mesh(caps(0.09, 0.28), pantsM, { pos: [0, -0.2, 0] }));
    const kn = new THREE.Group(); kn.position.y = -0.44; hp.add(kn);
    kn.add(mesh(caps(0.075, 0.26), pantsM, { pos: [0, -0.18, 0] }));
    kn.add(mesh(caps(0.08, 0.12), bootM, { pos: [0, -0.32, 0] }));
    kn.add(mesh(G.box, bootM, { scale: [0.12, 0.08, 0.24], pos: [0, -0.44, 0.05] }));
    return { hp, kn };
  };
  const LL = leg(1), LR = leg(-1);
  rig.hipL = LL.hp; rig.knL = LL.kn; rig.hipR = LR.hp; rig.knR = LR.kn;

  // weapons
  const blade = (len, w, col, guard = 0x222222) => {
    const g = new THREE.Group();
    g.add(mesh(G.box, toon(0x2a1a14), { scale: [0.035, 0.22, 0.035], pos: [0, 0.02, 0], outline: false }));
    g.add(mesh(G.box, toon(guard), { scale: [0.09, 0.025, 0.09], pos: [0, 0.14, 0], outline: false }));
    g.add(mesh(G.box, toon(col, { emissive: col, emissiveIntensity: 0.15 }), { scale: [0.02, len, w], pos: [0, 0.15 + len / 2, 0], ow: 0.01 }));
    return g;
  };
  if (M.sword === 'katana' || M.sword === 'three') {
    const k = blade(0.85, 0.045, 0xdfe8f2); k.rotation.x = Math.PI / 2; rig.handR.add(k); rig.sword.push(k);
  }
  if (M.sword === 'three') {
    const k2 = blade(0.85, 0.045, 0xdfe8f2); k2.rotation.x = Math.PI / 2; rig.handL.add(k2); rig.sword.push(k2);
    const k3 = blade(0.8, 0.04, 0xdfe8f2); k3.rotation.set(0, 0, Math.PI / 2); k3.position.set(0.05, -0.08, 0.17); head.add(k3);
  }
  if (M.sword === 'cleaver') {
    const k = blade(1.15, 0.2, 0x15151a, 0x111111); k.rotation.x = Math.PI / 2; rig.handR.add(k); rig.sword.push(k);
  }

  // aura (special / power-up glow)
  const auraM = new THREE.MeshBasicMaterial({ color: def.aura, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const aura = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14), auraM);
  aura.scale.set(0.75, 1.25, 0.75); aura.position.y = 1.0; root.add(aura); rig.aura = aura;

  // gojo's Infinity shell
  if (def.id === 'gojo') {
    const inf = new THREE.Mesh(new THREE.SphereGeometry(1.25, 24, 16), new THREE.MeshBasicMaterial({ color: 0x9fe0ff, transparent: true, opacity: 0, wireframe: true, depthWrite: false }));
    inf.position.y = 1; root.add(inf); rig.infinity = inf;
  }

  if (ghost) {
    root.traverse((o) => {
      if (o.isMesh && o.material !== auraM) {
        o.material = o.material === OUTLINE ? OUTLINE : new THREE.MeshBasicMaterial({ color: o.material.color || 0xffffff, transparent: true, opacity: 0.55 });
        o.castShadow = false;
      }
    });
  }

  // cache all materials for hit flash
  rig.mats = [];
  root.traverse((o) => { if (o.isMesh && o.material && o.material.isMeshToonMaterial) rig.mats.push(o.material); });
  rig.pose = {};
  return rig;
}

function buildHair(def, head, hairM, M) {
  const id = def.id;
  const capOn = (scale = [0.165, 0.15, 0.168], y = 0.04, z = -0.01) => head.add(mesh(G.sphere, hairM, { scale, pos: [0, y, z] }));
  const ring = (n, y, r, len, rad, tiltUp, back = 0) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const dx = Math.sin(a), dz = Math.cos(a);
      if (dz > 0.6 && y < 0.1) continue; // keep the face clear
      spike(head, hairM, [dx * r, y, dz * r], [dx, tiltUp, dz - back], len, rad);
    }
  };
  switch (M.hair) {
    case 'goku': case 'gogeta': {
      capOn();
      const big = M.hair === 'gogeta' ? 1.15 : 1;
      const sp = [[[0, 0.14, 0], [0.2, 1, -0.2], 0.32], [[0.08, 0.12, 0], [1, 0.9, -0.2], 0.3], [[-0.08, 0.12, 0], [-1, 0.9, -0.2], 0.3],
        [[0.12, 0.05, -0.05], [1, 0.3, -0.4], 0.3], [[-0.12, 0.05, -0.05], [-1, 0.3, -0.4], 0.3], [[0, 0.08, -0.1], [0, 0.4, -1], 0.3],
        [[0.06, 0.0, -0.13], [0.5, -0.3, -1], 0.26], [[-0.06, 0.0, -0.13], [-0.5, -0.3, -1], 0.26],
        [[0.05, 0.1, 0.1], [0.3, 0.2, 1], 0.14], [[-0.05, 0.1, 0.11], [-0.4, -0.2, 1], 0.13], [[0, 0.12, 0.1], [0, -0.6, 1], 0.12]];
      for (const [at, d, l] of sp) spike(head, hairM, at, d, l * big, 0.075);
      break;
    }
    case 'vegeta': {
      capOn([0.165, 0.14, 0.16]);
      for (const [x, z, tilt, l] of [[0, 0, 0, 0.5], [0.07, -0.04, 0.25, 0.44], [-0.07, -0.04, -0.25, 0.44], [0.1, 0.03, 0.4, 0.34], [-0.1, 0.03, -0.4, 0.34], [0, -0.09, 0, 0.42]])
        spike(head, hairM, [x, 0.12, z], [tilt, 1, -0.15], l, 0.085);
      break;
    }
    case 'naruto': {
      capOn();
      ring(12, 0.08, 0.13, 0.2, 0.06, 0.55, 0.1);
      spike(head, hairM, [0, 0.15, 0], [0, 1, -0.2], 0.2, 0.06);
      head.add(mesh(G.cyl, toon(M.headband), { scale: [0.168, 0.04, 0.172], pos: [0, 0.075, 0], outline: false }));
      head.add(mesh(G.box, toon(0xc8ccd6), { scale: [0.1, 0.045, 0.02], pos: [0, 0.075, 0.172], outline: false }));
      break;
    }
    case 'sasuke': {
      capOn();
      for (const [x, y] of [[0, 0.1], [0.08, 0.06], [-0.08, 0.06], [0.04, 0.13], [-0.04, 0.13]]) spike(head, hairM, [x, y, -0.06], [x * 3, 0.5, -1], 0.3, 0.075);
      spike(head, hairM, [0.11, 0.06, 0.08], [0.15, -1, 0.1], 0.2, 0.04);
      spike(head, hairM, [-0.11, 0.06, 0.08], [-0.15, -1, 0.1], 0.2, 0.04);
      break;
    }
    case 'anos': {
      capOn([0.17, 0.16, 0.17], 0.035);
      for (const x of [-0.07, 0, 0.07]) spike(head, hairM, [x, 0.1, 0.11], [x, -1, 0.5], 0.12, 0.045);
      break;
    }
    case 'gojo': {
      capOn([0.165, 0.15, 0.165]);
      ring(10, 0.09, 0.12, 0.2, 0.06, 1.2, 0.05);
      spike(head, hairM, [0, 0.16, 0], [0, 1, 0], 0.18, 0.06);
      head.add(mesh(G.cyl, toon(M.blindfold), { scale: [0.165, 0.05, 0.17], pos: [0, 0.01, 0.005], outline: false }));
      break;
    }
    case 'sukuna': {
      capOn([0.163, 0.14, 0.163]);
      ring(9, 0.1, 0.11, 0.14, 0.05, 1.3, 0.1);
      const mk = new THREE.MeshBasicMaterial({ color: M.markings });
      for (const s of [-1, 1]) {
        head.add(mesh(G.box, mk, { scale: [0.04, 0.012, 0.01], pos: [0.06 * s, -0.04, 0.152], outline: false }));
        head.add(mesh(G.box, mk, { scale: [0.035, 0.03, 0.02], pos: [0.06 * s, -0.025, 0.148], outline: false }));
      }
      break;
    }
    case 'tanjiro': {
      capOn([0.168, 0.15, 0.168]);
      ring(10, 0.07, 0.13, 0.13, 0.05, 0.3, 0.2);
      for (const s of [-1, 1]) head.add(mesh(G.box, toon(0xe8e0d0), { scale: [0.012, 0.07, 0.04], pos: [0.16 * s, -0.08, 0], outline: false }));
      head.add(mesh(G.box, toon(0x8a2020), { scale: [0.05, 0.02, 0.01], pos: [-0.06, 0.08, 0.155], outline: false }));
      break;
    }
    case 'ichigo': {
      capOn();
      ring(11, 0.08, 0.13, 0.2, 0.06, 0.8, 0.15);
      spike(head, hairM, [0, 0.15, 0], [0.2, 1, 0], 0.18, 0.06);
      break;
    }
    case 'luffy': {
      capOn([0.166, 0.13, 0.166]);
      const hatM = toon(M.hat);
      head.add(mesh(G.cyl, hatM, { scale: [0.17, 0.11, 0.17], pos: [0, 0.15, 0] }));
      head.add(mesh(G.cyl, hatM, { scale: [0.32, 0.015, 0.32], pos: [0, 0.1, 0] }));
      head.add(mesh(G.cyl, toon(0xc8202a), { scale: [0.172, 0.03, 0.172], pos: [0, 0.12, 0], outline: false }));
      break;
    }
    case 'zoro': {
      capOn([0.165, 0.13, 0.165], 0.05);
      ring(8, 0.1, 0.1, 0.07, 0.05, 1, 0);
      break;
    }
    case 'madara': {
      capOn([0.172, 0.16, 0.175]);
      for (let i = 0; i < 9; i++) {
        const a = -1.1 + (i / 8) * 2.2;
        spike(head, hairM, [Math.sin(a) * 0.12, 0.05, -0.09], [Math.sin(a) * 0.5, -1.4, -0.7], 0.62, 0.075);
      }
      for (const s of [-1, 1]) spike(head, hairM, [0.1 * s, 0.05, 0.1], [0.1 * s, -1, 0.15], 0.3, 0.05);
      break;
    }
    case 'beerus': {
      for (const s of [-1, 1]) spike(head, toon(M.hairColor), [0.09 * s, 0.11, 0], [0.35 * s, 1, 0], 0.32, 0.075);
      break;
    }
    case 'frieza': {
      head.add(mesh(G.sphere, toon(M.hairColor), { scale: [0.158, 0.12, 0.162], pos: [0, 0.075, -0.005] }));
      break;
    }
    case 'bald': default:
      break;
  }
}

// ---------------------------------------------------------------- animation
const J = ['body', 'hips', 'torso', 'head', 'shL', 'elL', 'shR', 'elR', 'hipL', 'knL', 'hipR', 'knR'];
const lerp = (a, b, t) => a + (b - a) * t;

function basePose() {
  const p = {};
  for (const j of J) p[j] = [0, 0, 0];
  p.y = 0;
  return p;
}

// Compute a target pose for a fighter from its simulation state.
function targetPose(f, time, rig) {
  const p = basePose();
  const s = f.state;
  const swordUser = rig.sword.length > 0;
  const stance = () => {
    const b = Math.sin(time * 3) * 0.03;
    p.shL = [-0.9, 0, 0.25]; p.elL = [-1.5, 0, 0];
    p.shR = [-0.6, 0, -0.25]; p.elR = [-1.6, 0, 0];
    if (swordUser) { p.shR = [-0.7, 0, -0.35]; p.elR = [-0.9, 0, 0]; }
    p.torso = [0.08, 0.35, 0];
    p.hipL = [-0.35, 0, 0.08]; p.knL = [0.5, 0, 0];
    p.hipR = [0.25, 0, -0.08]; p.knR = [0.35, 0, 0];
    p.y = -0.04 + b;
  };
  switch (s) {
    case 'idle': case 'blockstun': default: stance(); break;
    case 'move': {
      const ph = time * 11;
      p.hipL = [Math.sin(ph) * 0.8, 0, 0]; p.knL = [Math.max(0, -Math.cos(ph)) * 1.1 + 0.2, 0, 0];
      p.hipR = [-Math.sin(ph) * 0.8, 0, 0]; p.knR = [Math.max(0, Math.cos(ph)) * 1.1 + 0.2, 0, 0];
      p.shL = [-Math.sin(ph) * 0.7 - 0.2, 0, 0.15]; p.elL = [-1.2, 0, 0];
      p.shR = [Math.sin(ph) * 0.7 - 0.2, 0, -0.15]; p.elR = [-1.2, 0, 0];
      p.torso = [0.25, 0, 0]; p.y = Math.abs(Math.sin(ph)) * 0.06 - 0.03;
      break;
    }
    case 'block': {
      stance();
      p.shL = [-1.35, 0, -0.35]; p.elL = [-1.9, 0, 0];
      p.shR = [-1.35, 0, 0.35]; p.elR = [-1.9, 0, 0];
      p.torso = [0.25, 0, 0]; p.y = -0.12; p.knL = [0.8, 0, 0]; p.knR = [0.7, 0, 0]; p.hipL = [-0.5, 0, 0.1];
      break;
    }
    case 'dodge': {
      p.torso = [0.5, 0, 0]; p.y = -0.25; p.hipL = [-1.0, 0, 0]; p.knL = [1.4, 0, 0]; p.hipR = [-0.4, 0, 0]; p.knR = [1.3, 0, 0];
      p.shL = [0.5, 0, 0.4]; p.shR = [0.5, 0, -0.4]; p.elL = [-0.5, 0, 0]; p.elR = [-0.5, 0, 0];
      break;
    }
    case 'hitstun': {
      const k = Math.min(1, f.t / 0.1);
      p.torso = [-0.55 * k, 0.2, 0]; p.head = [-0.4 * k, 0, 0];
      p.shL = [0.6, 0, 0.6]; p.shR = [0.4, 0, -0.7]; p.elL = [-0.4, 0, 0]; p.elR = [-0.5, 0, 0];
      p.hipL = [0.3, 0, 0]; p.knL = [0.3, 0, 0]; p.hipR = [-0.2, 0, 0]; p.knR = [0.5, 0, 0];
      break;
    }
    case 'down': case 'ko': {
      p.body = [-Math.PI / 2, 0, 0]; p.y = 0.12;
      p.shL = [-2.6, 0, 0.5]; p.shR = [-2.6, 0, -0.5]; p.hipL = [-0.2, 0, 0.1]; p.hipR = [-0.4, 0, -0.1]; p.knL = [0.3, 0, 0]; p.knR = [0.6, 0, 0];
      p.head = [0.2, 0, 0];
      break;
    }
    case 'getup': {
      const k = Math.min(1, f.t / 0.4);
      p.body = [-Math.PI / 2 * (1 - k), 0, 0]; p.y = -0.35 * Math.sin(k * Math.PI);
      p.hipL = [-1.2 * (1 - k), 0, 0]; p.knL = [1.6 * (1 - k), 0, 0]; p.hipR = [-1.0 * (1 - k), 0, 0]; p.knR = [1.6 * (1 - k), 0, 0];
      break;
    }
    case 'win': {
      p.shR = [-3.0, 0, -0.2]; p.elR = [-0.2, 0, 0]; p.shL = [0.1, 0, 0.3]; p.elL = [-0.4, 0, 0];
      p.torso = [-0.1, -0.2, 0]; p.y = Math.sin(time * 4) * 0.03;
      break;
    }
    case 'attack': attackPose(f, p, swordUser, stance); break;
    case 'special': specialPose(f, p, time, swordUser, stance); break;
  }
  if (!f.grounded && !['down', 'ko', 'hitstun', 'special', 'attack'].includes(s)) {
    p.hipL = [-1.2, 0, 0.1]; p.knL = [1.6, 0, 0]; p.hipR = [-0.6, 0, -0.1]; p.knR = [1.2, 0, 0];
  }
  return p;
}

function attackPose(f, p, swordUser, stance) {
  stance();
  const a = f.act; if (!a) return;
  const wind = a.t < a.startup;
  const strike = !wind && a.t < a.startup + a.active + 0.08;
  if (a.kind === 'light') {
    if (swordUser) {
      const dir = a.step % 2 === 0 ? 1 : -1;
      if (wind) { p.shR = [-1.4, 0.9 * dir, -0.6 * dir]; p.elR = [-0.6, 0, 0]; p.torso = [0.1, 0.7 * dir, 0]; }
      else { p.shR = [-1.3, -0.9 * dir, 0.3 * dir]; p.elR = [-0.1, 0, 0]; p.torso = [0.25, -0.6 * dir, 0]; }
      if (a.step === 2 && !wind) { p.shR = [-2.0, 0, 0]; p.elR = [0, 0, 0]; p.torso = [0.5, 0, 0]; }
      return;
    }
    if (a.step === 2) { // finishing kick
      if (wind) { p.hipR = [0.4, 0, 0]; p.knR = [1.6, 0, 0]; p.torso = [0, 0.4, 0]; }
      else { p.hipR = [-1.55, 0, 0]; p.knR = [0.05, 0, 0]; p.torso = [-0.3, 0.3, 0]; p.hipL = [0.1, 0, 0]; p.knL = [0.2, 0, 0]; }
      return;
    }
    const right = a.step === 0;
    const sh = right ? 'shR' : 'shL', el = right ? 'elR' : 'elL';
    if (strike) { p[sh] = [-1.6, 0, right ? 0.1 : -0.1]; p[el] = [-0.05, 0, 0]; p.torso = [0.2, right ? -0.5 : 0.5, 0]; }
    else { p[sh] = [-0.8, 0, 0]; p[el] = [-1.9, 0, 0]; p.torso = [0.1, right ? 0.3 : -0.3, 0]; }
    return;
  }
  // heavy
  if (swordUser) {
    if (wind) { p.shR = [-3.0, 0, -0.2]; p.elR = [-0.4, 0, 0]; p.torso = [-0.25, 0.2, 0]; }
    else { p.shR = [-1.1, 0, 0]; p.elR = [0, 0, 0]; p.torso = [0.6, -0.1, 0]; p.y = -0.15; p.knL = [0.9, 0, 0]; p.hipL = [-0.8, 0, 0]; }
    return;
  }
  if (wind) { p.hipR = [0.6, 0, -0.3]; p.knR = [1.5, 0, 0]; p.torso = [0.1, 1.0, 0]; p.shL = [-1, 0, 0.8]; }
  else { p.hipR = [-1.4, 0, -0.5]; p.knR = [0.0, 0, 0]; p.torso = [-0.35, -0.7, 0]; p.shL = [-0.3, 0, 1.0]; p.shR = [-0.3, 0, -1.0]; }
}

function specialPose(f, p, time, swordUser, stance) {
  stance();
  const a = f.act; if (!a) return;
  const s = f.def.special;
  const charging = a.t < s.charge;
  switch (s.type) {
    case 'beam':
      if (charging) { p.shL = [-0.3, 0, -0.5]; p.shR = [-0.3, 0, 0.5]; p.elL = [-1.5, 0, 0]; p.elR = [-1.5, 0, 0]; p.torso = [0, -1.0, 0]; p.y = -0.15; }
      else { p.shL = [-1.55, 0, -0.2]; p.shR = [-1.55, 0, 0.2]; p.elL = [0, 0, 0]; p.elR = [0, 0, 0]; p.torso = [0.15, 0, 0]; p.y = -0.15; p.hipL = [-0.7, 0, 0.1]; p.knL = [0.9, 0, 0]; p.hipR = [0.5, 0, 0]; }
      break;
    case 'projectile':
      if (charging) { p.shR = [-0.2, 0, -0.9]; p.elR = [-1.2, 0, 0]; p.torso = [0, 0.7, 0]; if (swordUser) { p.shR = [-2.8, 0, -0.4]; } }
      else { p.shR = [-1.6, 0, 0]; p.elR = [0, 0, 0]; p.torso = [0.25, -0.4, 0]; if (swordUser) { p.shR = [-0.9, 0, 0]; p.torso = [0.6, -0.5, 0]; } if (f.def.id === 'madara') { p.head = [0.4, 0, 0]; p.shR = [-1.3, 0, 0.4]; p.elR = [-1.6, 0, 0]; } }
      break;
    case 'punch':
      if (charging) { p.shR = [0.5, 0, -0.3]; p.elR = [-2.0, 0, 0]; p.torso = [0.1, 1.1, 0]; p.y = -0.15; }
      else { p.shR = [-1.62, 0, 0.1]; p.elR = [0, 0, 0]; p.torso = [0.35, -0.8, 0]; p.hipL = [-0.9, 0, 0]; p.knL = [0.8, 0, 0]; p.y = -0.2; }
      break;
    case 'aoe': case 'gojo':
      if (charging || s.type === 'gojo') { p.shR = [-2.4, 0, -0.4]; p.elR = [-0.6, 0, 0]; p.shL = [-1.2, 0, 0.6]; p.elL = [-1.0, 0, 0]; }
      if (!charging && s.type === 'aoe') { p.shL = [0, 0, 1.6]; p.shR = [0, 0, -1.6]; p.elL = [0, 0, 0]; p.elR = [0, 0, 0]; p.torso = [-0.3, 0, 0]; }
      break;
    case 'clones': case 'dash':
      if (charging) { p.shR = [-0.9, 0, -0.6]; p.elR = [-1.0, 0, 0]; p.torso = [0.3, 0.6, 0]; p.y = -0.2; }
      else { p.shR = [-1.6, 0, 0]; p.elR = [0, 0, 0]; p.shL = [0.8, 0, 0.4]; p.torso = [0.7, -0.2, 0]; p.hipL = [-1.0, 0, 0]; p.knL = [0.6, 0, 0]; p.hipR = [0.7, 0, 0]; p.knR = [0.5, 0, 0];
        if (swordUser) { p.shR = [-1.3, -1.0 + Math.sin(time * 30) * 1.0, 0]; } }
      break;
    case 'flurry': {
      const alt = Math.sin(time * 45) > 0;
      p.shR = [alt ? -1.6 : -0.9, 0, 0]; p.elR = [alt ? 0 : -1.4, 0, 0];
      p.shL = [!alt ? -1.6 : -0.9, 0, 0]; p.elL = [!alt ? 0 : -1.4, 0, 0];
      p.torso = [0.2, alt ? -0.3 : 0.3, 0];
      if (f.def.id === 'sukuna') { p.shR = [-1.4, alt ? -0.8 : 0.8, 0]; p.elR = [0, 0, 0]; }
      break;
    }
    case 'spin':
      p.shL = [-1.5, 0, 1.0]; p.shR = [-1.5, 0, -1.0]; p.elL = [0, 0, 0]; p.elR = [0, 0, 0];
      if (!charging) p.body = [0, (time * 22) % (Math.PI * 2), 0];
      p.y = -0.1;
      break;
    case 'teleport':
      if (a.phase >= 2) { p.shR = [-1.6, 0, 0.2]; p.shL = [-1.6, 0, -0.2]; p.elR = [0, 0, 0]; p.elL = [0, 0, 0]; p.torso = [0.4, 0, 0]; }
      break;
  }
}

export function animateRig(rig, f, time, dt) {
  const target = targetPose(f, time, rig);
  const fast = f.state === 'attack' || f.state === 'special' || f.state === 'hitstun' || f.state === 'dodge';
  const k = Math.min(1, dt * (fast ? 28 : 14));
  for (const j of J) {
    const node = rig[j]; if (!node) continue;
    const t = target[j];
    if (j === 'body' && f.def.special && f.def.special.type === 'spin' && f.state === 'special') { node.rotation.set(t[0], t[1], t[2]); continue; }
    node.rotation.x = lerp(node.rotation.x, t[0], k);
    node.rotation.y = lerp(node.rotation.y, t[1], k);
    node.rotation.z = lerp(node.rotation.z, t[2], k);
  }
  rig.body.position.y = lerp(rig.body.position.y, target.y, k);
  if (rig.cape) rig.cape.rotation.x = lerp(rig.cape.rotation.x, 0.15 + Math.min(1.2, Math.hypot(f.mvx + f.vx, f.mvz + f.vz) * 0.12), k);
  if (rig.tail) rig.tail.rotation.y = Math.sin(time * 2.2) * 0.4;
}
