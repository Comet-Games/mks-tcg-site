// --- State management ---
const STORAGE_KEY = "mks_race_tracker_state_v1";

let state = {
  mode: "table",          // "table" | "single"
  players: [],            // {id, name, position}
  view: "list",           // "list" | "grid"
  selectedPlayerId: null
};

let previousLeaderId = null;

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Could not save state", e);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.players)) {
      state = {
        mode: parsed.mode || "table",
        players: parsed.players,
        view: parsed.view || "list",
        selectedPlayerId: null
      };
    }
  } catch (e) {
    console.warn("Could not load state", e);
  }
}

// --- DOM helpers ---
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const setupSection = $("#setupSection");
const gameSection = $("#gameSection");
const playersContainer = $("#playersContainer");

const modePills = $("#modePills");
const viewPills = $("#viewPills");

const setupTableBtn = $("#setupTableBtn");
const setupSingleBtn = $("#setupSingleBtn");
const tableSetupFields = $("#tableSetupFields");
const singleSetupFields = $("#singleSetupFields");

const newPlayerNameInput = $("#newPlayerName");
const addPlayerBtn = $("#addPlayerBtn");
const playerCountHint = $("#playerCountHint");
const singlePlayerNameInput = $("#singlePlayerName");

const startGameBtn = $("#startGameBtn");
const resetStateBtn = $("#resetStateBtn");

const movementPanel = $("#movementPanel");
const movementPlayerName = $("#movementPlayerName");
const movementPlayerPos = $("#movementPlayerPos");
const deltaInput = $("#deltaInput");
const applyDeltaBtn = $("#applyDeltaBtn");
const cancelMovementBtn = $("#cancelMovementBtn");

const rollD6Btn = $("#rollD6Btn");
const rollD20Btn = $("#rollD20Btn");
const diceOutput = $("#diceOutput");

const restartRaceBtn = $("#restartRaceBtn");
const newGameBtn = $("#newGameBtn");

// --- Rendering ---
function renderSetup() {
  // mode pills
  $$("#modePills .pill").forEach((p) => {
    p.classList.toggle("active", p.dataset.mode === state.mode);
  });

  // show relevant setup fields
  if (state.mode === "table") {
    tableSetupFields.style.display = "";
    singleSetupFields.style.display = "none";
  } else {
    tableSetupFields.style.display = "none";
    singleSetupFields.style.display = "";
  }

  if (state.mode === "single" && state.players.length === 1) {
    singlePlayerNameInput.value = state.players[0].name || "";
  }

  // start button availability
  if (state.mode === "table") {
    startGameBtn.disabled = state.players.length === 0;
    playerCountHint.textContent =
      state.players.length === 0
        ? "No players added yet."
        : `Players: ${state.players.map((p) => p.name).join(", ")}`;
  } else {
    startGameBtn.disabled = !singlePlayerNameInput.value.trim();
  }
}

function renderGame() {
  if (state.players.length === 0) {
    gameSection.style.display = "none";
    return;
  }
  gameSection.style.display = "";

  // view pills
  $$("#viewPills .pill").forEach((p) => {
    p.classList.toggle("active", p.dataset.view === state.view);
  });

  // capture old positions for FLIP animation
  const oldRects = {};
  playersContainer.querySelectorAll(".player-tile").forEach((tile) => {
    const id = tile.dataset.playerId;
    oldRects[id] = tile.getBoundingClientRect();
  });

  // clear container
  playersContainer.innerHTML = "";

  // sort players by position DESC, stable for ties
  const withIndex = state.players.map((p, idx) => ({ ...p, _idx: idx }));
  withIndex.sort((a, b) => {
    if (b.position !== a.position) return b.position - a.position;
    return a._idx - b._idx;
  });

  // detect leader change
  const newLeader = withIndex[0] || null;
  if (newLeader && previousLeaderId && newLeader.id !== previousLeaderId) {
    triggerLeaderFlash();
  }
  if (newLeader) {
    previousLeaderId = newLeader.id;
  }

  const container =
    state.view === "list"
      ? document.createElement("div")
      : document.createElement("div");
  container.className =
    state.view === "list" ? "players-list" : "players-grid";

  withIndex.forEach((player, i) => {
    const rank = i + 1;

    const tile = document.createElement("div");
    tile.className = "player-tile";
    if (rank === 1) tile.classList.add("rank-1");
    else if (rank === 2) tile.classList.add("rank-2");
    else if (rank === 3) tile.classList.add("rank-3");

    tile.dataset.playerId = player.id;

    const header = document.createElement("div");
    header.className = "player-header";

    const nameEl = document.createElement("div");
    nameEl.className = "player-name";
    nameEl.textContent = player.name || "Driver";

    const posEl = document.createElement("div");
    posEl.className = "player-pos";
    posEl.textContent = player.position;

    header.appendChild(nameEl);
    header.appendChild(posEl);

    const meta = document.createElement("div");
    meta.className = "player-meta";

    // Rank badge
    const rankBadge = document.createElement("span");
    rankBadge.className = "rank-badge";

    const rankLabel = (r) => {
      if (r === 1) return "1st";
      if (r === 2) return "2nd";
      if (r === 3) return "3rd";
      return r + "th";
    };

    const rankNum = document.createElement("span");
    rankNum.className = "rank-num";
    rankNum.textContent = rankLabel(rank);

    const rankText = document.createElement("span");
    rankText.textContent = "Place";

    rankBadge.appendChild(rankNum);
    rankBadge.appendChild(rankText);

    // Position tag
    const tag = document.createElement("span");
    tag.className = "tag";
    const dot = document.createElement("span");
    dot.className = "tag-dot";
    const label = document.createElement("span");
    label.textContent = "Position";
    tag.appendChild(dot);
    tag.appendChild(label);

    // Gap info (distance to racer ahead)
    const gapSpan = document.createElement("span");
    gapSpan.className = "gap";
    if (rank === 1) {
      gapSpan.textContent = "Leader";
    } else {
      const ahead = withIndex[i - 1];
      const diff = ahead.position - player.position;
      const nameShort =
        ahead.name.length > 10 ? ahead.name.slice(0, 9) + "…" : ahead.name;
      gapSpan.textContent = `-${diff} behind ${nameShort}`;
    }

    meta.appendChild(rankBadge);
    meta.appendChild(tag);
    meta.appendChild(gapSpan);

    tile.appendChild(header);
    tile.appendChild(meta);

    tile.addEventListener("click", () => openMovementPanel(player.id));

    container.appendChild(tile);
  });

  playersContainer.appendChild(container);

  // FLIP animate reordering
  const newTiles = Array.from(playersContainer.querySelectorAll(".player-tile"));

  requestAnimationFrame(() => {
    newTiles.forEach((tile) => {
      const id = tile.dataset.playerId;
      const oldRect = oldRects[id];
      const newRect = tile.getBoundingClientRect();

      if (oldRect) {
        const dx = oldRect.left - newRect.left;
        const dy = oldRect.top - newRect.top;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          tile.style.transition = "none";
          tile.style.transform = `translate(${dx}px, ${dy}px)`;

          requestAnimationFrame(() => {
            tile.style.transition =
              "transform 260ms cubic-bezier(.22,1.25,.32,1)";
            tile.style.transform = "translate(0,0)";
          });
        }
      } else {
        // new tile
        tile.classList.add("tile-enter");
      }
    });
  });
}

function renderAll() {
  renderSetup();
  renderGame();
}

// --- Movement panel logic ---
function openMovementPanel(playerId) {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return;
  state.selectedPlayerId = playerId;
  movementPlayerName.textContent = player.name;
  movementPlayerPos.textContent = `Current Position: ${player.position}`;
  deltaInput.value = 0;
  movementPanel.style.display = "";
}

function closeMovementPanel() {
  state.selectedPlayerId = null;
  movementPanel.style.display = "none";
}

function applyDelta() {
  const id = state.selectedPlayerId;
  if (!id) return;
  const player = state.players.find((p) => p.id === id);
  if (!player) return;

  const delta = parseInt(deltaInput.value, 10);
  if (isNaN(delta) || delta === 0) {
    closeMovementPanel();
    return;
  }
  player.position += delta;
  saveState();
  renderGame();
  closeMovementPanel();
}

// --- Dice ---
function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

function handleRollD6() {
  const v = rollDie(6);
  diceOutput.textContent = `d6 → ${v}`;
  bumpDice();
}

function handleRollD20() {
  const v = rollDie(20);
  diceOutput.textContent = `d20 → ${v}`;
  bumpDice();
}

function bumpDice() {
  diceOutput.classList.remove("bump");
  // force reflow to restart animation
  void diceOutput.offsetWidth;
  diceOutput.classList.add("bump");
}

// --- Restart/New Game helpers ---
function restartRace() {
  if (!state.players.length) return;
  if (!confirm("Restart race? All positions will reset to 0.")) return;

  state.players.forEach((p) => (p.position = 0));
  saveState();
  renderGame();
}

function newGame() {
  if (!confirm("Start a new game? All players and data will be cleared.")) return;

  state = {
    mode: "table",
    players: [],
    view: "list",
    selectedPlayerId: null
  };
  previousLeaderId = null;
  saveState();
  setupSection.style.display = "";
  gameSection.style.display = "none";
  renderAll();
}

function triggerLeaderFlash() {
  document.body.classList.add("leader-flash");
  setTimeout(() => {
    document.body.classList.remove("leader-flash");
  }, 600);
}

// --- Event wiring ---
function init() {
  loadState();
  renderAll();

  // Mode pills
  modePills.addEventListener("click", (e) => {
    const btn = e.target.closest(".pill");
    if (!btn) return;
    const mode = btn.dataset.mode;
    if (!mode) return;
    state.mode = mode;
    if (mode === "single" && state.players.length > 1) {
      // wipe players if coming from table multi
      state.players = [];
      previousLeaderId = null;
    }
    saveState();
    renderAll();
  });

  // View pills
  viewPills.addEventListener("click", (e) => {
    const btn = e.target.closest(".pill");
    if (!btn) return;
    const view = btn.dataset.view;
    if (!view) return;
    state.view = view;
    saveState();
    renderGame();
  });

  // Setup mode buttons
  setupTableBtn.addEventListener("click", () => {
    state.mode = "table";
    saveState();
    renderAll();
  });
  setupSingleBtn.addEventListener("click", () => {
    state.mode = "single";
    saveState();
    renderAll();
  });

  // Add player
  addPlayerBtn.addEventListener("click", () => {
    const name = newPlayerNameInput.value.trim();
    if (!name) return;
    state.players.push({
      id: "p_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      name,
      position: 0
    });
    newPlayerNameInput.value = "";
    saveState();
    renderSetup();
    renderGame();
  });

  // Start game
  startGameBtn.addEventListener("click", () => {
    if (state.mode === "single") {
      const name = singlePlayerNameInput.value.trim() || "Player";
      state.players = [
        {
          id: "p_single",
          name,
          position: 0
        }
      ];
      previousLeaderId = "p_single";
    } else if (state.players.length === 0) {
      return;
    }
    saveState();
    setupSection.style.display = "none";
    gameSection.style.display = "";
    renderGame();
  });

  // Reset state (hard reset from setup)
  resetStateBtn.addEventListener("click", () => {
    if (!confirm("Clear all players and positions?")) return;
    state = {
      mode: "table",
      players: [],
      view: "list",
      selectedPlayerId: null
    };
    previousLeaderId = null;
    saveState();
    setupSection.style.display = "";
    gameSection.style.display = "none";
    renderAll();
  });

  // Dice
  rollD6Btn.addEventListener("click", handleRollD6);
  rollD20Btn.addEventListener("click", handleRollD20);

  // Movement panel
  applyDeltaBtn.addEventListener("click", applyDelta);
  cancelMovementBtn.addEventListener("click", closeMovementPanel);

  // Quick delta buttons
  movementPanel.addEventListener("click", (e) => {
    const btn = e.target.closest("button.secondary");
    if (!btn || !btn.dataset.delta) return;
    const val = parseInt(btn.dataset.delta, 10);
    if (isNaN(val)) return;
    deltaInput.value = val;
  });

  // Restart / New game
  restartRaceBtn.addEventListener("click", restartRace);
  newGameBtn.addEventListener("click", newGame);

  // If we loaded players, skip straight to game
  if (state.players.length > 0) {
    setupSection.style.display = "none";
    gameSection.style.display = "";
    renderGame();
  }
}

document.addEventListener("DOMContentLoaded", init);
