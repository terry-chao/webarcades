/**
 * input.js – Keyboard + mouse + touch input handler.
 */
class InputHandler {
  constructor(canvas) {
    this.keys  = {};
    this.mouseX = 0;
    this.mouseY = 0;
    this._clicked = false;   // consumed per-frame
    this._isMobile = false;

    // ── keyboard ───────────────────────────────────────────────────────────────
    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))
        e.preventDefault();
    });
    window.addEventListener('keyup', e => {
      this.keys[e.code] = false;
    });

    // ── mouse ──────────────────────────────────────────────────────────────────
    canvas.addEventListener('mousemove', e => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = (e.clientX - r.left) * (canvas.width  / r.width);
      this.mouseY = (e.clientY - r.top)  * (canvas.height / r.height);
    });

    canvas.addEventListener('mousedown', e => {
      if (e.button === 0) {
        const r = canvas.getBoundingClientRect();
        this.mouseX = (e.clientX - r.left) * (canvas.width  / r.width);
        this.mouseY = (e.clientY - r.top)  * (canvas.height / r.height);
        this._clicked = true;
      }
    });

    // ── touch (canvas – for menu taps) ──────────────────────────────────────────
    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.touches[0];
      const r = canvas.getBoundingClientRect();
      this.mouseX = (t.clientX - r.left) * (canvas.width  / r.width);
      this.mouseY = (t.clientY - r.top)  * (canvas.height / r.height);
      this._clicked = true;
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const t = e.touches[0];
      const r = canvas.getBoundingClientRect();
      this.mouseX = (t.clientX - r.left) * (canvas.width  / r.width);
      this.mouseY = (t.clientY - r.top)  * (canvas.height / r.height);
    }, { passive: false });

    canvas.addEventListener('touchend',   e => e.preventDefault(), { passive: false });

    // ── mobile touch controls ──────────────────────────────────────────────────
    this._initTouchControls();
  }

  _initTouchControls() {
    const tc = document.getElementById('touchControls');
    if (!tc) return;

    // Detect mobile / touch device
    this._isMobile = ('ontouchstart' in window) ||
                     (navigator.maxTouchPoints > 0) ||
                     window.matchMedia('(pointer: coarse)').matches;

    // Bind D-pad buttons
    const dpadBtns = tc.querySelectorAll('.dpad-btn');
    dpadBtns.forEach(btn => {
      const key = btn.dataset.key;
      const press = (e) => { e.preventDefault(); this.keys[key] = true; btn.classList.add('pressed'); };
      const release = (e) => { e.preventDefault(); this.keys[key] = false; btn.classList.remove('pressed'); };

      btn.addEventListener('touchstart', press,   { passive: false });
      btn.addEventListener('touchend',   release,  { passive: false });
      btn.addEventListener('touchcancel', release,  { passive: false });

      // Also support mouse for testing on desktop
      btn.addEventListener('mousedown', press);
      btn.addEventListener('mouseup', release);
      btn.addEventListener('mouseleave', release);
    });

    // Fire button – maps to Space
    const fireBtn = document.getElementById('btnFire');
    if (fireBtn) {
      const firePress = (e) => { e.preventDefault(); this.keys['Space'] = true; fireBtn.classList.add('pressed'); };
      const fireRelease = (e) => { e.preventDefault(); this.keys['Space'] = false; fireBtn.classList.remove('pressed'); };

      fireBtn.addEventListener('touchstart', firePress,   { passive: false });
      fireBtn.addEventListener('touchend',   fireRelease,  { passive: false });
      fireBtn.addEventListener('touchcancel', fireRelease,  { passive: false });
      fireBtn.addEventListener('mousedown', firePress);
      fireBtn.addEventListener('mouseup', fireRelease);
      fireBtn.addEventListener('mouseleave', fireRelease);
    }

    // Pause button – maps to KeyP
    const pauseBtn = document.getElementById('btnPause');
    if (pauseBtn) {
      const pausePress = (e) => { e.preventDefault(); this.keys['KeyP'] = true; };
      const pauseRelease = (e) => { e.preventDefault(); this.keys['KeyP'] = false; };

      pauseBtn.addEventListener('touchstart', pausePress,   { passive: false });
      pauseBtn.addEventListener('touchend',   pauseRelease,  { passive: false });
      pauseBtn.addEventListener('touchcancel', pauseRelease,  { passive: false });
      pauseBtn.addEventListener('mousedown', pausePress);
      pauseBtn.addEventListener('mouseup', pauseRelease);
    }
  }

  // ── movement ──────────────────────────────────────────────────────────────────
  isUp()    { return !!(this.keys['ArrowUp']    || this.keys['KeyW']); }
  isDown()  { return !!(this.keys['ArrowDown']  || this.keys['KeyS']); }
  isLeft()  { return !!(this.keys['ArrowLeft']  || this.keys['KeyA']); }
  isRight() { return !!(this.keys['ArrowRight'] || this.keys['KeyD']); }
  isShoot() { return !!(this.keys['Space'] || this.keys['Enter'] || this.keys['KeyZ'] || this.keys['KeyX']); }
  isPause() { return !!(this.keys['KeyP'] || this.keys['Escape']); }

  /** Returns true once per click (must be consumed). */
  consumeClick() {
    const c = this._clicked;
    this._clicked = false;
    return c;
  }

  /**
   * Determine which DIR the mouse cursor is relative to a point (cx, cy).
   * Returns a DIR constant, or null if cursor is too close.
   */
  mouseDir(cx, cy) {
    const dx = this.mouseX - cx;
    const dy = this.mouseY - cy;
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return null;
    return Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? DIR.RIGHT : DIR.LEFT)
      : (dy > 0 ? DIR.DOWN  : DIR.UP);
  }
}
