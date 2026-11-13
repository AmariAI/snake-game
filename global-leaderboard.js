(() => {
  const SUPABASE_URL = "https://edwhgcufkzgqcgloipci.supabase.co";
  // This is the publishable browser key, not the secret key.
  const SUPABASE_KEY = "sb_publishable_WDFSP2VcqAgz8Aze23PHWw_R9osZkPO";

  const periods = [
    ["hour", "Past hour"],
    ["day", "Past day"],
    ["week", "Past week"],
    ["month", "Past month"],
    ["year", "Past year"],
    ["all", "All time"]
  ];

  const style = document.createElement("style");
  style.textContent = `
    .global-scores { margin-top: 28px; padding: 22px; background: #0d1b2b;
      border: 1px solid #203447; border-radius: 13px; }
    .global-scores-head { display:flex; justify-content:space-between; align-items:center;
      gap:12px; flex-wrap:wrap; margin-bottom:14px; }
    .global-scores h3 { margin:0; color:#eff7fa; font-size:20px; }
    .global-scores select { background:#071421; color:#eff7fa; border:1px solid #385366;
      border-radius:7px; padding:9px; font:inherit; }
    .global-scores ol { margin:0; padding:0; list-style:none; }
    .global-scores li { display:flex; justify-content:space-between; gap:12px;
      padding:10px 4px; border-bottom:1px solid #ffffff12; color:#c5d2d9; }
    .global-scores li b { color:#a5ff72; }
    .global-scores-status { color:#91a9b9; font-size:12px; margin:12px 0 0; }
  `;
  document.head.appendChild(style);

  const section = document.createElement("section");
  section.className = "global-scores";
  section.innerHTML = `
    <div class="global-scores-head">
      <h3>Global leaderboard</h3>
      <label>
        <span class="sr-only">Leaderboard time period</span>
        <select aria-label="Leaderboard time period">
          ${periods.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}
        </select>
      </label>
    </div>
    <ol aria-live="polite"></ol>
    <p class="global-scores-status" role="status">Loading scores…</p>
  `;

  const playSection = document.getElementById("play");
  if (playSection) playSection.appendChild(section);

  const select = section.querySelector("select");
  const list = section.querySelector("ol");
  const status = section.querySelector(".global-scores-status");

  function headers() {
    return {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`
    };
  }

  async function load(period = select.value) {
    status.textContent = "Loading scores…";
    list.replaceChildren();

    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/snake_leaderboard`,
        {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({ p_period: period })
        }
      );

      if (!response.ok) throw new Error(await response.text());

      const scores = await response.json();
      if (!scores.length) {
        status.textContent = "No scores for this period yet. Be the first!";
        return;
      }

      scores.forEach((entry, index) => {
        const row = document.createElement("li");
        const player = document.createElement("span");
        const score = document.createElement("b");

        player.textContent = `${index + 1}. ${entry.player_name}`;
        score.textContent = Math.floor(entry.score).toLocaleString();

        row.append(player, score);
        list.appendChild(row);
      });

      status.textContent = `Top players · ${periods.find(([value]) => value === period)?.[1]}`;
    } catch (error) {
      console.error("Could not load global leaderboard:", error);
      status.textContent = "Could not load leaderboard. Check the Supabase setup.";
    }
  }

  async function submit(playerName, score) {
    const name = String(playerName || "Player").trim().slice(0, 14);
    const finalScore = Math.floor(Number(score));

    if (!Number.isFinite(finalScore) || finalScore < 0) return;

    try {
      let playerId = localStorage.getItem("snake-global-player-id");

      if (!playerId) {
        playerId = crypto.randomUUID();
        localStorage.setItem("snake-global-player-id", playerId);
      }

      const response = await fetch(`${SUPABASE_URL}/rest/v1/snake_scores`, {
        method: "POST",
        headers: {
          ...headers(),
          "Prefer": "return=minimal"
        },
        body: JSON.stringify({
          player_id: playerId,
          player_name: name,
          score: finalScore
        })
      });

      if (!response.ok) throw new Error(await response.text());

      await load(select.value);
    } catch (error) {
      console.error("Could not submit score:", error);
      status.textContent = "Could not submit score. Check the Supabase setup.";
    }
  }

  select.addEventListener("change", () => load(select.value));

  // The game calls this once when a real player's run ends.
  window.SnakeLeaderboard = { submit };

  load("all");
})();
