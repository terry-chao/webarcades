/**
 * 太空侵略者 – Space Invaders
 * Pure Canvas + Web Audio API
 */
(() => {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────────────────
  const W = 480, H = 540;
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const msg = document.getElementById('message');

  // Responsive sizing
  function resize() {
    const maxW = Math.min(window.innerWidth - 16, 480);
    const scale = maxW / W;
    canvas.style.width = Math.floor(W * scale) + 'px';
    canvas.style.height = Math.floor(H * scale) + 'px';
  }
  resize();
  window.addEventListener('resize', resize);

  // ── Audio ──────────────────────────────────────────────────────────────────
  let audioCtx;
  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  function playTone(freq, dur, type, vol) {
    ensureAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol || 0.06, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + dur);
  }
  function sfxShoot() { playTone(800, 0.08, 'square', 0.05); }
  function sfxExplosion() {
    playTone(120, 0.15, 'sawtooth', 0.08);
    setTimeout(() => playTone(80, 0.2, 'sawtooth', 0.06), 50);
  }
  function sfxInvaderHit() { playTone(400, 0.06, 'square', 0.06); setTimeout(() => playTone(600, 0.08, 'square', 0.05), 40); }
  function sfxPlayerHit() { [200, 150, 100].forEach((f, i) => setTimeout(() => playTone(f, 0.2, 'sawtooth', 0.08), i * 80)); }
  function sfxGameOver() { [400, 300, 200, 150].forEach((f, i) => setTimeout(() => playTone(f, 0.25, 'sawtooth', 0.06), i * 120)); }
  function sfxWaveComplete() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 0.12, 'square', 0.06), i * 100)); }

  // March rhythm
  const marchFreqs = [80, 70, 60, 50];
  let marchIndex = 0;
  function sfxMarch() { playTone(marchFreqs[marchIndex % 4], 0.06, 'square', 0.04); marchIndex++; }

  // ── State ──────────────────────────────────────────────────────────────────
  let player, invaders, playerBullets, invaderBullets, particles, shields;
  let score, highScore, lives, wave;
  let state; // 'idle', 'playing', 'dead'
  let invaderDir, invaderSpeed, invaderDropAmount;
  let moveTimer, moveInterval, shootTimer, shootInterval;
  let lastTime;
  let shakeTimer = 0;
  let invaderStepCount = 0;

  try { highScore = parseInt(localStorage.getItem('invaders-high') || '0', 10); } catch (e) { highScore = 0; }

  // Invader pixel art patterns (5x5 grids)
  const INVADER_TYPES = [
    { // Type 0 - squid (top row)
      color: '#ff44ff',
      frames: [
        [
          [0,0,1,0,0],
          [0,1,1,1,0],
          [1,1,1,1,1],
          [1,0,1,0,1],
          [0,1,0,1,0],
        ],
        [
          [0,0,1,0,0],
          [0,1,1,1,0],
          [1,1,1,1,1],
          [1,0,1,0,1],
          [1,0,0,0,1],
        ]
      ],
      points: 30,
    },
    { // Type 1 - crab (middle rows)
      color: '#44ccff',
      frames: [
        [
          [0,1,0,1,0],
          [1,1,1,1,1],
          [1,0,1,0,1],
          [0,1,0,1,0],
          [1,0,0,0,1],
        ],
        [
          [0,1,0,1,0],
          [1,1,1,1,1],
          [1,0,1,0,1],
          [1,0,0,0,1],
          [0,1,0,1,0],
        ]
      ],
      points: 20,
    },
    { // Type 2 - octopus (bottom rows)
      color: '#44ff44',
      frames: [
        [
          [0,1,1,1,0],
          [1,1,1,1,1],
          [1,1,1,1,1],
          [0,1,0,1,0],
          [1,0,0,0,1],
        ],
        [
          [0,1,1,1,0],
          [1,1,1,1,1],
          [1,1,1,1,1],
          [1,0,0,0,1],
          [0,1,0,1,0],
        ]
      ],
      points: 10,
    },
  ];

  // UFO (mystery ship)
  const UFO_PATTERN = [
    [0,0,0,1,1,1,1,1,1,0,0,0],
    [0,1,1,1,1,1,1,1,1,1,1,0],
    [1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,1,0,1,1,1,1,0,1,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1],
    [0,0,1,1,1,0,0,1,1,1,0,0],
  ];

  // ── Init ───────────────────────────────────────────────────────────────────
  function initWave() {
    invaders = [];
    const INVADER_ROWS = 5, INVADER_COLS = 11;
    const spacing = 36;
    const startX = (W - INVADER_COLS * spacing) / 2 + spacing / 2;

    for (let r = 0; r < INVADER_ROWS; r++) {
      for (let c = 0; c < INVADER_COLS; c++) {
        const type = r === 0 ? 0 : r <= 2 ? 1 : 2;
        invaders.push({
          x: startX + c * spacing,
          y: 60 + r * spacing,
          type,
          alive: true,
          frame: 0,
        });
      }
    }

    invaderDir = 1;
    moveTimer = 0;
    invaderStepCount = 0;
    updateMoveInterval();
    shootTimer = 0;
    shootInterval = Math.max(400, 1500 - wave * 100);
    invaderBullets = [];
    invaderDropAmount = 0;
  }

  function init() {
    player = { x: W / 2, y: H - 50, w: 36, h: 16, speed: 280 };
    playerBullets = [];
    particles = [];
    lives = 3;
    score = 0;
    wave = 1;
    shakeTimer = 0;

    // Create shields
    shields = [];
    createShields();

    initWave();
    updateHUD();
  }

  function createShields() {
    shields = [];
    const shieldPositions = [W * 0.15, W * 0.38, W * 0.62, W * 0.85];
    for (const sx of shieldPositions) {
      const pixels = [];
      // Shield shape: arch
      for (let r = 0; r < 12; r++) {
        for (let c = 0; c < 16; c++) {
          const inArch = r < 8 && c >= 2 && c <= 13;
          const inCutout = r >= 6 && c >= 5 && c <= 10;
          if (inArch && !inCutout) {
            pixels.push({ x: sx - 12 + c * 2, y: H - 120 + r * 2, alive: true });
          }
        }
      }
      shields.push(pixels);
    }
  }

  function updateMoveInterval() {
    const alive = invaders.filter(i => i.alive).length;
    const total = 55;
    // Speed increases as fewer invaders remain
    const baseInterval = 800;
    const minInterval = 80;
    moveInterval = Math.max(minInterval, baseInterval * (alive / total));
  }

  function nextWave() {
    wave++;
    sfxWaveComplete();
    createShields();
    initWave();
    updateHUD();
  }

  // ── HUD ────────────────────────────────────────────────────────────────────
  function updateHUD() {
    document.getElementById('scoreVal').textContent = score;
    document.getElementById('highVal').textContent = highScore;
    document.getElementById('waveVal').textContent = wave;
    document.getElementById('livesVal').textContent = lives;
  }

  // ── Particles ──────────────────────────────────────────────────────────────
  function spawnExplosion(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color,
        size: 1 + Math.random() * 2,
      });
    }
  }

  // ── Update ─────────────────────────────────────────────────────────────────
  function update(dt) {
    if (state !== 'playing') return;

    // Shake
    if (shakeTimer > 0) shakeTimer = Math.max(0, shakeTimer - dt);

    // Particles
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= dt * 0.004;
    });
    particles = particles.filter(p => p.life > 0);

    // Player movement
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
      player.x = Math.max(player.w / 2, player.x - player.speed * dt / 1000);
    }
    if (keys['ArrowRight'] || keys['d'] || keys['D']) {
      player.x = Math.min(W - player.w / 2, player.x + player.speed * dt / 1000);
    }

    // Player bullets
    playerBullets.forEach(b => { b.y -= 500 * dt / 1000; });
    playerBullets = playerBullets.filter(b => b.y > -10);

    // Invader movement
    moveTimer += dt;
    if (moveTimer >= moveInterval) {
      moveTimer = 0;
      invaderStepCount++;
      sfxMarch();

      // Toggle animation frame
      invaders.forEach(inv => { if (inv.alive) inv.frame = 1 - inv.frame; });

      // Check if any invader hits edge
      let hitEdge = false;
      for (const inv of invaders) {
        if (!inv.alive) continue;
        const nextX = inv.x + invaderDir * 12;
        if (nextX < 20 || nextX > W - 20) { hitEdge = true; break; }
      }

      if (hitEdge) {
        // Drop down and reverse
        for (const inv of invaders) {
          if (inv.alive) inv.y += 16;
        }
        invaderDir *= -1;
      } else {
        for (const inv of invaders) {
          if (inv.alive) inv.x += invaderDir * 12;
        }
      }

      // Check if invaders reached bottom
      for (const inv of invaders) {
        if (inv.alive && inv.y + 12 > player.y - 10) {
          gameOver();
          return;
        }
      }

      updateMoveInterval();
    }

    // Invader shooting
    shootTimer += dt;
    if (shootTimer >= shootInterval) {
      shootTimer = 0;
      // Find bottom-most alive invader in each column
      const bottomInvaders = {};
      for (const inv of invaders) {
        if (!inv.alive) continue;
        const col = Math.round(inv.x);
        if (!bottomInvaders[col] || inv.y > bottomInvaders[col].y) {
          bottomInvaders[col] = inv;
        }
      }
      const shooters = Object.values(bottomInvaders);
      if (shooters.length > 0) {
        const shooter = shooters[Math.floor(Math.random() * shooters.length)];
        invaderBullets.push({ x: shooter.x, y: shooter.y + 12 });
      }
    }

    // Invader bullets
    invaderBullets.forEach(b => { b.y += 250 * dt / 1000; });
    invaderBullets = invaderBullets.filter(b => b.y < H + 10);

    // Collision: player bullets vs invaders
    for (const b of playerBullets) {
      for (const inv of invaders) {
        if (!inv.alive) continue;
        if (Math.abs(b.x - inv.x) < 14 && Math.abs(b.y - inv.y) < 14) {
          inv.alive = false;
          b.y = -100; // remove
          score += INVADER_TYPES[inv.type].points;
          sfxInvaderHit();
          spawnExplosion(inv.x, inv.y, INVADER_TYPES[inv.type].color, 12);
          updateHUD();
          break;
        }
      }
    }

    // Collision: player bullets vs UFO
    if (ufo && ufo.alive) {
      for (const b of playerBullets) {
        if (Math.abs(b.x - ufo.x) < 24 && Math.abs(b.y - ufo.y) < 10) {
          ufo.alive = false;
          b.y = -100;
          const ufoScore = [50, 100, 150, 300][Math.floor(Math.random() * 4)];
          score += ufoScore;
          sfxExplosion();
          spawnExplosion(ufo.x, ufo.y, '#ff0000', 20);
          ufoText = { x: ufo.x, y: ufo.y, text: String(ufoScore), timer: 1500 };
          updateHUD();
        }
      }
    }

    // UFO movement
    if (ufo && ufo.alive) {
      ufo.x += ufo.dir * 120 * dt / 1000;
      if (ufo.x < -30 || ufo.x > W + 30) ufo.alive = false;
    }
    if (ufoText) {
      ufoText.timer -= dt;
      ufoText.y -= 20 * dt / 1000;
      if (ufoText.timer <= 0) ufoText = null;
    }

    // UFO spawn timer
    if (!ufo || !ufo.alive) {
      ufoTimer += dt;
      if (ufoTimer > 15000 + Math.random() * 10000) {
        ufoTimer = 0;
        const dir = Math.random() < 0.5 ? 1 : -1;
        ufo = { x: dir === 1 ? -20 : W + 20, y: 30, dir, alive: true };
      }
    }

    // Collision: invader bullets vs player
    for (const b of invaderBullets) {
      if (Math.abs(b.x - player.x) < player.w / 2 && Math.abs(b.y - player.y) < player.h / 2) {
        b.y = H + 100;
        playerHit();
        break;
      }
    }

    // Collision: bullets vs shields
    checkShieldCollision(playerBullets, -1);
    checkShieldCollision(invaderBullets, 1);

    // Clean up dead bullets
    playerBullets = playerBullets.filter(b => b.y > -10);
    invaderBullets = invaderBullets.filter(b => b.y < H + 10);

    // Check wave complete
    if (invaders.every(i => !i.alive)) {
      nextWave();
    }
  }

  function checkShieldCollision(bullets, dir) {
    for (const b of bullets) {
      for (const shield of shields) {
        for (const px of shield) {
          if (!px.alive) continue;
          if (Math.abs(b.x - px.x) < 3 && Math.abs(b.y - px.y) < 3) {
            px.alive = false;
            b.y = dir > 0 ? H + 100 : -100;
            // Destroy nearby pixels too
            for (const px2 of shield) {
              if (px2.alive && Math.abs(px.x - px2.x) < 6 && Math.abs(px.y - px2.y) < 6) {
                if (Math.random() < 0.5) px2.alive = false;
              }
            }
            break;
          }
        }
      }
    }
  }

  function playerHit() {
    lives--;
    sfxPlayerHit();
    shakeTimer = 300;
    spawnExplosion(player.x, player.y, '#44ff44', 20);
    updateHUD();
    if (lives <= 0) {
      gameOver();
    }
  }

  function gameOver() {
    state = 'dead';
    if (score > highScore) {
      highScore = score;
      try { localStorage.setItem('invaders-high', String(highScore)); } catch (e) {}
    }
    updateHUD();
    sfxGameOver();
    msg.innerHTML = 'GAME OVER<span class="sub">PRESS SPACE to retry</span>';
    msg.classList.add('show');
  }

  // ── UFO state ──────────────────────────────────────────────────────────────
  let ufo = null;
  let ufoTimer = 0;
  let ufoText = null;

  // ── Draw ───────────────────────────────────────────────────────────────────
  function drawPixelSprite(x, y, pattern, color, pixelSize) {
    ctx.fillStyle = color;
    const halfW = pattern[0].length * pixelSize / 2;
    const halfH = pattern.length * pixelSize / 2;
    for (let r = 0; r < pattern.length; r++) {
      for (let c = 0; c < pattern[r].length; c++) {
        if (pattern[r][c]) {
          ctx.fillRect(
            Math.floor(x - halfW + c * pixelSize),
            Math.floor(y - halfH + r * pixelSize),
            pixelSize, pixelSize
          );
        }
      }
    }
  }

  function draw() {
    // Shake offset
    const sx = shakeTimer > 0 ? (Math.random() - 0.5) * 4 : 0;
    const sy = shakeTimer > 0 ? (Math.random() - 0.5) * 4 : 0;
    ctx.save();
    ctx.translate(sx, sy);

    // Background
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, W, H);

    // Stars
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    for (let i = 0; i < 60; i++) {
      const sx2 = (i * 73) % W;
      const sy2 = (i * 137) % H;
      const brightness = 0.2 + Math.sin(Date.now() * 0.001 + i) * 0.2;
      ctx.globalAlpha = brightness;
      ctx.fillRect(sx2, sy2, 1, 1);
    }
    ctx.globalAlpha = 1;

    // Ground line
    ctx.fillStyle = '#44ff44';
    ctx.fillRect(0, H - 18, W, 1);

    // Shields
    ctx.fillStyle = '#44ff44';
    for (const shield of shields) {
      for (const px of shield) {
        if (px.alive) ctx.fillRect(px.x, px.y, 2, 2);
      }
    }

    // Invaders
    for (const inv of invaders) {
      if (!inv.alive) continue;
      const type = INVADER_TYPES[inv.type];
      drawPixelSprite(inv.x, inv.y, type.frames[inv.frame], type.color, 3);
    }

    // UFO
    if (ufo && ufo.alive) {
      drawPixelSprite(ufo.x, ufo.y, UFO_PATTERN, '#ff0000', 3);
    }
    if (ufoText) {
      ctx.fillStyle = '#ff0000';
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.min(1, ufoText.timer / 500);
      ctx.fillText(ufoText.text, ufoText.x, ufoText.y);
      ctx.globalAlpha = 1;
    }

    // Player
    if (state === 'playing' || state === 'idle') {
      drawPlayer(player.x, player.y);
    }

    // Player bullets
    ctx.fillStyle = '#44ff44';
    for (const b of playerBullets) {
      ctx.fillRect(b.x - 1, b.y - 6, 2, 10);
    }

    // Invader bullets
    for (const b of invaderBullets) {
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(b.x - 1, b.y, 3, 8);
      // Flash effect
      ctx.fillStyle = '#ffaa44';
      ctx.fillRect(b.x - 2, b.y + 4, 5, 3);
    }

    // Particles
    for (const p of particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // Lives display
    for (let i = 0; i < lives - 1; i++) {
      drawPlayer(24 + i * 30, H - 10);
    }

    ctx.restore();
  }

  function drawPlayer(x, y) {
    ctx.fillStyle = '#44ff44';
    // Body
    ctx.fillRect(x - 16, y, 32, 10);
    // Turret
    ctx.fillRect(x - 3, y - 8, 6, 8);
    // Details
    ctx.fillStyle = '#22aa22';
    ctx.fillRect(x - 14, y + 2, 4, 6);
    ctx.fillRect(x + 10, y + 2, 4, 6);
  }

  // ── Game loop ──────────────────────────────────────────────────────────────
  function gameLoop(time) {
    if (!lastTime) lastTime = time;
    const dt = Math.min(time - lastTime, 100);
    lastTime = time;

    update(dt);
    draw();
    requestAnimationFrame(gameLoop);
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  const keys = {};
  let canShoot = true;

  document.addEventListener('keydown', e => {
    keys[e.key] = true;

    if (state === 'idle' || state === 'dead') {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        init();
        state = 'playing';
        msg.classList.remove('show');
        return;
      }
    }

    if (state === 'playing' && (e.key === ' ' || e.key === 'ArrowUp')) {
      e.preventDefault();
      if (canShoot && playerBullets.length < 3) {
        playerBullets.push({ x: player.x, y: player.y - 8 });
        sfxShoot();
        canShoot = false;
        setTimeout(() => { canShoot = true; }, 200);
      }
    }
  });

  document.addEventListener('keyup', e => {
    keys[e.key] = false;
  });

  // ── Touch controls ─────────────────────────────────────────────────────────
  let touchActive = false;
  let touchX = 0;
  let touchTimer = null;

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    if (state === 'idle' || state === 'dead') {
      init();
      state = 'playing';
      msg.classList.remove('show');
      return;
    }
    touchActive = true;
    touchX = e.touches[0].clientX;

    // Auto-shoot while touching
    if (canShoot && playerBullets.length < 3) {
      playerBullets.push({ x: player.x, y: player.y - 8 });
      sfxShoot();
      canShoot = false;
      setTimeout(() => { canShoot = true; }, 200);
    }
    touchTimer = setInterval(() => {
      if (canShoot && playerBullets.length < 3) {
        playerBullets.push({ x: player.x, y: player.y - 8 });
        sfxShoot();
        canShoot = false;
        setTimeout(() => { canShoot = true; }, 200);
      }
    }, 250);
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (!touchActive || state !== 'playing') return;
    const newTouchX = e.touches[0].clientX;
    const dx = newTouchX - touchX;
    const canvasRect = canvas.getBoundingClientRect();
    const scale = W / canvasRect.width;
    player.x = Math.max(player.w / 2, Math.min(W - player.w / 2, player.x + dx * scale));
    touchX = newTouchX;
  }, { passive: false });

  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    touchActive = false;
    if (touchTimer) { clearInterval(touchTimer); touchTimer = null; }
  }, { passive: false });

  // ── Init & start ───────────────────────────────────────────────────────────
  init();
  state = 'idle';
  msg.innerHTML = 'SPACE INVADERS<span class="sub">PRESS SPACE to start</span>';
  msg.classList.add('show');
  requestAnimationFrame(gameLoop);
})();
