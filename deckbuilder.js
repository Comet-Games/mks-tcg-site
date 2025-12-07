// ===== Config =====
const CSV_URL   = 'data/MasterSheet.csv';
const FRONT_DIR = 'images/cards';
const FRONT_EXT = 'png';
const BACK_IMAGE = 'images/back.png';

const DEFAULT_ITEM_SLOTS    = 10;
const DEFAULT_UTILITY_SLOTS = 10;
const MAX_DECK_NON_LEADERS  = 40;

// Rarity-based duplicate limits
const DUP_LIMIT = {
    common: 4,
    uncommon: 3,
    rare: 2,
    mythic: 1
};

// ===== State =====
let CARDS = [];
let CARD_MAP = new Map(); // card_id -> card

let driverId = null;
let kartId   = null;

let itemSlots    = new Array(DEFAULT_ITEM_SLOTS).fill(null);
let utilitySlots = new Array(DEFAULT_UTILITY_SLOTS).fill(null);

let fuelCardId = null;
let fuelCount  = 0;

// which section / slot is "active" for assigning from library
// group: 'driver' | 'kart' | 'item' | 'utility' | 'fuel' | null
let ACTIVE_GROUP = null;
// index for item / utility slots
let ACTIVE_INDEX = null;

// ===== DOM =====
const leaderSlotsEls   = document.querySelectorAll('.leader-slot');
const itemSlotsEl      = document.getElementById('itemSlots');
const utilitySlotsEl   = document.getElementById('utilitySlots');
const fuelSlotEl       = document.getElementById('fuelSlot');
const fuelCountEl      = document.getElementById('fuelCount');
const itemCountEl      = document.getElementById('itemSlotCount');
const utilityCountEl   = document.getElementById('utilitySlotCount');

const clearDeckBtn     = document.getElementById('clearDeck');
const copyLinkBtn      = document.getElementById('copyLink');
const copyStatusEl     = document.getElementById('copyStatus');
const deckCountSummary = document.getElementById('deckCountSummary');

const libGrid   = document.getElementById('libGrid');
const libEmpty  = document.getElementById('libEmpty');
const libSearch = document.getElementById('libSearch');
const libRarity = document.getElementById('libRarity');

const scrollTopBtn = document.getElementById('scrollTopBtn');

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

function allowedCopiesFor(card) {
    return DUP_LIMIT[rarityKey(card.rarity)] ?? 4;
}

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

    card.name    = txt(card.name);
    card.type    = txt(card.type);
    card.rarity  = txt(card.rarity);
    card.card_id = txt(card.card_id);

    return card;
}

function frontImagePath(card) {
    const id = txt(card.card_id);
    if (!id) return '';

    if (isFuel(card)) {
        return `${FRONT_DIR}/${encodeURIComponent(id.toLowerCase())}.${FRONT_EXT}`;
    }
    return `${FRONT_DIR}/${encodeURIComponent(id + "_vv1")}.${FRONT_EXT}`;
}

// ===== Deck counts & limits =====
function totalNonLeaderCount() {
    const items    = itemSlots.filter(Boolean).length;
    const utilities= utilitySlots.filter(Boolean).length;
    const fuel     = fuelCount;
    return items + utilities + fuel;
}

function countCardCopies(cardId) {
    let n = 0;
    for (const id of itemSlots) if (id === cardId) n++;
    for (const id of utilitySlots) if (id === cardId) n++;
    if (fuelCardId === cardId) n += fuelCount;
    return n;
}

// ===== Rendering slots =====
function renderLeaderSlots() {
    leaderSlotsEls.forEach(btn => {
        const group = btn.dataset.group; // 'driver' or 'kart'
        const id    = group === 'driver' ? driverId : kartId;
        const card  = id ? CARD_MAP.get(id) : null;

        btn.innerHTML = ''; // clear

        if (card) {
            const front = frontImagePath(card);
            btn.classList.add('filled');
            btn.insertAdjacentHTML('beforeend', `
                <div class="card-wrap rarity-${rarityKey(card.rarity)}">
                  <div class="card">
                    <span class="glow"></span>
                    <div class="face front">
                      <img src="${front}" alt="${card.name} front">
                    </div>
                  </div>
                </div>
            `);
        } else {
            btn.classList.remove('filled');
            btn.insertAdjacentHTML('beforeend', `
                <div class="slot-placeholder">
                  <span class="plus">+</span>
                  <span class="label">${group === 'driver' ? 'Driver' : 'Kart'}</span>
                </div>
            `);
        }

        if (ACTIVE_GROUP === group) {
            btn.style.outline = '2px solid rgba(77,163,255,0.9)';
        } else {
            btn.style.outline = 'none';
        }
    });
}

function renderCardSlot(cardId, placeholderLabel, isActive) {
    const card = cardId ? CARD_MAP.get(cardId) : null;

    if (!card) {
        return `
      <button class="deck-card-slot" type="button">
        <div class="slot-placeholder">
          <span class="plus">+</span>
          <span class="label">${placeholderLabel}</span>
        </div>
      </button>`;
    }

    const front = frontImagePath(card);
    const rar   = rarityKey(card.rarity);

    return `
      <button class="deck-card-slot" type="button">
        <div class="card-wrap rarity-${rar}">
          <div class="card">
            <span class="glow"></span>
            <div class="face front">
              <img src="${front}" alt="${card.name} front">
            </div>
          </div>
        </div>
      </button>`;
}

function renderItemSlots() {
    const label = 'Item';
    itemSlotsEl.innerHTML = itemSlots
      .map((id, idx) => renderCardSlot(id, label, ACTIVE_GROUP === 'item' && ACTIVE_INDEX === idx))
      .join('');

    Array.from(itemSlotsEl.querySelectorAll('.deck-card-slot')).forEach((btn, idx) => {
        btn.dataset.group = 'item';
        btn.dataset.index = idx;
        if (ACTIVE_GROUP === 'item' && ACTIVE_INDEX === idx) {
            btn.style.outline = '2px solid rgba(77,163,255,0.9)';
        }
        btn.addEventListener('click', () => {
            ACTIVE_GROUP = 'item';
            ACTIVE_INDEX = idx;
            refreshAll();
            scrollToLibrary();
        });
    });
}

function renderUtilitySlots() {
    const label = 'Utility';
    utilitySlotsEl.innerHTML = utilitySlots
      .map((id, idx) => renderCardSlot(id, label, ACTIVE_GROUP === 'utility' && ACTIVE_INDEX === idx))
      .join('');

    Array.from(utilitySlotsEl.querySelectorAll('.deck-card-slot')).forEach((btn, idx) => {
        btn.dataset.group = 'utility';
        btn.dataset.index = idx;
        if (ACTIVE_GROUP === 'utility' && ACTIVE_INDEX === idx) {
            btn.style.outline = '2px solid rgba(77,163,255,0.9)';
        }
        btn.addEventListener('click', () => {
            ACTIVE_GROUP = 'utility';
            ACTIVE_INDEX = idx;
            refreshAll();
            scrollToLibrary();
        });
    });
}

function renderFuelSlot() {
    fuelSlotEl.innerHTML = '';
    const card = fuelCardId ? CARD_MAP.get(fuelCardId) : null;

    if (card) {
        const front = frontImagePath(card);
        const rar   = rarityKey(card.rarity);
        fuelSlotEl.insertAdjacentHTML('beforeend', `
          <div class="card-wrap rarity-${rar}">
            <div class="card">
              <span class="glow"></span>
              <div class="face front">
                <img src="${front}" alt="${card.name} front">
              </div>
            </div>
          </div>
        `);
    } else {
        fuelSlotEl.insertAdjacentHTML('beforeend', `
          <div class="slot-placeholder">
            <span class="plus">+</span>
            <span class="label">Fuel card</span>
          </div>
        `);
    }

    fuelSlotEl.style.outline =
      ACTIVE_GROUP === 'fuel' ? '2px solid rgba(77,163,255,0.9)' : 'none';
}

// ===== Library rendering =====
function requiredTypeForActiveGroup(card) {
    // Return true if card is allowed for the currently active group
    if (!ACTIVE_GROUP) return true;

    const t = lc(card.type || '');
    if (ACTIVE_GROUP === 'driver')  return t === 'driver';
    if (ACTIVE_GROUP === 'kart')    return t === 'kart';
    if (ACTIVE_GROUP === 'item')    return t === 'item';
    if (ACTIVE_GROUP === 'utility') return t === 'utility';
    if (ACTIVE_GROUP === 'fuel')    return isFuel(card);

    return true;
}

function applyLibFilters() {
    const q   = lc(libSearch.value);
    const rar = lc(libRarity.value);

    let rows = CARDS.filter(c => {
        // respect active group type constraint
        if (!requiredTypeForActiveGroup(c)) return false;

        const hay = lc([
            c.name, c.card_id, c.type, c.rarity, c.text
        ].join(' '));

        const qOk  = !q || hay.includes(q);
        const rOk  = !rar || rarityKey(c.rarity) === rar;

        return qOk && rOk;
    });

    rows.sort((a, b) => txt(a.name).localeCompare(txt(b.name)));

    libGrid.innerHTML = rows.map(renderLibCard).join('');
    libEmpty.hidden = rows.length !== 0;

    wireLibCardEvents();
}

function renderLibCard(card) {
    const front = frontImagePath(card);
    const rar   = rarityKey(card.rarity);
    const typeLabel = isFuel(card) ? 'Fuel' : (card.type || 'Unknown');

    return `
      <button class="lib-card tile" data-id="${card.card_id}" type="button">
        <div class="card-wrap rarity-${rar}">
          <div class="card">
            <span class="glow"></span>
            <div class="face front">
              <img loading="lazy" src="${front}" alt="${card.name} front">
            </div>
          </div>
        </div>
        <div class="title">${card.name}</div>
        <div class="meta">${typeLabel}${card.card_id ? ` • ${card.card_id}` : ''} • ${card.rarity}</div>
      </button>
    `;
}

function wireLibCardEvents() {
    libGrid.querySelectorAll('.lib-card').forEach(btn => {
        const id = btn.dataset.id;
        btn.addEventListener('click', () => {
            assignCardToActive(id);
        });
    });
}

// ===== Assigning cards to slots =====
function assignCardToActive(cardId) {
    if (!ACTIVE_GROUP || !cardId) return;
    const card = CARD_MAP.get(cardId);
    if (!card) return;

    // Type safety
    if (!requiredTypeForActiveGroup(card)) {
        return;
    }

    // Duplicate limit
    const currentCopies = countCardCopies(cardId);
    const maxCopies     = allowedCopiesFor(card);
    if (currentCopies >= maxCopies) {
        flashCopyStatus(`Max copies reached for ${card.name} (${maxCopies}×).`);
        return;
    }

    // Deck size limit (non-leaders)
    // If this operation adds a new non-leader card, respect 40-card cap.
    let addingNew = false;

    if (ACTIVE_GROUP === 'driver') {
        driverId = cardId;
        refreshAll();
        return;
    }

    if (ACTIVE_GROUP === 'kart') {
        kartId = cardId;
        refreshAll();
        return;
    }

    if (ACTIVE_GROUP === 'item') {
        if (ACTIVE_INDEX == null || ACTIVE_INDEX < 0 || ACTIVE_INDEX >= itemSlots.length) return;
        if (!itemSlots[ACTIVE_INDEX]) addingNew = true;
        if (addingNew && totalNonLeaderCount() >= MAX_DECK_NON_LEADERS) {
            flashCopyStatus(`Deck is at the 40 non-leader card limit.`);
            return;
        }
        itemSlots[ACTIVE_INDEX] = cardId;
        advanceToNextEmpty('item');
        refreshAll();
        return;
    }

    if (ACTIVE_GROUP === 'utility') {
        if (ACTIVE_INDEX == null || ACTIVE_INDEX < 0 || ACTIVE_INDEX >= utilitySlots.length) return;
        if (!utilitySlots[ACTIVE_INDEX]) addingNew = true;
        if (addingNew && totalNonLeaderCount() >= MAX_DECK_NON_LEADERS) {
            flashCopyStatus(`Deck is at the 40 non-leader card limit.`);
            return;
        }
        utilitySlots[ACTIVE_INDEX] = cardId;
        advanceToNextEmpty('utility');
        refreshAll();
        return;
    }

    if (ACTIVE_GROUP === 'fuel') {
        // Setting / changing the fuel card ID doesn't change deck size.
        fuelCardId = cardId;
        refreshAll();
        return;
    }
}

function advanceToNextEmpty(group) {
    if (group === 'item') {
        const idx = itemSlots.findIndex((id, i) => !id && i > (ACTIVE_INDEX ?? -1));
        if (idx !== -1) ACTIVE_INDEX = idx;
    } else if (group === 'utility') {
        const idx = utilitySlots.findIndex((id, i) => !id && i > (ACTIVE_INDEX ?? -1));
        if (idx !== -1) ACTIVE_INDEX = idx;
    }
}

// ===== Deck size summary =====
function updateDeckSummary() {
    const items  = itemSlots.filter(Boolean).length;
    const utils  = utilitySlots.filter(Boolean).length;
    const fuel   = fuelCount;
    const total  = items + utils + fuel;

    deckCountSummary.textContent =
        `Deck size (excluding Driver & Kart): ${total} / ${MAX_DECK_NON_LEADERS} `
        + `(Items: ${items}, Utilities: ${utils}, Fuel: ${fuel})`;
}

// ===== URL encoding / decoding =====
// We'll encode as:
// d=<driverId> (optional)
// k=<kartId>
// i=<itemId1.itemId2...> (null slots skipped)
// u=<utilId1.utilId2...>
// f=<fuelCardId>,<fuelCount>
// s=<itemSlotsCount>,<utilitySlotsCount>
function encodeStateToUrl() {
    const url = new URL(window.location.href);

    if (driverId) url.searchParams.set('d', driverId); else url.searchParams.delete('d');
    if (kartId)   url.searchParams.set('k', kartId);   else url.searchParams.delete('k');

    const items = itemSlots.filter(Boolean);
    if (items.length) url.searchParams.set('i', items.join('.')); else url.searchParams.delete('i');

    const utils = utilitySlots.filter(Boolean);
    if (utils.length) url.searchParams.set('u', utils.join('.')); else url.searchParams.delete('u');

    if (fuelCardId && fuelCount > 0) {
        url.searchParams.set('f', `${fuelCardId},${fuelCount}`);
    } else {
        url.searchParams.delete('f');
    }

    const s = `${itemSlots.length},${utilitySlots.length}`;
    url.searchParams.set('s', s);

    return url;
}

function updateUrlFromState() {
    const url = encodeStateToUrl();
    window.history.replaceState({}, '', url);
}

function hydrateStateFromUrl() {
    const url = new URL(window.location.href);

    const d = txt(url.searchParams.get('d'));
    const k = txt(url.searchParams.get('k'));
    const i = txt(url.searchParams.get('i'));
    const u = txt(url.searchParams.get('u'));
    const f = txt(url.searchParams.get('f'));
    const s = txt(url.searchParams.get('s'));

    if (d && CARD_MAP.has(d)) driverId = d;
    if (k && CARD_MAP.has(k)) kartId   = k;

    // Slots config
    if (s) {
        const parts = s.split(',');
        const itemLen = Math.min(Math.max(parseInt(parts[0] || DEFAULT_ITEM_SLOTS, 10) || DEFAULT_ITEM_SLOTS, 0), 40);
        const utilLen = Math.min(Math.max(parseInt(parts[1] || DEFAULT_UTILITY_SLOTS, 10) || DEFAULT_UTILITY_SLOTS, 0), 40);
        itemSlots    = new Array(itemLen).fill(null);
        utilitySlots = new Array(utilLen).fill(null);
    }

    // Items
    if (i) {
        const ids = i.split('.').map(txt).filter(Boolean);
        ids.slice(0, itemSlots.length).forEach((id, idx) => {
            if (CARD_MAP.has(id)) itemSlots[idx] = id;
        });
    }

    // Utilities
    if (u) {
        const ids = u.split('.').map(txt).filter(Boolean);
        ids.slice(0, utilitySlots.length).forEach((id, idx) => {
            if (CARD_MAP.has(id)) utilitySlots[idx] = id;
        });
    }

    // Fuel
    if (f) {
        const [fid, nStr] = f.split(',');
        const n = Math.max(0, Math.min(parseInt(nStr || '0', 10) || 0, MAX_DECK_NON_LEADERS));
        if (fid && CARD_MAP.has(fid)) {
            fuelCardId = fid;
            fuelCount  = n;
        }
    }

    // Reflect slot counts in inputs
    itemCountEl.value    = itemSlots.length;
    utilityCountEl.value = utilitySlots.length;
    fuelCountEl.value    = fuelCount;
}

// ===== Misc =====
function scrollToLibrary() {
    document.querySelector('.deck-library').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function flashCopyStatus(msg) {
    copyStatusEl.textContent = msg;
    if (!msg) return;
    setTimeout(() => {
        if (copyStatusEl.textContent === msg) copyStatusEl.textContent = '';
    }, 2500);
}

// ===== Refresh all derived UI =====
function refreshAll() {
    renderLeaderSlots();
    renderItemSlots();
    renderUtilitySlots();
    renderFuelSlot();
    applyLibFilters();
    updateDeckSummary();
    updateUrlFromState();
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
                .filter(c => c.name);

            CARD_MAP = new Map();
            CARDS.forEach(c => {
                if (c.card_id) CARD_MAP.set(c.card_id, c);
            });

            hydrateStateFromUrl();
            refreshAll();
        },
        error: (e) => {
            console.error(e);
            libEmpty.textContent = 'Failed to load card data.';
            libEmpty.hidden = false;
        }
    });
}

// ===== Wire events =====

// Leader slots: click to activate & filter library
leaderSlotsEls.forEach(btn => {
    btn.addEventListener('click', () => {
        ACTIVE_GROUP = btn.dataset.group; // driver / kart
        ACTIVE_INDEX = null;
        refreshAll();
        scrollToLibrary();
    });
});

// Fuel slot
fuelSlotEl.addEventListener('click', () => {
    ACTIVE_GROUP = 'fuel';
    ACTIVE_INDEX = null;
    refreshAll();
    scrollToLibrary();
});

// Fuel count change
fuelCountEl.addEventListener('input', () => {
    let val = parseInt(fuelCountEl.value || '0', 10) || 0;
    if (val < 0) val = 0;

    // Enforce deck size
    const currentNonLeader = totalNonLeaderCount();
    const fuelDelta = val - fuelCount;
    if (fuelDelta > 0 && currentNonLeader + fuelDelta > MAX_DECK_NON_LEADERS) {
        const allowed = MAX_DECK_NON_LEADERS - (currentNonLeader);
        val = fuelCount + Math.max(0, allowed);
        flashCopyStatus('Fuel limited by 40-card cap.');
    }

    // Enforce duplicate limit for this fuel card
    if (fuelCardId && CARD_MAP.has(fuelCardId)) {
        const card       = CARD_MAP.get(fuelCardId);
        const maxCopies  = allowedCopiesFor(card);
        const othersUsed = countCardCopies(fuelCardId) - fuelCount; // other zones
        const maxHere    = Math.max(0, maxCopies - othersUsed);
        if (val > maxHere) {
            val = maxHere;
            flashCopyStatus(`Fuel copies limited to ${maxHere}× for this card.`);
        }
    }

    fuelCount = val;
    fuelCountEl.value = fuelCount;
    updateDeckSummary();
    updateUrlFromState();
});

// Item / utility slot count changes
itemCountEl.addEventListener('input', () => {
    let n = Math.min(40, Math.max(0, parseInt(itemCountEl.value || '0', 10) || 0));
    itemSlots.length = n;
    for (let i = 0; i < n; i++) if (itemSlots[i] === undefined) itemSlots[i] = null;
    refreshAll();
});

utilityCountEl.addEventListener('input', () => {
    let n = Math.min(40, Math.max(0, parseInt(utilityCountEl.value || '0', 10) || 0));
    utilitySlots.length = n;
    for (let i = 0; i < n; i++) if (utilitySlots[i] === undefined) utilitySlots[i] = null;
    refreshAll();
});

// Library filters
[libSearch, libRarity].forEach(el => {
    el.addEventListener('input', applyLibFilters);
});

// Clear deck
clearDeckBtn.addEventListener('click', () => {
    driverId = null;
    kartId   = null;
    itemSlots    = new Array(DEFAULT_ITEM_SLOTS).fill(null);
    utilitySlots = new Array(DEFAULT_UTILITY_SLOTS).fill(null);
    fuelCardId = null;
    fuelCount  = 0;
    itemCountEl.value    = DEFAULT_ITEM_SLOTS;
    utilityCountEl.value = DEFAULT_UTILITY_SLOTS;
    fuelCountEl.value    = 0;
    ACTIVE_GROUP = null;
    ACTIVE_INDEX = null;
    refreshAll();
});

// Copy link
copyLinkBtn.addEventListener('click', async () => {
    const url = encodeStateToUrl().toString();
    try {
        await navigator.clipboard.writeText(url);
        flashCopyStatus('Deck link copied to clipboard.');
    } catch {
        flashCopyStatus('Unable to copy link. You can copy the URL bar manually.');
    }
});

// Scroll to top
scrollTopBtn.addEventListener('click', () => {
    document.querySelector('.deck-main').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

document.addEventListener('DOMContentLoaded', loadCSV);
