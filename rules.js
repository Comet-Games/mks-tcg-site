// rules.js – simple, clean, no layout shenanigans

const CSV_URL = 'data/MasterSheet.csv';
const FRONT_DIR = 'images/cards';
const FRONT_EXT = 'png';
const IMG_VERSION_SUFFIX = '_vv1'; // e.g. d001_vv1.png

const t = s => (s ?? '').toString().trim();
const lc = s => t(s).toLowerCase();

function frontImage(cardId) {
    if (!cardId) return '';
    return `${FRONT_DIR}/${encodeURIComponent(cardId + IMG_VERSION_SUFFIX)}.${FRONT_EXT}`;
}

function mapRow(row) {
    return {
        name: t(row['Card Name']),
        type: t(row['Card Type']),   // Driver / Kart / Item / Utility
        rarity: t(row['Rarity']) || 'Common',
        card_id: t(row['Card ID']),
    };
}

function filterByType(cards, type) {
    return cards.filter(c => lc(c.type) === lc(type) && c.card_id);
}

function pickRandom(list) {
    if (!list.length) return null;
    return list[Math.floor(Math.random() * list.length)];
}

function renderExampleCard(slotId, card) {
    const slot = document.getElementById(slotId);
    if (!slot) return;

    if (!card) {
        slot.innerHTML = '<p class="rules-note">No card of this type found.</p>';
        return;
    }

    const imgSrc = frontImage(card.card_id);
    const href = `catalogue.html?id=${encodeURIComponent(card.card_id)}`;

    slot.innerHTML = `
    <a class="example-card-link" href="${href}" title="Open in catalogue">
      <div class="example-card-frame">
        <img src="${imgSrc}" alt="${card.name}">
      </div>
      <div class="example-card-name">${card.name}</div>
    </a>
  `;
}

// mini tools
function wireTools() {
    const d6Btn = document.getElementById('rollD6');
    const d6Out = document.getElementById('d6Result');
    const coinBtn = document.getElementById('flipCoin');
    const coinOut = document.getElementById('coinResult');

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

document.addEventListener('DOMContentLoaded', () => {
    wireTools();

    Papa.parse(CSV_URL, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: (res) => {
            const cards = res.data.map(mapRow).filter(c => c.name);

            function reroll() {
                renderExampleCard('driverExample', pickRandom(filterByType(cards, 'Driver')));
                renderExampleCard('kartExample', pickRandom(filterByType(cards, 'Kart')));
                renderExampleCard('itemExample', pickRandom(filterByType(cards, 'Item')));
                renderExampleCard('utilityExample', pickRandom(filterByType(cards, 'Utility')));
            }

            reroll();

            const shuffleBtn = document.getElementById('shuffleExamples');
            if (shuffleBtn) {
                shuffleBtn.addEventListener('click', reroll);
            }
        },
        error: (e) => console.error(e)
    });
});
