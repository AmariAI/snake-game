(() => {
  const SUPABASE_URL = "https://edwhgcufkzgqcgloipci.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_WDFSP2VcqAgz8Aze23PHWw_R9osZkPO";

  const style = document.createElement("style");
  style.textContent = `
    .global-leaderboard {
      max-width: 1240px;
      margin: 0 auto 28px;
      padding: 0 30px;
    }
    .gl-panel {
      background: #0d1b2b;
      border: 1px solid #203447;
      border-radius: 13px;
      padding: 18px;
    }
    .gl-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .gl-head h3 {
      margin: 0;
      font-size: 20px;
      letter-spacing: -0.04em;
    }
    .gl-head select {
      background: #071421;
      color: white;
      border: 1px solid #35576a;
      border-radius: 7px;
      padding: 8px 10px;
      font: inherit;
    }
    .gl-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .gl-list li {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid rgba(255,255,255,.08);
      color: #d6e6ef;
    }
    .gl-list li b {
      color: #a5ff72;
    }
    .gl-status {
      margin: 12px 0 0;
      color: #8ea5b4;
      font-size: 12px;
    }
  `;
  document.head.appendChild(style);

  const panel = document.createElement("div");
  panel.className = "global-leaderboard";
  panel.innerHTML = `
    <div class="gl-panel">
      <div class="gl-head">
        <h3>Global leaderboard</h3>
        <select aria-label="Leaderboard time period">
          <option value="hour">Past hour</option>
          <option value="day">Past day</option>
          <option value="week">Past week</option>
          <option value="month">Past month</option>
          <option value="year">Past year</option>
          <option value="all" selected>All time</option>
        </select>
      </div>
      <ol class="gl-list"></ol>
      <p class="gl-status">Loading scores…</p>
    </div>
  `;

  document.body.appendChild(panel);

  const select = panel.querySelector("select");
  const list = panel.querySelector(".gl-list");
  const status = panel.querySelector(".gl-status");

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));
  }

  async function loadLeaderboard(period = "all") {
    status.textContent = "Loading scores…";
    list.innerHTML = "";

    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/snake_leaderboard`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ p_period: period })
      });

      if (!res.ok) throw new Error(await res.text());

      const rows = await res.json();
      if (!rows || rows.length === 0) {
        status.textContent = "No scores for this period yet.";
        return;
      }

      rows.forEach((entry, index) => {
        const li = document.createElement("li");
        li.innerHTML = `
          <span>${index + 1}. ${escapeHtml(entry.player_name)}</span>
          <b>${Number(entry.score).toLocaleString()}</b>
        `;
        list.appendChild(li);
      });

      status.textContent = `Top scores · ${select.options[select.selectedIndex].text}`;
    } catch (err) {
      console.error("Leaderboard error:", err);
      status.textContent = "Leaderboard unavailable.";
    }
  }

  async function submitScore(name, score) {
    const playerName = String(name || "Player").trim().slice(0, 14);
    const finalScore = Math.max(0, Math.floor(Number(score) || 0));
    if (!playerName || !finalScore) return;

    try {
      let playerId = localStorage.getItem("snake-player-id");
      if (!playerId) {
        playerId = crypto.randomUUID();
        localStorage.setItem("snake-player-id", playerId);
      }

      const res = await fetch(`${SUPABASE_URL}/rest/v1/snake_scores`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          player_id: playerId,
          player_name: playerName,
          score: finalScore
        })
      });

      if (!res.ok) throw new Error(await res.text());

      await loadLeaderboard(select.value);
    } catch (err) {
      console.error("Score submit error:", err);
    }
  }

  select.addEventListener("change", () => loadLeaderboard(select.value));

  window.SnakeLeaderboard = { submitScore, loadLeaderboard };
  loadLeaderboard("all");
})();
