/**
 * home.js – Animated canvas previews for the arcade homepage.
 */
(() => {
  const fps = 10;
  let frame = 0;

  // ── Tank preview ─────────────────────────────────────────────────────────────
  function drawTankPreview(ctx, W, H) {
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, W, H);

    const ts = 16;
    // Simple brick pattern
    for (let r = 0; r < H / ts; r++) {
      for (let c = 0; c < W / ts; c++) {
        if (Math.random() < 0.18) {
          ctx.fillStyle = '#b83000';
          ctx.fillRect(c * ts, r * ts, ts, ts);
          ctx.fillStyle = '#e85020';
          ctx.fillRect(c * ts + 1, r * ts + 1, ts - 2, ts / 2 - 1);
          ctx.fillStyle = '#7a2000';
          ctx.fillRect(c * ts, r * ts + ts / 2, ts, 1);
        }
      }
    }

    // Player tank (yellow)
    const px = W / 2, py = H * 0.68;
    drawMiniTank(ctx, px, py, 0, '#e0d800', '#887700', true);

    // Enemy tanks (grey)
    const enemies = [
      { x: W * 0.25, y: 28, dir: 2 },
      { x: W * 0.50, y: 22, dir: 2 },
      { x: W * 0.75, y: 30, dir: 2 },
    ];
    enemies.forEach(e => drawMiniTank(ctx, e.x, e.y, e.dir, '#888', '#444', false));

    // Bullet trail
    const bOff = (frame * 6) % (H * 0.55);
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(px - 1, py - bOff - 8, 3, 8);
    // Explosion at top
    if (bOff > H * 0.48) {
      ctx.fillStyle = '#ff6600';
      ctx.beginPath(); ctx.arc(px, py - bOff, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffdd00';
      ctx.beginPath(); ctx.arc(px, py - bOff, 6, 0, Math.PI * 2); ctx.fill();
    }

    // Label
    ctx.fillStyle = 'rgba(255,220,0,0.9)';
    ctx.font = 'bold 11px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TANK BATTLE', W / 2, H - 12);
  }

  function drawMiniTank(ctx, x, y, dir, body, track, isPlayer) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate([0, Math.PI / 2, Math.PI, -Math.PI / 2][dir]);
    ctx.fillStyle = track;
    ctx.fillRect(-9, -8, 4, 16);
    ctx.fillRect(5, -8, 4, 16);
    ctx.fillStyle = body;
    ctx.fillRect(-5, -6, 10, 12);
    if (isPlayer) ctx.fillStyle = '#fff888';
    else          ctx.fillStyle = '#666';
    ctx.fillRect(-2, -10, 4, 10);
    ctx.restore();
  }

  // ── Snake preview ────────────────────────────────────────────────────────────
  function drawSnakePreview(ctx, W, H) {
    ctx.fillStyle = '#0a1a0a';
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = '#0f2f0f';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < W; x += 14) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 14) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // Snake body
    const segments = 14;
    const speed = 0.06;
    for (let i = 0; i < segments; i++) {
      const t = frame * speed - i * 0.35;
      const sx = W * 0.5 + Math.sin(t) * (W * 0.28);
      const sy = 20 + (i / segments) * (H - 50);
      ctx.fillStyle = i === 0 ? '#44ff44' : '#22aa22';
      ctx.fillRect(Math.round(sx / 14) * 14, Math.round(sy / 14) * 14, 12, 12);
    }

    // Food
    const fx = W * 0.7, fy = H * 0.3;
    ctx.fillStyle = '#ff3333';
    ctx.fillRect(fx, fy, 12, 12);

    ctx.fillStyle = '#44ff44';
    ctx.font = 'bold 11px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SNAKE', W / 2, H - 12);
  }

  // ── Tetris preview ───────────────────────────────────────────────────────────
  function drawTetrisPreview(ctx, W, H) {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = '#111133';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < W; x += 16) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 16) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // Stacked blocks at bottom
    const colors = ['#00eeee', '#dddd00', '#aa00ee', '#ee7700', '#0000ee', '#ee0000', '#00ee00'];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < Math.floor(W / 16); c++) {
        if (Math.sin(r * 7 + c * 3) > 0.1) {
          ctx.fillStyle = colors[(r + c) % colors.length];
          ctx.fillRect(c * 16 + 1, H - (r + 1) * 16 + 1, 14, 14);
        }
      }
    }

    // Falling piece (animated)
    const py = (frame * 4) % (H * 0.55) + 20;
    const colors2 = ['#00eeee', '#dddd00', '#aa00ee'];
    const ci = Math.floor(frame / 8) % colors2.length;
    ctx.fillStyle = colors2[ci];
    // T-piece
    ctx.fillRect(W / 2 - 8, py, 16, 16);
    ctx.fillRect(W / 2 - 24, py + 16, 16, 16);
    ctx.fillRect(W / 2 - 8, py + 16, 16, 16);
    ctx.fillRect(W / 2 + 8, py + 16, 16, 16);

    ctx.fillStyle = '#dddd00';
    ctx.font = 'bold 11px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TETRIS', W / 2, H - 12);
  }

  // ── Space Invaders preview ───────────────────────────────────────────────────
  function drawInvadersPreview(ctx, W, H) {
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, W, H);

    // Stars
    for (let i = 0; i < 30; i++) {
      const sx = (i * 47 + frame * 0.3) % W;
      const sy = (i * 31) % (H - 30);
      ctx.fillStyle = `rgba(255,255,255,${0.2 + Math.sin(frame * 0.2 + i) * 0.3})`;
      ctx.fillRect(sx, sy, 1, 1);
    }

    // Invader grid (animated horizontal movement)
    const xOff = Math.sin(frame * 0.12) * 18;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 6; c++) {
        const ix = 30 + c * 38 + xOff;
        const iy = 24 + r * 32;
        ctx.fillStyle = ['#44ff44', '#44ccff', '#ff44ff'][r];
        // Simple pixel invader
        ctx.fillRect(ix, iy, 20, 14);
        ctx.fillStyle = '#000';
        ctx.fillRect(ix + 3, iy + 3, 4, 4);
        ctx.fillRect(ix + 13, iy + 3, 4, 4);
        ctx.fillRect(ix + 6, iy + 8, 8, 3);
      }
    }

    // Player ship at bottom
    const shipX = W / 2 + Math.sin(frame * 0.15) * 50;
    ctx.fillStyle = '#44ff44';
    ctx.fillRect(shipX - 8, H - 36, 16, 10);
    ctx.fillRect(shipX - 2, H - 44, 4, 8);

    // Laser
    ctx.fillStyle = '#ff4444';
    const laserY = (H - 44 - frame * 5) % (H * 0.6) + 10;
    ctx.fillRect(shipX - 1, laserY, 2, 12);

    ctx.fillStyle = '#44ccff';
    ctx.font = 'bold 9px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SPACE INVADERS', W / 2, H - 12);
  }

  // ── Match-3 preview ─────────────────────────────────────────────────────────
  function drawMatch3Preview(ctx, W, H) {
    ctx.fillStyle = '#12121a';
    ctx.fillRect(0, 0, W, H);

    const cols = 7, rows = 5;
    const cellW = W / cols, cellH = (H - 28) / rows;
    const colors = ['#ff4444', '#44cc44', '#4488ff', '#ffaa00', '#cc44ff', '#ff66aa'];
    const shapes = ['circle', 'diamond', 'square', 'triangle', 'star', 'hexagon'];

    // Seed-based grid for stable pattern
    const grid = [];
    for (let r = 0; r < rows; r++) {
      grid[r] = [];
      for (let c = 0; c < cols; c++) {
        grid[r][c] = Math.floor(Math.abs(Math.sin(r * 13 + c * 7)) * colors.length);
      }
    }

    // Draw gems with subtle animation offset
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = grid[r][c];
        const cx = c * cellW + cellW / 2;
        const bobY = r * cellH + cellH / 2 + 14 + Math.sin(frame * 0.08 + r + c) * 2;
        const s = Math.min(cellW, cellH) * 0.34;

        ctx.save();
        ctx.shadowColor = colors[idx];
        ctx.shadowBlur = 6;
        ctx.fillStyle = colors[idx];
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1.5;

        switch (shapes[idx]) {
          case 'circle':
            ctx.beginPath(); ctx.arc(cx, bobY, s, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); break;
          case 'diamond':
            ctx.beginPath();
            ctx.moveTo(cx, bobY - s); ctx.lineTo(cx + s, bobY);
            ctx.lineTo(cx, bobY + s); ctx.lineTo(cx - s, bobY); ctx.closePath();
            ctx.fill(); ctx.stroke(); break;
          case 'square':
            ctx.fillRect(cx - s * 0.75, bobY - s * 0.75, s * 1.5, s * 1.5);
            ctx.strokeRect(cx - s * 0.75, bobY - s * 0.75, s * 1.5, s * 1.5); break;
          case 'triangle':
            ctx.beginPath();
            ctx.moveTo(cx, bobY - s); ctx.lineTo(cx + s, bobY + s * 0.7);
            ctx.lineTo(cx - s, bobY + s * 0.7); ctx.closePath();
            ctx.fill(); ctx.stroke(); break;
          case 'star':
            ctx.beginPath();
            for (let i = 0; i < 10; i++) {
              const r2 = i % 2 === 0 ? s : s * 0.4;
              const a = Math.PI * i / 5 - Math.PI / 2;
              i === 0 ? ctx.moveTo(cx + Math.cos(a) * r2, bobY + Math.sin(a) * r2)
                       : ctx.lineTo(cx + Math.cos(a) * r2, bobY + Math.sin(a) * r2);
            }
            ctx.closePath(); ctx.fill(); ctx.stroke(); break;
          case 'hexagon':
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
              const a = Math.PI / 3 * i - Math.PI / 6;
              const px = cx + Math.cos(a) * s, py = bobY + Math.sin(a) * s;
              i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
            }
            ctx.closePath(); ctx.fill(); ctx.stroke(); break;
        }

        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath(); ctx.arc(cx - s * 0.2, bobY - s * 0.2, s * 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }

    // Animated match flash
    const flashPhase = (frame % 40) / 40;
    if (flashPhase < 0.3) {
      const row = 2;
      for (let c = 2; c < 5; c++) {
        ctx.fillStyle = `rgba(255,255,255,${(1 - flashPhase / 0.3) * 0.4})`;
        ctx.fillRect(c * cellW, row * cellH + 14, cellW, cellH);
      }
    }

    // Label
    ctx.fillStyle = '#ff66aa';
    ctx.font = 'bold 11px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('MATCH 3', W / 2, H - 6);
  }

  // ── Render loop ──────────────────────────────────────────────────────────────
  function render() {
    frame++;
    const previews = [
      { id: 'preview-tank',     fn: drawTankPreview },
      { id: 'preview-match3',   fn: drawMatch3Preview },
      { id: 'preview-snake',    fn: drawSnakePreview },
      { id: 'preview-tetris',   fn: drawTetrisPreview },
      { id: 'preview-invaders', fn: drawInvadersPreview },
    ];
    previews.forEach(p => {
      const canvas = document.getElementById(p.id);
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      p.fn(ctx, canvas.width, canvas.height);
    });
  }

  setInterval(render, 1000 / fps);
  render();
})();
