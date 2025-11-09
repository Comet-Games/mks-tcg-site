// ====== Config ======
const CSV_URL   = 'data/MasterSheet.csv';
const FRONT_DIR = 'images/cards';
const FRONT_EXT = 'png';
const IMG_VERSION_SUFFIX = '_vv1';                 // fronts like d001_vv1.png
const CATALOGUE_HREF     = 'mks-tcg-site/catalogue.html';

// ====== DOM ======
const latestGrid  = document.getElementById('latestGrid');
const carouselTrack = document.getElementById('carouselTrack'); // optional; only if carousel section exists

// ====== Utils ======
const t  = s => (s ?? '').toString().trim();
const lc = s => t(s).toLowerCase();
function frontImage(id){ return `${FRONT_DIR}/${encodeURIComponent(id)}.${FRONT_EXT}`; }

function rarityKey(r){
  const v = lc(r);
  if (v.startsWith('myth')) return 'mythic';
  if (v.startsWith('rare') && !v.includes('un')) return 'rare';
  if (v.startsWith('un')) return 'uncommon';
  return 'common';
}

function mapRow(row){
  return {
    name:    t(row['Card Name']),
    type:    t(row['Card Type']),
    rarity:  t(row['Rarity']) || 'Common',
    card_id: t(row['Card ID']),
    version: t(row['Version'])
  };
}

// ====== Latest grid ======
function renderLatest(cards){
  if (!latestGrid) return;
  latestGrid.innerHTML = cards.map(c => `
    <a class="latest-tile rarity-${rarityKey(c.rarity)}"
       href="${CATALOGUE_HREF}?id=${encodeURIComponent(c.card_id || c.name)}"
       title="${c.name}">
      <span class="lt-glow"></span>
      <img loading="lazy" src="${frontImage((c.card_id || '') + IMG_VERSION_SUFFIX)}" alt="${c.name}" />
      <div class="lt-name">${c.name}</div>
    </a>
  `).join('');
}

function fillCounts(cards){
  const total  = cards.length;
  const counts = { common:0, uncommon:0, rare:0, mythic:0 };
  for (const c of cards) counts[rarityKey(c.rarity)]++;

  const el = id => document.getElementById(id);
  if (el('totalCount'))    el('totalCount').textContent    = total;
  if (el('commonCount'))   el('commonCount').textContent   = counts.common;
  if (el('uncommonCount')) el('uncommonCount').textContent = counts.uncommon;
  if (el('rareCount'))     el('rareCount').textContent     = counts.rare;
  if (el('mythicCount'))   el('mythicCount').textContent   = counts.mythic;
}

function pickLatest(cards, n=6){
  // If a Date column is added later, sort by it. For now: Card ID desc, then Version desc.
  const sorted = [...cards].sort((a,b)=>{
    const A = (a.card_id||'').toString();
    const B = (b.card_id||'').toString();
    if (A === B) return (b.version||'').localeCompare(a.version||'', undefined, {numeric:true});
    return B.localeCompare(A, undefined, {numeric:true});
  });
  return sorted.slice(0,n);
}

// ====== Carousel (optional section) ======
function shuffle(arr){
  for (let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Build an infinite, seamless scrolling carousel:
 * - random order
 * - duplicate sequence for loop (A+B)
 * - duration computed from width for constant px/sec speed
 */
function renderCarousel(cards){
  if (!carouselTrack) return; // page has no carousel section

  const usable = cards
    .filter(c => c.card_id)
    .map(c => ({ id: c.card_id, name: c.name, rarity: rarityKey(c.rarity || 'Common') }));

  if (!usable.length) return;

  const order = shuffle([...usable]);

  // Build one sequence (A)
  const seqA = document.createElement('div');
  seqA.className = 'seqA';
  seqA.style.display = 'flex';
  seqA.style.gap = '.75rem';

  const tile = (c) => {
    const href = `${CATALOGUE_HREF}?id=${encodeURIComponent(c.id)}`;
    const src  = frontImage(c.id + IMG_VERSION_SUFFIX);
    return `
      <a class="carousel-tile rarity-${c.rarity}" href="${href}" title="${c.name}">
        <span class="ring"></span>
        <img loading="lazy" src="${src}" alt="${c.name}">
      </a>`;
  };

  seqA.innerHTML = order.map(tile).join('');

  // Duplicate sequence (B) for seamless loop
  const seqB = seqA.cloneNode(true);

  // Mount and compute travel/duration
  carouselTrack.innerHTML = '';
  carouselTrack.append(seqA, seqB);

  requestAnimationFrame(() => {
    const gapPx = parseFloat(getComputedStyle(seqA).gap || 0) || 0;
    const travelPx = seqA.scrollWidth + gapPx;        // distance to shift until B starts
    const speedPxPerSec = 40;                         // tweak speed here
    const durationSec = Math.max(10, Math.round(travelPx / speedPxPerSec));

    carouselTrack.style.setProperty('--travel', `${travelPx}px`);
    carouselTrack.style.setProperty('--duration', `${durationSec}s`);
  });
}

// ====== Boot ======
document.addEventListener('DOMContentLoaded', ()=>{
  Papa.parse(CSV_URL, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: (res)=>{
      const rows = res.data.map(mapRow).filter(r=>r.name);

      // Stats + latest
      fillCounts(rows);
      renderLatest(pickLatest(rows, 6));

      // Carousel from all cards
      renderCarousel(rows);
    },
    error: (e)=> console.error(e)
  });
});
