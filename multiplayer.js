(() => {
  'use strict';

  const section = document.getElementById('play');
  if (!section) return;
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = 'multiplayer.css';
  document.head.appendChild(style);

  const button = document.createElement('button');
  button.className = 'multiplayer-launch';
  button.type = 'button';
  button.textContent = '🌐 Play multiplayer';
  button.setAttribute('aria-haspopup', 'dialog');
  const heading = section.querySelector('.section-title, .section-heading');
  if (heading) heading.appendChild(button);

  const dialog = document.createElement('dialog');
  dialog.className = 'multiplayer-dialog';
  dialog.setAttribute('aria-labelledby', 'multiplayer-title');
  dialog.innerHTML = `
    <form method="dialog" class="mp-close-form"><button class="mp-close" aria-label="Close multiplayer">×</button></form>
    <div class="mp-lobby" id="mp-lobby">
      <p class="eyebrow">REAL-TIME ONLINE ARENA</p><h2 id="multiplayer-title">Play with friends.</h2>
      <p class="mp-copy">Create a room and share its six-character code, or enter a friend's code to join their server room.</p>
      <label class="mp-label" for="mp-server">Multiplayer server URL</label><input id="mp-server" class="mp-input" type="url" placeholder="wss://your-server.onrender.com" autocomplete="url">
      <p class="mp-hint">If the game is hosted on the multiplayer server, this is detected automatically. GitHub Pages needs your server's wss:// URL.</p>
      <label class="mp-label" for="mp-name">Your name</label><input id="mp-name" class="mp-input" maxlength="14" value="Player" autocomplete="nickname">
      <label class="mp-label" for="mp-room">Room code <span>(leave blank to create one)</span></label><input id="mp-room" class="mp-input" maxlength="6" placeholder="e.g. A1B2C3" autocapitalize="characters">
      <p class="mp-error" id="mp-error" role="alert"></p>
      <button class="mp-connect" id="mp-connect" type="button">Create / join room</button>
      <p class="mp-hint">Rooms support up to 12 players. The Node.js server must be running for online play.</p>
    </div>
    <div class="mp-game hidden" id="mp-game"><div class="mp-game-head"><div><p class="eyebrow">MULTIPLAYER ROOM</p><h2>Room <strong id="mp-room-code">------</strong></h2></div><div class="mp-online"><i></i><span id="mp-count">Connecting…</span></div></div><canvas id="mp-canvas" aria-label="Online multiplayer arena"></canvas><div class="mp-game-foot"><span>Move pointer or finger to steer · Space / Shift to boost</span><button id="mp-leave" type="button">Leave room</button></div></div>`;
  document.body.appendChild(dialog);

  const serverInput = dialog.querySelector('#mp-server');
  const nameInput = dialog.querySelector('#mp-name');
  const roomInput = dialog.querySelector('#mp-room');
  const errorEl = dialog.querySelector('#mp-error');
  const connectButton = dialog.querySelector('#mp-connect');
  const lobby = dialog.querySelector('#mp-lobby');
  const multiplayerGame = dialog.querySelector('#mp-game');
  const mpCanvas = dialog.querySelector('#mp-canvas');
  const mpCtx = mpCanvas.getContext('2d');
  let socket = null, playerId = null, state = null, roomCode = '', targetAngle = 0;
  let lastInputAt = 0, animFrame = 0;
  const WORLD_W = 2600, WORLD_H = 1900;
  const savedServer = localStorage.getItem('snake-clash-multiplayer-server') || '';
  serverInput.value = savedServer;
  if (!savedServer && location.hostname !== 'github.io') serverInput.value = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`;

  function serverAddress() {
    const value = serverInput.value.trim();
    if (!value) throw new Error('Enter the WebSocket server URL.');
    let url;
    try { url = new URL(value); } catch { throw new Error('Enter a valid server URL, such as wss://your-server.onrender.com.'); }
    if (url.protocol === 'https:') url.protocol = 'wss:';
    if (url.protocol === 'http:') url.protocol = 'ws:';
    if (!['ws:', 'wss:'].includes(url.protocol)) throw new Error('Server URL must start with ws:// or wss://.');
    return url.toString();
  }

  function openDialog() {
    errorEl.textContent = '';
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', 'open');
  }
  button.addEventListener('click', openDialog);
  dialog.addEventListener('click', event => { if (event.target === dialog) closeConnection(); });
  connectButton.addEventListener('click', connect);
  roomInput.addEventListener('input', () => { roomInput.value = roomInput.value.toUpperCase().replace(/[^A-F0-9]/g, '').slice(0, 6); });
  dialog.querySelector('#mp-leave').addEventListener('click', closeConnection);

  function connect() {
    errorEl.textContent = '';
    let address;
    try { address = serverAddress(); } catch (error) { errorEl.textContent = error.message; return; }
    try { localStorage.setItem('snake-clash-multiplayer-server', address); } catch { /* optional preference */ }
    connectButton.disabled = true;
    connectButton.textContent = 'Connecting…';
    socket = new WebSocket(address);
    const timer = setTimeout(() => { if (socket?.readyState === WebSocket.CONNECTING) { socket.close(); errorEl.textContent = 'Server connection timed out. Check the URL and make sure the Node.js server is deployed.'; resetButton(); } }, 8000);
    socket.addEventListener('open', () => {
      clearTimeout(timer);
      socket.send(JSON.stringify({ type: 'join', room: roomInput.value.trim(), name: nameInput.value.trim() || 'Player' }));
    }, { once: true });
    socket.addEventListener('message', event => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.type === 'error') { errorEl.textContent = message.message; closeConnection(false); return; }
      if (message.type === 'joined') {
        playerId = message.id; roomCode = message.room;
        dialog.querySelector('#mp-room-code').textContent = roomCode;
        lobby.classList.add('hidden'); multiplayerGame.classList.remove('hidden');
        resizeCanvas(); sendInput(); drawLoop();
      } else if (message.type === 'state') {
        state = message.state; updatePlayerCount();
      } else if (message.type === 'died') {
        errorEl.textContent = `${message.reason} Your online snake was eliminated. Leave and rejoin to play again.`;
      }
    });
    socket.addEventListener('error', () => { clearTimeout(timer); errorEl.textContent = 'Could not connect. Check the server URL, deployment status, and HTTPS/WSS setup.'; resetButton(); });
    socket.addEventListener('close', () => { clearTimeout(timer); if (dialog.open) { errorEl.textContent = errorEl.textContent || 'Disconnected from the multiplayer server.'; resetButton(); } });
  }

  function resetButton() { connectButton.disabled = false; connectButton.textContent = 'Create / join room'; }
  function updatePlayerCount() {
    const count = state?.players?.length || 0;
    dialog.querySelector('#mp-count').textContent = `${count} / 12 players`;
  }
  function closeConnection(closeDialog = true) {
    if (socket) { socket.close(); socket = null; }
    state = null; playerId = null; roomCode = '';
    cancelAnimationFrame(animFrame);
    multiplayerGame.classList.add('hidden'); lobby.classList.remove('hidden'); resetButton();
    if (closeDialog && dialog.open) dialog.close();
  }

  function resizeCanvas() {
    const rect = mpCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    mpCanvas.width = Math.floor(rect.width * dpr);
    mpCanvas.height = Math.floor(rect.height * dpr);
    mpCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  new ResizeObserver(resizeCanvas).observe(mpCanvas);

  function sendInput() {
    if (socket?.readyState !== WebSocket.OPEN) return;
    const now = performance.now();
    if (now - lastInputAt < 45) return;
    lastInputAt = now;
    socket.send(JSON.stringify({ type: 'input', angle: targetAngle, boost: Boolean(keys.Space || keys.Shift) }));
  }
  const keys = Object.create(null);
  mpCanvas.addEventListener('pointermove', steer);
  mpCanvas.addEventListener('pointerdown', steer);
  function steer(event) {
    const rect = mpCanvas.getBoundingClientRect();
    const me = state?.players?.find(player => player.id === playerId);
    if (!me) return;
    const worldX = me.x + (event.clientX - rect.left - rect.width / 2);
    const worldY = me.y + (event.clientY - rect.top - rect.height / 2);
    targetAngle = Math.atan2(worldY - me.y, worldX - me.x);
    sendInput();
  }
  window.addEventListener('keydown', event => { if (event.code === 'Space' || event.key === 'Shift') { keys[event.code === 'Space' ? 'Space' : 'Shift'] = true; sendInput(); } });
  window.addEventListener('keyup', event => { if (event.code === 'Space' || event.key === 'Shift') { keys[event.code === 'Space' ? 'Space' : 'Shift'] = false; sendInput(); } });

  function drawLoop() {
    if (!dialog.open || multiplayerGame.classList.contains('hidden')) return;
    draw(); sendInput(); animFrame = requestAnimationFrame(drawLoop);
  }
  function draw() {
    const rect = mpCanvas.getBoundingClientRect();
    const width = rect.width, height = rect.height;
    if (!width || !height) return;
    mpCtx.setTransform(Math.min(window.devicePixelRatio || 1, 2), 0, 0, Math.min(window.devicePixelRatio || 1, 2), 0, 0);
    mpCtx.clearRect(0, 0, width, height);
    mpCtx.fillStyle = '#081421'; mpCtx.fillRect(0, 0, width, height);
    if (!state) return;
    const me = state.players.find(player => player.id === playerId);
    const cameraX = me?.x || WORLD_W / 2, cameraY = me?.y || WORLD_H / 2;
    mpCtx.save(); mpCtx.translate(width / 2 - cameraX, height / 2 - cameraY);
    mpCtx.fillStyle = '#081421'; mpCtx.fillRect(0, 0, WORLD_W, WORLD_H);
    mpCtx.strokeStyle = 'rgba(75,113,133,.25)'; mpCtx.lineWidth = 1;
    for (let x = 0; x <= WORLD_W; x += 40) { mpCtx.beginPath(); mpCtx.moveTo(x, 0); mpCtx.lineTo(x, WORLD_H); mpCtx.stroke(); }
    for (let y = 0; y <= WORLD_H; y += 40) { mpCtx.beginPath(); mpCtx.moveTo(0, y); mpCtx.lineTo(WORLD_W, y); mpCtx.stroke(); }
    mpCtx.strokeStyle = '#ff6674'; mpCtx.lineWidth = 7; mpCtx.strokeRect(4, 4, WORLD_W - 8, WORLD_H - 8);
    for (const food of state.food || []) { mpCtx.fillStyle = food.color; mpCtx.beginPath(); mpCtx.arc(food.x, food.y, 4, 0, Math.PI * 2); mpCtx.fill(); }
    for (const player of state.players || []) {
      if (!player.alive) continue;
      mpCtx.beginPath(); mpCtx.lineCap = 'round'; mpCtx.lineJoin = 'round'; mpCtx.strokeStyle = player.color; mpCtx.lineWidth = 17;
      player.parts.forEach((part, index) => index ? mpCtx.lineTo(part.x, part.y) : mpCtx.moveTo(part.x, part.y)); mpCtx.stroke();
      mpCtx.fillStyle = '#f0ffd7'; mpCtx.beginPath(); mpCtx.arc(player.x, player.y, 8, 0, Math.PI * 2); mpCtx.fill();
      mpCtx.fillStyle = '#eff7fa'; mpCtx.font = 'bold 10px sans-serif'; mpCtx.textAlign = 'center'; mpCtx.fillText(`${player.name} · ${player.mass}`, player.x, player.y - 17);
      if (player.shield) { mpCtx.beginPath(); mpCtx.arc(player.x, player.y, 24, 0, Math.PI * 2); mpCtx.strokeStyle = '#62e8ee'; mpCtx.lineWidth = 2; mpCtx.stroke(); }
    }
    mpCtx.restore();
  }
})();
