(() => {
  'use strict';

  const KEY = 'snake-clash-progression-v1';
  const skins = [
    { id: 'lime', name: 'Starter Lime', color: '#a5ff72', cost: 0, level: 1, type: 'skin', icon: '🟢' },
    { id: 'ice', name: 'Glacier', color: '#62e8ee', cost: 120, level: 2, type: 'skin', icon: '❄️' },
    { id: 'ember', name: 'Ember Fang', color: '#ff795e', cost: 260, level: 4, type: 'skin', icon: '🔥' },
    { id: 'royal', name: 'Royal Nebula', color: '#c69aff', cost: 450, level: 7, type: 'skin', icon: '💜' },
    { id: 'sunset', name: 'Solar Flare', color: '#ffc857', cost: 700, level: 10, type: 'skin', icon: '🌟' },
    { id: 'cosmic', name: 'Cosmic Voyager', color: '#8476ff', type: 'skin', icon: '🌌' },
    { id: 'frost', name: 'Frostbite', color: '#a6f2ff', type: 'skin', icon: '🧊' },
    { id: 'puppy', name: 'Puppy Pal', color: '#d9a66c', type: 'skin', icon: '🐶' },
    { id: 'circuit', name: 'Circuit Snake', color: '#62ffbd', type: 'skin', icon: '🤖' },
    { id: 'fruit', name: 'Fruit Salad', color: '#ff6b8a', type: 'skin', icon: '🍉' },
    { id: 'inferno', name: 'Inferno', color: '#ff4d25', type: 'skin', icon: '🌋' },
    { id: 'lagoon', name: 'Lagoon', color: '#36bce7', type: 'skin', icon: '🌊' }
  ];
  const accessories = [
    { id: 'none', name: 'No accessory', type: 'accessory', icon: '—' },
    { id: 'cap', name: 'Street Cap', cost: 90, level: 2, type: 'accessory', icon: '🧢' },
    { id: 'wings', name: 'Neon Wings', cost: 220, level: 4, type: 'accessory', icon: '🪽' },
    { id: 'cape', name: 'Comet Cape', cost: 380, level: 6, type: 'accessory', icon: '🦸' },
    { id: 'crown', name: 'Star Crown', cost: 600, level: 9, type: 'accessory', icon: '👑' },
    { id: 'antenna', name: 'Star Antenna', type: 'accessory', icon: '📡' },
    { id: 'scarf', name: 'Frost Scarf', type: 'accessory', icon: '🧣' },
    { id: 'dogears', name: 'Puppy Ears', type: 'accessory', icon: '🐾' },
    { id: 'visor', name: 'Robot Visor', type: 'accessory', icon: '🥽' },
    { id: 'fruit-hat', name: 'Fruit Crown', type: 'accessory', icon: '🍓' },
    { id: 'flame', name: 'Flame Trail', type: 'accessory', icon: '🔥' },
    { id: 'bubble', name: 'Bubble Trail', type: 'accessory', icon: '🫧' }
  ];
  const packs = [
    { id: 'space-pack', name: 'Space Pack', description: 'Cosmic Voyager skin + Star Antenna', icon: '🚀', cost: 500, rewards: ['cosmic', 'antenna'] },
    { id: 'ice-pack', name: 'Ice Pack', description: 'Frostbite skin + Frost Scarf', icon: '❄️', cost: 480, rewards: ['frost', 'scarf'] },
    { id: 'dog-pack', name: 'Dog Pack', description: 'Puppy Pal skin + Puppy Ears', icon: '🐶', cost: 450, rewards: ['puppy', 'dogears'] },
    { id: 'robot-pack', name: 'Robot Pack', description: 'Circuit Snake skin + Robot Visor', icon: '🤖', cost: 600, rewards: ['circuit', 'visor'] },
    { id: 'galaxy-pack', name: 'Galaxy Pack', description: 'Royal Nebula skin + Star Crown', icon: '🌌', cost: 700, rewards: ['royal', 'crown'] },
    { id: 'fruits-pack', name: 'Fruits Pack', description: 'Fruit Salad skin + Fruit Crown', icon: '🍉', cost: 400, rewards: ['fruit', 'fruit-hat'] },
    { id: 'fire-pack', name: 'Fire Pack', description: 'Inferno skin + Flame Trail', icon: '🔥', cost: 550, rewards: ['inferno', 'flame'] },
    { id: 'water-pack', name: 'Water Pack', description: 'Lagoon skin + Bubble Trail', icon: '🌊', cost: 500, rewards: ['lagoon', 'bubble'] }
  ];
  const allItems = [...skins, ...accessories];
  const shop = document.getElementById('season-shop');
  if (!shop) return;

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
      return {
        coins: Math.max(0, Number(saved.coins) || 0),
        xp: Math.max(0, Number(saved.xp) || 0),
        owned: Array.isArray(saved.owned) ? [...new Set(['lime', 'none', ...saved.owned])] : ['lime', 'none'],
        packs: Array.isArray(saved.packs) ? saved.packs : [],
        equipped: { skin: 'lime', accessory: 'none', ...(saved.equipped || {}) },
        rewarded: Array.isArray(saved.rewarded) ? saved.rewarded : []
      };
    } catch {
      return { coins: 0, xp: 0, owned: ['lime', 'none'], packs: [], equipped: { skin: 'lime', accessory: 'none' }, rewarded: [] };
    }
  }
  let data = load();
  const levelForXP = xp => Math.floor(xp / 100) + 1;
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

    const packCards = packs.map(pack => {
      const purchased = data.packs.includes(pack.id);
      const rewardNames = pack.rewards.map(id => itemById(id)?.name).filter(Boolean).join(' + ');
      return `<article class="pack-card"><div class="pack-icon">${pack.icon}</div><div class="pack-copy"><span class="item-kind">COSMETIC BUNDLE</span><h4>${pack.name}</h4><p>${pack.description}</p><small>${rewardNames}</small></div><button type="button" data-pack="${pack.id}" ${purchased ? 'disabled' : ''}>${purchased ? 'Owned' : `Buy · ${pack.cost} ◆`}</button></article>`;
    }).join('');
    const itemCards = allItems.map(item => {
      const owned = data.owned.includes(item.id);
      const equipped = data.equipped[item.type] === item.id;
      const locked = level < (item.level || 1);
      const buttonText = equipped ? 'Equipped' : owned ? 'Equip' : locked ? `Unlocks at level ${item.level}` : `Buy · ${item.cost || 0} ◆`;
      return `<article class="shop-item ${item.type}" style="--item-color:${item.color || '#9fb6c4'}"><div class="item-art">${item.icon}</div><div class="item-copy"><span class="item-kind">${item.type === 'skin' ? 'SNAKE SKIN' : 'ACCESSORY'}</span><h4>${item.name}</h4><small>${locked ? `Season level ${item.level}` : owned ? 'Owned' : 'Available now'}</small></div><button type="button" data-item="${item.id}" ${equipped || locked ? 'disabled' : ''}>${buttonText}</button></article>`;
    }).join('');

    shop.innerHTML = `<section class="pack-shop" aria-labelledby="pack-title"><div class="pack-shop-heading"><div><span class="item-kind">THEMED BUNDLES</span><h3 id="pack-title">Choose your pack</h3></div><p>Each pack unlocks a matching snake skin and accessory. Buy once with coins earned from runs.</p></div><div class="pack-grid">${packCards}</div></section><section class="cosmetic-shop" aria-labelledby="cosmetic-title"><div class="pack-shop-heading"><div><span class="item-kind">MIX & MATCH</span><h3 id="cosmetic-title">Individual cosmetics</h3></div></div><div class="cosmetic-grid">${itemCards}</div></section>`;
    shop.querySelectorAll('button[data-item]').forEach(button => button.addEventListener('click', () => selectItem(button.dataset.item)));
    shop.querySelectorAll('button[data-pack]').forEach(button => button.addEventListener('click', () => buyPack(button.dataset.pack)));
  }

  function selectItem(id) {
    const item = itemById(id);
    if (!item || levelForXP(data.xp) < (item.level || 1)) return;
    if (!data.owned.includes(id)) {
      const cost = Number(item.cost) || 0;
      if (data.coins < cost) {
        document.getElementById('season-reward').textContent = `You need ${cost - data.coins} more coins for ${item.name}. Finish another run!`;
        return;
      }
      data.coins -= cost;
      data.owned.push(id);
    }
    data.equipped[item.type] = id;
    save();
  }

  function buyPack(id) {
    const pack = packs.find(item => item.id === id);
    if (!pack || data.packs.includes(id)) return;
    if (data.coins < pack.cost) {
      document.getElementById('season-reward').textContent = `You need ${pack.cost - data.coins} more coins for the ${pack.name}. Finish another run!`;
      return;
    }
    data.coins -= pack.cost;
    data.packs.push(id);
    data.owned = [...new Set([...data.owned, ...pack.rewards])];
    save();
    document.getElementById('season-reward').textContent = `${pack.name} unlocked! Its skin and accessory are now in your cosmetics.`;
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
      if (!data.rewarded.includes(level)) { data.coins += level * 50; data.rewarded.push(level); }
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
    const emoji = { antenna: '📡', scarf: '🧣', dogears: '🐾', visor: '🥽', 'fruit-hat': '🍓', flame: '🔥', bubble: '🫧' }[snake.accessory];
    if (emoji) {
      ctx.save(); ctx.translate(snake.x, snake.y); ctx.rotate(angle);
      ctx.font = '15px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(emoji, -5, -12); ctx.restore(); return;
    }
    ctx.save(); ctx.translate(snake.x, snake.y); ctx.rotate(angle); ctx.shadowBlur = 12;
    if (snake.accessory === 'cap') {
      ctx.shadowColor = '#f4d35e'; ctx.fillStyle = '#f4d35e';
      ctx.beginPath(); ctx.ellipse(2, -8, 8, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(2, -5, 10, 2);
    } else if (snake.accessory === 'crown') {
      ctx.shadowColor = '#ffd45c'; ctx.fillStyle = '#ffd45c';
      ctx.beginPath(); ctx.moveTo(-7, -7); ctx.lineTo(-6, -17); ctx.lineTo(-2, -12); ctx.lineTo(1, -19); ctx.lineTo(4, -12); ctx.lineTo(8, -16); ctx.lineTo(7, -7); ctx.closePath(); ctx.fill();
    } else if (snake.accessory === 'wings') {
      ctx.shadowColor = '#92f4ff'; ctx.fillStyle = '#92f4ff';
      for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-5, 3); ctx.quadraticCurveTo(-17, side * 4, -19, side * 14); ctx.quadraticCurveTo(-9, side * 11, -3, 8); ctx.fill(); }
    } else if (snake.accessory === 'cape') {
      ctx.shadowColor = '#ff70ce'; ctx.fillStyle = '#ff70ce';
      ctx.beginPath(); ctx.moveTo(-7, 3); ctx.lineTo(-22, 9); ctx.lineTo(-19, 20); ctx.lineTo(-4, 8); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  window.SnakeProgression = { finishRun, applyToSnake, drawAccessory };
  render();
})();
