(() => {
  'use strict';

  const canvas = document.getElementById('game');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const scoreEl = $('score'), bestEl = $('best'), killsEl = $('kills');
  const leaderboard = $('leaderboard'), overlay = $('overlay');
  const startButton = $('start-button'), pauseButton = $('pause-button');
  const nameInput = $('player-name'), statusEl = $('game-status');
  const mobileBoost = $('mobile-boost');
  const colors = ['#ff7179', '#5ab9ff', '#c57cff', '#ffb35d', '#ff70ce', '#53dfb9', '#e9df56', '#929bff'];
  const WORLD_W = 2600, WORLD_H = 1900;
  const POWERUPS = [
    { id: 'magnet', label: 'MAGNET', icon: '🧲' },
    { id: 'shield', label: 'SHIELD', icon: '🛡️' },
    { id: 'multiplier', label: '3× ORBS', icon: '✦' },
    { id: 'speed', label: '2× SPEED', icon: '⚡' }
  ];
  let width = 0, height = 0, dpr = 1, game = null, lastTime = 0;
  const keys = Object.create(null);

  let best = Number(localStorage.getItem('snake-clash-best') || 0);
  if (bestEl) bestEl.textContent = best;

  // Small live indicator for spawn protection and temporary lucky-block powers.
  const powerupHUD = document.createElement('div');
  powerupHUD.className = 'powerup-hud';
  powerupHUD.setAttribute('aria-live', 'polite');
  const hudStyle = document.createElement('style');
  hudStyle.textContent = `.powerup-hud{position:absolute;z-index:3;top:12px;right:12px;display:flex;flex-direction:column;align-items:flex-end;gap:6px;pointer-events:none}.powerup-chip{padding:6px 9px;border:1px solid #a5ff7270;border-radius:7px;background:#081421dd;color:#c9ffac;font:800 9px ui-monospace,monospace;letter-spacing:.06em;box-shadow:0 0 15px #a5ff7222}.powerup-chip.spawn{border-color:#62e8ee88;color:#a8faff}.lucky-toast{position:absolute;z-index:6;left:50%;top:16px;transform:translateX(-50%);padding:9px 13px;border:1px solid #f4cf67;border-radius:8px;background:#201b0eeF;color:#ffe895;font:800 10px ui-monospace,monospace;letter-spacing:.06em;pointer-events:none;opacity:0;transition:opacity .2s}.lucky-toast.visible{opacity:1}`;
  document.head.appendChild(hudStyle);
  const toast = document.createElement('div');
  toast.className = 'lucky-toast';
  toast.setAttribute('role', 'status');
  const canvasWrap = canvas.parentElement;
  if (canvasWrap) { canvasWrap.append(powerupHUD, toast); }
  let toastTimer;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }
  new ResizeObserver(resize).observe(canvas);

  const rand = (min, max) => min + Math.random() * (max - min);
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const distance2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

  function makeSnake(name, x, y, color, player = false) {
    const parts = [];
    for (let i = 0; i < 12; i++) parts.push({ x: x - i * 12, y });
    return { name, x, y, angle: 0, target: 0, color, player, parts, mass: 120, alive: true, think: 0 };
  }

  function addFood(x = rand(30, WORLD_W - 30), y = rand(30, WORLD_H - 30), color = colors[Math.floor(Math.random() * colors.length)], value = 1) {
    game.food.push({ x, y, color, value, phase: rand(0, Math.PI * 2) });
  }

  function spawnLuckyBlock() {
    if (!game || game.luckyBlocks.length >= 4) return;
    let x, y, attempts = 0;
    do {
      x = rand(70, WORLD_W - 70);
      y = rand(70, WORLD_H - 70);
      attempts++;
    } while (Math.hypot(x - game.player.x, y - game.player.y) < 280 && attempts < 50);
    game.luckyBlocks.push({ x, y, phase: rand(0, Math.PI * 2) });
  }

  function announcePowerup(powerup) {
    toast.textContent = `${powerup.icon} ${powerup.label} ACTIVATED · 10 SECONDS`;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2200);
  }

  function updatePowerupHUD() {
    if (!game) { powerupHUD.replaceChildren(); return; }
    const chips = [];
    const spawnLeft = Math.max(0, 3 - game.elapsed);
    if (spawnLeft > 0) chips.push(`<span class="powerup-chip spawn">🛡️ SPAWN SHIELD ${spawnLeft.toFixed(1)}s</span>`);
    for (const powerup of POWERUPS) {
      const left = (game.effects[powerup.id] || 0) - game.elapsed;
      if (left > 0) chips.push(`<span class="powerup-chip">${powerup.icon} ${powerup.label} ${left.toFixed(1)}s</span>`);
    }
    powerupHUD.innerHTML = chips.join('');
  }

  function start() {
    const name = (nameInput.value.trim() || 'Player').slice(0, 14);
    game = {
      state: 'playing',
      player: makeSnake(name, WORLD_W / 2, WORLD_H / 2, '#a5ff72', true),
      bots: [], food: [], luckyBlocks: [], luckySpawnTimer: 5,
      effects: { magnet: 0, shield: 0, multiplier: 0, speed: 0 },
      camera: { x: WORLD_W / 2, y: WORLD_H / 2 }, kills: 0, elapsed: 0
    };
    const botNames = ['Noodle', 'Zippy', 'Comet', 'Pickle', 'Mochi', 'Turbo', 'Wiggles', 'Ramen', 'Viper', 'Boba', 'Sizzle'];
    botNames.forEach((botName, i) => {
      let x, y, attempts = 0;
      do {
        x = rand(100, WORLD_W - 100);
        y = rand(100, WORLD_H - 100);
        attempts++;
      } while (Math.hypot(x - WORLD_W / 2, y - WORLD_H / 2) < 450 && attempts < 100);
      game.bots.push(makeSnake(botName, x, y, colors[i % colors.length]));
    });
    for (let i = 0; i < 210; i++) addFood();
    spawnLuckyBlock(); spawnLuckyBlock();
    overlay.classList.add('hidden');
    pauseButton.disabled = false;
    pauseButton.innerHTML = 'Pause <kbd>SPACE</kbd>';
    startButton.innerHTML = 'Start playing <span>→</span>';
    statusEl.textContent = 'Move mouse / finger to steer · WASD or arrows also work';
    lastTime = performance.now();
    updatePowerupHUD();
    requestAnimationFrame(frame);
  }

  function end(reason) {
    if (!game || game.state !== 'playing') return;
    game.state = 'over';
    const finalScore = Math.floor(game.player.mass);
    best = Math.max(best, finalScore);
    bestEl.textContent = best;
    localStorage.setItem('snake-clash-best', String(best));
    if (window.SnakeLeaderboard?.submitScore) window.SnakeLeaderboard.submitScore(game.player.name, finalScore);
    overlay.classList.remove('hidden');
    $('overlay-title').innerHTML = 'Run <span>over.</span>';
    $('overlay-message').textContent = `${reason} You reached ${finalScore} mass and ${game.kills} eliminations.`;
    startButton.innerHTML = 'Play again <span>↗</span>';
    pauseButton.disabled = true;
    updatePowerupHUD();
  }

  function steerTo(clientX, clientY) {
    if (!game || game.state !== 'playing') return;
    const rect = canvas.getBoundingClientRect();
    const targetX = game.camera.x + (clientX - rect.left - width / 2);
    const targetY = game.camera.y + (clientY - rect.top - height / 2);
    game.player.target = Math.atan2(targetY - game.player.y, targetX - game.player.x);
  }

  function moveSnake(snake, dt, isPlayer) {
    if (!snake.alive) return;
    if (!isPlayer) {
      snake.think -= dt;
      if (snake.think <= 0) {
        snake.think = rand(.5, 1.3);
        let nearest = null, nearestD = Infinity;
        for (const food of game.food) {
          const d = distance2(snake, food);
          if (d < nearestD) { nearestD = d; nearest = food; }
        }
        if (nearest) snake.target = Math.atan2(nearest.y - snake.y, nearest.x - snake.x);
      }
    }
    const diff = Math.atan2(Math.sin(snake.target - snake.angle), Math.cos(snake.target - snake.angle));
    snake.angle += clamp(diff, -3.2 * dt, 3.2 * dt);
    const boosting = isPlayer && (keys.Space || keys.Shift || mobileBoost?.dataset.down === '1') && snake.mass > 60;
    const powerSpeed = isPlayer && game.effects.speed > game.elapsed ? 2 : 1;
    const speed = (boosting ? 220 : 155) * (isPlayer ? powerSpeed : .72);
    if (boosting) snake.mass = Math.max(60, snake.mass - dt * 12);
    snake.x += Math.cos(snake.angle) * speed * dt;
    snake.y += Math.sin(snake.angle) * speed * dt;
    snake.parts.unshift({ x: snake.x, y: snake.y });
    const desiredParts = Math.max(12, Math.floor(snake.mass / 10));
    while (snake.parts.length > desiredParts) snake.parts.pop();

    if (snake.x < 22 || snake.y < 22 || snake.x > WORLD_W - 22 || snake.y > WORLD_H - 22) {
      if (isPlayer) end('You hit the arena wall.'); else eliminate(snake);
      return;
    }
    for (let i = 0; i < game.food.length; i++) {
      const food = game.food[i];
      if (distance2(snake, food) < 20 * 20) {
        const multiplier = isPlayer && game.effects.multiplier > game.elapsed ? 3 : 1;
        snake.mass += food.value * 2.7 * multiplier;
        game.food.splice(i, 1);
        addFood(food.x + rand(-10, 10), food.y + rand(-10, 10), food.color);
        break;
      }
    }
  }

  function eliminate(snake) {
    if (!snake.alive) return;
    snake.alive = false;
    for (let i = 2; i < snake.parts.length; i += 3) addFood(snake.parts[i].x, snake.parts[i].y, snake.color, 2);
    if (snake.player) game.kills++;
  }

  function applyMagnet(dt) {
    if (game.effects.magnet <= game.elapsed) return;
    const p = game.player;
    for (const food of game.food) {
      const dx = p.x - food.x, dy = p.y - food.y;
      const d = Math.hypot(dx, dy);
      if (d > 12 && d < 270) {
        const travel = Math.min(d - 12, 260 * dt);
        food.x += dx / d * travel;
        food.y += dy / d * travel;
      }
    }
  }

  function collectLuckyBlocks() {
    const p = game.player;
    for (let i = game.luckyBlocks.length - 1; i >= 0; i--) {
      const block = game.luckyBlocks[i];
      if (distance2(p, block) < 30 * 30) {
        const powerup = POWERUPS[Math.floor(Math.random() * POWERUPS.length)];
        game.effects[powerup.id] = game.elapsed + 10;
        game.luckyBlocks.splice(i, 1);
        announcePowerup(powerup);
      }
    }
  }

  function collisions() {
    const player = game.player;
    const protectedNow = game.elapsed < 3 || game.effects.shield > game.elapsed;
    // Player can still take out a rival by running into its body.
    for (const bot of game.bots) {
      if (!bot.alive) continue;
      for (let i = 3; i < bot.parts.length; i++) {
        if (distance2(player, bot.parts[i]) < 15 * 15) { eliminate(bot); player.mass += 14; break; }
      }
    }
    // Spawn shield and the lucky-block shield prevent both enemy and self collisions.
    if (protectedNow) return;
    for (const bot of game.bots) {
      if (!bot.alive) continue;
      for (let i = 8; i < player.parts.length; i++) {
        if (distance2(bot, player.parts[i]) < 13 * 13) { end('A rival caught you.'); return; }
      }
    }
    for (let i = 9; i < player.parts.length; i++) {
      if (distance2(player, player.parts[i]) < 10 * 10) { end('You tangled with yourself.'); return; }
    }
  }

  function update(dt) {
    if (!game || game.state !== 'playing') return;
    game.elapsed += dt;
    game.luckySpawnTimer -= dt;
    if (game.luckySpawnTimer <= 0) {
      if (game.luckyBlocks.length < 4) spawnLuckyBlock();
      game.luckySpawnTimer = rand(7, 12);
    }
    const p = game.player;
    let dx = 0, dy = 0;
    if (keys.ArrowUp || keys.w || keys.W) dy--;
    if (keys.ArrowDown || keys.s || keys.S) dy++;
    if (keys.ArrowLeft || keys.a || keys.A) dx--;
    if (keys.ArrowRight || keys.d || keys.D) dx++;
    if (dx || dy) p.target = Math.atan2(dy, dx);
    moveSnake(p, dt, true);
    game.bots.forEach(bot => moveSnake(bot, dt, false));
    if (!game || game.state !== 'playing') return;
    applyMagnet(dt);
    collectLuckyBlocks();
    collisions();
    if (game.state !== 'playing') return;
    while (game.food.length < 210) addFood();
    game.camera.x += (p.x - game.camera.x) * Math.min(1, dt * 4);
    game.camera.y += (p.y - game.camera.y) * Math.min(1, dt * 4);
    scoreEl.textContent = Math.floor(p.mass);
    killsEl.textContent = game.kills;
    best = Math.max(best, Math.floor(p.mass));
    bestEl.textContent = best;
    localStorage.setItem('snake-clash-best', String(best));
    showLeaders();
    updatePowerupHUD();
  }

  function showLeaders() {
    const entries = [game.player, ...game.bots.filter(bot => bot.alive)]
      .sort((a, b) => b.mass - a.mass).slice(0, 5);
    leaderboard.innerHTML = entries.map((snake, i) =>
      `<li class="${snake.player ? 'you' : ''}"><span>${i + 1}. ${escapeText(snake.name)}${snake.player ? ' (you)' : ''}</span><b>${Math.floor(snake.mass)}</b></li>`
    ).join('');
  }
  function escapeText(text) {
    return String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function drawSnake(snake) {
    if (!snake.alive || !snake.parts.length) return;
    ctx.beginPath();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = snake.color; ctx.lineWidth = 17;
    for (let i = 0; i < snake.parts.length; i++) {
      const part = snake.parts[i];
      if (i === 0) ctx.moveTo(part.x, part.y); else ctx.lineTo(part.x, part.y);
    }
    ctx.stroke();
    ctx.fillStyle = '#f0ffd7';
    ctx.beginPath(); ctx.arc(snake.x, snake.y, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#13222b';
    ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(snake.name, snake.x, snake.y - 17);
  }

  function drawLuckyBlock(block) {
    const bob = Math.sin(game.elapsed * 3 + block.phase) * 4;
    ctx.save();
    ctx.translate(block.x, block.y + bob);
    ctx.shadowColor = '#ffc94d'; ctx.shadowBlur = 22;
    ctx.fillStyle = '#ffcb4d'; ctx.strokeStyle = '#fff0a6'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-13, -13, 26, 26, 6); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0; ctx.fillStyle = '#5a3900'; ctx.font = 'bold 17px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('?', 0, 1);
    ctx.restore();
  }

  function draw() {
    if (!ctx || !width || !height) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#081421'; ctx.fillRect(0, 0, width, height);
    if (!game) return;
    ctx.save();
    ctx.translate(width / 2 - game.camera.x, height / 2 - game.camera.y);
    ctx.fillStyle = '#081421'; ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx.strokeStyle = 'rgba(75,113,133,.25)'; ctx.lineWidth = 1;
    for (let x = 0; x <= WORLD_W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD_H); ctx.stroke(); }
    for (let y = 0; y <= WORLD_H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD_W, y); ctx.stroke(); }
    ctx.strokeStyle = '#ff6674'; ctx.lineWidth = 7; ctx.strokeRect(4, 4, WORLD_W - 8, WORLD_H - 8);
    for (const food of game.food) {
      ctx.fillStyle = food.color; ctx.shadowColor = food.color; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(food.x, food.y, 3.4 + food.value * .7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0;
    game.luckyBlocks.forEach(drawLuckyBlock);
    game.bots.forEach(drawSnake); drawSnake(game.player);
    const shieldActive = game.elapsed < 3 || game.effects.shield > game.elapsed;
    if (shieldActive) {
      ctx.beginPath(); ctx.arc(game.player.x, game.player.y, 25 + Math.sin(game.elapsed * 9) * 2, 0, Math.PI * 2);
      ctx.strokeStyle = game.effects.shield > game.elapsed ? '#c39aff' : '#62e8ee';
      ctx.lineWidth = 3; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 18; ctx.stroke(); ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  function frame(time) {
    if (!game || game.state !== 'playing') return;
    const dt = Math.min(.04, (time - lastTime) / 1000 || 0);
    lastTime = time;
    update(dt); draw();
    if (game && game.state === 'playing') requestAnimationFrame(frame);
  }

  function togglePause() {
    if (!game) return;
    if (game.state === 'playing') {
      game.state = 'paused'; overlay.classList.remove('hidden');
      $('overlay-title').innerHTML = 'Take a <span>breather.</span>';
      $('overlay-message').textContent = 'Your run is paused. Start playing to resume.';
      startButton.textContent = 'Resume run';
      pauseButton.innerHTML = 'Resume <kbd>SPACE</kbd>';
    } else if (game.state === 'paused') {
      game.state = 'playing'; overlay.classList.add('hidden');
      pauseButton.innerHTML = 'Pause <kbd>SPACE</kbd>';
      lastTime = performance.now(); requestAnimationFrame(frame);
    }
  }

  startButton.addEventListener('click', () => {
    if (game?.state === 'paused') { togglePause(); return; }
    start();
  });
  nameInput.addEventListener('keydown', event => { if (event.key === 'Enter') start(); });
  pauseButton.addEventListener('click', togglePause);
  window.addEventListener('keydown', event => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Shift'].includes(event.key)) event.preventDefault();
    keys[event.key] = true;
    if (event.code === 'Space' && game?.state === 'paused') togglePause();
  });
  window.addEventListener('keyup', event => { keys[event.key] = false; });
  canvas.addEventListener('pointermove', event => steerTo(event.clientX, event.clientY));
  canvas.addEventListener('pointerdown', event => steerTo(event.clientX, event.clientY));
  if (mobileBoost) {
    mobileBoost.addEventListener('pointerdown', event => { event.preventDefault(); mobileBoost.dataset.down = '1'; });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => mobileBoost.addEventListener(type, () => { mobileBoost.dataset.down = '0'; }));
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) keys.Space = false; });
  resize();
})();
