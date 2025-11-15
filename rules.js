// ===== Config: match your site =====
const CSV_URL = 'data/MasterSheet.csv';
const FRONT_DIR = 'images/cards';
const FRONT_EXT = 'png';
const BACK_IMAGE = 'images/back.png';
const IMG_VERSION_SUFFIX = '_vv1'; // e.g., d001_vv1.png

const CATALOGUE_HREF = 'catalogue.html';

// ===== DOM targets for examples =====
const driverSlot = document.getElementById('driverExample');
const kartSlot = document.getElementById('kartExample');
const itemSlot = document.getElementById('itemExample');
const utilSlot = document.getElementById('utilityExample');

const rerollBtn = document.getElementById('rerollExamples');

// Tools & quiz
const d6Btn = document.getElementById('rollD6');
const d6Out = document.getElementById('d6Result');
const coinBtn = document.getElementById('coinFlip');
const coinOut = document.getElementById('coinResult');
const quizRoot = document.getElementById('quizRoot');

let ALL = [];

// ===== Helpers =====
const t = s => (s ?? '').toString().trim();
const lc = s => t(s).toLowerCase();

function mapRow(row) {
    return {
        name: t(row['Card Name']),
        type: t(row['Card Type']), // Driver/Kart/Item/Utility
        rarity: t(row['Rarity']) || 'Common',
        card_id: t(row['Card ID']),
        version: t(row['Version'])
    };
}
function frontImage(id) { return `${FRONT_DIR}/${encodeURIComponent(id)}.${FRONT_EXT}`; }
function byType(cards, type) { return cards.filter(c => lc(c.type) === lc(type)); }

function rarityKey(r) {
    const v = lc(r);
    if (v.startsWith('myth')) return 'mythic';
    if (v.startsWith('rare') && !v.includes('un')) return 'rare';
    if (v.startsWith('un')) return 'uncommon';
    return 'common';
}
function pickRandom(arr) {
    if (!arr.length) return null;
    return arr[Math.floor(Math.random() * arr.length)];
}

// ===== Example card tile (flip on click) =====
function exampleTile(card) {
    const id = card.card_id;
    const rar = rarityKey(card.rarity);
    const href = `${CATALOGUE_HREF}?id=${encodeURIComponent(id || card.name)}`;
    const front = id ? frontImage(id + IMG_VERSION_SUFFIX) : '';
    return `
    <a class="ex-card-wrap" href="${href}" title="Open in catalogue">
      <div class="ex-card rarity-${rar}" data-name="${card.name}">
        <span class="ex-glow"></span>
        <img class="ex-front" loading="lazy" src="${front}" alt="${card.name} (front)">
        <img class="ex-back"  loading="lazy" src="${BACK_IMAGE}" alt="Card back">
      </div>
      <div class="ex-meta">${card.name}</div>
    </a>
  `;
}
function injectExample(slot, card) {
    if (!slot) return;
    slot.innerHTML = card ? exampleTile(card) : `<div class="muted">No example found.</div>`;
    // flip on click (prevent link while flipping)
    const link = slot.querySelector('.ex-card-wrap');
    const cardEl = slot.querySelector('.ex-card');
    if (!cardEl || !link) return;
    let flipped = false;
    cardEl.addEventListener('click', (e) => {
        e.preventDefault();
        flipped = !flipped;
        cardEl.classList.toggle('is-flipped', flipped);
    });
}

// ===== Reroll all examples =====
function rerollExamples() {
    injectExample(driverSlot, pickRandom(byType(ALL, 'Driver')));
    injectExample(kartSlot, pickRandom(byType(ALL, 'Kart')));
    injectExample(itemSlot, pickRandom(byType(ALL, 'Item')));
    injectExample(utilSlot, pickRandom(byType(ALL, 'Utility')));
}

// ===== Simple mini quiz =====
function renderQuiz() {
    if (!quizRoot) return;
    const Q = [
        {
            q: 'What determines your chance to dodge?',
            a: ['Handling', 'Speed', 'Rarity', 'Play Cost'],
            i: 0
        },
        {
            q: 'What wins the game?',
            a: ['Most cards in hand', 'Highest Position at race end', 'Most mythics revealed'],
            i: 1
        },
        {
            q: 'Items usually need…',
            a: ['A hit roll against a threshold', 'A sacrifice of your Driver', 'No cost at all'],
            i: 0
        }
    ];
    quizRoot.innerHTML = Q.map((q, i) => `
    <div class="quiz-q">
      <div class="qq">${i + 1}. ${q.q}</div>
      <div class="qa">
        ${q.a.map((opt, j) => `<button class="btn quiz-opt" data-q="${i}" data-a="${j}">${opt}</button>`).join('')}
      </div>
      <div class="qr" id="qr-${i}"> </div>
    </div>
  `).join('');

    quizRoot.querySelectorAll('.quiz-opt').forEach(btn => {
        btn.addEventListener('click', () => {
            const qi = parseInt(btn.dataset.q, 10);
            const ai = parseInt(btn.dataset.a, 10);
            const correct = ai === Q[qi].i;
            const r = document.getElementById(`qr-${qi}`);
            r.textContent = correct ? 'Correct! ✅' : 'Try again. ❌';
            r.style.color = correct ? '#54c17a' : '#ff8686';
        });
    });
}

// ===== Tools =====
function wireTools() {
    if (d6Btn && d6Out) {
        d6Btn.addEventListener('click', () => {
            d6Out.textContent = (1 + Math.floor(Math.random() * 6)).toString();
        });
    }
    if (coinBtn && coinOut) {
        coinBtn.addEventListener('click', () => {
            coinOut.textContent = Math.random() < 0.5 ? 'Heads' : 'Tails';
        });
    }
}

// ===== Boot =====
document.addEventListener('DOMContentLoaded', () => {
    wireTools();
    renderQuiz();

    Papa.parse(CSV_URL, {
        download: true, header: true, skipEmptyLines: true,
        complete: (res) => {
            ALL = res.data.map(mapRow).filter(r => r.name);
            rerollExamples();
            if (rerollBtn) rerollBtn.addEventListener('click', rerollExamples);
        },
        error: (e) => console.error(e)
    });
});
