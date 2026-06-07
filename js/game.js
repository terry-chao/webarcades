/**
 * game.js – Main game loop, state machine, and all gameplay logic.
 */

const STATE = {
  MENU:        'MENU',
  STARTING:    'STARTING',
  PLAYING:     'PLAYING',
  PAUSED:      'PAUSED',
  STAGE_CLEAR: 'STAGE_CLEAR',
  GAME_OVER:   'GAME_OVER',
  VICTORY:     'VICTORY'
};

class Game {
  constructor(canvas) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');
    this.input   = new InputHandler(canvas);
    this.map     = new GameMap();

    // Game state
    this.state    = STATE.MENU;
    this.level    = 0;
    this.score    = 0;
    this.hiScore  = parseInt(localStorage.getItem('tankHiScore') || '0', 10);
    this.lives    = 3;

    // Entities
    this.player     = null;
    this.enemies    = [];
    this.enemyQueue = [];
    this.powerups   = [];
    this.explosions = [];
    this.popups     = [];

    // Timers / flags
    this.stateTimer    = 0;
    this.spawnTimer    = 0;
    this.spawnIdx      = 0;
    this.respawnTimer  = 0;
    this.eagleDead     = false;
    this.frozen        = false;
    this.frozenTimer   = 0;
    this.screenFlash   = 0;   // ms of white flash remaining
    this.pauseHeld     = false;
    this.frame         = 0;   // global frame counter (for menu animations)

    this.SPAWN_PTS = [
      { x: 0,           y: 0 },
      { x: 6 * CFG.TS,  y: 0 },
      { x: 12 * CFG.TS, y: 0 }
    ];

    // Start loop
    this.lastTime = 0;
    requestAnimationFrame(t => this._loop(t));
  }

  // ── main loop ─────────────────────────────────────────────────────────────────
  _loop(ts) {
    const dt = Math.min(ts - this.lastTime, 50);
    this.lastTime = ts;
    this.frame++;
    this._update(dt);
    this._render();
    requestAnimationFrame(t => this._loop(t));
  }

  // ── update dispatcher ────────────────────────────────────────────────────────
  _update(dt) {
    if (this.screenFlash > 0) this.screenFlash -= dt;

    switch (this.state) {
      case STATE.MENU:        this._uMenu();            break;
      case STATE.STARTING:    this._uStarting(dt);      break;
      case STATE.PLAYING:     this._uPlaying(dt);       break;
      case STATE.PAUSED:      this._uPaused();          break;
      case STATE.STAGE_CLEAR: this._uStageClear(dt);    break;
      case STATE.GAME_OVER:
      case STATE.VICTORY:     this._uEnd();             break;
    }
  }

  // ── state: MENU ──────────────────────────────────────────────────────────────
  _uMenu() {
    if (this.input.isShoot() || this.input.consumeClick()) {
      sound.resume();
      this._startGame();
    }
  }

  // ── state: STARTING ──────────────────────────────────────────────────────────
  _uStarting(dt) {
    this.stateTimer -= dt;
    if (this.stateTimer <= 0) {
      this.state = STATE.PLAYING;
      sound.startEngine();
    }
  }

  // ── state: PLAYING ───────────────────────────────────────────────────────────
  _uPlaying(dt) {
    // Pause
    const pauseNow = this.input.isPause();
    if (pauseNow && !this.pauseHeld) {
      this.pauseHeld = true;
      this.state = STATE.PAUSED;
      sound.stopEngine();
      return;
    }
    if (!pauseNow) this.pauseHeld = false;

    // Frozen timer
    if (this.frozen) {
      this.frozenTimer -= dt;
      if (this.frozenTimer <= 0) this.frozen = false;
    }

    // Map update (shovel)
    this.map.update(dt);

    // Player update
    if (this.player) {
      this.player.update(dt, this.map, this.input);
      this.player.bullets.forEach(b => b.update(dt));
    }

    // Respawn timer
    if (!this.player && this.respawnTimer > 0) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this._spawnPlayer(true);
        sound.startEngine();
      }
    }

    // Enemies
    for (const e of this.enemies) {
      if (!this.frozen) e.update(dt, this.map, null);
      e.bullets.forEach(b => b.update(dt));
    }

    // Spawn new enemies
    this._spawnEnemies(dt);

    // Collisions
    const eagleResult = this._processBullets();
    if (eagleResult) { this._triggerGameOver(); return; }

    // Powerups
    this._checkPowerups();

    // Update effects
    this.powerups.forEach(p => p.update(dt));
    this.explosions.forEach(e => e.update(dt));
    this.popups.forEach(p => p.update(dt));

    this.powerups   = this.powerups.filter(p => p.alive);
    this.explosions = this.explosions.filter(e => e.alive);
    this.popups     = this.popups.filter(p => p.alive);
    this.enemies    = this.enemies.filter(e => e.alive);

    if (this.eagleDead) { this._triggerGameOver(); return; }

    // Win check
    if (this.enemies.length === 0 && this.enemyQueue.length === 0) {
      this._stageClear();
    }
  }

  // ── state: PAUSED ────────────────────────────────────────────────────────────
  _uPaused() {
    const pauseNow = this.input.isPause();
    if (pauseNow && !this.pauseHeld) {
      this.pauseHeld = true;
      this.state = STATE.PLAYING;
      sound.resume();
      sound.startEngine();
    }
    if (!pauseNow) this.pauseHeld = false;
  }

  // ── state: STAGE_CLEAR ───────────────────────────────────────────────────────
  _uStageClear(dt) {
    this.stateTimer -= dt;
    if (this.stateTimer <= 0) {
      this.level++;
      if (this.level >= CFG.LEVELS.length) {
        this.state = STATE.VICTORY;
      } else {
        this._startLevel();
      }
    }
  }

  // ── state: GAME_OVER / VICTORY ───────────────────────────────────────────────
  _uEnd() {
    if (this.input.isShoot() || this.input.consumeClick()) {
      sound.resume();
      this.state = STATE.MENU;
    }
  }

  // ── bullet processing ────────────────────────────────────────────────────────
  _processBullets() {
    const pBullets = this.player ? [...this.player.bullets] : [];
    const eBullets = this.enemies.flatMap(e => e.bullets);

    // Player bullets vs map and enemies
    for (const b of pBullets) {
      if (!b.alive) continue;
      const r = this.map.bulletHit(b, this.explosions);
      if (r === 'eagle_dead') { this.eagleDead = true; }
      if (!b.alive) continue;

      for (const enemy of this.enemies) {
        if (!enemy.alive || enemy.spawning) continue;
        if (this._overlap(b.rect(), enemy.rect())) {
          b.alive = false;
          if (enemy.hit(b.power)) {
            if (!enemy.alive) {
              const pts = CFG.ENEMY_PTS[enemy.type];
              this.score += pts;
              if (this.score > this.hiScore) {
                this.hiScore = this.score;
                localStorage.setItem('tankHiScore', this.hiScore);
              }
              this.explosions.push(new Explosion(enemy.cx(), enemy.cy(), true));
              this.popups.push(new ScorePopup(enemy.cx(), enemy.cy() - 8, '+' + pts));
              sound.explode(true);
              if (enemy.hasPup) this._spawnPowerup(enemy.x, enemy.y);
            } else {
              this.explosions.push(new Explosion(enemy.cx(), enemy.cy(), false));
            }
          }
          break;
        }
      }
    }

    // Enemy bullets vs map and player
    for (const b of eBullets) {
      if (!b.alive) continue;
      const r = this.map.bulletHit(b, this.explosions);
      if (r === 'eagle_dead') { this.eagleDead = true; }
      if (!b.alive) continue;

      if (this.player && !this.player.spawning) {
        if (this._overlap(b.rect(), this.player.rect())) {
          b.alive = false;
          if (this.player.hit(b.power)) {
            this.explosions.push(new Explosion(this.player.cx(), this.player.cy(), true));
            sound.explode(true);
            this.screenFlash = 180;
            if (!this.player.alive) {
              this._playerDied();
            }
          }
        }
      }
    }

    // Bullet vs bullet cancellation
    for (const pb of pBullets) {
      if (!pb.alive) continue;
      for (const eb of eBullets) {
        if (!eb.alive) continue;
        if (this._overlap(pb.rect(), eb.rect())) {
          pb.alive = false;
          eb.alive = false;
          this.explosions.push(new Explosion(pb.x + 4, pb.y + 4, false));
        }
      }
    }

    // Clean dead bullets
    if (this.player) this.player.bullets = this.player.bullets.filter(b => b.alive);
    for (const e of this.enemies) e.bullets = e.bullets.filter(b => b.alive);

    return false;
  }

  // ── enemy spawning ────────────────────────────────────────────────────────────
  _spawnEnemies(dt) {
    if (!this.enemyQueue.length || this.enemies.length >= CFG.MAX_ON_SCREEN) return;
    this.spawnTimer += dt;
    if (this.spawnTimer < CFG.SPAWN_INTERVAL) return;
    this.spawnTimer = 0;

    const pt   = this.SPAWN_PTS[this.spawnIdx % 3];
    this.spawnIdx++;
    const type = this.enemyQueue.shift();

    // Clear spawn tile
    const c = Math.floor(pt.x / CFG.TS);
    const r = Math.floor(pt.y / CFG.TS);
    this.map.set(c, r, TILE.EMPTY);

    this.enemies.push(new Tank(pt.x, pt.y, DIR.DOWN, type, false));
  }

  // ── power-up ─────────────────────────────────────────────────────────────────
  _spawnPowerup(x, y) {
    const type = Math.floor(Math.random() * 6);
    // Snap to grid
    const c = Math.max(0, Math.min(CFG.COLS-1, Math.floor(x / CFG.TS)));
    const r = Math.max(0, Math.min(CFG.ROWS-1, Math.floor(y / CFG.TS)));
    if (this.map.get(c, r) === TILE.EMPTY)
      this.powerups.push(new PowerUp(c * CFG.TS, r * CFG.TS, type));
    else
      this.powerups.push(new PowerUp(x, y, type));
  }

  _checkPowerups() {
    if (!this.player || !this.player.alive || this.player.spawning) return;
    for (const p of this.powerups) {
      if (!p.alive) continue;
      if (this._overlap(p.rect(), this.player.rect())) {
        p.alive = false;
        this._applyPowerup(p.type);
        sound.powerup();
        this.score += 500;
        this.popups.push(new ScorePopup(p.x + 16, p.y, '+500'));
      }
    }
  }

  _applyPowerup(type) {
    switch (type) {
      case PUP.STAR:
        this.player.applyPowerup(PUP.STAR);
        break;
      case PUP.SHIELD:
        this.player.applyPowerup(PUP.SHIELD);
        break;
      case PUP.TANK:
        this.lives++;
        sound.lifeUp();
        break;
      case PUP.SHOVEL:
        this.map.activateShovel();
        break;
      case PUP.BOMB:
        for (const e of this.enemies) {
          this.score += CFG.ENEMY_PTS[e.type];
          this.explosions.push(new Explosion(e.cx(), e.cy(), true));
          e.alive = false;
        }
        this.enemies = [];
        sound.explode(true);
        this.screenFlash = 100;
        break;
      case PUP.CLOCK:
        this.frozen      = true;
        this.frozenTimer = CFG.CLOCK_DURATION;
        break;
    }
  }

  // ── player died ───────────────────────────────────────────────────────────────
  _playerDied() {
    sound.stopEngine();
    this.lives--;
    this.player = null;
    if (this.lives <= 0) {
      this.lives = 0;
      this._triggerGameOver();
    } else {
      this.respawnTimer = CFG.RESPAWN_DELAY;
    }
  }

  _triggerGameOver() {
    sound.stopEngine();
    sound.gameOver();
    this.state = STATE.GAME_OVER;
  }

  _stageClear() {
    sound.stopEngine();
    sound.stageClear();
    this.state      = STATE.STAGE_CLEAR;
    this.stateTimer = 3200;
  }

  // ── game / level init ─────────────────────────────────────────────────────────
  _startGame() {
    this.level   = 0;
    this.score   = 0;
    this.lives   = 3;
    this._startLevel();
  }

  _startLevel() {
    this.map.load(this.level);
    this.enemies    = [];
    this.powerups   = [];
    this.explosions = [];
    this.popups     = [];
    this.eagleDead  = false;
    this.frozen     = false;
    this.spawnTimer = 0;
    this.spawnIdx   = 0;
    this.respawnTimer = 0;

    // Build and shuffle enemy queue
    this.enemyQueue = [];
    for (const { t, n } of CFG.WAVES[this.level])
      for (let i = 0; i < n; i++) this.enemyQueue.push(t);
    for (let i = this.enemyQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.enemyQueue[i], this.enemyQueue[j]] = [this.enemyQueue[j], this.enemyQueue[i]];
    }

    this._spawnPlayer(false);
    this.state      = STATE.STARTING;
    this.stateTimer = 2200;
    sound.stageStart();
  }

  _spawnPlayer(isRespawn) {
    const x = 2 * CFG.TS, y = 12 * CFG.TS;
    this.player = new Tank(x, y, DIR.UP, 0, true);
    if (!isRespawn) {
      // Skip spawn animation at level start (GET READY overlay does the delay)
      this.player.spawning   = false;
      this.player.spawnTimer = 0;
      this.player.shieldTimer = CFG.SPAWN_SHIELD;
    }
    this.map.set(2, 12, TILE.EMPTY);
  }

  // ── helpers ───────────────────────────────────────────────────────────────────
  _overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // ── render dispatcher ────────────────────────────────────────────────────────
  _render() {
    const ctx = this.ctx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CFG.GW + CFG.HW, CFG.GH);

    switch (this.state) {
      case STATE.MENU:
        this._rMenu(ctx); break;
      default:
        this._rGame(ctx);
        if (this.state === STATE.GAME_OVER) this._rGameOver(ctx);
        if (this.state === STATE.VICTORY)   this._rVictory(ctx);
        break;
    }

    // Screen flash (white overlay)
    if (this.screenFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.55, this.screenFlash / 200)})`;
      ctx.fillRect(0, 0, CFG.GW, CFG.GH);
    }
  }

  // ── render: game ─────────────────────────────────────────────────────────────
  _rGame(ctx) {
    // Game area background
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, CFG.GW, CFG.GH);

    // Map (no grass yet)
    this.map.render(ctx);

    // Powerups
    for (const p of this.powerups) p.render(ctx);

    // Player
    if (this.player) this.player.render(ctx);

    // Enemies
    for (const e of this.enemies) e.render(ctx);

    // Explosions and popups
    for (const e of this.explosions) e.render(ctx);

    // Grass on top (hides units)
    this.map.renderGrass(ctx);

    // Score popups on top of grass
    for (const p of this.popups) p.render(ctx);

    // HUD
    Sprites.drawHUD(ctx, this);

    // Overlays based on state
    if (this.state === STATE.STARTING) {
      ctx.fillStyle = 'rgba(0,0,0,0.52)';
      ctx.fillRect(0, 0, CFG.GW, CFG.GH);
      this._centreText(ctx, CFG.GW/2, CFG.GH/2 - 20, 'STAGE ' + (this.level+1), 18, '#ffdd00');
      this._centreText(ctx, CFG.GW/2, CFG.GH/2 + 18, 'GET READY!', 10, '#ffffff');
    }
    if (this.state === STATE.PAUSED) {
      ctx.fillStyle = 'rgba(0,0,0,0.48)';
      ctx.fillRect(0, 0, CFG.GW, CFG.GH);
      this._centreText(ctx, CFG.GW/2, CFG.GH/2 - 10, 'PAUSED', 20, '#ffdd00');
      this._centreText(ctx, CFG.GW/2, CFG.GH/2 + 24, 'P to resume', 9, '#aaa');
    }
    if (this.state === STATE.STAGE_CLEAR) {
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.fillRect(0, 0, CFG.GW, CFG.GH);
      this._centreText(ctx, CFG.GW/2, CFG.GH/2, 'STAGE CLEAR!', 16, '#66ff66');
    }
  }

  // ── render: menu ─────────────────────────────────────────────────────────────
  _rMenu(ctx) {
    const W = CFG.GW + CFG.HW, H = CFG.GH;

    // Animated background tanks
    const f = this.frame;
    Sprites.drawTank(ctx,  50, 90,  DIR.DOWN,  0, false, f, false, false);
    Sprites.drawTank(ctx, 300, 90,  DIR.DOWN,  1, false, f, false, false);
    Sprites.drawTank(ctx,  50, 300, DIR.DOWN,  2, false, f, false, false);
    Sprites.drawTank(ctx, 300, 300, DIR.DOWN,  3, false, f, false, false);
    Sprites.drawTank(ctx, 180, 200, DIR.UP,    0, true,  f, true,  false);

    // Title shadow
    ctx.textAlign = 'center';
    const cx = CFG.GW / 2;
    ctx.fillStyle = '#6a3800';
    ctx.font = 'bold 30px "Press Start 2P", monospace';
    ctx.fillText('TANK', cx+3, 62);
    ctx.fillText('BATTLE', cx+3, 100);
    // Title
    ctx.fillStyle = '#ffdd00';
    ctx.fillText('TANK',   cx, 60);
    ctx.fillText('BATTLE', cx, 98);

    // Subtitle
    ctx.fillStyle = '#ff8c00';
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillText('坦克大战', cx, 124);

    // HI-SCORE
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 9px "Press Start 2P", monospace';
    ctx.fillText('HI-SCORE: ' + String(this.hiScore).padStart(7, '0'), cx, 152);

    // Blink prompt
    if (Math.floor(Date.now() / 520) % 2 === 0) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '9px "Press Start 2P", monospace';
      ctx.fillText('PRESS ENTER TO START', cx, 378);
    }

    // Controls
    ctx.fillStyle = '#666';
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillText('WASD / ↑↓←→ : Move    Space / Click : Shoot    P : Pause', cx, 400);

    // HUD panel
    ctx.fillStyle = '#111';
    ctx.fillRect(CFG.GW, 0, CFG.HW, CFG.GH);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(CFG.GW+1, 1, CFG.HW-2, CFG.GH-2);
    ctx.fillStyle = '#ffdd00';
    ctx.font = 'bold 10px "Press Start 2P", monospace';
    ctx.fillText('TANK',   CFG.GW + CFG.HW/2, 30);
    ctx.fillText('BATTLE', CFG.GW + CFG.HW/2, 50);

    // Enemy showcase
    ctx.fillStyle = '#555';
    ctx.font = '7px monospace';
    ctx.textAlign = 'left';
    const labels = ['BASIC','FAST','POWER','ARMOR'];
    const pts    = CFG.ENEMY_PTS;
    for (let i = 0; i < 4; i++) {
      const ex = CFG.GW + 12, ey = 80 + i * 70;
      Sprites.drawTank(ctx, ex, ey, DIR.DOWN, i, false, f, false, false);
      ctx.fillStyle = '#aaa';
      ctx.fillText(labels[i], ex + 38, ey + 10);
      ctx.fillStyle = '#ff8';
      ctx.fillText(pts[i] + ' PTS', ex + 38, ey + 22);
    }
  }

  // ── render: game over ────────────────────────────────────────────────────────
  _rGameOver(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, CFG.GW, CFG.GH);

    const cx = CFG.GW / 2, cy = CFG.GH / 2;
    ctx.fillStyle = '#6a0000';
    ctx.fillRect(cx-150, cy-90, 300, 180);
    ctx.strokeStyle = '#ff2222';
    ctx.lineWidth = 3;
    ctx.strokeRect(cx-150, cy-90, 300, 180);

    this._centreText(ctx, cx, cy - 42, 'GAME',  22, '#ff2222');
    this._centreText(ctx, cx, cy - 12, 'OVER',  22, '#ff2222');
    this._centreText(ctx, cx, cy + 30, 'SCORE: ' + this.score, 9, '#ffdd00');
    if (Math.floor(Date.now()/600) % 2 === 0)
      this._centreText(ctx, cx, cy + 60, 'ENTER TO RETRY', 7, '#888');
  }

  // ── render: victory ──────────────────────────────────────────────────────────
  _rVictory(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.68)';
    ctx.fillRect(0, 0, CFG.GW, CFG.GH);

    const cx = CFG.GW / 2, cy = CFG.GH / 2;
    ctx.fillStyle = '#005500';
    ctx.fillRect(cx-165, cy-100, 330, 200);
    ctx.strokeStyle = '#00ee44';
    ctx.lineWidth = 3;
    ctx.strokeRect(cx-165, cy-100, 330, 200);

    this._centreText(ctx, cx, cy-55, 'VICTORY!',             18, '#00ff66');
    this._centreText(ctx, cx, cy-22, 'YOU WIN!',             14, '#66ffaa');
    this._centreText(ctx, cx, cy+18, 'SCORE: '+this.score,   9,  '#ffdd00');
    if (this.score === this.hiScore && this.score > 0)
      this._centreText(ctx, cx, cy+40, 'NEW RECORD!',        8,  '#ff8800');
    if (Math.floor(Date.now()/600) % 2 === 0)
      this._centreText(ctx, cx, cy+70, 'ENTER TO PLAY AGAIN',7,  '#888');
  }

  // ── helper: centred text ─────────────────────────────────────────────────────
  _centreText(ctx, x, y, text, size, color) {
    ctx.fillStyle  = color;
    ctx.font       = `bold ${size}px "Press Start 2P", monospace`;
    ctx.textAlign  = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
window.addEventListener('load', () => {
  sound.init();

  const canvas = document.getElementById('gameCanvas');

  // Adaptive CSS scaling
  function scaleCanvas() {
    const sx = (window.innerWidth  - 8) / canvas.width;
    const sy = (window.innerHeight - 8) / canvas.height;
    const s  = Math.min(sx, sy, 2.5);   // cap at 2.5×
    canvas.style.width  = Math.floor(canvas.width  * s) + 'px';
    canvas.style.height = Math.floor(canvas.height * s) + 'px';
  }
  scaleCanvas();
  window.addEventListener('resize', scaleCanvas);

  const game = new Game(canvas);

  // Resume AudioContext on first interaction
  const resume = () => { sound.resume(); };
  window.addEventListener('keydown', resume, { once: true });
  canvas.addEventListener('mousedown', resume, { once: true });
  canvas.addEventListener('touchstart', resume, { once: true });
});
