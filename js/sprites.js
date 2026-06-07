/**
 * sprites.js – Canvas pixel-art drawing functions.
 * All visuals are drawn procedurally; no image files required.
 */
const Sprites = {

  // ── colour utilities ─────────────────────────────────────────────────────────
  shade(hex, f) {
    // hex must be '#rrggbb'
    let r = parseInt(hex.slice(1,3),16);
    let g = parseInt(hex.slice(3,5),16);
    let b = parseInt(hex.slice(5,7),16);
    r = Math.max(0, Math.min(255, Math.round(r * f)));
    g = Math.max(0, Math.min(255, Math.round(g * f)));
    b = Math.max(0, Math.min(255, Math.round(b * f)));
    return `rgb(${r},${g},${b})`;
  },

  // ── tank ─────────────────────────────────────────────────────────────────────
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x,y   top-left of 32×32 cell
   * @param {number} dir   DIR.UP / RIGHT / DOWN / LEFT
   * @param {number} type  ETYPE constant (0-3), ignored for player
   * @param {boolean} isPlayer
   * @param {number} frame animation frame counter
   * @param {boolean} shielded  draw shield ring
   * @param {boolean} flash     draw body white (hit flash)
   * @param {number} health / maxHealth  for armour tank colour
   */
  drawTank(ctx, x, y, dir, type, isPlayer, frame, shielded, flash, health = 1, maxHealth = 1) {
    ctx.save();
    ctx.translate(x + 16, y + 16);

    // Rotation: UP = 0°, RIGHT = 90°, DOWN = 180°, LEFT = -90°
    ctx.rotate([0, Math.PI/2, Math.PI, -Math.PI/2][dir]);

    // Base colour
    const baseColors = ['#888888','#00bcd4','#e64a19','#4caf50'];
    let base = isPlayer ? '#e0d800' : baseColors[type];

    // Armour tank: colour encodes remaining health
    if (!isPlayer && type === 3 && maxHealth > 1) {
      const r = health / maxHealth;
      if      (r > 0.75) base = '#4caf50';
      else if (r > 0.50) base = '#cddc39';
      else if (r > 0.25) base = '#ff9800';
      else               base = '#f44336';
    }

    const body  = flash ? '#ffffff' : base;
    const dark  = this.shade(base, 0.48);
    const light = this.shade(base, 1.55);

    // Track offset for animation (treads moving)
    const tOff = (frame % 4) * 4;

    // ── Left track ──────────────────────────────────────────────────────────────
    ctx.fillStyle = dark;
    ctx.fillRect(-16, -16, 7, 32);
    ctx.fillStyle = this.shade(base, 0.72);
    for (let i = 0; i < 5; i++) {
      const ty = -14 + ((i * 8 + tOff) % 32);
      ctx.fillRect(-15, ty, 5, 5);
    }

    // ── Right track ─────────────────────────────────────────────────────────────
    ctx.fillStyle = dark;
    ctx.fillRect(9, -16, 7, 32);
    ctx.fillStyle = this.shade(base, 0.72);
    for (let i = 0; i < 5; i++) {
      const ty = -14 + ((i * 8 + tOff) % 32);
      ctx.fillRect(10, ty, 5, 5);
    }

    // ── Body ────────────────────────────────────────────────────────────────────
    ctx.fillStyle = body;
    ctx.fillRect(-8, -12, 16, 24);

    // Body shading stripe
    ctx.fillStyle = light;
    ctx.fillRect(-7, -11, 14, 5);
    ctx.fillStyle = dark;
    ctx.fillRect(-7, 8, 14, 4);

    // ── Turret ──────────────────────────────────────────────────────────────────
    ctx.fillStyle = this.shade(base, 1.15);
    ctx.beginPath();
    ctx.ellipse(0, 1, 7, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Turret hatch
    ctx.fillStyle = dark;
    ctx.fillRect(-2, -1, 4, 4);

    // ── Barrel ──────────────────────────────────────────────────────────────────
    ctx.fillStyle = dark;
    ctx.fillRect(-2, -17, 4, 18);
    ctx.fillStyle = light;
    ctx.fillRect(-1, -19, 2, 4);

    ctx.restore();

    // ── Shield rings ────────────────────────────────────────────────────────────
    if (shielded) this._drawShield(ctx, x + 16, y + 16, frame);
  },

  _drawShield(ctx, cx, cy, frame) {
    const colors = ['#4499ff','#88ccff','#00eeff'];
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 2;
    for (let r = 0; r < 2; r++) {
      ctx.strokeStyle = colors[(Math.floor(frame / 4) + r) % colors.length];
      ctx.beginPath();
      ctx.arc(cx, cy, 19 - r * 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  },

  // ── bullet ───────────────────────────────────────────────────────────────────
  drawBullet(ctx, x, y, dir) {
    ctx.save();
    ctx.translate(x + 4, y + 4);
    ctx.rotate([0, Math.PI/2, Math.PI, -Math.PI/2][dir]);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-2, -5, 4, 10);
    ctx.fillStyle = '#ffffaa';
    ctx.fillRect(-1, -7, 2, 3);
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(-1, 4, 2, 2);

    ctx.restore();
  },

  // ── tiles ────────────────────────────────────────────────────────────────────
  drawTile(ctx, x, y, type) {
    const ts = CFG.TS;
    switch (type) {

      case TILE.BRICK: {
        ctx.fillStyle = '#b83000';
        ctx.fillRect(x, y, ts, ts);
        // Mortar grid
        ctx.fillStyle = '#7a2000';
        for (let r = 0; r <= 4; r++) ctx.fillRect(x, y + r * 8, ts, 1);
        ctx.fillRect(x + ts/2, y,     1, 8);
        ctx.fillRect(x,        y + 8, 1, 8);
        ctx.fillRect(x + ts/2, y + 8, 1, 8);
        ctx.fillRect(x + ts/2, y +16, 1, 8);
        ctx.fillRect(x,        y +16, 1, 8);
        ctx.fillRect(x + ts/2, y +24, 1, 8);
        ctx.fillRect(x,        y +24, 1, 8);
        // Brick highlights
        ctx.fillStyle = '#e85020';
        for (let r = 0; r < 4; r++) {
          const off = (r % 2) * (ts / 2);
          ctx.fillRect(x + off + 1,  y + r * 8 + 1, ts/2 - 2, 6);
        }
        break;
      }

      case TILE.STEEL: {
        ctx.fillStyle = '#777777';
        ctx.fillRect(x, y, ts, ts);
        ctx.fillStyle = '#aaaaaa';
        ctx.fillRect(x+2, y+2, ts-4, ts/2-3);
        ctx.fillRect(x+2, y+ts/2+2, ts-4, ts/2-4);
        ctx.fillStyle = '#444444';
        ctx.fillRect(x, y+ts/2, ts, 2);
        ctx.fillRect(x+ts/2, y, 2, ts);
        ctx.fillStyle = '#cccccc';
        ctx.fillRect(x+2, y+2, 3, 3);
        ctx.fillRect(x+2, y+ts/2+2, 3, 3);
        break;
      }

      case TILE.WATER: {
        ctx.fillStyle = '#0033aa';
        ctx.fillRect(x, y, ts, ts);
        const wt = (Date.now() / 480) % (Math.PI * 2);
        ctx.fillStyle = '#0055ee';
        for (let wx = 0; wx < 4; wx++) {
          const woff = Math.round(Math.sin(wt + wx * 1.1) * 2);
          ctx.fillRect(x + wx*8 + 1, y + 6  + woff, 6, 3);
          ctx.fillRect(x + wx*8 + 1, y + 18 + woff, 6, 3);
        }
        ctx.fillStyle = '#1166ff';
        ctx.fillRect(x+2, y+2, ts-4, 2);
        break;
      }

      case TILE.GRASS: {
        ctx.fillStyle = '#1a6600';
        ctx.fillRect(x, y, ts, ts);
        ctx.fillStyle = '#22880a';
        for (let gx = 0; gx < 4; gx++) {
          for (let gy = 0; gy < 4; gy++) {
            ctx.fillRect(x + gx*8+1, y + gy*8,   3, 7);
            ctx.fillRect(x + gx*8+5, y + gy*8+2, 2, 5);
          }
        }
        break;
      }

      case TILE.ICE: {
        ctx.fillStyle = '#aaddff';
        ctx.fillRect(x, y, ts, ts);
        ctx.fillStyle = '#ddf4ff';
        ctx.globalAlpha = 0.65;
        ctx.fillRect(x+3, y+3,  ts-6, 5);
        ctx.fillRect(x+3, y+13, ts-6, 5);
        ctx.fillRect(x+3, y+23, ts-6, 5);
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x+4, y+4, 4, 2);
        break;
      }

      case TILE.EAGLE:
        this.drawEagle(ctx, x, y, true);
        break;

      case TILE.EAGLE_DEAD:
        this.drawEagle(ctx, x, y, false);
        break;
    }
  },

  // ── eagle (phoenix) ──────────────────────────────────────────────────────────
  drawEagle(ctx, x, y, alive) {
    const ts = CFG.TS;
    // Pedestal
    ctx.fillStyle = alive ? '#9e6a00' : '#555';
    ctx.fillRect(x, y, ts, ts);

    if (alive) {
      // Wings
      ctx.fillStyle = '#f5a800';
      ctx.fillRect(x+1,  y+14, 10, 10);
      ctx.fillRect(x+21, y+14, 10, 10);
      // Wing tips
      ctx.fillStyle = '#ffe066';
      ctx.fillRect(x+1,  y+14, 4, 4);
      ctx.fillRect(x+27, y+14, 4, 4);
      // Body
      ctx.fillStyle = '#c87000';
      ctx.fillRect(x+10, y+8, 12, 18);
      // Head
      ctx.fillStyle = '#fff8e0';
      ctx.fillRect(x+12, y+4, 8, 7);
      // Eye
      ctx.fillStyle = '#111';
      ctx.fillRect(x+15, y+6, 2, 2);
      // Beak
      ctx.fillStyle = '#f5a800';
      ctx.fillRect(x+11, y+7, 2, 2);
      // Star on body
      ctx.fillStyle = '#ffff00';
      ctx.fillRect(x+14, y+10, 4, 2);
      ctx.fillRect(x+15, y+9, 2, 4);
    } else {
      // Ruins
      ctx.fillStyle = '#666';
      ctx.fillRect(x+4,  y+18, 24, 10);
      ctx.fillStyle = '#444';
      ctx.fillRect(x+4,  y+12, 7,  8);
      ctx.fillRect(x+22, y+12, 6,  8);
      ctx.fillRect(x+11, y+9,  10, 9);
      ctx.fillStyle = '#888';
      ctx.fillRect(x+4,  y+28, 5, 4);
      ctx.fillRect(x+22, y+28, 6, 4);
    }
  },

  // ── explosions ───────────────────────────────────────────────────────────────
  drawExplosion(ctx, cx, cy, progress) {
    // progress 0→1
    const r = 28 * progress;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - progress * 0.6);

    // Yellow halo
    if (progress < 0.55) {
      ctx.fillStyle = '#ffee00';
      ctx.beginPath(); ctx.arc(cx, cy, r * 1.7, 0, Math.PI*2); ctx.fill();
    }
    // Orange core
    ctx.fillStyle = progress < 0.35 ? '#ffffff' : '#ff6a00';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();

    // Sparks
    ctx.fillStyle = '#ff2200';
    for (let i = 0; i < 8; i++) {
      const a = (i/8)*Math.PI*2 + progress*3;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a)*r*1.25, cy + Math.sin(a)*r*1.25, 2.5, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  },

  drawBigExplosion(ctx, cx, cy, progress) {
    const r = 52 * progress;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - progress * 0.72);

    ctx.fillStyle = '#ffee00';
    ctx.beginPath(); ctx.arc(cx, cy, r*2, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = '#ff8800';
    ctx.beginPath(); ctx.arc(cx, cy, r*1.35, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = progress < 0.4 ? '#ffffff' : '#ff3300';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();

    ctx.strokeStyle = '#ffdd00';
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; i++) {
      const a = (i/12)*Math.PI*2 + progress*2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a)*r*1.2, cy + Math.sin(a)*r*1.2);
      ctx.lineTo(cx + Math.cos(a)*r*1.8, cy + Math.sin(a)*r*1.8);
      ctx.stroke();
    }
    ctx.restore();
  },

  // ── spawn effect ─────────────────────────────────────────────────────────────
  drawSpawnEffect(ctx, cx, cy, progress) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - progress);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    const r = 22 * progress;
    for (let i = 0; i < 8; i++) {
      const a = (i/8)*Math.PI*2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a)*r*0.3, cy + Math.sin(a)*r*0.3);
      ctx.lineTo(cx + Math.cos(a)*r,     cy + Math.sin(a)*r);
      ctx.stroke();
    }
    ctx.restore();
  },

  // ── power-up ─────────────────────────────────────────────────────────────────
  drawPowerup(ctx, x, y, type, frame) {
    if (Math.floor(frame / 14) % 2 === 1) return;  // blink

    const ts    = CFG.TS;
    const color = ['#ffdd00','#5599ff','#ff4444','#cc6600','#ff8800','#44ffff'][type];
    const label = ['STAR',   'SHLD',   'LIFE',   'SHLV',   'BOMB',   'CLK' ][type];

    ctx.save();
    ctx.fillStyle = '#111111';
    ctx.fillRect(x+1, y+1, ts-2, ts-2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x+2, y+2, ts-4, ts-4);

    ctx.fillStyle = color;
    ctx.font = 'bold 8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + ts/2, y + ts/2);
    ctx.restore();
  },

  // ── HUD ──────────────────────────────────────────────────────────────────────
  drawHUD(ctx, game) {
    const gw = CFG.GW, hw = CFG.HW, gh = CFG.GH;
    const cx = gw + hw / 2;
    ctx.textBaseline = 'alphabetic';   // reset after potential drawPowerup leak

    // Background
    ctx.fillStyle = '#111111';
    ctx.fillRect(gw, 0, hw, gh);

    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.strokeRect(gw+1, 1, hw-2, gh-2);

    let y = 18;
    const section = (label) => {
      ctx.fillStyle = '#ff8c00';
      ctx.font = 'bold 7px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label, cx, y);
      y += 13;
    };
    const value = (text, color = '#ffffff') => {
      ctx.fillStyle = color;
      ctx.font = 'bold 10px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(text, cx, y);
      y += 20;
    };
    const sep = () => {
      ctx.fillStyle = '#333';
      ctx.fillRect(gw+8, y, hw-16, 1);
      y += 10;
    };

    // Title
    ctx.fillStyle = '#ffdd00';
    ctx.font = 'bold 10px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TANK', cx, y); y += 16;
    ctx.fillText('WAR',  cx, y); y += 14;
    sep();

    section('SCORE');
    value(String(game.score).padStart(7,'0'), '#ffffff');
    section('HI-SCORE');
    value(String(game.hiScore).padStart(7,'0'), '#ffdd00');
    sep();

    section('LEVEL');
    value(String(game.level + 1), '#aaffaa');
    sep();

    section('LIVES');
    // Mini player tank icons
    for (let i = 0; i < Math.min(game.lives, 6); i++) {
      const lx = gw + 10 + i * 24;
      this._miniTank(ctx, lx, y-2, '#e0d800');
    }
    if (game.lives > 6) {
      ctx.fillStyle = '#fff';
      ctx.font = '7px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('+' + (game.lives - 6), gw + hw - 22, y + 6);
    }
    y += 22; sep();

    section('ENEMIES');
    const total = game.enemyQueue.length + game.enemies.length;
    value(String(total), '#ff6666');

    // Mini enemy icons
    const perRow = 5;
    for (let i = 0; i < Math.min(total, 20); i++) {
      const ex = gw + 10 + (i % perRow) * 26;
      const ey = y + Math.floor(i / perRow) * 16;
      this._miniTank(ctx, ex, ey, '#888888');
    }
    y += Math.ceil(Math.min(total, 20) / perRow) * 16 + 8;
    sep();

    // Controls
    ctx.fillStyle = '#444';
    ctx.font = '6px monospace';
    ctx.textAlign = 'left';
    const hints = [
      'WASD/↑↓←→:Move',
      'SPACE:Shoot',
      'Click:AimShoot',
      'P:Pause'
    ];
    hints.forEach((h, i) => {
      ctx.fillText(h, gw + 8, gh - 46 + i * 12);
    });
  },

  _miniTank(ctx, x, y, color) {
    ctx.fillStyle = this.shade(color, 0.55);
    ctx.fillRect(x,    y,  5, 12);
    ctx.fillRect(x+15, y,  5, 12);
    ctx.fillStyle = color;
    ctx.fillRect(x+5,  y+2, 10, 8);
    ctx.fillRect(x+8,  y,   4, 4);
  },

  // ── score popup ──────────────────────────────────────────────────────────────
  drawScorePopup(ctx, x, y, text, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffff44';
    ctx.font = 'bold 9px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
  }
};
