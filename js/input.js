/**
 * input.js – Keyboard + mouse + touch input handler.
 */
class InputHandler {
  constructor(canvas) {
    this.keys  = {};
    this.mouseX = 0;
    this.mouseY = 0;
    this._clicked = false;   // consumed per-frame

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

    // ── touch ──────────────────────────────────────────────────────────────────
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
