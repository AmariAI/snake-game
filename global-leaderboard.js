(() => {
  'use strict';

  const SUPABASE_URL = 'https://edwhgcufkzgqcgloipci.supabase.co';
  // Use only the public publishable key in browser code. Never put a secret key here.
  const SUPABASE_KEY = 'sb_publishable_WDFSP2VcqAgz8Aze23PHWw_R9osZkPO';
  const host = document.getElementById('play');
  if (!host) return;

  const periods = [
    ['hour', 'Past hour'], ['day', 'Past day'], ['week', 'Past week'],
    ['month', 'Past month'], ['year', 'Past year'], ['all', 'All time']
  ];
  const section = document.createElement('section');
  section.className = 'global-scores';
  section.id = 'leaderboard';
  section.setAttribute('aria-label', 'Global leaderboard');
  section.innerHTML = `
    <div class="global-scores-head">
      <div><p class="eyebrow">COMMUNITY RECORDS</p><h3>Global leaderboard</h3></div>
      <label><span class="sr-only">Leaderboard period</span><select aria-label="Leaderboard period">${periods.map(([v, label]) => `<option value="${v}"${v === 'all' ? ' selected' : ''}>${label}</option>`).join('')}</select></label>
    </div>
    <ol aria-live="polite"></ol><p class="global-scores-status" role="status">Loading scores…</p>`;
  host.appendChild(section);

  const select = section.querySelector('select');
  const list = section.querySelector('ol');
  const status = section.querySelector('[role="status"]');
  const headers = () => ({
    'Content-Type': 'application/json',
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`
  });

  async function loadLeaderboard(period = select.value) {
    status.textContent = 'Loading scores…';
    list.replaceChildren();
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/snake_leaderboard`, {
        method: 'POST', headers: headers(), body: JSON.stringify({ p_period: period })
      });
      if (!response.ok) throw new Error(await response.text());
      const scores = await response.json();
      if (!Array.isArray(scores) || scores.length === 0) {
        status.textContent = 'No scores for this period yet. Be the first!';
        return;
      }
      scores.forEach((entry, index) => {
        const row = document.createElement('li');
        const player = document.createElement('span');
        const score = document.createElement('b');
        player.textContent = `${index + 1}. ${entry.player_name}`;
        score.textContent = Math.floor(Number(entry.score) || 0).toLocaleString();
        row.append(player, score);
        list.appendChild(row);
      });
      status.textContent = `Top scores · ${periods.find(([value]) => value === period)?.[1] || 'All time'}`;
    } catch (error) {
      console.error('Leaderboard load failed:', error);
      status.textContent = 'Leaderboard unavailable. Check the Supabase table, function, and public policies.';
    }
  }

  async function submitScore(name, score) {
    const playerName = String(name || 'Player').trim().slice(0, 14);
    const finalScore = Math.floor(Number(score));
    if (!playerName || !Number.isFinite(finalScore) || finalScore <= 0) return;
    try {
      let playerId = localStorage.getItem('snake-global-player-id');
      if (!playerId) {
        playerId = window.crypto?.randomUUID?.() || `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 3 | 8)).toString(16);
        });
        localStorage.setItem('snake-global-player-id', playerId);
      }
      const response = await fetch(`${SUPABASE_URL}/rest/v1/snake_scores`, {
        method: 'POST',
        headers: { ...headers(), Prefer: 'return=minimal' },
        body: JSON.stringify({ player_id: playerId, player_name: playerName, score: finalScore })
      });
      if (!response.ok) throw new Error(await response.text());
      await loadLeaderboard(select.value);
    } catch (error) {
      console.error('Score submit failed:', error);
      status.textContent = 'Score could not be saved. Check Supabase permissions and table columns.';
    }
  }

  select.addEventListener('change', () => loadLeaderboard(select.value));
  window.SnakeLeaderboard = { submitScore, loadLeaderboard };
  loadLeaderboard();
})();
