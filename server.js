'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const ROOT = __dirname;
const WORLD = { width: 2600, height: 1900 };
const MAX_PLAYERS_PER_ROOM = 12;
const MAX_CONNECTIONS = 300;
const TICK_MS = 50;
const FOOD_TARGET = 160;
const COLORS = ['#ff7179', '#5ab9ff', '#c57cff', '#ffb35d', '#ff70ce', '#53dfb9', '#e9df56', '#929bff'];
const rooms = new Map();
const sockets = new Set();
const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};

function send(socket, payload) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}
function roomCode() {
  let code;
  do { code = crypto.randomBytes(3).toString('hex').toUpperCase(); } while (rooms.has(code));
  return code;
}
function createFood() {
  return { x: 25 + Math.random() * (WORLD.width - 50), y: 25 + Math.random() * (WORLD.height - 50), color: COLORS[Math.floor(Math.random() * COLORS.length)], value: 1 };
}
function createRoom(code) {
  const room = { code, players: new Map(), food: Array.from({ length: FOOD_TARGET }, createFood), lastBroadcast: 0 };
  rooms.set(code, room);
  return room;
}
function createPlayer(socket, name, room) {
  const id = crypto.randomUUID();
  const x = 180 + Math.random() * (WORLD.width - 360);
  const y = 180 + Math.random() * (WORLD.height - 360);
  const parts = Array.from({ length: 12 }, (_, i) => ({ x: x - i * 12, y }));
  const player = {
    id, name, color: COLORS[room.players.size % COLORS.length], x, y,
    angle: 0, target: 0, mass: 120, parts, alive: true,
    shieldUntil: Date.now() + 2500, boosting: false, socket
  };
  room.players.set(id, player);
  socket.playerId = id;
  socket.roomCode = room.code;
  return player;
}
function safeName(value) {
  const name = String(value || 'Player').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 14);
  return name || 'Player';
}
function joinRoom(socket, message) {
  const codeInput = String(message.room || '').trim().toUpperCase();
  if (codeInput && !/^[A-F0-9]{6}$/.test(codeInput)) {
    send(socket, { type: 'error', message: 'Room codes must be six letters or numbers.' });
    return;
  }
  let room = codeInput ? rooms.get(codeInput) : null;
  if (codeInput && !room) {
    send(socket, { type: 'error', message: 'That room was not found. Create a new room instead.' });
    return;
  }
  if (!room) room = createRoom(roomCode());
  if (room.players.size >= MAX_PLAYERS_PER_ROOM) {
    send(socket, { type: 'error', message: 'That room is full. Try another room.' });
    return;
  }
  const player = createPlayer(socket, safeName(message.name), room);
  send(socket, { type: 'joined', id: player.id, room: room.code, world: WORLD, maxPlayers: MAX_PLAYERS_PER_ROOM });
  broadcast(room, { type: 'state', state: serializeRoom(room) });
}
function serializeRoom(room) {
  return {
    players: [...room.players.values()].map(({ id, name, color, x, y, angle, mass, parts, alive, shieldUntil, boosting }) => ({
      id, name, color, x, y, angle, mass: Math.floor(mass), parts, alive,
      shield: shieldUntil > Date.now(), boosting
    })),
    food: room.food
  };
}
function broadcast(room, payload) {
  const encoded = JSON.stringify(payload);
  for (const player of room.players.values()) {
    if (player.socket.readyState === WebSocket.OPEN) player.socket.send(encoded);
  }
}
function removePlayer(socket) {
  if (!socket.roomCode || !socket.playerId) return;
  const room = rooms.get(socket.roomCode);
  if (!room) return;
  room.players.delete(socket.playerId);
  socket.roomCode = null;
  socket.playerId = null;
  if (!room.players.size) rooms.delete(room.code);
  else broadcast(room, { type: 'state', state: serializeRoom(room) });
}
function handleMessage(socket, raw) {
  let message;
  try { message = JSON.parse(raw.toString()); } catch { send(socket, { type: 'error', message: 'Invalid message.' }); return; }
  if (!message || typeof message !== 'object') return;
  if (message.type === 'join') {
    if (socket.roomCode) { send(socket, { type: 'error', message: 'You are already in a room.' }); return; }
    joinRoom(socket, message);
    return;
  }
  if (message.type === 'input' && socket.roomCode && socket.playerId) {
    const room = rooms.get(socket.roomCode);
    const player = room?.players.get(socket.playerId);
    if (!player || !player.alive) return;
    if (Number.isFinite(message.angle)) player.target = Math.max(-Math.PI, Math.min(Math.PI, message.angle));
    player.boosting = message.boost === true;
  }
}
function updateRoom(room, dt) {
  const now = Date.now();
  for (const player of room.players.values()) {
    if (!player.alive) continue;
    let diff = Math.atan2(Math.sin(player.target - player.angle), Math.cos(player.target - player.angle));
    player.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));
    const boosting = player.boosting && player.mass > 60;
    const speed = boosting ? 220 : 155;
    if (boosting) player.mass = Math.max(60, player.mass - dt * 12);
    player.x += Math.cos(player.angle) * speed * dt;
    player.y += Math.sin(player.angle) * speed * dt;
    player.parts.unshift({ x: player.x, y: player.y });
    const length = Math.max(12, Math.floor(player.mass / 10));
    while (player.parts.length > length) player.parts.pop();
    for (let i = 1; i < player.parts.length; i++) {
      const previous = player.parts[i - 1], segment = player.parts[i];
      const dx = previous.x - segment.x, dy = previous.y - segment.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 12) { segment.x += dx / distance * (distance - 12); segment.y += dy / distance * (distance - 12); }
    }
    if (player.x < 22 || player.y < 22 || player.x > WORLD.width - 22 || player.y > WORLD.height - 22) {
      player.alive = false;
      send(player.socket, { type: 'died', reason: 'You hit the arena wall.' });
      continue;
    }
    const foodIndex = room.food.findIndex(food => (player.x - food.x) ** 2 + (player.y - food.y) ** 2 < 400);
    if (foodIndex >= 0) { room.food.splice(foodIndex, 1); player.mass += 2.7; }
    if (player.shieldUntil <= now) {
      for (const other of room.players.values()) {
        if (other.id === player.id || !other.alive) continue;
        let hit = false;
        for (let i = 8; i < other.parts.length; i++) {
          if ((player.x - other.parts[i].x) ** 2 + (player.y - other.parts[i].y) ** 2 < 169) { hit = true; break; }
        }
        if (hit) {
          player.alive = false;
          other.mass += 14;
          send(player.socket, { type: 'died', reason: `${other.name} caught you.` });
          break;
        }
      }
      if (!player.alive) continue;
      for (let i = 9; i < player.parts.length; i++) {
        if ((player.x - player.parts[i].x) ** 2 + (player.y - player.parts[i].y) ** 2 < 100) {
          player.alive = false;
          send(player.socket, { type: 'died', reason: 'You tangled with yourself.' });
          break;
        }
      }
    }
  }
  while (room.food.length < FOOD_TARGET) room.food.push(createFood());
  if (now - room.lastBroadcast >= 100) {
    room.lastBroadcast = now;
    broadcast(room, { type: 'state', state: serializeRoom(room) });
  }
}

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host || 'localhost'}`).pathname);
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(ROOT, requested);
  if (file !== ROOT && !file.startsWith(`${ROOT}${path.sep}`)) { response.writeHead(403); response.end('Forbidden'); return; }
  fs.readFile(file, (error, contents) => {
    if (error) { response.writeHead(error.code === 'ENOENT' ? 404 : 500); response.end('Not found'); return; }
    response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' });
    response.end(contents);
  });
});
const wss = new WebSocketServer({ server, maxPayload: 4096, perMessageDeflate: false });
wss.on('connection', (socket, request) => {
  if (sockets.size >= MAX_CONNECTIONS) { socket.close(1013, 'Server is busy'); return; }
  sockets.add(socket);
  socket.isAlive = true;
  socket.on('pong', () => { socket.isAlive = true; });
  socket.on('message', raw => handleMessage(socket, raw));
  socket.on('close', () => { sockets.delete(socket); removePlayer(socket); });
  socket.on('error', () => { sockets.delete(socket); removePlayer(socket); });
});
setInterval(() => {
  for (const socket of wss.clients) {
    if (!socket.isAlive) { socket.terminate(); continue; }
    socket.isAlive = false;
    socket.ping();
  }
}, 30000).unref();
setInterval(() => { for (const room of rooms.values()) updateRoom(room, TICK_MS / 1000); }, TICK_MS).unref();
server.listen(PORT, HOST, () => console.log(`Snake Clash multiplayer listening on ${HOST}:${PORT}`));
