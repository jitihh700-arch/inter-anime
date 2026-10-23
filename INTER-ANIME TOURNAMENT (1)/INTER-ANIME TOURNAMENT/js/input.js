// Input → gameplay intent. Keyboard, mouse camera and on-screen touch controls all
// feed the same intent object the AI uses, so every device drives identical rules.

export class Input {
  constructor(stage) {
    this.stage = stage;
    this.keys = new Set();
    this.pressed = new Set();
    this.touchMove = { x: 0, y: 0 };
    this.touchHold = new Set();
    this.enabled = false;
    this.onPause = null;

    const map = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
      Space: 'jump', KeyJ: 'light', KeyK: 'heavy', KeyL: 'special', ShiftLeft: 'dodge', ShiftRight: 'dodge', KeyI: 'block' };
    this.map = map;
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' || e.code === 'KeyP') { if (this.enabled && this.onPause) this.onPause(); return; }
      const a = map[e.code]; if (!a) return;
      if (this.enabled) e.preventDefault();
      if (!this.keys.has(a)) this.pressed.add(a);
      this.keys.add(a);
    });
    window.addEventListener('keyup', (e) => { const a = map[e.code]; if (a) this.keys.delete(a); });
    window.addEventListener('blur', () => { this.keys.clear(); this.touchHold.clear(); });

    // mouse camera: drag to orbit, wheel to zoom
    const cv = stage.renderer.domElement;
    let drag = null;
    cv.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') { drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); } });
    cv.addEventListener('pointermove', (e) => {
      if (!drag) return;
      stage.orbitYaw += (e.clientX - drag.x) * 0.006;
      stage.orbitYaw = Math.max(-1.3, Math.min(1.3, stage.orbitYaw));
      stage.orbitPitch = Math.max(-0.3, Math.min(0.6, stage.orbitPitch - (e.clientY - drag.y) * 0.003));
      drag = { x: e.clientX, y: e.clientY };
    });
    cv.addEventListener('pointerup', () => { drag = null; });
    cv.addEventListener('dblclick', () => { stage.orbitYaw = 0; stage.orbitPitch = 0; stage.zoom = 1; });
    cv.addEventListener('wheel', (e) => { stage.zoom = Math.max(0.65, Math.min(1.5, stage.zoom + Math.sign(e.deltaY) * 0.06)); e.preventDefault(); }, { passive: false });
  }

  bindTouch(root) {
    const stick = root.querySelector('.stick'), knob = root.querySelector('.knob');
    let sid = null, cx = 0, cy = 0;
    const R = 46;
    stick.addEventListener('pointerdown', (e) => { sid = e.pointerId; const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; stick.setPointerCapture(e.pointerId); move(e); e.preventDefault(); });
    const move = (e) => {
      if (e.pointerId !== sid) return;
      let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.touchMove = { x: dx / R, y: dy / R };
    };
    stick.addEventListener('pointermove', move);
    const end = (e) => { if (e.pointerId !== sid) return; sid = null; knob.style.transform = ''; this.touchMove = { x: 0, y: 0 }; };
    stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);

    root.querySelectorAll('[data-act]').forEach((b) => {
      const a = b.dataset.act;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.classList.add('on'); this.pressed.add(a); this.touchHold.add(a); b.setPointerCapture(e.pointerId); });
      const up = () => { b.classList.remove('on'); this.touchHold.delete(a); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    });
  }

  // fill a fighter's intent (camera-relative movement)
  apply(intent) {
    if (!this.enabled) { this.pressed.clear(); return; }
    const k = this.keys;
    let fwd = (k.has('up') ? 1 : 0) - (k.has('down') ? 1 : 0) - this.touchMove.y;
    let side = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0) + this.touchMove.x;
    const m = Math.hypot(fwd, side); if (m > 1) { fwd /= m; side /= m; }
    const b = this.stage.basis();
    // screen-right in world space is forward × up = (-fz, fx)
    intent.mx = b.fx * fwd - b.fz * side;
    intent.mz = b.fz * fwd + b.fx * side;
    intent.block = k.has('block') || this.touchHold.has('block');
    for (const a of ['light', 'heavy', 'special', 'dodge', 'jump']) if (this.pressed.has(a)) intent[a] = true;
    this.pressed.clear();
  }
}
