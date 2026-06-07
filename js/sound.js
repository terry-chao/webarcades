/**
 * sound.js – Web Audio API sound effects (no external files needed).
 * All sounds are synthesised with oscillators and noise.
 */
class SoundManager {
  constructor() {
    this.ctx    = null;
    this.enabled = true;
    this._engineOsc  = null;
    this._engineGain = null;
  }

  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      this.enabled = false;
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  // ── helpers ──────────────────────────────────────────────────────────────────
  _noise(duration) {
    const sr  = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, Math.ceil(sr * duration), sr);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  _osc(type, freq) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    return o;
  }

  _gain(val) {
    const g = this.ctx.createGain();
    g.gain.value = val;
    return g;
  }

  _play(node, gainNode, vol, duration) {
    const t = this.ctx.currentTime;
    gainNode.gain.setValueAtTime(vol, t);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    node.connect(gainNode);
    gainNode.connect(this.ctx.destination);
    node.start(t);
    node.stop(t + duration + 0.01);
  }

  // ── public sounds ─────────────────────────────────────────────────────────────
  shoot() {
    if (!this.enabled || !this.ctx) return;
    const o = this._osc('square', 880);
    const g = this._gain(0.14);
    o.frequency.setValueAtTime(880, this.ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(180, this.ctx.currentTime + 0.09);
    this._play(o, g, 0.14, 0.09);
  }

  explode(big = false) {
    if (!this.enabled || !this.ctx) return;
    const dur = big ? 0.65 : 0.38;
    const n   = this._noise(dur);
    const g   = this._gain(big ? 0.7 : 0.42);
    const f   = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = big ? 380 : 560;
    n.connect(f);
    f.connect(g);
    g.connect(this.ctx.destination);
    g.gain.setValueAtTime(big ? 0.7 : 0.42, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
    n.start(this.ctx.currentTime);
    n.stop(this.ctx.currentTime + dur);
  }

  hitWall() {
    if (!this.enabled || !this.ctx) return;
    const n = this._noise(0.04);
    const g = this._gain(0.08);
    this._play(n, g, 0.08, 0.04);
  }

  powerup() {
    if (!this.enabled || !this.ctx) return;
    const o = this._osc('square', 440);
    const g = this._gain(0.18);
    o.frequency.setValueAtTime(440, this.ctx.currentTime);
    o.frequency.linearRampToValueAtTime(1320, this.ctx.currentTime + 0.28);
    this._play(o, g, 0.18, 0.28);
  }

  lifeUp() {
    if (!this.enabled || !this.ctx) return;
    [523, 659, 784].forEach((f, i) => {
      const o = this._osc('sine', f);
      const g = this._gain(0.13);
      const t = this.ctx.currentTime + i * 0.1;
      g.gain.setValueAtTime(0.13, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + 0.1);
    });
  }

  stageStart() {
    if (!this.enabled || !this.ctx) return;
    [523, 659, 784, 1047].forEach((f, i) => {
      const o = this._osc('square', f);
      const g = this._gain(0.16);
      const t = this.ctx.currentTime + i * 0.14;
      g.gain.setValueAtTime(0.16, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + 0.14);
    });
  }

  stageClear() {
    if (!this.enabled || !this.ctx) return;
    [784, 1047, 784, 1047, 1319].forEach((f, i) => {
      const o = this._osc('square', f);
      const g = this._gain(0.18);
      const t = this.ctx.currentTime + i * 0.12;
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + 0.13);
    });
  }

  gameOver() {
    if (!this.enabled || !this.ctx) return;
    [523, 415, 330, 262].forEach((f, i) => {
      const o = this._osc('sawtooth', f);
      const g = this._gain(0.18);
      const t = this.ctx.currentTime + i * 0.26;
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + 0.27);
    });
  }

  // ── engine hum (looped) ───────────────────────────────────────────────────────
  startEngine() {
    if (!this.enabled || !this.ctx || this._engineOsc) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this._engineOsc  = this.ctx.createOscillator();
    this._engineGain = this.ctx.createGain();
    this._engineOsc.type = 'sawtooth';
    this._engineOsc.frequency.value = 58;
    this._engineGain.gain.value = 0.025;
    this._engineOsc.connect(this._engineGain);
    this._engineGain.connect(this.ctx.destination);
    this._engineOsc.start();
  }

  stopEngine() {
    if (!this._engineOsc) return;
    const t = this.ctx.currentTime;
    this._engineGain.gain.setValueAtTime(this._engineGain.gain.value, t);
    this._engineGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    this._engineOsc.stop(t + 0.13);
    this._engineOsc  = null;
    this._engineGain = null;
  }

  setEngineMoving(moving) {
    if (!this._engineOsc || !this._engineGain) return;
    const t   = this.ctx.currentTime;
    const vol = moving ? 0.05 : 0.018;
    const frq = moving ? 88  : 58;
    this._engineGain.gain.setTargetAtTime(vol, t, 0.06);
    this._engineOsc.frequency.setTargetAtTime(frq, t, 0.1);
  }
}

const sound = new SoundManager();
