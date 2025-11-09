const CSV_URL = 'data/MasterSheet.csv';
const FRONT_DIR = 'images/cards';
const FRONT_EXT = 'png';

const latestGrid = document.getElementById('latestGrid');

function frontImage(id){ return `${FRONT_DIR}/${encodeURIComponent(id)}.${FRONT_EXT}`; }
const t = s => (s??'').toString().trim();
const lc = s => t(s).toLowerCase();

function rarityKey(r){
  const v = lc(r);
  if (v.startsWith('myth')) return 'mythic';
  if (v.startsWith('rare') && !v.includes('un')) return 'rare';
  if (v.startsWith('un')) return 'uncommon';
  return 'common';
}

function mapRow(row){
  return {
    name: t(row['Card Name']),
    type: t(row['Card Type']),
    rarity: t(row['Rarity']) || 'Common',
    card_id: t(row['Card ID']),
    version: t(row['Version'])
  };
}

function renderLatest(cards){
  latestGrid.innerHTML = cards.map(c => `
      <a class="latest-tile rarity-${rarityKey(c.rarity)}"href="mks-tcg-site/catalogue.html?id=${encodeURIComponent(c.card_id || c.name)}"title="${c.name}">
      <span class="lt-glow"></span>
      <img loading="lazy" src="${frontImage(c.card_id + "_vv1")}" alt="${c.name}" />
      <div class="lt-name">${c.name}</div>
    </a>
  `).join('');
}

function fillCounts(cards){
  const total = cards.length;
  const counts = { common:0, uncommon:0, rare:0, mythic:0 };
  for (const c of cards) counts[rarityKey(c.rarity)]++;

  document.getElementById('totalCount').textContent = total;
  document.getElementById('commonCount').textContent = counts.common;
  document.getElementById('uncommonCount').textContent = counts.uncommon;
  document.getElementById('rareCount').textContent = counts.rare;
  document.getElementById('mythicCount').textContent = counts.mythic;
}

function pickLatest(cards, n=6){
  // If you add a "Date" column later, sort by it.
  // For now: sort by Card ID then Version, both descending.
  const sorted = [...cards].sort((a,b)=>{
    const A = (a.card_id||'').toString();
    const B = (b.card_id||'').toString();
    if (A === B) return (b.version||'').localeCompare(a.version||'', undefined, {numeric:true});
    return B.localeCompare(A, undefined, {numeric:true});
  });
  return sorted.slice(0,n);
}

document.addEventListener('DOMContentLoaded', ()=>{
  Papa.parse(CSV_URL, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: (res)=>{
      const rows = res.data.map(mapRow).filter(r=>r.name);
      fillCounts(rows);
      renderLatest(pickLatest(rows, 6));
    },
    error: (e)=> console.error(e)
  });
});
