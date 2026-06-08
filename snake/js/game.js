/**
 * 贪吃蛇 – Snake Game
 * Pure Canvas + Web Audio API
 */
(() => {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────────────────
  const COLS = 24, ROWS = 24;
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const CELL = canvas.width / COLS; // 20px logical

  // Responsive sizing
  function resize() {
    const maxW = Math.min(window.innerWidth - 16, 480);
    const size = Math.floor(maxW / COLS) * COLS;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
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

  function sfxEat() { playTone(880, 0.08, 'square', 0.07); setTimeout(() => playTone(1100, 0.1, 'square', 0.06), 60); }
  function sfxDie() { [300, 220, 160].forEach((f, i) => setTimeout(() => playTone(f, 0.2, 'sawtooth', 0.06), i * 100)); }
  function sfxTurn() { playTone(440, 0.04, 'triangle', 0.03); }

  // ── State ──────────────────────────────────────────────────────────────────
  const DIR = { UP: 0, RIGHT: 1, DOWN: 2, LEFT: 3 };
  const DX = [0, 1, 0, -1];
  const DY = [-1, 0, 1, 0];

  let snake, dir, nextDir, food, specialFood;
  let score, highScore, speed, tickInterval;
  let state; // 'idle', 'playing', 'dead'
  let tickTimer, lastTick;
  let inputQueue;
  let particles = [];
  let shakeTimer = 0;
  let foodPulse = 0;
  let specialTimer = 0;
  let eatCombo = 0;
  let eatComboTimer = 0;

  // Load high score
  try { highScore = parseInt(localStorage.getItem('snake-high') || '0', 10); } catch (e) { highScore = 0; }

  function init() {
    const midC = Math.floor(COLS / 2);
    const midR = Math.floor(ROWS / 2);
    snake = [
      { r: midR, c: midC },
      { r: midR, c: midC - 1 },
      { r: midR, c: midC - 2 },
    ];
    dir = DIR.RIGHT;
    nextDir = DIR.RIGHT;
    score = 0;
    speed = 1;
    tickInterval = 120;
    inputQueue = [];
    food = null;
    specialFood = null;
    specialTimer = 0;
    eatCombo = 0;
    eatComboTimer = 0;
    placeFood();
    updateHUD();
  }

  function placeFood() {
    let r, c;
    do {
      r = Math.floor(Math.random() * ROWS);
      c = Math.floor(Math.random() * COLS);
    } while (isOccupied(r, c));
    food = { r, c };
  }

  function placeSpecialFood() {
    let r, c, attempts = 0;
    do {
      r = Math.floor(Math.random() * ROWS);
      c = Math.floor(Math.random() * COLS);
      attempts++;
    } while (isOccupied(r, c) && attempts < 100);
    if (attempts < 100) {
      specialFood = { r, c, timer: 120 }; // disappears after ~120 ticks
    }
  }

  function isOccupied(r, c) {
    if (food && r === food.r && c === food.c) return true;
    if (specialFood && r === specialFood.r && c === specialFood.c) return true;
    return snake.some(s => s.r === r && s.c === c);
  }

  function updateHUD() {
    document.getElementById('scoreVal').textContent = score;
    document.getElementById('highVal').textContent = highScore;
    document.getElementById('speedVal').textContent = speed;
  }

  function showMessage(html) {
    const el = document.getElementById('message');
    el.innerHTML = html;
    el.classList.add('show');
  }

  function hideMessage() {
    document.getElementById('message').classList.remove('show');
  }

  // ── Game logic ─────────────────────────────────────────────────────────────
  function tick() {
    // Process input queue
    if (inputQueue.length > 0) {
      const nd = inputQueue.shift();
      if ((nd + 2) % 4 !== dir) {
        dir = nd;
      }
    }

    const head = snake[0];
    const nr = head.r + DY[dir];
    const nc = head.c + DX[dir];

    // Wall collision
    if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) {
      die();
      return;
    }

    // Self collision
    if (snake.some(s => s.r === nr && s.c === nc)) {
      die();
      return;
    }

    const newHead = { r: nr, c: nc };
    snake.unshift(newHead);

    // Check food
    let ate = false;
    if (nr === food.r && nc === food.c) {
      ate = true;
      const pts = 10 + eatCombo * 5;
      score += pts;
      eatCombo++;
      eatComboTimer = 30;
      sfxEat();
      spawnParticles(food.r, food.c, '#ff3333');
      placeFood();

      // Speed up every 50 points
      const newSpeed = Math.min(10, 1 + Math.floor(score / 50));
      if (newSpeed !== speed) {
        speed = newSpeed;
        tickInterval = Math.max(50, 120 - (speed - 1) * 8);
      }

      // Chance for special food
      if (!specialFood && Math.random() < 0.3) {
        placeSpecialFood();
      }
    } else if (specialFood && nr === specialFood.r && nc === specialFood.c) {
      ate = true;
      score += 50;
      sfxEat();
      spawnParticles(specialFood.r, specialFood.c, '#ffdd00');
      specialFood = null;
      specialTimer = 0;
    } else {
      snake.pop();
    }

    // Decay combo
    if (eatComboTimer > 0) {
      eatComboTimer--;
      if (eatComboTimer <= 0) eatCombo = 0;
    }

    // Special food timer
    if (specialFood) {
      specialFood.timer--;
      if (specialFood.timer <= 0) {
        specialFood = null;
      }
    }

    if (score > highScore) {
      highScore = score;
      try { localStorage.setItem('snake-high', highScore); } catch (e) {}
    }
    updateHUD();
  }

  function die() {
    state = 'dead';
    sfxDie();
    shakeTimer = 15;

    // Particles along snake body
    snake.forEach(s => spawnParticles(s.r, s.c, '#44ff44'));

    showMessage('GAME OVER<br>Score: ' + score + '<span class="sub">Press Space or tap to restart</span>');
  }

  function spawnParticles(r, c, color) {
    const cx = c * CELL + CELL / 2;
    const cy = r * CELL + CELL / 2;
    for (let i = 0; i < 8; i++) {
      particles.push({
        x: cx, y: cy,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,
        life: 1,
        color: color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  // ── Drawing ────────────────────────────────────────────────────────────────
  function draw() {
    ctx.save();

    // Screen shake
    if (shakeTimer > 0) {
      ctx.translate((Math.random() - 0.5) * shakeTimer, (Math.random() - 0.5) * shakeTimer);
      shakeTimer *= 0.85;
      if (shakeTimer < 0.5) shakeTimer = 0;
    }

    // Background
    ctx.fillStyle = '#0a1a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid lines
    ctx.strokeStyle = '#0f2f0f';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, canvas.height); ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(canvas.width, y * CELL); ctx.stroke();
    }

    // Food
    foodPulse += 0.1;
    const fp = Math.sin(foodPulse) * 0.15 + 0.85;
    const foodX = food.c * CELL + CELL / 2;
    const foodY = food.r * CELL + CELL / 2;
    const foodR = CELL * 0.38 * fp;
    ctx.save();
    ctx.shadowColor = '#ff3333';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ff3333';
    ctx.beginPath();
    ctx.arc(foodX, foodY, foodR, 0, Math.PI * 2);
    ctx.fill();
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(foodX - foodR * 0.25, foodY - foodR * 0.25, foodR * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Special food
    if (specialFood) {
      const sp = Math.sin(foodPulse * 2) * 0.2 + 0.8;
      const sfx = specialFood.c * CELL + CELL / 2;
      const sfy = specialFood.r * CELL + CELL / 2;
      const sfr = CELL * 0.38 * sp;
      const blink = specialFood.timer < 30 ? (Math.floor(specialFood.timer / 3) % 2 === 0) : true;
      if (blink) {
        ctx.save();
        ctx.shadowColor = '#ffdd00';
        ctx.shadowBlur = 14;
        ctx.fillStyle = '#ffdd00';
        // Star shape
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? sfr : sfr * 0.45;
          const a = Math.PI * i / 5 - Math.PI / 2;
          i === 0 ? ctx.moveTo(sfx + Math.cos(a) * r, sfy + Math.sin(a) * r)
                   : ctx.lineTo(sfx + Math.cos(a) * r, sfy + Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // Snake body
    snake.forEach((seg, i) => {
      const x = seg.c * CELL;
      const y = seg.r * CELL;
      const isHead = i === 0;
      const t = i / snake.length;

      ctx.save();
      if (isHead) {
        ctx.shadowColor = '#66ff66';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#44ff44';
      } else {
        const g = Math.floor(180 + 75 * (1 - t));
        const gb = Math.floor(80 + 60 * (1 - t));
        ctx.fillStyle = `rgb(${Math.floor(30 + 20 * (1 - t))},${g},${gb})`;
      }

      const pad = isHead ? 1 : 2;
      const radius = isHead ? 4 : 3;
      roundRect(ctx, x + pad, y + pad, CELL - pad * 2, CELL - pad * 2, radius);
      ctx.fill();

      // Head eyes
      if (isHead) {
        ctx.fillStyle = '#000';
        const eyeSize = 3;
        let ex1, ey1, ex2, ey2;
        const ecx = x + CELL / 2;
        const ecy = y + CELL / 2;
        switch (dir) {
          case DIR.UP:
            ex1 = ecx - 4; ey1 = ecy - 3; ex2 = ecx + 4; ey2 = ecy - 3; break;
          case DIR.DOWN:
            ex1 = ecx - 4; ey1 = ecy + 3; ex2 = ecx + 4; ey2 = ecy + 3; break;
          case DIR.LEFT:
            ex1 = ecx - 3; ey1 = ecy - 4; ex2 = ecx - 3; ey2 = ecy + 4; break;
          case DIR.RIGHT:
            ex1 = ecx + 3; ey1 = ecy - 4; ex2 = ecx + 3; ey2 = ecy + 4; break;
        }
        ctx.beginPath(); ctx.arc(ex1, ey1, eyeSize, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(ex2, ey2, eyeSize, 0, Math.PI * 2); ctx.fill();
      }

      ctx.restore();
    });

    // Combo text
    if (eatCombo >= 2) {
      const comboAlpha = Math.min(1, eatComboTimer / 15);
      ctx.save();
      ctx.globalAlpha = comboAlpha;
      ctx.fillStyle = '#ffdd00';
      ctx.font = 'bold 12px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#ffdd00';
      ctx.shadowBlur = 10;
      const headX = snake[0].c * CELL + CELL / 2;
      const headY = snake[0].r * CELL - 10;
      ctx.fillText('x' + eatCombo, headX, Math.max(14, headY));
      ctx.restore();
    }

    // Particles
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.life -= 0.03;
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    });
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  function queueDirection(d) {
    // Prevent duplicate / reverse in queue
    const last = inputQueue.length > 0 ? inputQueue[inputQueue.length - 1] : dir;
    if (d !== last && (d + 2) % 4 !== last) {
      if (inputQueue.length < 3) {
        inputQueue.push(d);
      }
    }
  }

  document.addEventListener('keydown', e => {
    if (state === 'idle' || state === 'dead') {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        startGame();
        return;
      }
    }
    if (state !== 'playing') return;

    switch (e.code) {
      case 'ArrowUp':    case 'KeyW': e.preventDefault(); queueDirection(DIR.UP); sfxTurn(); break;
      case 'ArrowDown':  case 'KeyS': e.preventDefault(); queueDirection(DIR.DOWN); sfxTurn(); break;
      case 'ArrowLeft':  case 'KeyA': e.preventDefault(); queueDirection(DIR.LEFT); sfxTurn(); break;
      case 'ArrowRight': case 'KeyD': e.preventDefault(); queueDirection(DIR.RIGHT); sfxTurn(); break;
    }
  });

  // Touch / swipe
  let touchStart = null;
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    if (state === 'idle' || state === 'dead') { startGame(); return; }
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: false });

  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    if (!touchStart || state !== 'playing') { touchStart = null; return; }
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    const absDx = Math.abs(dx), absDy = Math.abs(dy);
    if (Math.max(absDx, absDy) < 15) { touchStart = null; return; } // too small
    if (absDx > absDy) {
      queueDirection(dx > 0 ? DIR.RIGHT : DIR.LEFT);
    } else {
      queueDirection(dy > 0 ? DIR.DOWN : DIR.UP);
    }
    sfxTurn();
    touchStart = null;
  }, { passive: false });

  // Click/tap to start (on canvas or message overlay)
  canvas.addEventListener('click', () => {
    if (state === 'idle' || state === 'dead') startGame();
  });
  document.getElementById('message').addEventListener('click', () => {
    if (state === 'idle' || state === 'dead') startGame();
  });

  // ── Game loop ──────────────────────────────────────────────────────────────
  function startGame() {
    ensureAudio();
    hideMessage();
    init();
    state = 'playing';
    lastTick = performance.now();
    tickTimer = 0;
  }

  function gameLoop(now) {
    requestAnimationFrame(gameLoop);

    if (state === 'playing') {
      const dt = now - lastTick;
      lastTick = now;
      tickTimer += dt;
      while (tickTimer >= tickInterval) {
        tickTimer -= tickInterval;
        tick();
        if (state !== 'playing') break;
      }
    }

    draw();
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  state = 'idle';
  init();
  showMessage('🐍 SNAKE<br><span class="sub">Press Space or tap to start</span>');
  requestAnimationFrame(gameLoop);
})();
