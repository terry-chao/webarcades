/**
 * 消消乐 – Match-3 Puzzle Game
 * Pure Canvas + Web Audio API
 */
(() => {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────────────────
  const COLS = 8, ROWS = 8;
  const GEM_TYPES = 6;
  const MOVE_LIMIT = 30;
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  // Responsive sizing
  function resize() {
    const maxW = Math.min(window.innerWidth - 16, 480);
    const size = Math.floor(maxW / COLS) * COLS;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
  }
  resize();
  window.addEventListener('resize', resize);

  const CELL = canvas.width / COLS; // 60px logical

  // Gem colors and shapes
  const GEM_COLORS = [
    { fill: '#ff4444', stroke: '#cc0000', light: '#ff8888', shape: 'circle' },    // red
    { fill: '#44cc44', stroke: '#228822', light: '#88ff88', shape: 'diamond' },    // green
    { fill: '#4488ff', stroke: '#2255cc', light: '#88bbff', shape: 'square' },     // blue
    { fill: '#ffaa00', stroke: '#cc7700', light: '#ffcc66', shape: 'triangle' },   // orange
    { fill: '#cc44ff', stroke: '#8822cc', light: '#dd88ff', shape: 'star' },       // purple
    { fill: '#ff66aa', stroke: '#cc3377', light: '#ff99cc', shape: 'hexagon' },    // pink
  ];

  // ── Audio (Web Audio API) ──────────────────────────────────────────────────
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
    gain.gain.setValueAtTime(vol || 0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + dur);
  }

  function sfxSelect() { playTone(600, 0.08, 'square', 0.06); }
  function sfxSwap() { playTone(400, 0.1, 'triangle', 0.06); }
  function sfxMatch(count) {
    for (let i = 0; i < count && i < 5; i++) {
      setTimeout(() => playTone(500 + i * 120, 0.12, 'square', 0.07), i * 60);
    }
  }
  function sfxCombo(chain) {
    playTone(800 + chain * 100, 0.2, 'triangle', 0.1);
  }
  function sfxGameOver() {
    [300, 260, 220, 180].forEach((f, i) => setTimeout(() => playTone(f, 0.25, 'sawtooth', 0.06), i * 150));
  }
  function sfxLevelUp() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 0.15, 'square', 0.08), i * 100));
  }

  // ── Game State ─────────────────────────────────────────────────────────────
  let grid = [];       // grid[row][col] = gem type (0..5) or -1
  let selected = null; // { row, col }
  let score = 0;
  let moves = MOVE_LIMIT;
  let level = 1;
  let targetScore = 1000;
  let animating = false;
  let swapAnim = null; // { r1,c1,r2,c2, progress, reverse }
  let fallAnims = [];  // [{ row, col, fromY, toY, progress }]
  let removeAnims = []; // [{ row, col, progress }]
  let comboCount = 0;
  let particles = [];
  let shakeTimer = 0;
  let flashTimer = 0;

  // ── Grid helpers ───────────────────────────────────────────────────────────
  function randomGem() {
    return Math.floor(Math.random() * GEM_TYPES);
  }

  function initGrid() {
    grid = [];
    for (let r = 0; r < ROWS; r++) {
      grid[r] = [];
      for (let c = 0; c < COLS; c++) {
        let g;
        do {
          g = randomGem();
        } while (
          (c >= 2 && grid[r][c - 1] === g && grid[r][c - 2] === g) ||
          (r >= 2 && grid[r - 1][c] === g && grid[r - 2][c] === g)
        );
        grid[r][c] = g;
      }
    }
  }

  function findMatches() {
    const matched = new Set();
    // Horizontal
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS - 2; c++) {
        const t = grid[r][c];
        if (t < 0) continue;
        if (grid[r][c + 1] === t && grid[r][c + 2] === t) {
          let end = c + 2;
          while (end + 1 < COLS && grid[r][end + 1] === t) end++;
          for (let k = c; k <= end; k++) matched.add(r * COLS + k);
        }
      }
    }
    // Vertical
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS - 2; r++) {
        const t = grid[r][c];
        if (t < 0) continue;
        if (grid[r + 1][c] === t && grid[r + 2][c] === t) {
          let end = r + 2;
          while (end + 1 < ROWS && grid[end + 1][c] === t) end++;
          for (let k = r; k <= end; k++) matched.add(k * COLS + c);
        }
      }
    }
    return matched;
  }

  function removeMatches(matched) {
    const count = matched.size;
    matched.forEach(idx => {
      const r = Math.floor(idx / COLS);
      const c = idx % COLS;
      removeAnims.push({ row: r, col: c, progress: 0 });
      // Particles
      const cx = c * CELL + CELL / 2;
      const cy = r * CELL + CELL / 2;
      for (let i = 0; i < 6; i++) {
        particles.push({
          x: cx, y: cy,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6,
          life: 1,
          color: GEM_COLORS[grid[r][c]].fill,
          size: 3 + Math.random() * 3,
        });
      }
      grid[r][c] = -1;
    });
    // Score: base * count * combo multiplier
    const pts = count * 10 * (1 + comboCount * 0.5);
    score += Math.floor(pts);
    sfxMatch(count);
    if (comboCount > 0) sfxCombo(comboCount);
    shakeTimer = Math.min(count * 2, 10);
    updateHUD();
  }

  function applyGravity() {
    fallAnims = [];
    for (let c = 0; c < COLS; c++) {
      let writeRow = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (grid[r][c] >= 0) {
          if (r !== writeRow) {
            grid[writeRow][c] = grid[r][c];
            grid[r][c] = -1;
            fallAnims.push({ row: writeRow, col: c, fromY: r * CELL, toY: writeRow * CELL, progress: 0 });
          }
          writeRow--;
        }
      }
      // Fill empty top cells
      for (let r = writeRow; r >= 0; r--) {
        grid[r][c] = randomGem();
        fallAnims.push({ row: r, col: c, fromY: (r - writeRow - 1) * CELL, toY: r * CELL, progress: 0 });
      }
    }
  }

  function hasValidMoves() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        // Try swap right
        if (c + 1 < COLS) {
          swapInGrid(r, c, r, c + 1);
          if (findMatches().size > 0) { swapInGrid(r, c, r, c + 1); return true; }
          swapInGrid(r, c, r, c + 1);
        }
        // Try swap down
        if (r + 1 < ROWS) {
          swapInGrid(r, c, r + 1, c);
          if (findMatches().size > 0) { swapInGrid(r, c, r + 1, c); return true; }
          swapInGrid(r, c, r + 1, c);
        }
      }
    }
    return false;
  }

  function swapInGrid(r1, c1, r2, c2) {
    const tmp = grid[r1][c1];
    grid[r1][c1] = grid[r2][c2];
    grid[r2][c2] = tmp;
  }

  function isAdjacent(r1, c1, r2, c2) {
    return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
  }

  function reshuffle() {
    // Collect all gems, shuffle, and place back ensuring no initial matches
    const gems = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        gems.push(grid[r][c]);

    // Fisher-Yates shuffle
    for (let i = gems.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [gems[i], gems[j]] = [gems[j], gems[i]];
    }

    let idx = 0;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        grid[r][c] = gems[idx++];

    flashTimer = 20;
  }

  // ── Update HUD ─────────────────────────────────────────────────────────────
  function updateHUD() {
    document.getElementById('scoreVal').textContent = score;
    document.getElementById('movesVal').textContent = moves;
    document.getElementById('levelVal').textContent = level;
  }

  // ── Cascade loop ───────────────────────────────────────────────────────────
  function processCascade() {
    comboCount = 0;
    cascadeStep();
  }

  function cascadeStep() {
    const matched = findMatches();
    if (matched.size > 0) {
      removeMatches(matched);
      comboCount++;
      // Animate removal, then gravity
      animating = true;
      animateRemoval(() => {
        applyGravity();
        animateFalls(() => {
          cascadeStep();
        });
      });
    } else {
      animating = false;
      comboCount = 0;
      // Check level up
      if (score >= targetScore) {
        level++;
        targetScore += level * 800;
        moves += 10;
        sfxLevelUp();
        flashTimer = 30;
        showMessage('LEVEL ' + level + '!', 1500);
        updateHUD();
      }
      // Check game over
      if (moves <= 0) {
        showMessage('GAME OVER<br>Score: ' + score + '<span class="sub">Click to restart</span>', 0);
        sfxGameOver();
        canvas.addEventListener('click', restartHandler, { once: true });
      } else if (!hasValidMoves()) {
        showMessage('NO MOVES!<br>Reshuffling...', 1500);
        setTimeout(() => {
          reshuffle();
          processCascade();
        }, 1600);
      }
    }
  }

  // ── Animations ─────────────────────────────────────────────────────────────
  const EASE_OUT = t => 1 - (1 - t) * (1 - t);
  const EASE_IN_OUT = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  function animateRemoval(onDone) {
    removeAnims.forEach(a => a.progress = 0);
    function step() {
      let done = true;
      removeAnims.forEach(a => {
        a.progress = Math.min(1, a.progress + 0.08);
        if (a.progress < 1) done = false;
      });
      draw();
      if (done) {
        removeAnims = [];
        onDone();
      } else {
        requestAnimationFrame(step);
      }
    }
    requestAnimationFrame(step);
  }

  function animateFalls(onDone) {
    fallAnims.forEach(a => a.progress = 0);
    function step() {
      let done = true;
      fallAnims.forEach(a => {
        a.progress = Math.min(1, a.progress + 0.06);
        if (a.progress < 1) done = false;
      });
      draw();
      if (done) {
        fallAnims = [];
        onDone();
      } else {
        requestAnimationFrame(step);
      }
    }
    requestAnimationFrame(step);
  }

  function animateSwap(r1, c1, r2, c2, valid, onDone) {
    swapAnim = { r1, c1, r2, c2, progress: 0, reverse: false };
    animating = true;

    function step() {
      swapAnim.progress = Math.min(1, swapAnim.progress + 0.06);
      draw();
      if (swapAnim.progress >= 1) {
        if (!valid) {
          // Swap back
          swapAnim.reverse = true;
          swapAnim.progress = 0;
          swapInGrid(r1, c1, r2, c2);
          function stepBack() {
            swapAnim.progress = Math.min(1, swapAnim.progress + 0.06);
            draw();
            if (swapAnim.progress >= 1) {
              swapAnim = null;
              animating = false;
              onDone();
            } else {
              requestAnimationFrame(stepBack);
            }
          }
          requestAnimationFrame(stepBack);
        } else {
          swapAnim = null;
          onDone();
        }
      } else {
        requestAnimationFrame(step);
      }
    }
    requestAnimationFrame(step);
  }

  // ── Drawing ────────────────────────────────────────────────────────────────
  function drawGem(x, y, type, scale, alpha) {
    if (type < 0 || type >= GEM_TYPES) return;
    const g = GEM_COLORS[type];
    const s = CELL * 0.38 * (scale || 1);
    const cx = x + CELL / 2;
    const cy = y + CELL / 2;

    ctx.save();
    ctx.globalAlpha = alpha != null ? alpha : 1;

    // Glow
    ctx.shadowColor = g.fill;
    ctx.shadowBlur = 8;

    ctx.fillStyle = g.fill;
    ctx.strokeStyle = g.stroke;
    ctx.lineWidth = 2;

    switch (g.shape) {
      case 'circle':
        ctx.beginPath();
        ctx.arc(cx, cy, s, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        // Highlight
        ctx.fillStyle = g.light;
        ctx.beginPath();
        ctx.arc(cx - s * 0.25, cy - s * 0.25, s * 0.35, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'diamond':
        ctx.beginPath();
        ctx.moveTo(cx, cy - s);
        ctx.lineTo(cx + s, cy);
        ctx.lineTo(cx, cy + s);
        ctx.lineTo(cx - s, cy);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = g.light;
        ctx.beginPath();
        ctx.moveTo(cx, cy - s * 0.4);
        ctx.lineTo(cx + s * 0.4, cy);
        ctx.lineTo(cx, cy + s * 0.1);
        ctx.lineTo(cx - s * 0.2, cy);
        ctx.closePath();
        ctx.fill();
        break;

      case 'square':
        ctx.beginPath();
        ctx.rect(cx - s * 0.8, cy - s * 0.8, s * 1.6, s * 1.6);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = g.light;
        ctx.fillRect(cx - s * 0.5, cy - s * 0.5, s * 0.6, s * 0.6);
        break;

      case 'triangle':
        ctx.beginPath();
        ctx.moveTo(cx, cy - s);
        ctx.lineTo(cx + s, cy + s * 0.8);
        ctx.lineTo(cx - s, cy + s * 0.8);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = g.light;
        ctx.beginPath();
        ctx.moveTo(cx, cy - s * 0.5);
        ctx.lineTo(cx + s * 0.3, cy + s * 0.2);
        ctx.lineTo(cx - s * 0.3, cy + s * 0.2);
        ctx.closePath();
        ctx.fill();
        break;

      case 'star':
        drawStar(ctx, cx, cy, 5, s, s * 0.45);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = g.light;
        drawStar(ctx, cx, cy, 5, s * 0.5, s * 0.22);
        ctx.fill();
        break;

      case 'hexagon':
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = Math.PI / 3 * i - Math.PI / 6;
          const px = cx + Math.cos(a) * s;
          const py = cy + Math.sin(a) * s;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = g.light;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = Math.PI / 3 * i - Math.PI / 6;
          const px = cx + Math.cos(a) * s * 0.4 + s * 0.1;
          const py = cy + Math.sin(a) * s * 0.4 - s * 0.1;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        break;
    }
    ctx.restore();
  }

  function drawStar(ctx, cx, cy, points, outer, inner) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = (Math.PI * i) / points - Math.PI / 2;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function draw() {
    ctx.save();

    // Screen shake
    if (shakeTimer > 0) {
      const sx = (Math.random() - 0.5) * shakeTimer;
      const sy = (Math.random() - 0.5) * shakeTimer;
      ctx.translate(sx, sy);
      shakeTimer *= 0.85;
      if (shakeTimer < 0.5) shakeTimer = 0;
    }

    // Background
    ctx.fillStyle = '#12121a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid lines
    ctx.strokeStyle = '#1a1a2a';
    ctx.lineWidth = 1;
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(canvas.width, r * CELL); ctx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, canvas.height); ctx.stroke();
    }

    // Flash effect
    if (flashTimer > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flashTimer / 60})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      flashTimer--;
    }

    // Build a set of cells being removed
    const removing = new Set(removeAnims.map(a => a.row * COLS + a.col));

    // Build a map of fall animations for quick lookup
    const fallMap = {};
    fallAnims.forEach(a => { fallMap[a.row * COLS + a.col] = a; });

    // Draw gems
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const type = grid[r][c];
        if (type < 0) continue;

        let x = c * CELL;
        let y = r * CELL;
        let scale = 1;
        let alpha = 1;

        // Removal animation
        const remIdx = removing.has(r * COLS + c) ? removeAnims.findIndex(a => a.row === r && a.col === c) : -1;
        if (remIdx >= 0) {
          const p = EASE_OUT(removeAnims[remIdx].progress);
          scale = 1 - p;
          alpha = 1 - p;
          // Draw at center of cell during shrink
          const offset = (1 - scale) * CELL / 2;
          x += offset;
          y += offset;
        }

        // Fall animation
        const fall = fallMap[r * COLS + c];
        if (fall) {
          const p = EASE_OUT(fall.progress);
          y = fall.fromY + (fall.toY - fall.fromY) * p;
        }

        // Swap animation
        if (swapAnim) {
          if (r === swapAnim.r1 && c === swapAnim.c1) {
            const t = swapAnim.reverse ? EASE_IN_OUT(1 - swapAnim.progress) : EASE_IN_OUT(swapAnim.progress);
            x = swapAnim.c1 * CELL + (swapAnim.c2 - swapAnim.c1) * CELL * t;
            y = swapAnim.r1 * CELL + (swapAnim.r2 - swapAnim.r1) * CELL * t;
          } else if (r === swapAnim.r2 && c === swapAnim.c2) {
            const t = swapAnim.reverse ? EASE_IN_OUT(1 - swapAnim.progress) : EASE_IN_OUT(swapAnim.progress);
            x = swapAnim.c2 * CELL + (swapAnim.c1 - swapAnim.c2) * CELL * t;
            y = swapAnim.r2 * CELL + (swapAnim.r1 - swapAnim.r2) * CELL * t;
          }
        }

        drawGem(x, y, type, scale, alpha);
      }
    }

    // Selection highlight
    if (selected && !animating) {
      const sx = selected.col * CELL;
      const sy = selected.row * CELL;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ffdd00';
      ctx.shadowBlur = 12;
      ctx.strokeRect(sx + 2, sy + 2, CELL - 4, CELL - 4);
      ctx.shadowBlur = 0;
    }

    // Particles
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.life -= 0.025;
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    });
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  function getCell(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const col = Math.floor(x / CELL);
    const row = Math.floor(y / CELL);
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return null;
    return { row, col };
  }

  // Touch / mouse drag support
  let dragStart = null;
  let isDragging = false;

  canvas.addEventListener('mousedown', e => {
    if (animating) return;
    const cell = getCell(e);
    if (!cell) return;
    dragStart = cell;
    isDragging = false;
  });

  canvas.addEventListener('mousemove', e => {
    if (!dragStart || animating) return;
    isDragging = true;
  });

  canvas.addEventListener('mouseup', e => {
    if (animating) { dragStart = null; return; }
    const cell = getCell(e);
    if (!cell) { dragStart = null; return; }

    if (dragStart && isDragging && isAdjacent(dragStart.row, dragStart.col, cell.row, cell.col)) {
      trySwap(dragStart.row, dragStart.col, cell.row, cell.col);
    } else if (dragStart && !isDragging) {
      handleClick(cell);
    }
    dragStart = null;
    isDragging = false;
  });

  // Touch events
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    if (animating) return;
    const touch = e.touches[0];
    const cell = getCell(touch);
    if (!cell) return;
    dragStart = cell;
    isDragging = false;
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (!dragStart || animating) return;
    isDragging = true;
  }, { passive: false });

  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    if (animating) { dragStart = null; return; }
    const touch = e.changedTouches[0];
    const cell = getCell(touch);
    if (!cell) { dragStart = null; return; }

    if (dragStart && isDragging && isAdjacent(dragStart.row, dragStart.col, cell.row, cell.col)) {
      trySwap(dragStart.row, dragStart.col, cell.row, cell.col);
    } else if (dragStart && !isDragging) {
      handleClick(cell);
    }
    dragStart = null;
    isDragging = false;
  }, { passive: false });

  function handleClick(cell) {
    if (!selected) {
      selected = cell;
      sfxSelect();
    } else if (selected.row === cell.row && selected.col === cell.col) {
      selected = null;
    } else if (isAdjacent(selected.row, selected.col, cell.row, cell.col)) {
      trySwap(selected.row, selected.col, cell.row, cell.col);
      selected = null;
    } else {
      selected = cell;
      sfxSelect();
    }
  }

  function trySwap(r1, c1, r2, c2) {
    ensureAudio();
    selected = null;
    animating = true;
    sfxSwap();

    swapInGrid(r1, c1, r2, c2);
    const matched = findMatches();
    const valid = matched.size > 0;

    if (!valid) {
      // Swap back
      swapInGrid(r1, c1, r2, c2);
    } else {
      moves--;
      updateHUD();
    }

    animateSwap(r1, c1, r2, c2, valid, () => {
      if (valid) {
        processCascade();
      } else {
        animating = false;
      }
    });
  }

  // ── Message display ────────────────────────────────────────────────────────
  let msgTimeout;
  function showMessage(html, duration) {
    const el = document.getElementById('message');
    el.innerHTML = html;
    el.classList.add('show');
    clearTimeout(msgTimeout);
    if (duration > 0) {
      msgTimeout = setTimeout(() => el.classList.remove('show'), duration);
    }
  }

  function restartHandler() {
    document.getElementById('message').classList.remove('show');
    score = 0;
    moves = MOVE_LIMIT;
    level = 1;
    targetScore = 1000;
    selected = null;
    animating = false;
    particles = [];
    initGrid();
    updateHUD();
    // Make sure no initial matches
    while (findMatches().size > 0) initGrid();
    draw();
  }

  // ── Main render loop (for particles and idle animations) ───────────────────
  function mainLoop() {
    if (!animating) draw();
    requestAnimationFrame(mainLoop);
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  initGrid();
  while (findMatches().size > 0) initGrid();
  if (!hasValidMoves()) initGrid();
  updateHUD();
  draw();
  mainLoop();
})();
