// Tiny synthesized sound effects (no audio files needed).
let ctx = null, master = null;
export const sound = { on: true };

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
    ctx = new C(); master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function noise(dur, freq, q, gain) {
  const c = ac(); if (!c || !sound.on) return;
  const len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain(); g.gain.value = gain;
  src.connect(f); f.connect(g); g.connect(master); src.start();
}
function tone(type, f0, f1, dur, gain) {
  const c = ac(); if (!c || !sound.on) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, c.currentTime); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), c.currentTime + dur);
  g.gain.setValueAtTime(gain, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  o.connect(g); g.connect(master); o.start(); o.stop(c.currentTime + dur);
}
export const sfx = {
  unlock() { ac(); },
  ui() { tone('square', 660, 880, 0.06, 0.08); },
  light() { noise(0.08, 1800, 1.2, 0.6); },
  heavy() { noise(0.18, 500, 0.8, 0.9); tone('sine', 140, 50, 0.2, 0.5); },
  block() { tone('square', 1200, 900, 0.05, 0.12); },
  whoosh() { noise(0.12, 2600, 2, 0.15); },
  special() { tone('sawtooth', 220, 880, 0.35, 0.12); },
  boom() { noise(0.5, 200, 0.6, 1); tone('sine', 90, 30, 0.6, 0.6); },
  ko() { tone('sine', 300, 40, 0.9, 0.5); noise(0.6, 300, 0.5, 0.8); },
  fight() { tone('square', 440, 440, 0.12, 0.12); setTimeout(() => tone('square', 880, 880, 0.2, 0.12), 120); },
};
