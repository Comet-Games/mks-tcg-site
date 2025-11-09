// CSV + image locations
const CSV_URL = 'data/MasterSheet.csv';
const FRONT_DIR = 'images/cards';
const FRONT_EXT = 'png';
const BACK_IMAGE = 'images/back.png';

// UI
const grid = document.getElementById('grid');
const empty = document.getElementById('empty');
const qEl = document.getElementById('search');
const tEl = document.getElementById('type');
const rEl = document.getElementById('rarity');
const sEl = document.getElementById('sort');

const compareDock = document.getElementById('compareDock');
const selList = document.getElementById('selList');
const compareBtn = document.getElementById('compareBtn');
const clearSel = document.getElementById('clearSel');
const modal = document.getElementById('compareModal');
const closeModal = document.getElementById('closeModal');
const compareArea = document.getElementById('compareArea');

let CARDS = [];
let SELECTED = []; // store Card IDs (or names if no ID – but ID is expected)

// Helpers
const lc = s => (s ?? '').toString().trim().toLowerCase();
const txt = s => (s ?? '').toString().trim();
const titleCase = s => { s = txt(s); return s ? s[0].toUpperCase() + s.slice(1) : s; };

function rarityClass(r) {
    const v = lc(r);
    if (v.startsWith('myth')) return 'mythic';
    if (v.startsWith('rare') && !v.includes('un')) return 'rare';
    if (v.startsWith('un')) return 'uncommon';
    return 'common';
}

// Map your CSV columns
function mapRow(row) {
    const out = {
        name: row['Card Name'] ?? '',
        type: row['Card Type'] ?? '',
        rarity: row['Rarity'] ?? 'Common',
        play_cost: row['Play Cost'] ?? '',
        speed: row['Speed'] ?? '',
        handling: row['Handling'] ?? '',
        off_ability: row['Offensive Ability'] ?? '',
        off_text: row['Offensive Text'] ?? '',
        off_cost: row['Offensive Cost'] ?? '',
        def_ability: row['Defensive Ability'] ?? '',
        def_text: row['Defensive Text'] ?? '',
        def_cost: row['Defensive Cost'] ?? '',
        hit_threshold: row['Hit Threshold'] ?? '',
        burn_cost: row['Burn Cost'] ?? '',
        utility_effect: row['Utility Effect'] ?? '',
        flavour: row['Flavour Text'] ?? '',
        artist: row['Artist'] ?? '',
        card_id: row['Card ID'] ?? '',
        version: row['Version'] ?? ''
    };
    for (const k of ['flavour', 'off_text', 'def_text', 'utility_effect']) {
        out[k] = txt(out[k]).replaceAll('\\n', '\n');
    }
    out.rarity = titleCase(out.rarity);
    return out;
}

// Front image: use Card ID exactly
function frontImagePath(card) {
    const id = txt(card.card_id);
    const idext = txt("_vv1");
    if (!(id + idtext)) return ''; // no ID → no image (warn in console)
    return `${FRONT_DIR}/${encodeURIComponent(id)}.${FRONT_EXT}`;
}

function renderTile(card) {
    const rar = rarityClass(card.rarity);
    const idKey = card.card_id || card.name; // selection key (ID strongly preferred)
    const selected = SELECTED.includes(idKey);

    const front = frontImagePath(card);
    if (!front) console.warn('Missing Card ID (no front image):', card.name);

    return `
  <div class="tile" data-id="${idKey}">
    <div class="card-wrap rarity-${rar}" data-name="${card.name}">
      <div class="card" tabindex="0" aria-label="${card.name} card">
        <div class="card-controls">
          <button class="icon-btn mark-compare" aria-pressed="${selected}">Compare</button>
        </div>
        <span class="glow"></span>
        <div class="face front"><img loading="lazy" src="${front}" alt="${card.name} (front)"></div>
        <div class="face back"><img loading="lazy" src="${BACK_IMAGE}" alt="Card back"></div>
      </div>
    </div>
    <div class="title">${card.name}</div>
    <div class="meta">${titleCase(card.type)}${card.card_id ? ` • ${card.card_id}` : ''} • ${card.rarity}</div>
  </div>`;
}

function applyFilters() {
    const q = lc(qEl.value);
    const t = lc(tEl.value);
    const r = lc(rEl.value);

    let rows = CARDS.filter(c => {
        const hay = lc([
            c.name, c.card_id, c.type, c.rarity, c.off_text, c.def_text, c.utility_effect, c.flavour,
            c.off_ability, c.def_ability, c.artist
        ].join(' '));
        const qOk = !q || hay.includes(q);
        const tOk = !t || lc(c.type) === t;
        const rOk = !r || lc(c.rarity).startsWith(r);
        return qOk && tOk && rOk;
    });

    const key = sEl.value;
    rows.sort((a, b) => (a[key] ?? '').toString().localeCompare((b[key] ?? '').toString(), undefined, { numeric: true }));

    grid.innerHTML = rows.map(renderTile).join('');
    empty.hidden = rows.length !== 0;

    wireCards();
    updateDock();
}

function loadCSV() {
    Papa.parse(CSV_URL, {
        download: true, header: true, skipEmptyLines: true,
        complete: (res) => { CARDS = res.data.map(mapRow); applyFilters(); },
        error: (e) => { console.error(e); empty.textContent = 'Failed to load CSV.'; empty.hidden = false; }
    });
}

/* ===== Interactions ===== */
function wireCards() {
    // Flip on click/tap or Enter/Space
    grid.querySelectorAll('.card').forEach(cardEl => {
        cardEl.addEventListener('click', () => cardEl.classList.toggle('is-flipped'));
        cardEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cardEl.classList.toggle('is-flipped'); }
        });
    });

    // Reactive tilt
    grid.querySelectorAll('.card-wrap').forEach(w => {
        const maxTilt = 10;
        function setTilt(e) {
            const r = w.getBoundingClientRect();
            const px = (e.clientX - r.left) / r.width;
            const py = (e.clientY - r.top) / r.height;
            const ry = (px - 0.5) * 2 * maxTilt;
            const rx = (0.5 - py) * 2 * maxTilt;
            w.style.setProperty('--rx', rx.toFixed(2) + 'deg');
            w.style.setProperty('--ry', ry.toFixed(2) + 'deg');
            w.style.setProperty('--tz', '12px');
        }
        function reset() { w.style.setProperty('--rx', '0deg'); w.style.setProperty('--ry', '0deg'); w.style.setProperty('--tz', '0px'); }
        w.addEventListener('mousemove', setTilt);
        w.addEventListener('mouseleave', reset);
        w.addEventListener('touchstart', () => w.classList.add('touched'), { passive: true });
    });

    // Compare toggle
    grid.querySelectorAll('.tile').forEach(tile => {
        const id = tile.dataset.id;
        const btn = tile.querySelector('.mark-compare');
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSelect(id);
            btn.setAttribute('aria-pressed', SELECTED.includes(id));
        });
    });
}

function toggleSelect(id) {
    if (SELECTED.includes(id)) {
        SELECTED = SELECTED.filter(x => x !== id);
    } else {
        if (SELECTED.length >= 2) SELECTED.shift();
        SELECTED.push(id);
    }
    updateDock();
}

function updateDock() {
    if (SELECTED.length === 0) { compareDock.hidden = true; return; }
    compareDock.hidden = false;
    selList.innerHTML = SELECTED.map(id => `<span class="sel-chip">${id}</span>`).join('');
    compareBtn.disabled = SELECTED.length !== 2;
}

// Compare modal
compareBtn.addEventListener('click', () => {
    const [aId, bId] = SELECTED;
    const a = CARDS.find(c => (c.card_id || c.name) === aId);
    const b = CARDS.find(c => (c.card_id || c.name) === bId);
    renderCompare(a, b);
    modal.showModal();
});
clearSel.addEventListener('click', () => { SELECTED = []; updateDock(); });
closeModal.addEventListener('click', () => modal.close());

function renderCompare(a, b) { compareArea.innerHTML = [a, b].map(c => c ? compareBlock(c) : '').join(''); }
function compareBlock(c) {
    const front = frontImagePath(c);
    return `
  <div class="compare-card">
    <div class="small"><img src="${front}" alt="${c.name} front"></div>
    <div class="small"><img src="${BACK_IMAGE}" alt="Card back"></div>
    <table class="meta-table">
      <tr><td>Name</td><td>${c.name}</td></tr>
      <tr><td>ID</td><td>${c.card_id || '-'}</td></tr>
      <tr><td>Type</td><td>${titleCase(c.type)}</td></tr>
      <tr><td>Rarity</td><td>${c.rarity}</td></tr>
      ${c.play_cost ? `<tr><td>Play Cost</td><td>${c.play_cost}</td></tr>` : ''}
      ${c.burn_cost ? `<tr><td>Burn</td><td>${c.burn_cost}</td></tr>` : ''}
      ${c.hit_threshold ? `<tr><td>Hit</td><td>${c.hit_threshold}</td></tr>` : ''}
      ${c.speed !== '' ? `<tr><td>Speed</td><td>${c.speed}</td></tr>` : ''}
      ${c.handling !== '' ? `<tr><td>Handling</td><td>${c.handling}</td></tr>` : ''}
      ${c.off_ability || c.off_text ? `<tr><td>Offensive</td><td>${[c.off_ability, c.off_text].filter(Boolean).join(' — ')}</td></tr>` : ''}
      ${c.def_ability || c.def_text ? `<tr><td>Defensive</td><td>${[c.def_ability, c.def_text].filter(Boolean).join(' — ')}</td></tr>` : ''}
      ${c.utility_effect ? `<tr><td>Utility</td><td>${c.utility_effect}</td></tr>` : ''}
      ${c.flavour ? `<tr><td>Flavour</td><td>${c.flavour}</td></tr>` : ''}
      ${c.artist ? `<tr><td>Artist</td><td>${c.artist}</td></tr>` : ''}
      ${c.version ? `<tr><td>Version</td><td>${c.version}</td></tr>` : ''}
    </table>
  </div>`;
}

// Wire up
[qEl, tEl, rEl, sEl].forEach(el => el.addEventListener('input', applyFilters));
document.addEventListener('DOMContentLoaded', loadCSV);
