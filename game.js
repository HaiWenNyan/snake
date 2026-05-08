(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayMsg = document.getElementById('overlayMsg');
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const restartBtn = document.getElementById('restartBtn');

  const GRID = 20; // 20x20 grid
  const BEST_KEY = 'snake.best.v1';

  let cell = canvas.width / GRID;
  let snake, dir, nextDir, food, score, best, alive, paused, started;
  let lastTick = 0;
  const stepMs = 130;

  // 图片资源
  const imgHead = new Image();
  const imgHeadEat = new Image();
  const imgFood = new Image();
  imgHead.src = 'head.jpg';
  imgHeadEat.src = 'head_eat.jpg';
  imgFood.src = 'food.jpg';
  let eatUntil = 0; // 同顿饭后头部表情切换结束时间戳
  // 图片加载完触发一次重绘
  [imgHead, imgHeadEat, imgFood].forEach(im => im.addEventListener('load', () => draw()));

  best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0;
  bestEl.textContent = best;

  function resizeCanvas() {
    // Match canvas pixel size to its CSS size for crisp rendering
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = Math.round(rect.width * dpr);
    if (canvas.width !== size) {
      canvas.width = size;
      canvas.height = size;
    }
    cell = canvas.width / GRID;
    draw();
  }

  function reset() {
    snake = [
      { x: 9, y: 10 },
      { x: 8, y: 10 },
      { x: 7, y: 10 },
    ];
    dir = { x: 1, y: 0 };
    nextDir = dir;
    score = 0;
    alive = true;
    paused = false;
    placeFood();
    updateScore();
  }

  function placeFood() {
    while (true) {
      const f = {
        x: Math.floor(Math.random() * GRID),
        y: Math.floor(Math.random() * GRID),
      };
      if (!snake.some(s => s.x === f.x && s.y === f.y)) {
        food = f;
        return;
      }
    }
  }

  function updateScore() {
    scoreEl.textContent = score;
    if (score > best) {
      best = score;
      bestEl.textContent = best;
      localStorage.setItem(BEST_KEY, String(best));
    }
  }

  function tick(ts) {
    if (!started) return;
    if (!lastTick) lastTick = ts;
    const elapsed = ts - lastTick;
    if (!paused && alive && elapsed >= stepMs) {
      lastTick = ts;
      step();
    }
    draw();
    requestAnimationFrame(tick);
  }

  function step() {
    // Apply queued direction (prevent reversing)
    if ((nextDir.x !== -dir.x || nextDir.y !== -dir.y)) {
      dir = nextDir;
    }
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    // Wall collision
    if (head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID) {
      return gameOver();
    }
    // Self collision (skip tail tip because it will move)
    for (let i = 0; i < snake.length - 1; i++) {
      if (snake[i].x === head.x && snake[i].y === head.y) return gameOver();
    }

    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score += 10;
      updateScore();
      eatUntil = performance.now() + 350; // 切换为睹眼头像 0.35s
      placeFood();
    } else {
      snake.pop();
    }
  }

  function gameOver() {
    alive = false;
    overlayTitle.textContent = '游戏结束';
    overlayMsg.textContent = `得分 ${score} · 最高 ${best}`;
    startBtn.textContent = '再来一次';
    overlay.classList.remove('hidden');
  }

  function draw() {
    const W = canvas.width;
    ctx.clearRect(0, 0, W, W);

    // Grid background subtle
    ctx.fillStyle = '#fff5f9';
    ctx.fillRect(0, 0, W, W);
    ctx.strokeStyle = 'rgba(255, 126, 182, 0.18)';
    ctx.lineWidth = 1;
    for (let i = 1; i < GRID; i++) {
      const p = Math.round(i * cell) + 0.5;
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, W); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(W, p); ctx.stroke();
    }

    // Food
    drawFood(food.x, food.y);

    // Snake body (从尾到颈，最后画头部避免被身体遮住)
    for (let i = snake.length - 1; i >= 1; i--) {
      const s = snake[i];
      const t = i / Math.max(snake.length - 1, 1);
      const color = lerpColor('#ff7eb6', '#ffb3d1', t);
      drawCell(s.x, s.y, color, false);
    }
    // Snake head (放大 1.4倍 + 图片)
    if (snake.length > 0) drawHead(snake[0]);
  }

  function drawHead(s) {
    const eating = performance.now() < eatUntil;
    const img = eating ? imgHeadEat : imgHead;
    const scale = 1.4;
    const sz = cell * scale;
    const cx = s.x * cell + cell / 2;
    const cy = s.y * cell + cell / 2;
    const px = cx - sz / 2;
    const py = cy - sz / 2;
    if (img.complete && img.naturalWidth > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, sz / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      // 按短边 cover
      const iw = img.naturalWidth, ih = img.naturalHeight;
      const ratio = Math.max(sz / iw, sz / ih);
      const dw = iw * ratio, dh = ih * ratio;
      ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
      ctx.restore();
      // 描边
      ctx.lineWidth = Math.max(1.5, cell * 0.08);
      ctx.strokeStyle = '#ff4d8d';
      ctx.beginPath();
      ctx.arc(cx, cy, sz / 2, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // 图片未加载时的后备
      drawCell(s.x, s.y, '#ff7eb6', true);
    }
  }

  function drawCell(x, y, color, head) {
    const pad = Math.max(1, cell * 0.08);
    const px = x * cell + pad;
    const py = y * cell + pad;
    const sz = cell - pad * 2;
    const r = Math.min(sz * 0.28, 8);
    roundRect(px, py, sz, sz, r);
    ctx.fillStyle = color;
    ctx.fill();
    if (head) {
      // Eyes
      ctx.fillStyle = '#0b1226';
      const ex = px + sz * 0.28, ey = py + sz * 0.32;
      const ex2 = px + sz * 0.72;
      const er = Math.max(1.2, sz * 0.08);
      ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(ex2, ey, er, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawFood(x, y) {
    const cx = x * cell + cell / 2;
    const cy = y * cell + cell / 2;
    const r = cell * 0.62; // 比原来的 0.36 大约 1.7 倍
    if (imgFood.complete && imgFood.naturalWidth > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      const iw = imgFood.naturalWidth, ih = imgFood.naturalHeight;
      const ratio = Math.max((r * 2) / iw, (r * 2) / ih);
      const dw = iw * ratio, dh = ih * ratio;
      ctx.drawImage(imgFood, cx - dw / 2, cy - dh / 2, dw, dh);
      ctx.restore();
      ctx.lineWidth = Math.max(1.5, cell * 0.08);
      ctx.strokeStyle = '#fb7185';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const grd = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.2, cx, cy, r);
      grd.addColorStop(0, '#fb7185');
      grd.addColorStop(1, '#e11d48');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function lerpColor(a, b, t) {
    const ca = hexToRgb(a), cb = hexToRgb(b);
    const r = Math.round(ca.r + (cb.r - ca.r) * t);
    const g = Math.round(ca.g + (cb.g - ca.g) * t);
    const bl = Math.round(ca.b + (cb.b - ca.b) * t);
    return `rgb(${r},${g},${bl})`;
  }
  function hexToRgb(h) {
    const x = h.replace('#', '');
    return { r: parseInt(x.slice(0, 2), 16), g: parseInt(x.slice(2, 4), 16), b: parseInt(x.slice(4, 6), 16) };
  }

  function setDir(d) {
    const map = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    };
    const nd = map[d];
    if (!nd) return;
    // Prevent immediate reverse
    if (nd.x === -dir.x && nd.y === -dir.y) return;
    nextDir = nd;
  }

  // Keyboard
  window.addEventListener('keydown', (e) => {
    const k = e.key;
    if (['ArrowUp', 'w', 'W'].includes(k)) { setDir('up'); e.preventDefault(); }
    else if (['ArrowDown', 's', 'S'].includes(k)) { setDir('down'); e.preventDefault(); }
    else if (['ArrowLeft', 'a', 'A'].includes(k)) { setDir('left'); e.preventDefault(); }
    else if (['ArrowRight', 'd', 'D'].includes(k)) { setDir('right'); e.preventDefault(); }
    else if (k === ' ') { togglePause(); e.preventDefault(); }
  }, { passive: false });

  // D-pad buttons
  document.querySelectorAll('.dbtn').forEach(btn => {
    const d = btn.dataset.dir;
    const handler = (e) => { e.preventDefault(); setDir(d); };
    btn.addEventListener('touchstart', handler, { passive: false });
    btn.addEventListener('mousedown', handler);
  });

  // Swipe controls on canvas
  let touchStart = null;
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    touchStart = { x: t.clientX, y: t.clientY, time: Date.now() };
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    if (!touchStart) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    const threshold = 18;
    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;
    if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 'right' : 'left');
    else setDir(dy > 0 ? 'down' : 'up');
    touchStart = { x: t.clientX, y: t.clientY, time: Date.now() };
  }, { passive: true });
  canvas.addEventListener('touchend', () => { touchStart = null; }, { passive: true });

  // Mouse swipe (desktop dev)
  let mouseStart = null;
  canvas.addEventListener('mousedown', (e) => { mouseStart = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('mouseup', (e) => {
    if (!mouseStart) return;
    const dx = e.clientX - mouseStart.x, dy = e.clientY - mouseStart.y;
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) { mouseStart = null; return; }
    if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 'right' : 'left');
    else setDir(dy > 0 ? 'down' : 'up');
    mouseStart = null;
  });

  function togglePause() {
    if (!started || !alive) return;
    paused = !paused;
    pauseBtn.textContent = paused ? '▶' : '⏸';
    if (paused) {
      overlayTitle.textContent = '已暂停';
      overlayMsg.textContent = '点击继续';
      startBtn.textContent = '继续';
      overlay.classList.remove('hidden');
    } else {
      overlay.classList.add('hidden');
      lastTick = 0;
    }
  }
  pauseBtn.addEventListener('click', togglePause);

  function startGame() {
    if (!alive || !started) {
      reset();
    }
    paused = false;
    started = true;
    pauseBtn.textContent = '⏸';
    overlay.classList.add('hidden');
    lastTick = 0;
    requestAnimationFrame(tick);
  }
  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', () => { started = false; startGame(); });

  // Init
  reset();
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('orientationchange', resizeCanvas);
  // Defer to next frame for layout
  requestAnimationFrame(() => { resizeCanvas(); draw(); });

  // Prevent pull-to-refresh / scroll on iOS
  document.addEventListener('touchmove', (e) => {
    if (e.target === canvas) e.preventDefault();
  }, { passive: false });
})();
