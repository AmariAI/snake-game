(() => {
  'use strict';

  const KEY = 'snake-clash-progression-v1';
  const skins = [
    { id: 'lime', name: 'Starter Lime', color: '#a5ff72', cost: 0, level: 1, type: 'skin', icon: '🟢' },
    { id: 'ice', name: 'Glacier', color: '#62e8ee', cost: 120, level: 2, type: 'skin', icon: '❄️' },
    { id: 'ember', name: 'Ember Fang', color: '#ff795e', cost: 260, level: 4, type: 'skin', icon: '🔥' },
    { id: 'royal', name: 'Royal Nebula', color: '#c69aff', cost: 450, level: 7, type: 'skin', icon: '💜' },
    { id: 'sunset', name: 'Solar Flare', color: '#ffc857', cost: 700, level: 10, type: 'skin', icon: '🌟' }
  ];
  const accessories = [
    { id: 'none', name: 'No accessory', cost: 0, level: 1, type: 'accessory', icon: '—' },
    { id: 'cap', name: 'Street Cap', cost: 90, level: 2, type: 'accessory', icon: '🧢' },
    { id: 'wings', name: 'Neon Wings', cost: 220, level: 4, type: 'accessory', icon: '🪽' },
    { id: 'cape', name: 'Comet Cape', cost: 380, level: 6, type: 'accessory', icon: '🦸' },
    { id: 'crown', name: 'Star Crown', cost: 600, level: 9, type: 'accessory', icon: '👑' }
  ];
  const allItems = [...skins, ...accessories];
  const shop = document.getElementById('season-shop');
  if (!shop) return;

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
      return {
        coins: Math.max(0, Number(saved.coins) || 0), xp: Math.max(0, Number(saved.xp) || 0),
        owned: Array.isArray(saved.owned) ? [...new Set(['lime', 'none', ...saved.owned])] : ['lime', 'none'],
        equipped: { skin: 'lime', accessory: 'none', ...(saved.equipped || {}) },
        rewarded: Array.isArray(saved.rewarded) ? saved.rewarded : []
      };
    } catch { return { coins: 0, xp: 0, owned: ['lime', 'none'], equipped: { skin: 'lime', accessory: 'none' }, rewarded: [] }; }
  }
  let data = load();
  const levelForXP = (xp) => Math.floor(xp / 100) + 1;
  function save() { localStorage.setItem(KEY, JSON.stringify(data)); render(); }
  function itemById(id) { return allItems.find(item => item.id === id); }

  function render() {
    const level = levelForXP(data.xp);
    const xpIntoLevel = data.xp % 100;
    document.getElementById('season-coins').textContent = data.coins.toLocaleString();
    document.getElementById('season-level').textContent = level;
    document.getElementById('season-xp').textContent = `${xpIntoLevel} / 100 XP`;
    document.getElementById('season-next').textContent = `${100 - xpIntoLevel} XP to next reward`;
    document.getElementById('season-progress').style.width = `${xpIntoLevel}%`;
    const nextReward = Math.min(20, level) * 50;
    document.getElementById('season-reward').textContent = level >= 20
      ? 'Season complete! Keep playing to earn more coins.'
      : `Next tier reward: ${nextReward} bonus coins at level ${level + 1}.`;
    shop.innerHTML = allItems.map(item => {
      const owned = data.owned.includes(item.id);
      const equipped = data.equipped[item.type] === item.id;
      const locked = level < item.level;
      const buttonText = equipped ? 'Equipped' : owned ? 'Equip' : locked ? `Unlocks at level ${item.level}` : `Buy · ${item.cost} ◆`;
      return `<article class="shop-item ${item.type}" style="--item-color:${item.color || '#9fb6c4'}"><div class="item-art">${item.icon}</div><div class="item-copy"><span class="item-kind">${item.type === 'skin' ? 'SNAKE SKIN' : 'ACCESSORY'}</span><h4>${item.name}</h4><small>${locked ? `Season level ${item.level}` : owned ? 'Owned' : 'Available now'}</small></div><button data-item="${item.id}" ${equipped || locked ? 'disabled' : ''}>${buttonText}</button></article>`;
    }).join('');
    shop.querySelectorAll('button[data-item]').forEach(button => button.addEventListener('click', () => selectItem(button.dataset.item)));
  }

  function selectItem(id) {
    const item = itemById(id);
    if (!item) return;
    const level = levelForXP(data.xp);
    if (level < item.level) return;
    if (!data.owned.includes(id)) {
      if (data.coins < item.cost) {
        document.getElementById('season-reward').textContent = `You need ${item.cost - data.coins} more coins for ${item.name}. Finish another run!`;
        return;
      }
      data.coins -= item.cost;
      data.owned.push(id);
    }
    data.equipped[item.type] = id;
    save();
  }

  function finishRun(score, seconds) {
    const safeScore = Math.max(0, Math.floor(Number(score) || 0));
    const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
    const coinsEarned = Math.max(10, Math.floor(safeScore / 5) + Math.floor(safeSeconds / 10));
    const xpEarned = Math.max(10, Math.floor(safeScore / 2) + safeSeconds * 2);
    const oldLevel = levelForXP(data.xp);
    data.coins += coinsEarned;
    data.xp += xpEarned;
    const newLevel = levelForXP(data.xp);
    for (let level = oldLevel + 1; level <= Math.min(newLevel, 20); level++) {
      if (!data.rewarded.includes(level)) {
        data.coins += level * 50;
        data.rewarded.push(level);
      }
    }
    save();
    document.getElementById('season-reward').textContent = `Run reward: +${coinsEarned} coins · +${xpEarned} XP${newLevel > oldLevel ? ` · Pass level ${newLevel}! Bonus coins claimed.` : ''}`;
  }

  function applyToSnake(snake) {
    const skin = itemById(data.equipped.skin) || skins[0];
    snake.color = skin.color;
    snake.accessory = data.equipped.accessory;
  }

  function drawAccessory(ctx, snake) {
    if (!snake || !snake.accessory || snake.accessory === 'none') return;
    const angle = snake.angle || 0;
    ctx.save();
    ctx.translate(snake.x, snake.y);
    ctx.rotate(angle);
    ctx.shadowBlur = 12;
    if (snake.accessory === 'cap') {
      ctx.shadowColor = '#f4d35e'; ctx.fillStyle = '#f4d35e';
      ctx.beginPath(); ctx.ellipse(2, -8, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(2, -5, 10, 2);
    } else if (snake.accessory === 'crown') {
      ctx.shadowColor = '#ffd45c'; ctx.fillStyle = '#ffd45c';
      ctx.beginPath(); ctx.moveTo(-7, -7); ctx.lineTo(-6, -17); ctx.lineTo(-2, -12); ctx.lineTo(1, -19); ctx.lineTo(4, -12); ctx.lineTo(8, -16); ctx.lineTo(7, -7); ctx.closePath(); ctx.fill();
    } else if (snake.accessory === 'wings') {
      ctx.shadowColor = '#92f4ff'; ctx.fillStyle = '#92f4ff';
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(-5, 3); ctx.quadraticCurveTo(-17, side * 4, -19, side * 14); ctx.quadraticCurveTo(-9, side * 11, -3, 8); ctx.fill();
      }
    } else if (snake.accessory === 'cape') {
      ctx.shadowColor = '#ff70ce'; ctx.fillStyle = '#ff70ce';
      ctx.beginPath(); ctx.moveTo(-7, 3); ctx.lineTo(-22, 9); ctx.lineTo(-19, 20); ctx.lineTo(-4, 8); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  window.SnakeProgression = { finishRun, applyToSnake, drawAccessory };
  render();
})();
