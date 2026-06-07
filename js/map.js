/**
 * map.js – Level map: load, render, collision, bullet-tile interaction, shovel.
 */
class GameMap {
  constructor() {
    this.grid          = [];   // [row][col] = TILE constant
    this.shovelActive  = false;
    this.shovelTimer   = 0;
    this.shovelSaved   = [];   // {c,r,tile} backups for shovel revert
  }

  // ── load level ───────────────────────────────────────────────────────────────
  load(levelIndex) {
    const rows = CFG.LEVELS[levelIndex];
    this.grid  = [];
    for (let r = 0; r < CFG.ROWS; r++) {
      this.grid[r] = [];
      for (let c = 0; c < CFG.COLS; c++) {
        const ch = (rows[r] || '')[c] || '.';
        this.grid[r][c] = { '.':TILE.EMPTY, 'B':TILE.BRICK, 'S':TILE.STEEL,
                             'W':TILE.WATER, 'G':TILE.GRASS, 'I':TILE.ICE,
                             'E':TILE.EAGLE }[ch] ?? TILE.EMPTY;
      }
    }
    this.shovelActive = false;
    this.shovelTimer  = 0;
    this.shovelSaved  = [];

    // Guarantee spawn points clear
    [[0,0],[6,0],[12,0]].forEach(([c,r]) => this.set(c,r,TILE.EMPTY));
    // Guarantee player area clear
    this.set(2,12,TILE.EMPTY);
    this.set(2,11,TILE.EMPTY);
  }

  // ── tile accessors ───────────────────────────────────────────────────────────
  get(c, r) {
    if (r < 0 || r >= CFG.ROWS || c < 0 || c >= CFG.COLS) return TILE.STEEL;
    return this.grid[r][c];
  }
  set(c, r, t) {
    if (r < 0 || r >= CFG.ROWS || c < 0 || c >= CFG.COLS) return;
    this.grid[r][c] = t;
  }

  isSolid(t) {
    return t === TILE.BRICK || t === TILE.STEEL || t === TILE.WATER ||
           t === TILE.EAGLE || t === TILE.EAGLE_DEAD;
  }

  // ── collision for tanks ───────────────────────────────────────────────────────
  blocked(x, y) {
    const ts = CFG.TS;
    if (x < 0 || y < 0 || x + ts > CFG.GW || y + ts > CFG.GH) return true;
    const m = 1;
    const pts = [
      { x: x + m,      y: y + m       },
      { x: x + ts-1-m, y: y + m       },
      { x: x + m,      y: y + ts-1-m  },
      { x: x + ts-1-m, y: y + ts-1-m  }
    ];
    for (const p of pts) {
      if (this.isSolid(this.get(Math.floor(p.x / ts), Math.floor(p.y / ts))))
        return true;
    }
    return false;
  }

  // ── bullet → tile interaction ────────────────────────────────────────────────
  /**
   * Check if a bullet has hit a solid tile.
   * Returns null or 'eagle_dead'.
   * May set bullet.alive = false.
   */
  bulletHit(bullet, explosions) {
    if (!bullet.alive) return null;
    const ts  = CFG.TS;
    const bx  = bullet.x + 4;
    const by  = bullet.y + 4;
    const col = Math.floor(bx / ts);
    const row = Math.floor(by / ts);
    const t   = this.get(col, row);

    if (t === TILE.BRICK) {
      this.set(col, row, TILE.EMPTY);
      if (bullet.power >= 2) {
        // Destroy adjacent bricks too
        [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dc,dr]) => {
          if (this.get(col+dc, row+dr) === TILE.BRICK)
            this.set(col+dc, row+dr, TILE.EMPTY);
        });
      }
      bullet.alive = false;
      explosions.push(new Explosion(col*ts+ts/2, row*ts+ts/2, false));
      return null;
    }

    if (t === TILE.STEEL) {
      if (bullet.power >= 2) {
        this.set(col, row, TILE.EMPTY);
        explosions.push(new Explosion(col*ts+ts/2, row*ts+ts/2, false));
      } else {
        sound.hitWall();
      }
      bullet.alive = false;
      return null;
    }

    if (t === TILE.EAGLE || t === TILE.EAGLE_DEAD) {
      this.set(col, row, TILE.EAGLE_DEAD);
      bullet.alive = false;
      explosions.push(new Explosion(col*ts+ts/2, row*ts+ts/2, true));
      return 'eagle_dead';
    }

    return null;
  }

  // ── shovel power-up ──────────────────────────────────────────────────────────
  activateShovel() {
    if (this.shovelActive) {
      // Refresh timer only
      this.shovelTimer = CFG.SHOVEL_DURATION;
      return;
    }
    this.shovelSaved = [];
    const eaglePos = this._eaglePos();
    if (!eaglePos) return;
    const { c, r } = eaglePos;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const cc = c + dc, rr = r + dr;
        const tile = this.get(cc, rr);
        if (tile !== TILE.EAGLE && tile !== TILE.EAGLE_DEAD) {
          this.shovelSaved.push({ c: cc, r: rr, tile });
          this.set(cc, rr, TILE.STEEL);
        }
      }
    }
    this.shovelActive = true;
    this.shovelTimer  = CFG.SHOVEL_DURATION;
  }

  deactivateShovel() {
    this.shovelActive = false;
    for (const { c, r, tile } of this.shovelSaved) {
      const cur = this.get(c, r);
      if (cur !== TILE.EAGLE && cur !== TILE.EAGLE_DEAD)
        this.set(c, r, tile);
    }
    this.shovelSaved = [];
  }

  _eaglePos() {
    for (let r = 0; r < CFG.ROWS; r++)
      for (let c = 0; c < CFG.COLS; c++)
        if (this.grid[r][c] === TILE.EAGLE) return { c, r };
    return null;
  }

  // ── update (shovel blink + timer) ────────────────────────────────────────────
  update(dt) {
    if (!this.shovelActive) return;
    this.shovelTimer -= dt;
    if (this.shovelTimer <= 0) {
      this.deactivateShovel();
      return;
    }
    // Blink: toggle steel ↔ brick near eagle in final 3 s
    if (this.shovelTimer < 3000) {
      const blink = Math.floor(this.shovelTimer / 280) % 2 === 0;
      const eagle = this._eaglePos();
      if (eagle) {
        const { c, r } = eagle;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const cc = c+dc, rr = r+dr;
            const t  = this.get(cc, rr);
            if (t === TILE.STEEL || t === TILE.BRICK)
              this.set(cc, rr, blink ? TILE.STEEL : TILE.BRICK);
          }
        }
      }
    }
  }

  // ── render ───────────────────────────────────────────────────────────────────
  render(ctx) {
    for (let r = 0; r < CFG.ROWS; r++) {
      for (let c = 0; c < CFG.COLS; c++) {
        const t = this.grid[r][c];
        if (t !== TILE.EMPTY && t !== TILE.GRASS)
          Sprites.drawTile(ctx, c * CFG.TS, r * CFG.TS, t);
      }
    }
  }

  renderGrass(ctx) {
    // Grass drawn last so it overlaps tanks
    for (let r = 0; r < CFG.ROWS; r++) {
      for (let c = 0; c < CFG.COLS; c++) {
        if (this.grid[r][c] === TILE.GRASS)
          Sprites.drawTile(ctx, c * CFG.TS, r * CFG.TS, TILE.GRASS);
      }
    }
  }
}
