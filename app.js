const CSV_URL = 'data/MasterSheet.csv';

// UI
const grid = document.getElementById('grid');
const empty = document.getElementById('empty');
const qEl = document.getElementById('search');
const tEl = document.getElementById('type');
const rEl = document.getElementById('rarity');
const sEl = document.getElementById('sort');

let CARDS = [];

const lc = s => (s ?? '').toString().trim().toLowerCase();
const txt = s => (s ?? '').toString().trim();
const num = s => {
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
};

function rarityClass(r) {
    const v = lc(r);
    if (v.startsWith('myth')) return 'mythic';
    if (v.startsWith('rare') && !v.includes('un')) return 'rare';
    if (v.startsWith('un')) return 'uncommon';
    return 'common';
}
function titleCase(s) {
    s = txt(s);
    return s ? s[0].toUpperCase() + s.slice(1) : s;
}

// Map your exact columns → canonical keys the renderer expects
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
        version: row['Version'] ?? '',
        // image is optional; see auto-derive below
        image: ''
    };

    // Normalise text fields
    for (const k of ['flavour', 'off_text', 'def_text', 'utility_effect']) {
        out[k] = txt(out[k]).replaceAll('\\n', '\n');
    }
    // Pretty rarity for display
    out.rarity = titleCase(out.rarity);
    return out;
}

// OPTIONAL: auto-derive an image path if you name files by Card ID
// e.g., /images/<Card ID>.jpg (change extensions or path as you like)
function deriveImage(card) {
    if (!card.card_id) return '';
    return `images/${card.card_id}.jpg`;
}

function renderCard(c) {
    const typeCls = `type-${lc(c.type) || 'item'}`;
    const rarCls = `rarity-${rarityClass(c.rarity)}`;
    const imgSrc = c.image || deriveImage(c);
    const art = imgSrc ? `<div class="art"><img loading="lazy" src="${imgSrc}" alt="Art for ${c.name}"></div>` : '';

    // Stats row
    const stats = [
        c.play_cost && `Cost: ${c.play_cost}`,
        c.burn_cost && `Burn: ${c.burn_cost}`,
        c.hit_threshold && `Hit: ${c.hit_threshold}`,
        (c.speed !== '' && c.speed != null) && `Speed: ${c.speed}`,
        (c.handling !== '' && c.handling != null) && `Handling: ${c.handling}`
    ].filter(Boolean).map(s => `<span class="stat">${s}</span>`).join('');

    // Abilities
    const offBlock = (c.off_ability || c.off_text || c.off_cost) ? `
    <div>
      <h4>Offensive${c.off_ability ? ` · ${c.off_ability}` : ''}${c.off_cost ? ` · Cost ${c.off_cost}` : ''}</h4>
      ${c.off_text ? `<p>${c.off_text}</p>` : ''}
    </div>` : '';

    const defBlock = (c.def_ability || c.def_text || c.def_cost) ? `
    <div>
      <h4>Defensive${c.def_ability ? ` · ${c.def_ability}` : ''}${c.def_cost ? ` · Cost ${c.def_cost}` : ''}</h4>
      ${c.def_text ? `<p>${c.def_text}</p>` : ''}
    </div>` : '';

    const utilBlock = c.utility_effect ? `
    <div>
      <h4>Utility</h4>
      <p>${c.utility_effect}</p>
    </div>` : '';

    // Footer mini meta (Artist / ID / Version)
    const meta = [c.artist && `Art: ${c.artist}`, c.card_id && `ID: ${c.card_id}`, c.version && `v${c.version}`]
        .filter(Boolean).join(' • ');
    const metaHtml = meta ? `<div class="flavour" style="opacity:.7; font-style:normal;">${meta}</div>` : '';

    return `
  <article class="card ${typeCls} ${rarCls}">
    <div class="top">
      <div>
        <div class="title">${c.name || 'Untitled'}</div>
        <div class="type">${titleCase(c.type)}${c.card_id ? ` • ${c.card_id}` : ''}</div>
      </div>
      <span class="rarity">${c.rarity}</span>
    </div>

    ${art}

    ${stats ? `<div class="stats">${stats}</div>` : ''}

    <div class="rules">
      ${offBlock}
      ${defBlock}
      ${utilBlock}
    </div>

    ${c.flavour ? `<div class="flavour">“${c.flavour}”</div>` : ''}
    ${metaHtml}
  </article>`;
}

function applyFilters() {
    const q = lc(qEl.value);
    const t = lc(tEl.value);
    const r = lc(rEl.value);

    let rows = CARDS.filter(c => {
        const hay = lc([
            c.name, c.type, c.rarity, c.off_text, c.def_text, c.utility_effect, c.flavour,
            c.off_ability, c.def_ability, c.card_id, c.artist
        ].join(' '));
        const qOk = !q || hay.includes(q);
        const tOk = !t || lc(c.type) === t;
        const rOk = !r || lc(c.rarity).startsWith(r);
        return qOk && tOk && rOk;
    });

    // Sorting
    const key = sEl.value;
    rows.sort((a, b) => {
        if (['speed', 'handling', 'play_cost'].includes(key)) {
            return (num(b[key]) ?? -1) - (num(a[key]) ?? -1);
        }
        return (a[key] ?? '').toString().localeCompare((b[key] ?? '').toString(), undefined, { numeric: true });
    });

    grid.innerHTML = rows.map(renderCard).join('');
    empty.hidden = rows.length !== 0;
}

function loadCSV() {
    Papa.parse(CSV_URL, {
        download: true, header: true, skipEmptyLines: true,
        complete: (res) => { CARDS = res.data.map(mapRow); applyFilters(); },
        error: (e) => { console.error(e); empty.textContent = 'Failed to load CSV.'; empty.hidden = false; }
    });
}

// Wire up
[qEl, tEl, rEl, sEl].forEach(el => el.addEventListener('input', applyFilters));
document.addEventListener('DOMContentLoaded', loadCSV);
