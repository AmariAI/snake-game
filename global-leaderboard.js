(() => {
  'use strict';

  const SUPABASE_URL = 'https://edwhgcufkzgqcgloipci.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_WDFSP2VcqAgz8Aze23PHWw_R9osZkPO';
  const LOCAL_KEY = 'snake-clash-local-leaderboard';
  const host = document.getElementById('play');
  if (!host) return;

  const periods = [
    ['hour', 'Past hour'], ['day', 'Past day'], ['week', 'Past week'],
    ['month', 'Past month'], ['year', 'Past year'], ['all', 'All time']
  ];

  const section = document.createElement('section');
  section.className = 'global-scores';
  section.id = 'global-leaderboard';
  section.setAttribute('aria-label', 'Global leaderboard');
  section.innerHTML = `
    <div class="global-scores-head">
      <div><p class="eyebrow">COMMUNITY RECORDS</p><h3>Global leaderboard</h3></div>
      <label><span class="sr-only">Leaderboard period</span><select aria-label="Leaderboard period">${periods.map(([v, label]) => `<option value="${v}"${v === 'all' ? ' selected' : ''}>${label}</option>`).join('')}</select></label>
    </div>
    <ol aria-live="polite"></ol>
    <p class="global-scores-status" role="status">Loading scores…</p>`;
  host.appendChild(section);

  const select = section.querySelector('select');
  const list = section.querySelector('ol');
  const status = section.querySelector('[role="status"]');

  function readLocalScores() {
    try {
      const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  function writeLocalScores(entries) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(entries));
  }

  function sortScores(entries) {
    return [...entries]
      .filter(entry => Number.isFinite(Number(entry.score)) && Number(entry.score) > 0)
      .sort((a, b) => Number(b.score) - Number(a.score))
      .slice(0, 10)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }

  function renderScores(entries) {
    const rows = sortScores(entries);
    list.replaceChildren();
    if (!rows.length) {
      status.textContent = 'No scores yet. Be the first!';
      return;
    }
    rows.forEach((entry) => {
      const row = document.createElement('li');
      const player = document.createElement('span');
      const score = document.createElement('b');
      player.textContent = `${entry.rank}. ${String(entry.player_name || 'Player').slice(0, 14)}`;
      score.textContent = Math.floor(Number(entry.score) || 0).toLocaleString();
      row.append(player, score);
      list.appendChild(row);
    });
    status.textContent = `Top scores · ${periods.find(([value]) => value === select.value)?.[1] || 'All time'}`;
  }

  async function loadRemoteScores() {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/snake_scores?select=player_name,score&order=score.desc&limit=10`, {
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  async function loadLeaderboard(period = select.value) {
    status.textContent = 'Loading scores…';
    list.replaceChildren();

    try {
      const remoteScores = await loadRemoteScores();
      if (remoteScores.length) {
        renderScores(remoteScores);
        return;
      }
    } catch (error) {
      console.warn('Remote leaderboard failed, using local cache.', error);
    }

    const localScores = readLocalScores();
    renderScores(localScores);
    if (!localScores.length) {
      status.textContent = 'No scores yet. Be the first!';
    }
  }

  async function submitScore(name, score) {
    const playerName = String(name || 'Player').trim().slice(0, 14);
    const finalScore = Math.floor(Number(score));
    if (!playerName || !Number.isFinite(finalScore) || finalScore <= 0) return;

    const entry = { player_name: playerName, score: finalScore };
    const current = readLocalScores();
    const updated = sortScores([...current, entry]);
    writeLocalScores(updated);
    renderScores(updated);

    try {
      let playerId = localStorage.getItem('snake-global-player-id');
      if (!playerId) {
        playerId = window.crypto?.randomUUID?.() || `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, (char) => {
          const r = Math.random() * 16 | 0;
          return (char === 'x' ? r : (r & 3 | 8)).toString(16);
        });
        localStorage.setItem('snake-global-player-id', playerId);
      }

      const response = await fetch(`${SUPABASE_URL}/rest/v1/snake_scores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({ player_id: playerId, player_name: playerName, score: finalScore })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }
    } catch (error) {
      console.warn('Remote score submit failed; saved locally instead.', error);
      status.textContent = 'Saved locally. Remote leaderboard is unavailable right now.';
    }

    await loadLeaderboard(select.value);
  }

  select.addEventListener('change', () => loadLeaderboard(select.value));
  window.SnakeLeaderboard = { submitScore, loadLeaderboard };
  loadLeaderboard();
})();
