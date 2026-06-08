/**
 * 俄罗斯方块 – Tetris Game
 * Pure Canvas + Web Audio API
 */
(() => {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────────────────
  const COLS = 10, ROWS = 20;
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const nextCanvas = document.getElementById('nextCanvas');
  const nextCtx = nextCanvas.getContext('2d');
  const CELL = canvas.width / COLS; // 24px
  const msg = document.getElementById('message');

  // Responsive sizing
  function resize() {
    const maxH = window.innerHeight - 140;
    const scale = Math.min((window.innerWidth - 120) / (canvas.width + nextCanvas.width + 12), maxH / canvas.height, 1);
    canvas.style.width = Math.floor(canvas.width * scale) + 'px';
    canvas.style.height = Math.floor(canvas.height * scale) + 'px';
    nextCanvas.style.width = Math.floor(nextCanvas.width * scale) + 'px';
    nextCanvas.style.height = Math.floor(nextCanvas.height * scale) + 'px';
  }
  resize();
  window.addEventListener('resize', resize);

  // ── Tetrominoes ────────────────────────────────────────────────────────────
  const SHAPES = {
    I: { color: '#00eeee', blocks: [[0,0],[1,0],[2,0],[3,0]] },
    O: { color: '#dddd00', blocks: [[0,0],[1,0],[0,1],[1,1]] },
    T: { color: '#aa00ee', blocks: [[0,0],[1,0],[2,0],[1,1]] },
    S: { color: '#00ee00', blocks: [[1,0],[2,0],[0,1],[1,1]] },
    Z: { color: '#ee0000', blocks: [[0,0],[1,0],[1,1],[2,1]] },
    J: { color: '#0000ee', blocks: [[0,0],[0,1],[1,1],[2,1]] },
    L: { color: '#ee7700', blocks: [[2,0],[0,1],[1,1],[2,1]] },
  };
  const SHAPE_KEYS = Object.keys(SHAPES);

  // Wall-kick data (SRS simplified)
  const KICKS = [
    [[ 0, 0],[-1, 0],[-1,-1],[ 0, 2],[-1, 2]],
    [[ 0, 0],[ 1, 0],[ 1, 1],[ 0,-2],[ 1,-2]],
    [[ 0, 0],[ 1, 0],[ 1,-1],[ 0, 2],[ 1, 2]],
    [[ 0, 0],[-1, 0],[-1, 1],[ 0,-2],[-1,-2]],
  ];
  const KICKS_I = [
    [[ 0, 0],[-2, 0],[ 1, 0],[-2, 1],[ 1,-2]],
    [[ 0, 0],[ 2, 0],[-1, 0],[ 2,-1],[-1, 2]],
    [[ 0, 0],[-1, 0],[ 2, 0],[-1,-2],[ 2, 1]],
    [[ 0, 0],[ 1, 0],[-2, 0],[ 1, 2],[-2,-1]],
  ];

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
  function sfxDrop() { playTone(200, 0.1, 'triangle', 0.08); }
  function sfxRotate() { playTone(600, 0.05, 'square', 0.04); }
  function sfxClear(n) {
    const freqs = n >= 4 ? [880, 1100, 1320, 1540] : [660, 880];
    freqs.forEach((f, i) => setTimeout(() => playTone(f, 0.12, 'square', 0.06), i * 60));
  }
  function sfxGameOver() { [400, 300, 200, 150].forEach((f, i) => setTimeout(() => playTone(f, 0.25, 'sawtooth', 0.06), i * 120)); }
  function sfxLevelUp() { [523, 659, 784].forEach((f, i) => setTimeout(() => playTone(f, 0.1, 'square', 0.05), i * 80)); }

  // ── State ──────────────────────────────────────────────────────────────────
  let board, current, next, bag;
  let score, highScore, level, lines, combo;
  let state; // 'idle', 'playing', 'paused', 'dead'
  let dropTimer, dropInterval, lockTimer, lockDelay;
  let lastTime;
  let particles = [];
  let flashRows = [];
  let flashTimer = 0;

  try { highScore = parseInt(localStorage.getItem('tetris-high') || '0', 10); } catch (e) { highScore = 0; }

  function createBag() {
    const arr = [...SHAPE_KEYS];
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }

  function spawnPiece() {
    if (bag.length === 0) bag = createBag();
    const key = bag.pop();
    const shape = SHAPES[key];
    const blocks = shape.blocks.map(b => [...b]);
    const minX = Math.min(...blocks.map(b => b[0]));
    const maxX = Math.max(...blocks.map(b => b[0]));
    const w = maxX - minX + 1;
    return { key, color: shape.color, blocks, x: Math.floor((COLS - w) / 2) - minX, y: 0, rot: 0 };
  }

  function init() {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    bag = createBag();
    current = spawnPiece();
    next = spawnPiece();
    score = 0;
    level = 1;
    lines = 0;
    combo = -1;
    dropTimer = 0;
    lockTimer = 0;
    lockDelay = 500;
    dropInterval = getDropInterval();
    particles = [];
    flashRows = [];
    flashTimer = 0;
    updateHUD();
  }

  function getDropInterval() {
    // Classic NES-style speed curve
    const speeds = [800, 720, 630, 550, 470, 380, 300, 220, 140, 100, 80, 80, 80, 70, 70, 70, 50, 50, 50, 30];
    return speeds[Math.min(level - 1, speeds.length - 1)];
  }

  // ── Collision ──────────────────────────────────────────────────────────────
  function collides(piece, dx, dy, blocks) {
    const bl = blocks || piece.blocks;
    for (const [bx, by] of bl) {
      const nx = piece.x + bx + (dx || 0);
      const ny = piece.y + by + (dy || 0);
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
    return false;
  }

  // ── Piece actions ──────────────────────────────────────────────────────────
  function rotateBlocks(blocks, dir) {
    // Rotate around the center of the bounding box
    const minX = Math.min(...blocks.map(b => b[0]));
    const maxX = Math.max(...blocks.map(b => b[0]));
    const minY = Math.min(...blocks.map(b => b[1]));
    const maxY = Math.max(...blocks.map(b => b[1]));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    return blocks.map(([x, y]) => {
      const rx = Math.round(cx + (dir === 1 ? -(y - cy) : (y - cy)));
      const ry = Math.round(cy + (dir === 1 ? (x - cx) : -(x - cx)));
      return [rx, ry];
    });
  }

  function rotate(dir) {
    if (current.key === 'O') return;
    const newBlocks = rotateBlocks(current.blocks, dir);
    const newRot = ((current.rot + (dir === 1 ? 1 : 3)) % 4);
    const kicks = current.key === 'I' ? KICKS_I : KICKS;
    const kickData = kicks[current.rot];
    for (const [kx, ky] of kickData) {
      const testPiece = { ...current, blocks: newBlocks, x: current.x + kx, y: current.y - ky };
      if (!collides(testPiece)) {
        current.blocks = newBlocks;
        current.x += kx;
        current.y -= ky;
        current.rot = newRot;
        sfxRotate();
        lockTimer = 0; // Reset lock delay on successful rotation
        return;
      }
    }
  }

  function move(dx) {
    if (!collides(current, dx, 0)) {
      current.x += dx;
      lockTimer = 0;
    }
  }

  function softDrop() {
    if (!collides(current, 0, 1)) {
      current.y++;
      score += 1;
      dropTimer = 0;
      updateHUD();
    }
  }

  function hardDrop() {
    let dropped = 0;
    while (!collides(current, 0, 1)) {
      current.y++;
      dropped++;
    }
    score += dropped * 2;
    sfxDrop();
    lockPiece();
  }

  function getGhostY() {
    let gy = current.y;
    while (!collides({ ...current, y: gy + 1 })) gy++;
    return gy;
  }

  // ── Lock & Clear ───────────────────────────────────────────────────────────
  function lockPiece() {
    for (const [bx, by] of current.blocks) {
      const x = current.x + bx;
      const y = current.y + by;
      if (y < 0) { gameOver(); return; }
      board[y][x] = current.color;
    }
    checkLines();
    current = next;
    next = spawnPiece();
    dropTimer = 0;
    lockTimer = 0;
  }

  function checkLines() {
    const full = [];
    for (let r = 0; r < ROWS; r++) {
      if (board[r].every(c => c !== null)) full.push(r);
    }
    if (full.length > 0) {
      combo++;
      flashRows = full;
      flashTimer = 300;
      sfxClear(full.length);

      // Score: NES-style
      const lineScores = [0, 100, 300, 500, 800];
      score += (lineScores[full.length] || 800) * level;
      if (combo > 0) score += 50 * combo * level;

      lines += full.length;
      const newLevel = Math.floor(lines / 10) + 1;
      if (newLevel > level) {
        level = newLevel;
        dropInterval = getDropInterval();
        sfxLevelUp();
      }

      // Spawn particles for cleared rows
      for (const row of full) {
        for (let c = 0; c < COLS; c++) {
          for (let p = 0; p < 3; p++) {
            particles.push({
              x: c * CELL + CELL / 2,
              y: row * CELL + CELL / 2,
              vx: (Math.random() - 0.5) * 4,
              vy: (Math.random() - 0.5) * 4 - 2,
              life: 1,
              color: board[row][c],
            });
          }
        }
      }

      // Delay clear for flash effect
      setTimeout(() => {
        for (const row of full) {
          board.splice(row, 1);
          board.unshift(Array(COLS).fill(null));
        }
        flashRows = [];
        updateHUD();
      }, 300);
    } else {
      combo = -1;
    }
    updateHUD();
  }

  function gameOver() {
    state = 'dead';
    if (score > highScore) {
      highScore = score;
      try { localStorage.setItem('tetris-high', String(highScore)); } catch (e) {}
    }
    updateHUD();
    sfxGameOver();
    msg.innerHTML = 'GAME OVER<span class="sub">PRESS SPACE to retry</span>';
    msg.classList.add('show');
  }

  // ── HUD ────────────────────────────────────────────────────────────────────
  function updateHUD() {
    document.getElementById('scoreVal').textContent = score;
    document.getElementById('highVal').textContent = highScore;
    document.getElementById('levelVal').textContent = level;
    document.getElementById('linesVal').textContent = lines;
  }

  // ── Draw ───────────────────────────────────────────────────────────────────
  function drawBlock(context, x, y, color, size) {
    const s = size || CELL;
    const px = x * s, py = y * s;
    context.fillStyle = color;
    context.fillRect(px + 1, py + 1, s - 2, s - 2);
    // Highlight
    context.fillStyle = 'rgba(255,255,255,0.2)';
    context.fillRect(px + 1, py + 1, s - 2, 3);
    context.fillRect(px + 1, py + 1, 3, s - 2);
    // Shadow
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.fillRect(px + s - 3, py + 1, 2, s - 2);
    context.fillRect(px + 1, py + s - 3, s - 2, 2);
  }

  function draw() {
    // Background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid lines
    ctx.strokeStyle = '#111133';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, ROWS * CELL); ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(COLS * CELL, y * CELL); ctx.stroke();
    }

    // Board
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c]) {
          if (flashRows.includes(r)) {
            const flash = Math.sin(Date.now() * 0.02) * 0.3 + 0.7;
            ctx.globalAlpha = flash;
            drawBlock(ctx, c, r, '#ffffff');
            ctx.globalAlpha = 1;
          } else {
            drawBlock(ctx, c, r, board[r][c]);
          }
        }
      }
    }

    // Ghost piece
    if (state === 'playing' && current) {
      const ghostY = getGhostY();
      if (ghostY !== current.y) {
        ctx.globalAlpha = 0.2;
        for (const [bx, by] of current.blocks) {
          drawBlock(ctx, current.x + bx, ghostY + by, current.color);
        }
        ctx.globalAlpha = 1;
      }
    }

    // Current piece
    if (state === 'playing' && current) {
      for (const [bx, by] of current.blocks) {
        if (current.y + by >= 0) {
          drawBlock(ctx, current.x + bx, current.y + by, current.color);
        }
      }
    }

    // Particles
    particles = particles.filter(p => p.life > 0);
    for (const p of particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      ctx.globalAlpha = 1;
    }

    // Next piece preview
    nextCtx.fillStyle = '#0a0a1a';
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    if (next) {
      const minX = Math.min(...next.blocks.map(b => b[0]));
      const maxX = Math.max(...next.blocks.map(b => b[0]));
      const minY = Math.min(...next.blocks.map(b => b[1]));
      const maxY = Math.max(...next.blocks.map(b => b[1]));
      const pw = maxX - minX + 1;
      const ph = maxY - minY + 1;
      const ns = 16; // next preview block size
      const ox = Math.floor((nextCanvas.width - pw * ns) / 2 - minX * ns);
      const oy = Math.floor((nextCanvas.height - ph * ns) / 2 - minY * ns);
      for (const [bx, by] of next.blocks) {
        const px2 = ox + bx * ns;
        const py2 = oy + by * ns;
        nextCtx.fillStyle = next.color;
        nextCtx.fillRect(px2 + 1, py2 + 1, ns - 2, ns - 2);
        nextCtx.fillStyle = 'rgba(255,255,255,0.2)';
        nextCtx.fillRect(px2 + 1, py2 + 1, ns - 2, 3);
        nextCtx.fillRect(px2 + 1, py2 + 1, 3, ns - 2);
        nextCtx.fillStyle = 'rgba(0,0,0,0.3)';
        nextCtx.fillRect(px2 + ns - 3, py2 + 1, 2, ns - 2);
        nextCtx.fillRect(px2 + 1, py2 + ns - 3, ns - 2, 2);
      }
    }
  }

  // ── Update ─────────────────────────────────────────────────────────────────
  function update(dt) {
    if (state !== 'playing') return;

    // Particle update
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      p.life -= dt * 0.003;
    });

    if (flashRows.length > 0) {
      flashTimer -= dt;
      if (flashTimer <= 0) flashTimer = 0;
      return; // Don't drop while clearing
    }

    dropTimer += dt;
    if (dropTimer >= dropInterval) {
      dropTimer = 0;
      if (!collides(current, 0, 1)) {
        current.y++;
      } else {
        lockTimer += dropInterval;
        if (lockTimer >= lockDelay) {
          lockPiece();
          if (state === 'dead') return;
        }
      }
    }

    // Auto-lock when sitting on surface
    if (collides(current, 0, 1)) {
      lockTimer += dt;
      if (lockTimer >= lockDelay) {
        lockPiece();
      }
    } else {
      lockTimer = 0;
    }
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
  let dasTimer = 0, dasDelay = 170, dasRepeat = 50, dasActive = false;
  let moveDir = 0;

  document.addEventListener('keydown', e => {
    if (e.repeat && (e.key === 'ArrowUp' || e.key === ' ')) return;

    if (state === 'idle' || state === 'dead') {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        init();
        state = 'playing';
        msg.classList.remove('show');
        return;
      }
    }

    if (state === 'playing') {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          move(-1);
          moveDir = -1;
          dasTimer = 0;
          dasActive = false;
          break;
        case 'ArrowRight':
          e.preventDefault();
          move(1);
          moveDir = 1;
          dasTimer = 0;
          dasActive = false;
          break;
        case 'ArrowDown':
          e.preventDefault();
          softDrop();
          break;
        case 'ArrowUp':
          e.preventDefault();
          rotate(1);
          break;
        case 'z': case 'Z':
          rotate(-1);
          break;
        case ' ':
          e.preventDefault();
          hardDrop();
          break;
      }
    }
  });

  document.addEventListener('keyup', e => {
    if ((e.key === 'ArrowLeft' && moveDir === -1) || (e.key === 'ArrowRight' && moveDir === 1)) {
      moveDir = 0;
    }
  });

  // DAS (Delayed Auto Shift) via game loop check
  setInterval(() => {
    if (state !== 'playing' || moveDir === 0) return;
    dasTimer += 50;
    if (!dasActive && dasTimer >= dasDelay) {
      dasActive = true;
      dasTimer = 0;
    }
    if (dasActive && dasTimer >= dasRepeat) {
      move(moveDir);
      dasTimer = 0;
    }
  }, 50);

  // ── Touch controls ─────────────────────────────────────────────────────────
  let touchStartX, touchStartY;
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    if (state === 'idle' || state === 'dead') {
      init();
      state = 'playing';
      msg.classList.remove('show');
      return;
    }
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
  }, { passive: false });

  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    if (state !== 'playing' || touchStartX == null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 15) {
      // Tap = rotate
      rotate(1);
    } else if (Math.abs(dx) > Math.abs(dy)) {
      move(dx > 0 ? 1 : -1);
    } else {
      if (dy > 30) hardDrop();
    }
    touchStartX = null;
  }, { passive: false });

  // Swipe down for soft drop
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (state !== 'playing') return;
    const t = e.touches[0];
    const dy = t.clientY - touchStartY;
    if (dy > 40) {
      softDrop();
      touchStartY = t.clientY;
    }
  }, { passive: false });

  // ── Init & start ───────────────────────────────────────────────────────────
  init();
  state = 'idle';
  msg.innerHTML = 'TETRIS<span class="sub">PRESS SPACE to start</span>';
  msg.classList.add('show');
  requestAnimationFrame(gameLoop);
})();
