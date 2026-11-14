(() => {
  'use strict';

  const button = document.createElement('button');
  button.className = 'clans-fab';
  button.type = 'button';
  button.textContent = '♟ Clans';
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-label', 'Open clans panel');
  document.body.appendChild(button);

  const dialog = document.createElement('dialog');
  dialog.className = 'clans-dialog';
  dialog.setAttribute('aria-labelledby', 'clans-title');
  dialog.innerHTML = `
    <form method="dialog" class="clans-close-form"><button class="clans-close" aria-label="Close clans">×</button></form>
    <p class="eyebrow">SNAKE CLASH COMMUNITY</p>
    <h2 id="clans-title">Clans</h2>
    <p class="clans-intro">Create a clan for 10,000 coins, or request to join one. A clan leader must approve your request.</p>
    <label class="clans-label" for="clans-server">Multiplayer server URL</label>
    <input class="clans-input" id="clans-server" type="url" placeholder="wss://your-server.onrender.com">
    <div class="clans-connect-row"><button class="clans-action secondary" id="clans-connect" type="button">Connect / refresh clans</button><span id="clans-balance" class="clans-balance"></span></div>
    <p class="clans-status" id="clans-status" role="status">Connect to the multiplayer server to view clans.</p>
    <section class="clans-create"><h3>Create a clan</h3><div class="clans-create-row"><input class="clans-input" id="clans-name" maxlength="24" placeholder="Clan name"><button class="clans-action" id="clans-create-button" type="button">Create · 10,000 ◆</button></div><small>Coins and clan data are currently stored locally/in server memory.</small></section>
    <section class="clans-current" id="clans-current" hidden></section>
    <section class="clans-list-wrap"><div class="clans-list-heading"><h3>Browse clans</h3><button class="clans-refresh" id="clans-refresh" type="button">Refresh</button></div><div class="clans-list" id="clans-list"><p class="clans-empty">Connect to load clans.</p></div></section>`;
  document.body.appendChild(dialog);

  const style = document.createElement('link');
  style.rel = 'stylesheet'; style.href = 'clans.css'; document.head.appendChild(style);
  const serverInput = dialog.querySelector('#clans-server');
  const status = dialog.querySelector('#clans-status');
  const list = dialog.querySelector('#clans-list');
  const current = dialog.querySelector('#clans-current');
  const connectButton = dialog.querySelector('#clans-connect');
  const coinsKey = 'snake-clash-progression-v1';
  const identityKey = 'snake-clash-clan-player-id';
  let socket = null, clans = [], myClan = null;

  try { serverInput.value = localStorage.getItem('snake-clash-multiplayer-server') || ''; } catch { /* optional saved URL */ }
  button.addEventListener('click', () => {
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', 'open');
    updateBalance();
  });
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', disconnect);
  connectButton.addEventListener('click', connect);
  dialog.querySelector('#clans-refresh').addEventListener('click', refresh);
  dialog.querySelector('#clans-create-button').addEventListener('click', createClan);

  function playerId() {
    let id = localStorage.getItem(identityKey);
    if (!id) { id = crypto.randomUUID ? crypto.randomUUID() : `clan-${Math.random().toString(36).slice(2)}-${Date.now()}`; localStorage.setItem(identityKey, id); }
    return id;
  }
  function playerName() {
    const input = document.getElementById('player-name');
    return String(input?.value || localStorage.getItem('snake-clash-player-name') || 'Player').trim().slice(0, 14) || 'Player';
  }
  function progression() {
    try { return JSON.parse(localStorage.getItem(coinsKey) || '{}'); } catch { return {}; }
  }
  function balance() { return Math.max(0, Number(progression().coins) || 0); }
  function updateBalance() { dialog.querySelector('#clans-balance').textContent = `Balance: ${balance().toLocaleString()} ◆`; }
  function serverAddress() {
    let address = serverInput.value.trim();
    if (!address) throw new Error('Enter the WebSocket server URL first.');
    let url;
    try { url = new URL(address); } catch { throw new Error('Enter a valid server URL.'); }
    if (url.protocol === 'https:') url.protocol = 'wss:';
    if (url.protocol === 'http:') url.protocol = 'ws:';
    if (!['ws:', 'wss:'].includes(url.protocol)) throw new Error('Server URL must use ws:// or wss://.');
    return url.toString();
  }
  function connect() {
    disconnect();
    status.textContent = 'Connecting…'; connectButton.disabled = true;
    let address;
    try { address = serverAddress(); } catch (error) { status.textContent = error.message; connectButton.disabled = false; return; }
    try { localStorage.setItem('snake-clash-multiplayer-server', address); } catch { /* optional preference */ }
    try { socket = new WebSocket(address); } catch { status.textContent = 'Could not open a connection. Check the URL.'; connectButton.disabled = false; return; }
    socket.addEventListener('open', () => {
      status.textContent = 'Connected. Loading clans…';
      send({ type: 'clans:list' });
    });
    socket.addEventListener('message', event => {
      let message; try { message = JSON.parse(event.data); } catch { return; }
      if (message.type === 'clans:list') { clans = Array.isArray(message.clans) ? message.clans : []; renderList(); }
      if (message.type === 'clans:profile') { myClan = message.clan || null; renderCurrent(); }
      if (message.type === 'clans:created') {
        const data = progression(); data.coins = Math.max(0, balance() - 10000);
        try { localStorage.setItem(coinsKey, JSON.stringify(data)); } catch { /* balance remains client-side */ }
        updateBalance(); status.textContent = 'Clan created! You are the clan leader.'; send({ type: 'clans:list' });
      }
      if (message.type === 'clans:request-sent') status.textContent = `Join request sent to ${message.name}. The leader must approve it.`;
      if (message.type === 'clans:request-approved') status.textContent = `${message.name} was approved to join.`;
      if (message.type === 'clans:request-declined') status.textContent = `${message.name}'s request was declined.`;
      if (message.type === 'clans:left') { myClan = null; renderCurrent(); status.textContent = 'You left your clan.'; send({ type: 'clans:list' }); }
      if (message.type === 'clans:error') status.textContent = message.message;
    });
    socket.addEventListener('error', () => { status.textContent = 'Connection failed. Make sure the Node.js server is deployed and the URL is correct.'; connectButton.disabled = false; });
    socket.addEventListener('close', () => { connectButton.disabled = false; });
  }
  function disconnect() { if (socket) { const old = socket; socket = null; old.close(); } }
  function send(data) {
    if (socket?.readyState !== WebSocket.OPEN) { status.textContent = 'Connect to the multiplayer server first.'; return false; }
    socket.send(JSON.stringify({ ...data, memberId: playerId(), name: playerName() })); return true;
  }
  function refresh() { if (socket?.readyState === WebSocket.OPEN) send({ type: 'clans:list' }); else connect(); }
  function createClan() {
    const clanName = dialog.querySelector('#clans-name').value.trim();
    if (balance() < 10000) { status.textContent = `You need ${(10000 - balance()).toLocaleString()} more coins to create a clan.`; return; }
    if (!clanName) { status.textContent = 'Enter a name for your clan.'; return; }
    send({ type: 'clans:create', clanName, coins: balance() });
  }
  function renderList() {
    if (!clans.length) { list.innerHTML = '<p class="clans-empty">No clans yet. Create the first one!</p>'; return; }
    list.replaceChildren();
    clans.forEach(clan => {
      const card = document.createElement('article'); card.className = 'clan-card';
      const info = document.createElement('div'); info.className = 'clan-card-info';
      const title = document.createElement('b'); title.textContent = clan.name;
      const detail = document.createElement('small'); detail.textContent = `${clan.members} members · Leader: ${clan.leader || 'Unknown'}`;
      info.append(title, detail);
      const action = document.createElement('button'); action.type = 'button'; action.className = 'clans-action secondary';
      const requested = clan.id === myClan?.id;
      action.textContent = requested ? 'Your clan' : 'Request to join'; action.disabled = requested;
      action.addEventListener('click', () => send({ type: 'clans:request', clanId: clan.id }));
      card.append(info, action); list.appendChild(card);
    });
  }
  function renderCurrent() {
    current.hidden = !myClan;
    if (!myClan) { renderList(); return; }
    current.replaceChildren();
    const heading = document.createElement('div'); heading.className = 'clans-list-heading';
    const title = document.createElement('h3'); title.textContent = `Your clan · ${myClan.name}`;
    const leave = document.createElement('button'); leave.type = 'button'; leave.className = 'clans-refresh'; leave.textContent = 'Leave clan'; leave.addEventListener('click', () => send({ type: 'clans:leave' }));
    heading.append(title, leave); current.appendChild(heading);
    const roster = document.createElement('p'); roster.className = 'clans-roster';
    roster.textContent = `Leader: ${myClan.leader} · Members: ${(myClan.members || []).map(member => member.name).join(', ')}`; current.appendChild(roster);
    (myClan.requests || []).forEach(request => {
      const row = document.createElement('div'); row.className = 'clan-request';
      const name = document.createElement('b'); name.textContent = `${request.name} requested to join`;
      row.appendChild(name);
      for (const [label, approve] of [['Approve', true], ['Decline', false]]) {
        const action = document.createElement('button'); action.type = 'button'; action.className = 'clans-action secondary'; action.textContent = label;
        action.addEventListener('click', () => send({ type: 'clans:decision', clanId: myClan.id, requestId: request.id, approve })); row.appendChild(action);
      }
      current.appendChild(row);
    });
    renderList();
  }
})();
