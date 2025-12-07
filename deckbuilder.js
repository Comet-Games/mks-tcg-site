// ===== Config =====
const CSV_URL   = 'data/MasterSheet.csv';
const FRONT_DIR = 'images/cards';
const FRONT_EXT = 'png';
const BACK_IMAGE = 'images/back.png';
const DECK_SLOTS = 12; // tweak if you want more / fewer slots

// ===== State =====
let CARDS = [];
let CARD_MAP = new Map(); // card_id -> card
let DECK = new Array(DECK_SLOTS).fill(null); // stores card_id or null
let ACTIVE_SLOT = 0;

// ===== DOM =====
const deckSlotsEl = document.getElementById('deckSlots');
const clearDeckBtn = document.getElementById('clearDeck');

const libGrid   = document.getElementById('libGrid');
const libEmpty  = document.getElementById('libEmpty');
const libSearch = document.getElementById('libSearch');
const libType   = document.getElementById('libType');
const libRarity = document.getElementById('libRarity');

const scrollTopBtn = document.getElementById('scrollTopBtn');

const targetDriver  = document.getElementById('targetDriver');
const targetKart    = document.getElementById('targetKart');
const targetItem    = document.getElementById('targetItem');
const targetUtility = document.getElementById('targetUtility');
const targetFuel    = document.getElementById('targetFuel');

const typeCountEls  = document.querySelectorAll('.deck-type-count');

// ===== Helpers =====
const txt = s => (s ?? '').toString().trim();
const lc  = s => txt(s).toLowerCase();

function rarityKey(r) {
  const v = lc(r);
  if (v.startsWith('myth')) return 'mythic';
  if (v.startsWith('rare') && !v.includes('un')) return 'rare';
  if (v.startsWith('un')) return 'uncommon';
  return 'common';
}

function titleCase(s) {
  s = txt(s);
  return s ? s[0].toUpperCase() + s.slice(1) + s.slice(1) : s;
}

// Fuel detection, similar to catalogue
function isFuel(card) {
  const type = lc(card.type || '');
  const name = lc(card.name || '');
  const id   = lc(card.card_id || '');

  if (type.includes('fuel')) return true;
  if (name === 'fuel' || name.startsWith('fuel ')) return true;
  if (!type && /^f\d{3,}$/i.test(id)) return true;
  return false;
}

function mapRow(row) {
  const card = {
    name:    row['Card Name'] ?? '',
    type:    row['Card Type'] ?? '',
    rarity:  row['Rarity']    ?? 'Common',
    card_id: row['Card ID']   ?? '',
    text:    [
      row['Offensive Text'], row['Defensive Text'],
      row['Utility Effect'], row['Flavour Text']
    ].filter(Boolean).join(' ')
  };

  card.type   = txt(card.type);
  card.rarity = txt(card.rarity);
  card.name   = txt(card.name);
  card.card_id = txt(card.card_id);

  return card;
}

function frontImagePath(card) {
  const id = txt(card.card_id);
  if (!id) return '';

  if (isFuel(card)) {
    // Fuel: f001.png, etc.
    return `${FRONT_DIR}/${encodeURIComponent(id.toLowerCase())}.${FRONT_EXT}`;
  }
  // Everything else: ID_vv1.png
  return `${FRONT_DIR}/${encodeURIComponent(id + "_vv1")}.${FRONT_EXT}`;
}

// ===== Deck rendering =====
function renderDeck() {
  deckSlotsEl.innerHTML = DECK.map((id, idx) => {
    const isActive = idx === ACTIVE_SLOT;
    const card = id ? CARD_MAP.get(id) : null;
    const front = card ? frontImagePath(card) : null;
    const type  = card ? (isFuel(card) ? 'Fuel' : card.type || 'Unknown') : null;

    return `
      <button class="deck-slot${isActive ? ' active' : ''}" data-slot="${idx}" type="button">
        ${card ? `
          <div class="deck-slot-thumb">
            <img src="${front}" alt="${card.name} front">
          </div>
          <div class="deck-slot-meta">
            <div class="deck-slot-name">${card.name}</div>
            <div class="deck-slot-type">${type}${card.card_id ? ` • ${card.card_id}` : ''}</div>
          </div>
          <span class="deck-slot-clear" data-clear="${idx}" aria-label="Remove card">×</span>
        ` : `
          <div class="deck-slot-empty">
            <span class="plus">+</span>
            <span class="label">Empty slot</span>
          </div>
        `}
      </button>
    `;
  }).join('');

  wireDeckSlotEvents();
  updateTypeSummary();
  updateUrlFromState();
}

function wireDeckSlotEvents() {
  deckSlotsEl.querySelectorAll('.deck-slot').forEach(btn => {
    const idx = Number(btn.dataset.slot);
    btn.addEventListener('click', (e) => {
      const clear = e.target.closest('.deck-slot-clear');
      if (clear) {
        // Clear this slot
        const ci = Number(clear.dataset.clear);
        DECK[ci] = null;
        if (ACTIVE_SLOT === ci) ACTIVE_SLOT = 0;
        renderDeck();
        return;
      }

      ACTIVE_SLOT = idx;
      renderDeck();
      document.querySelector('.deck-shell').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

// ===== Library rendering =====
function applyLibFilters() {
  const q   = lc(libSearch.value);
  const t   = lc(libType.value);
  const rar = lc(libRarity.value);

  let rows = CARDS.filter(c => {
    const hay = lc([
      c.name, c.card_id, c.type, c.rarity, c.text
    ].join(' '));

    const qOk = !q || hay.includes(q);

    let typeOk = true;
    const typeLc = lc(c.type || '');
    const fuel = isFuel(c);

    if (t) {
      if (t === 'fuel') {
        typeOk = fuel;
      } else {
        if (t === 'driver')   typeOk = !fuel && typeLc === 'driver';
        else if (t === 'kart')    typeOk = !fuel && typeLc === 'kart';
        else if (t === 'item')    typeOk = !fuel && typeLc === 'item';
        else if (t === 'utility') typeOk = !fuel && typeLc === 'utility';
        else typeOk = !fuel && typeLc === t;
      }
    }

    const rOk = !rar || rarityKey(c.rarity) === rar;

    return qOk && typeOk && rOk;
  });

  // Sort by name then rarity
  rows.sort((a, b) => txt(a.name).localeCompare(txt(b.name)));

  libGrid.innerHTML = rows.map(renderLibCard).join('');
  libEmpty.hidden = rows.length !== 0;
  wireLibCardEvents();
}

function renderLibCard(card) {
  const front = frontImagePath(card);
  const rar   = rarityKey(card.rarity);
  const type  = isFuel(card) ? 'Fuel' : (card.type || 'Unknown');

  return `
    <button class="lib-card tile" data-id="${card.card_id}" type="button">
      <div class="card-wrap rarity-${rar}" data-name="${card.name}">
        <div class="card">
          <span class="glow"></span>
          <div class="face front">
            <img loading="lazy" src="${front}" alt="${card.name} front">
          </div>
          <div class="face back">
            <img loading="lazy" src="${BACK_IMAGE}" alt="Card back">
          </div>
        </div>
      </div>
      <div class="title">${card.name}</div>
      <div class="meta">${type}${card.card_id ? ` • ${card.card_id}` : ''} • ${card.rarity}</div>
    </button>
  `;
}

function wireLibCardEvents() {
  libGrid.querySelectorAll('.lib-card').forEach(btn => {
    const id = btn.dataset.id;
    btn.addEventListener('click', () => {
      if (!id || !CARD_MAP.has(id)) return;

      // If no active slot, pick first empty or 0
      if (ACTIVE_SLOT == null) ACTIVE_SLOT = 0;
      if (DECK[ACTIVE_SLOT] !== null) {
        const emptyIdx = DECK.findIndex(x => x === null);
        if (emptyIdx !== -1) ACTIVE_SLOT = emptyIdx;
      }

      DECK[ACTIVE_SLOT] = id;

      // Advance to next empty slot (nice QoL)
      const nextEmpty = DECK.findIndex((x, i) => x === null && i > ACTIVE_SLOT);
      if (nextEmpty !== -1) ACTIVE_SLOT = nextEmpty;

      renderDeck();
    });
  });
}

// ===== Type breakdown / targets =====
function getDeckTypeCounts() {
  const counts = {
    driver: 0,
    kart: 0,
    item: 0,
    utility: 0,
    fuel: 0,
    other: 0
  };

  for (const id of DECK) {
    if (!id) continue;
    const card = CARD_MAP.get(id);
    if (!card) continue;

    if (isFuel(card)) {
      counts.fuel++;
      continue;
    }

    const t = lc(card.type || '');
    if (t === 'driver') counts.driver++;
    else if (t === 'kart') counts.kart++;
    else if (t === 'item') counts.item++;
    else if (t === 'utility') counts.utility++;
    else counts.other++;
  }

  return counts;
}

function updateTypeSummary() {
  const counts = getDeckTypeCounts();

  const targets = {
    driver:  Number(targetDriver.value)  || 0,
    kart:    Number(targetKart.value)    || 0,
    item:    Number(targetItem.value)    || 0,
    utility: Number(targetUtility.value) || 0,
    fuel:    Number(targetFuel.value)    || 0
  };

  typeCountEls.forEach(el => {
    const type = el.dataset.type;
    const current = counts[type] ?? 0;
    const target  = targets[type] ?? 0;

    el.textContent = `${current} / ${target}`;

    el.classList.remove('ok', 'warn');
    if (!target) return;
    if (current === target) {
      el.classList.add('ok');
    } else {
      el.classList.add('warn');
    }
  });
}

// ===== URL encoding / decoding =====
function encodeStateToUrl() {
  const url = new URL(window.location.href);

  // Deck: list of IDs, skipping empty slots
  const ids = DECK.filter(Boolean);
  if (ids.length) {
    url.searchParams.set('deck', ids.join('.'));
  } else {
    url.searchParams.delete('deck');
  }

  // Targets: d:,k:,i:,u:,f:
  const cfgParts = [
    `d:${Number(targetDriver.value)  || 0}`,
    `k:${Number(targetKart.value)    || 0}`,
    `i:${Number(targetItem.value)    || 0}`,
    `u:${Number(targetUtility.value) || 0}`,
    `f:${Number(targetFuel.value)    || 0}`
  ];
  const cfgStr = cfgParts.join('.');

  if (cfgStr) {
    url.searchParams.set('cfg', cfgStr);
  } else {
    url.searchParams.delete('cfg');
  }

  return url;
}

function updateUrlFromState() {
  const url = encodeStateToUrl();
  window.history.replaceState({}, '', url);
}

function hydrateStateFromUrl() {
  const url = new URL(window.location.href);
  const deckParam = url.searchParams.get('deck');
  const cfgParam  = url.searchParams.get('cfg');

  // Deck
  if (deckParam) {
    const ids = deckParam.split('.').map(s => txt(s)).filter(Boolean);
    DECK = new Array(DECK_SLOTS).fill(null);
    ids.slice(0, DECK_SLOTS).forEach((id, i) => {
      if (CARD_MAP.has(id)) DECK[i] = id;
    });
  }

  // Targets
  if (cfgParam) {
    const parts = cfgParam.split('.');
    const map = {};
    for (const p of parts) {
      const [k, v] = p.split(':');
      if (!k) continue;
      map[k] = Number(v) || 0;
    }
    if (map.d != null) targetDriver.value  = map.d;
    if (map.k != null) targetKart.value    = map.k;
    if (map.i != null) targetItem.value    = map.i;
    if (map.u != null) targetUtility.value = map.u;
    if (map.f != null) targetFuel.value    = map.f;
  }
}

// ===== CSV load =====
function loadCSV() {
  Papa.parse(CSV_URL, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: (res) => {
      CARDS = res.data
        .map(mapRow)
        .filter(c => c.name); // ignore blanks

      CARD_MAP = new Map();
      CARDS.forEach(c => {
        if (c.card_id) CARD_MAP.set(c.card_id, c);
      });

      // Hydrate from URL after we know what cards exist
      hydrateStateFromUrl();

      renderDeck();
      applyLibFilters();
    },
    error: (e) => {
      console.error(e);
      libEmpty.textContent = 'Failed to load card data.';
      libEmpty.hidden = false;
    }
  });
}

// ===== Wiring =====
[libSearch, libType, libRarity].forEach(el => {
  el.addEventListener('input', applyLibFilters);
});

[targetDriver, targetKart, targetItem, targetUtility, targetFuel].forEach(el => {
  el.addEventListener('input', () => {
    updateTypeSummary();
    updateUrlFromState();
  });
});

clearDeckBtn.addEventListener('click', () => {
  DECK = new Array(DECK_SLOTS).fill(null);
  ACTIVE_SLOT = 0;
  renderDeck();
});

scrollTopBtn.addEventListener('click', () => {
  document.querySelector('.deck-shell').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.addEventListener('DOMContentLoaded', loadCSV);
