/**
 * entities.js – Tank, Bullet, PowerUp, Explosion, ScorePopup classes.
 */

// ─────────────────────────────────────────────────────────────────────────────
class Tank {
  constructor(x, y, dir, type, isPlayer) {
    this.x = x; this.y = y;
    this.dir = dir;
    this.type = type;
    this.isPlayer = isPlayer;

    this.speed     = isPlayer ? CFG.PLAYER_SPEED : CFG.ENEMY_SPEED[type];
    this.maxBullets= isPlayer ? CFG.PLAYER_MAX_BULLETS : 1;
    this.shootCD   = isPlayer ? CFG.PLAYER_SHOOT_CD    : CFG.ENEMY_SHOOT_INT[type];
    this.bSpeed    = isPlayer ? CFG.PLAYER_BULLET_SPEED : CFG.ENEMY_BSPEED[type];
    this.bPower    = isPlayer ? 1 : CFG.ENEMY_BPOWER[type];

    this.maxHP  = isPlayer ? 1 : CFG.ENEMY_HP[type];
    this.hp     = this.maxHP;
    this.hasPup = !isPlayer && CFG.ENEMY_HAS_PUP[type];

    this.bullets = [];
    this.lastShot = 0;

    // Timers
    this.shieldTimer = 0;
    this.starTimer   = 0;
    this.hitFlash    = 0;

    // Spawn animation
    this.spawning   = true;
    this.spawnTimer = 1400;

    this.alive    = true;

    // Frame counter
    this.frame      = 0;
    this.frameTick  = 0;

    // AI state
    this.aiDir      = dir;
    this.aiMoveCD   = 800 + Math.random() * 2000;
    this.aiMoveT    = 0;
    this.aiShootT   = Math.random() * this.shootCD;
  }

  // ── getters ──────────────────────────────────────────────────────────────────
  cx() { return this.x + CFG.TS / 2; }
  cy() { return this.y + CFG.TS / 2; }
  rect() { return { x: this.x+2, y: this.y+2, w: CFG.TS-4, h: CFG.TS-4 }; }

  // ── update ───────────────────────────────────────────────────────────────────
  update(dt, map, input) {
    if (!this.alive) return;

    // Spawn countdown
    if (this.spawning) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawning = false;
        if (this.isPlayer) this.shieldTimer = CFG.SPAWN_SHIELD;
      }
      return;
    }

    // Timers
    if (this.shieldTimer > 0) this.shieldTimer -= dt;
    if (this.hitFlash  > 0) this.hitFlash  -= dt;
    if (this.starTimer > 0) {
      this.starTimer -= dt;
      if (this.starTimer <= 0) this._resetStar();
    }

    // Frame animation
    this.frameTick += dt;
    if (this.frameTick > 120) { this.frame++; this.frameTick = 0; }

    if (this.isPlayer) this._updatePlayer(dt, map, input);
    else               this._updateAI(dt, map);
  }

  _updatePlayer(dt, map, input) {
    let moved = false;
    const spd = this.speed * dt / 16;
    let moveDir = -1;

    if      (input.isUp())    moveDir = DIR.UP;
    else if (input.isDown())  moveDir = DIR.DOWN;
    else if (input.isLeft())  moveDir = DIR.LEFT;
    else if (input.isRight()) moveDir = DIR.RIGHT;

    if (moveDir !== -1) {
      this.dir = moveDir;
      const dx = [0,1,0,-1][moveDir];
      const dy = [-1,0,1,0][moveDir];
      let nx = this.x + dx * spd;
      let ny = this.y + dy * spd;

      // Snap to 2-px grid on the perpendicular axis for smooth alignment
      if (moveDir === DIR.UP || moveDir === DIR.DOWN) nx = Math.round(nx / 2) * 2;
      else                                             ny = Math.round(ny / 2) * 2;

      if (!map.blocked(nx, ny)) {
        this.x = nx; this.y = ny;
        moved = true;
      }
    }

    sound.setEngineMoving(moved);

    // Shooting
    const now = Date.now();
    const clicked = input.consumeClick();

    if (clicked) {
      const md = input.mouseDir(this.cx(), this.cy());
      if (md !== null) this.dir = md;
    }

    if ((input.isShoot() || clicked) &&
        this.bullets.length < this.maxBullets &&
        now - this.lastShot > this.shootCD) {
      this._shoot();
      this.lastShot = now;
    }
  }

  _updateAI(dt, map) {
    this.aiMoveT  += dt;
    this.aiShootT += dt;

    // Shoot
    if (this.aiShootT >= this.shootCD && this.bullets.length < this.maxBullets) {
      this._shoot();
      this.aiShootT = 0;
    }

    // Periodic direction change or eagle-targeting
    if (this.aiMoveT >= this.aiMoveCD) {
      this.aiMoveT = 0;
      this.aiMoveCD = 700 + Math.random() * 2200;
      if (Math.random() < 0.3) {
        // Aim toward eagle
        const edx = 6 * CFG.TS - this.x;
        const edy = 12 * CFG.TS - this.y;
        this.dir = Math.abs(edy) > Math.abs(edx)
          ? (edy > 0 ? DIR.DOWN : DIR.UP)
          : (edx > 0 ? DIR.RIGHT : DIR.LEFT);
      } else {
        this._pickDir();
      }
    }

    const spd = this.speed * dt / 16;
    const dx = [0,1,0,-1][this.dir];
    const dy = [-1,0,1,0][this.dir];
    const nx = this.x + dx * spd;
    const ny = this.y + dy * spd;

    if (!map.blocked(nx, ny)) {
      this.x = nx; this.y = ny;
    } else {
      // Try a new direction immediately
      this._pickDir();
      const dx2 = [0,1,0,-1][this.dir];
      const dy2 = [-1,0,1,0][this.dir];
      const nx2 = this.x + dx2 * spd;
      const ny2 = this.y + dy2 * spd;
      if (!map.blocked(nx2, ny2)) {
        this.x = nx2; this.y = ny2;
      }
    }
  }

  _pickDir() {
    const opposite = (this.dir + 2) % 4;
    const choices  = [0,1,2,3].filter(d => d !== opposite || Math.random() < 0.15);
    this.dir = choices[Math.floor(Math.random() * choices.length)];
    // Snap to 2-px grid on perpendicular axis
    if (this.dir === DIR.UP || this.dir === DIR.DOWN)
      this.x = Math.round(this.x / 2) * 2;
    else
      this.y = Math.round(this.y / 2) * 2;
  }

  _shoot() {
    const ts = CFG.TS;
    const cx = this.x + ts/2 - 4;
    const cy = this.y + ts/2 - 4;
    const offsets = [
      { x: cx,            y: this.y - 8 },     // UP
      { x: this.x + ts,   y: cy           },    // RIGHT
      { x: cx,            y: this.y + ts  },    // DOWN
      { x: this.x - 8,    y: cy           }     // LEFT
    ];
    const o = offsets[this.dir];
    this.bullets.push(new Bullet(o.x, o.y, this.dir, this.bSpeed, this.bPower, this.isPlayer));
    sound.shoot();
  }

  // ── hit & powerup ─────────────────────────────────────────────────────────────
  hit(power) {
    if (this.shieldTimer > 0 || this.spawning) return false;
    this.hp -= power;
    this.hitFlash = 180;
    if (this.hp <= 0) { this.alive = false; }
    return true;
  }

  applyPowerup(type) {
    if (type === PUP.STAR) {
      this.starTimer   = CFG.STAR_DURATION;
      this.maxBullets  = CFG.STAR_MAX_B;
      this.shootCD     = CFG.STAR_CD;
      this.bPower      = 2;
    } else if (type === PUP.SHIELD) {
      this.shieldTimer = CFG.SHIELD_DURATION;
    }
  }

  _resetStar() {
    this.maxBullets = CFG.PLAYER_MAX_BULLETS;
    this.shootCD    = CFG.PLAYER_SHOOT_CD;
    this.bPower     = 1;
  }

  // ── render ───────────────────────────────────────────────────────────────────
  render(ctx) {
    if (!this.alive) return;
    if (this.spawning) {
      Sprites.drawSpawnEffect(ctx, this.cx(), this.cy(), 1 - this.spawnTimer / 1400);
      return;
    }
    Sprites.drawTank(ctx, this.x, this.y, this.dir, this.type, this.isPlayer,
                     this.frame, this.shieldTimer > 0, this.hitFlash > 0,
                     this.hp, this.maxHP);
    for (const b of this.bullets) b.render(ctx);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, dir, speed, power, fromPlayer) {
    this.x = x; this.y = y;
    this.dir       = dir;
    this.speed     = speed;
    this.power     = power;
    this.fromPlayer = fromPlayer;
    this.alive     = true;
  }

  rect() { return { x: this.x+1, y: this.y+1, w: 6, h: 6 }; }

  update(dt) {
    if (!this.alive) return;
    const spd = this.speed * dt / 16;
    this.x += [0,1,0,-1][this.dir] * spd;
    this.y += [-1,0,1,0][this.dir] * spd;
    if (this.x < -8 || this.x > CFG.GW + 8 || this.y < -8 || this.y > CFG.GH + 8)
      this.alive = false;
  }

  render(ctx) {
    if (!this.alive) return;
    Sprites.drawBullet(ctx, this.x, this.y, this.dir);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
class PowerUp {
  constructor(x, y, type) {
    this.x = x; this.y = y;
    this.type  = type;
    this.alive = true;
    this.frame = 0;
    this.life  = 10000;
  }
  rect() { return { x: this.x, y: this.y, w: CFG.TS, h: CFG.TS }; }
  update(dt) {
    this.frame++;
    this.life -= dt;
    if (this.life <= 0) this.alive = false;
  }
  render(ctx) {
    if (!this.alive) return;
    Sprites.drawPowerup(ctx, this.x, this.y, this.type, this.frame);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
class Explosion {
  constructor(cx, cy, big) {
    this.cx  = cx; this.cy = cy;
    this.big = big;
    this.t   = 0;
    this.dur = CFG.EXPL_DURATION;
    this.alive = true;
  }
  update(dt) {
    this.t += dt;
    if (this.t >= this.dur) this.alive = false;
  }
  render(ctx) {
    if (!this.alive) return;
    const p = this.t / this.dur;
    this.big ? Sprites.drawBigExplosion(ctx, this.cx, this.cy, p)
             : Sprites.drawExplosion(ctx, this.cx, this.cy, p);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
class ScorePopup {
  constructor(x, y, text) {
    this.x = x; this.y = y;
    this.text  = text;
    this.life  = 900;
    this.alive = true;
  }
  update(dt) {
    this.life -= dt;
    this.y    -= 0.4;
    if (this.life <= 0) this.alive = false;
  }
  render(ctx) {
    if (!this.alive) return;
    Sprites.drawScorePopup(ctx, this.x, this.y, this.text, this.life / 900);
  }
}
