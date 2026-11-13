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
  let width = 0, height = 0, dpr = 1, game = null, lastTime = 0;
  const keys = Object.create(null);

  let best = Number(localStorage.getItem('snake-clash-best') || 0);
  if (bestEl) bestEl.textContent = best;

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

  function start() {
    const name = (nameInput.value.trim() || 'Player').slice(0, 14);
    game = {
      state: 'playing',
      player: makeSnake(name, WORLD_W / 2, WORLD_H / 2, '#a5ff72', true),
      bots: [], food: [], camera: { x: WORLD_W / 2, y: WORLD_H / 2 }, kills: 0, elapsed: 0
    };
    // Keep bots away from the player at spawn so a random placement cannot cause an instant collision.
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
    overlay.classList.add('hidden');
    pauseButton.disabled = false;
    pauseButton.innerHTML = 'Pause <kbd>SPACE</kbd>';
    statusEl.textContent = 'Move mouse / finger to steer · WASD or arrows also work';
    lastTime = performance.now();
    requestAnimationFrame(frame);
  }

  function end(reason) {
    if (!game || game.state !== 'playing') return;
    game.state = 'over';
    const finalScore = Math.floor(game.player.mass);
    best = Math.max(best, finalScore);
    bestEl.textContent = best;
    localStorage.setItem('snake-clash-best', String(best));
    if (window.SnakeLeaderboard?.submitScore) {
      window.SnakeLeaderboard.submitScore(game.player.name, finalScore);
    }
    overlay.classList.remove('hidden');
    $('overlay-title').innerHTML = 'Run <span>over.</span>';
    $('overlay-message').textContent = `${reason} You reached ${finalScore} mass and ${game.kills} eliminations.`;
    startButton.innerHTML = 'Play again <span>↗</span>';
    pauseButton.disabled = true;
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
    let diff = Math.atan2(Math.sin(snake.target - snake.angle), Math.cos(snake.target - snake.angle));
    snake.angle += clamp(diff, -3.2 * dt, 3.2 * dt);
    const boosting = isPlayer && (keys.Space || keys.Shift || mobileBoost?.dataset.down === '1') && snake.mass > 60;
    const speed = (boosting ? 220 : 155) * (isPlayer ? 1 : .72);
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
        snake.mass += food.value * 2.7;
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

  function collisions() {
    const player = game.player;
    for (const bot of game.bots) {
      if (!bot.alive) continue;
      for (let i = 3; i < bot.parts.length; i++) {
        if (distance2(player, bot.parts[i]) < 15 * 15) { eliminate(bot); player.mass += 14; break; }
      }
    }
    // Give the player a brief start grace period and ignore the nearest body segments,
    // avoiding unfair deaths while the snake is still short and turning out of spawn.
    if (game.elapsed < 3) return;
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
    const p = game.player;
    let dx = 0, dy = 0;
    if (keys.ArrowUp || keys.w || keys.W) dy--;
    if (keys.ArrowDown || keys.s || keys.S) dy++;
    if (keys.ArrowLeft || keys.a || keys.A) dx--;
    if (keys.ArrowRight || keys.d || keys.D) dx++;
    if (dx || dy) p.target = Math.atan2(dy, dx);
    moveSnake(p, dt, true);
    game.bots.forEach(bot => moveSnake(bot, dt, false));
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
    game.bots.forEach(drawSnake); drawSnake(game.player);
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
