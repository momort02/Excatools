import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, collection, doc, getDocs, getDoc, addDoc, deleteDoc, updateDoc, query, orderBy, limit, where } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyA831PoGY1dzGaI0MgNCI92NmXsEtiW9LU",
  authDomain: "excatools.firebaseapp.com",
  projectId: "excatools",
  storageBucket: "excatools.firebasestorage.app",
  messagingSenderId: "471103011145",
  appId: "1:471103011145:web:da2d972cd7d0224b89c298"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const EXCALIA_API = 'https://excalia.fr/api/hotel';
const UA = 'ExcaTools/1.0 (excatools)';
const BASE_PJS = 'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.21.11/';
const PAGE_SIZE = 30;

let allItems = [], filteredItems = [], stats = null;
let currentPage = 1, currentCategory = 'ALL', currentSearch = '', currentSort = 'default';
let priceHistoryAll = [];
let currentModalKey = null, currentModalName = null, currentChartRange = 24;
let chartInstance = null;
let playersData = null, playersSearch = '', playersServerFilter = 'all';
let playersRefreshTimer = null;
let selectedAlertItem = null;

const ORAXEN_NAMES = {
  rune_strength_3: 'Rune de Tranchant VI', rune_speed_3: 'Rune de Châtiment VI',
  rune_fall_3: 'Rune de Puissance VII', cristal_marin: 'Cristal Marin',
  pierre_celeste: 'Pierre Céleste', pierre_mystique: 'Pierre Mystique',
  premium_houe: 'Houe des Flammes Glaciales', ice_key: 'Clé Premium+',
  plume_fly_60m: 'Plume de Fly 60min', potion_generale_t3: 'Potion Générale 15%',
  delicate_hook: 'Hameçon Léger',
};

const MC_NAMES = {
  iron_block: 'Bloc de Fer', gold_block: 'Bloc d\'Or', diamond_block: 'Bloc de Diamant',
  netherite_boots: 'Bottes en Netherite', netherite_chestplate: 'Plastron en Netherite',
  netherite_leggings: 'Jambières en Netherite', netherite_helmet: 'Casque en Netherite',
  netherite_sword: 'Épée en Netherite', netherite_scrap: 'Débris Anciens',
  apple: 'Pomme', bamboo: 'Bambou', beacon: 'Balise',
  jungle_sapling: 'Pousse de Jungle', enchanted_book: 'Livre Enchanté',
  splash_potion: 'Potion Jetable', iron_ingot: 'Lingot de Fer',
  gold_ingot: 'Lingot d\'Or', diamond: 'Diamant', emerald: 'Émeraude',
  netherite_ingot: 'Lingot de Netherite',
};

const ENCHANT_NAMES = {
  'minecraft:mending': 'Réparation',
  'minecraft:protection': 'Protection',
  'minecraft:unbreaking': 'Solidité',
  'minecraft:sharpness': 'Tranchant',
  'minecraft:efficiency': 'Efficacité',
  'minecraft:fortune': 'Fortune',
  'minecraft:silk_touch': 'Toucher de Soie',
  'minecraft:looting': 'Butin',
  'minecraft:fire_aspect': 'Aspect de Feu',
  'minecraft:knockback': 'Recul',
  'minecraft:sweeping_edge': 'Taille en Éventail',
  'minecraft:depth_strider': 'Foulée des Profondeurs',
  'minecraft:feather_falling': 'Chute Amortie',
  'minecraft:blast_protection': 'Protection Explosions',
  'minecraft:fire_protection': 'Protection Feu',
  'minecraft:projectile_protection': 'Protection Projectiles',
  'minecraft:respiration': 'Respiration',
  'minecraft:aqua_affinity': 'Affinité Aquatique',
  'minecraft:thorns': 'Épines',
  'minecraft:frost_walker': 'Pas Givrés',
  'minecraft:soul_speed': 'Vitesse des Âmes',
  'minecraft:swift_sneak': 'Furtivité Rapide',
  'minecraft:power': 'Puissance',
  'minecraft:punch': 'Percussion',
  'minecraft:flame': 'Flamme',
  'minecraft:infinity': 'Infini',
  'minecraft:luck_of_the_sea': 'Chance de la Mer',
  'minecraft:lure': 'Appât',
  'minecraft:channeling': 'Canalisation',
  'minecraft:impaling': 'Embrocher',
  'minecraft:loyalty': 'Loyauté',
  'minecraft:riptide': 'Raz-de-Marée',
  'minecraft:multishot': 'Multitir',
  'minecraft:piercing': 'Pénétration',
  'minecraft:quick_charge': 'Chargement Rapide',
  'minecraft:bane_of_arthropods': 'Fléau des Arthropodes',
  'minecraft:smite': 'Châtiment',
};

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

const CAT_FALLBACK = {
  BLOCKS: { emoji: '🧱', color: '#a16207' }, TOOLS: { emoji: '⛏️', color: '#7DD3FC' },
  WEAPON: { emoji: '⚔️', color: '#ef4444' }, ARMOR: { emoji: '🛡️', color: '#6366f1' },
  FOOD: { emoji: '🍖', color: '#f97316' }, POTIONS: { emoji: '🧪', color: '#a855f7' },
  MISCELLANEOUS: { emoji: '✨', color: '#FACC15' },
};

// ── UTILS ──

window.showPage = function(page) {
  ['market', 'prices', 'alerts', 'island', 'players'].forEach(p => {
    const el = document.getElementById(p + 'Page');
    const nav = document.getElementById('nav' + p.charAt(0).toUpperCase() + p.slice(1));
    if (!el) return;
    if (p === 'market') el.classList.toggle('hidden', page !== 'market');
    else el.classList.toggle('visible', page === p);
    if (nav) nav.classList.toggle('active', page === p);
  });
  if (page === 'prices') loadPriceHistory();
  if (page === 'alerts') { loadAlerts(); loadPriceHistoryForAutocomplete(); }
  if (page === 'players') loadPlayers();
};

function getItemKey(dn) {
  const oraxenId = dn.match(/oraxen:id[^a-z_0-9][^"]*"([a-z_0-9]+)"/);
  if (oraxenId) return oraxenId[1];
  const o = dn.match(/oraxen:([a-z_0-9]+)/); if (o) return o[1];
  const v = dn.match(/show_item:([a-z_]+)/); if (v) return v[1];
  return null;
}

function stripSmallCaps(str) {
  const map = {
    'ᴀ':'a','ʙ':'b','ᴄ':'c','ᴅ':'d','ᴇ':'e','ꜰ':'f','ɢ':'g','ʜ':'h','ɪ':'i',
    'ᴊ':'j','ᴋ':'k','ʟ':'l','ᴍ':'m','ɴ':'n','ᴏ':'o','ᴘ':'p','ǫ':'q','ʀ':'r',
    'ꜱ':'s','ᴛ':'t','ᴜ':'u','ᴠ':'v','ᴡ':'w','ʏ':'y','ᴢ':'z',
  };
  return str.split('').map(c => map[c] ?? c).join('');
}

function extractTextFromNode(node) {
  if (typeof node === 'string') return node;
  if (!node || typeof node !== 'object') return '';
  let t = node.text || '';
  if (Array.isArray(node.extra)) t += node.extra.map(extractTextFromNode).join('');
  return t;
}

function parseSnbtToJson(snbt) {
  return snbt
    .replace(/([{,\[])\s*([a-zA-Z_][a-zA-Z_0-9]*)\s*:/g, '$1"$2":')
    .replace(/:(\d+)b/gi, ':$1');
}

function parseStoredEnchantments(dn) {
  const match = dn.match(/stored_enchantments:'\{([^}]+)\}'/);
  if (!match) return null;
  try {
    const obj = JSON.parse('{' + match[1] + '}');
    const parts = Object.entries(obj).map(([key, lvl]) => {
      const name = ENCHANT_NAMES[key] || key.split(':')[1].replace(/_/g, ' ');
      return lvl > 1 ? name + ' ' + (ROMAN[lvl] || lvl) : name;
    });
    return parts.length ? parts.join(', ') : null;
  } catch (_) { return null; }
}

function parseItemName(item) {
  const dn = item.displayName;

  // ── 1. custom_name avec extra (clef_vote, clef_premium, gemme…)
  const customNameMatch = dn.match(/custom_name:'(\{[^']+\})'/);
  if (customNameMatch) {
    try {
      const obj = JSON.parse(parseSnbtToJson(customNameMatch[1]));
      const name = extractTextFromNode(obj).trim();
      if (name.length > 1) return stripSmallCaps(name);
    } catch (_) {
      const texts = [...customNameMatch[1].matchAll(/"text"\s*:\s*"([^"]*)"/g)];
      const name = texts.map(m => m[1]).join('').trim();
      if (name.length > 1) return stripSmallCaps(name);
    }
  }

  // ── 2. item_name string simple (lingot_dacier_brut)
  const simpleNameMatch = dn.match(/item_name:'"([^'"]{2,80})"'/);
  if (simpleNameMatch) return stripSmallCaps(simpleNameMatch[1].trim());

  // ── 3. item_name avec extra JSON (block-breaker, pierre_mystique, épée…)
  const itemNameJson = dn.match(/item_name:'(\{[^']+\})'/);
  if (itemNameJson) {
    try {
      const obj = JSON.parse(parseSnbtToJson(itemNameJson[1]));
      const name = extractTextFromNode(obj).trim();
      if (name.length > 1) return stripSmallCaps(name);
    } catch (_) {
      const texts = [...itemNameJson[1].matchAll(/"text"\s*:\s*"([^"]*)"/g)];
      const name = texts.map(m => m[1]).join('').trim();
      if (name.length > 1) return stripSmallCaps(name);
    }
  }

  // ── 4. MiniMessage dans lang:chat.square_brackets
  const miniMsg = dn.match(/lang:chat\.square_brackets:'([\s\S]+?)'\s*>/);
  if (miniMsg) {
    const name = miniMsg[1].replace(/<[^>]+>/g, '').trim();
    if (name.length > 1) return stripSmallCaps(name);
  }

  // ── 5. Vanilla lang key
  const langKey = dn.match(/<lang:(block|item)\.minecraft\.([a-z_]+)>/);
  if (langKey) {
    const key = langKey[2];
    if (key === 'enchanted_book') {
      const enchants = parseStoredEnchantments(dn);
      return enchants ? 'Livre : ' + enchants : 'Livre Enchanté';
    }
    return MC_NAMES[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  // ── 6. Oraxen ID fallback
  const oraxenId = dn.match(/oraxen:id[^a-z_0-9][^"]*"([a-z_0-9]+)"/);
  if (oraxenId) return ORAXEN_NAMES[oraxenId[1]] || oraxenId[1].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const o = dn.match(/oraxen:([a-z_0-9]+)/);
  if (o) return ORAXEN_NAMES[o[1]] || o[1].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return 'Objet Inconnu';
}

function parseRarity(dn) {
  if (dn.includes('rarelvl3') || dn.includes('rarity\\":\\"RARE')) return 'rare';
  if (dn.includes('rarelvl5') || dn.includes('epiclvl')) return 'epic';
  if (dn.includes('mythic')) return 'mythic';
  if (dn.includes('uncommonlvl') || dn.includes('uncommon')) return 'uncommon';
  if (dn.includes('elite')) return 'epic';
  return 'common';
}

function getItemImage(item) {
  const dn = item.displayName;
  const oraxenId = dn.match(/oraxen:id[^a-z_0-9][^"]*"([a-z_0-9]+)"/);
  const oraxenModel = dn.match(/oraxen:([a-z_0-9]+)/);
  const oraxenKey = oraxenId ? oraxenId[1] : (oraxenModel ? oraxenModel[1] : null);
  if (oraxenKey) {
    const fb = CAT_FALLBACK[item.category] || { emoji: '✦', color: '#FACC15' };
    // On essaie directement PrismarineJS, sans passer par /textures/ local
    return {
      type: 'sprite',
      value: BASE_PJS + 'items/' + oraxenKey + '.png',
      fallback: fb.emoji,
      fallbackUrl: null  // pas de second fallback URL, on tombe sur l'emoji
    };
  }
  const v = dn.match(/show_item:([a-z_]+)/);
  if (v) {
    const folder = item.category === 'BLOCKS' ? 'blocks' : 'items';
    const fb = CAT_FALLBACK[item.category] || { emoji: '📦', color: '#666' };
    return {
      type: 'sprite',
      value: BASE_PJS + folder + '/' + v[1] + '.png',
      fallback: fb.emoji,
      fallbackUrl: null
    };
  }
  const fb = CAT_FALLBACK[item.category] || { emoji: '📦', color: '#666' };
  return { type: 'emoji', value: fb.emoji, color: fb.color };
}

function formatPrice(p) {
  if (!p && p !== 0) return '—';
  if (p >= 1000000) return (p / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (p >= 1000) return (p / 1000).toFixed(0) + 'k';
  return p.toLocaleString('fr-FR');
}

function timeLeft(expiresAt) {
  const diff = new Date(expiresAt) - Date.now();
  if (diff < 0) return { text: 'Expiré', soon: true };
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(h / 24);
  if (d > 0) return { text: d + 'j ' + (h % 24) + 'h', soon: false };
  return { text: h + 'h', soon: h < 6 };
}

// ── MARKET ──

function renderCard(item, idx) {
  const rarity = parseRarity(item.displayName);
  const name = parseItemName(item);
  const qty = item.displayName.match(/show_item:[a-z_]+:(\d+)/);
  const qtyN = qty && qty[1] !== '1' ? parseInt(qty[1]) : null;
  const exp = timeLeft(item.expiresAt);
  const img = getItemImage(item);
  const key = getItemKey(item.displayName);
  if (img.type === 'sprite') {
  iconInner = `<img src="${img.value}" alt="" 
    onerror="this.outerHTML='<span style=font-size:1.4rem>${img.fallback}</span>'" 
    style="width:32px;height:32px;image-rendering:pixelated;object-fit:contain;">`;
};

  let iconInner;
  if (img.type === 'sprite') {
    const fb2 = img.fallbackUrl
      ? `if(!this.dataset.fb){this.dataset.fb=1;this.src='${img.fallbackUrl}'}else{this.outerHTML='<span style=font-size:1.4rem>${img.fallback}</span>'}`
      : `this.outerHTML='<span style=font-size:1.4rem>${img.fallback}</span>'`;
    iconInner = `<img src="${img.value}" alt="" onerror="${fb2}" style="width:32px;height:32px;image-rendering:pixelated;object-fit:contain;">`;
  } else {
    iconInner = `<span style="font-size:1.4rem;filter:drop-shadow(0 0 8px ${img.color}88)">${img.value}</span>`;
  }

  const hist = priceHistoryAll.find(h => h.key === key);
  let priceHint = '';
  if (hist?.lastAvg) {
    const diff = Math.round(((item.price - hist.lastAvg) / hist.lastAvg) * 100);
    if (Math.abs(diff) >= 5) {
      priceHint = `<div class="card-price-hint${diff > 0 ? ' above' : ''}">${diff > 0 ? '▲' : '▼'} ${Math.abs(diff)}% vs moy. ${formatPrice(hist.lastAvg)}</div>`;
    }
  }

  const safeName = name.replace(/'/g, "\\'");
  return `<div class="card" style="animation-delay:${(idx % PAGE_SIZE) * 0.02}s" onclick="openChart('${key}','${safeName}')">
    <div class="card-header">
      <div class="item-icon">${iconInner}${qtyN ? `<span class="qty-badge">×${qtyN}</span>` : ''}</div>
      <div style="flex:1;min-width:0">
        <div class="item-name">${name}</div>
        <div class="item-seller">Vendu par <span>${item.ownerName}</span></div>
      </div>
      <div class="rarity-badge rarity-${rarity}">${rarity}</div>
    </div>
    <div class="card-footer">
      <div>
        <div class="price"><span class="price-value">${formatPrice(item.price)}</span><span class="price-currency">${item.currency}</span></div>
        ${priceHint}
        <div class="category-tag">${item.category}</div>
      </div>
      <div class="expires${exp.soon ? ' soon' : ''}">⏱ ${exp.text}</div>
    </div>
  </div>`;
}

function renderGrid() {
  const grid = document.getElementById('grid');
  const page = filteredItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  if (!page.length) { grid.innerHTML = '<div class="empty">✦ Aucun objet trouvé ✦</div>'; return; }
  grid.innerHTML = page.map(renderCard).join('');
  document.getElementById('totalCount').innerHTML = `<span>${filteredItems.length}</span> objets sur <span>${allItems.length}</span>`;
  renderPagination();
}

function renderPagination() {
  const total = Math.ceil(filteredItems.length / PAGE_SIZE);
  const pag = document.getElementById('pagination');
  if (total <= 1) { pag.innerHTML = ''; return; }
  let html = `<button class="page-btn" onclick="goPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>◀</button>`;
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - currentPage) <= 2)
      html += `<button class="page-btn${i === currentPage ? ' active' : ''}" onclick="goPage(${i})">${i}</button>`;
    else if (Math.abs(i - currentPage) === 3)
      html += `<span class="page-info">…</span>`;
  }
  html += `<button class="page-btn" onclick="goPage(${currentPage + 1})" ${currentPage === total ? 'disabled' : ''}>▶</button>`;
  pag.innerHTML = html;
}

window.goPage = p => {
  const total = Math.ceil(filteredItems.length / PAGE_SIZE);
  if (p < 1 || p > total) return;
  currentPage = p;
  renderGrid();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

function applyFilters() {
  let items = allItems.slice();
  if (currentCategory !== 'ALL') items = items.filter(i => i.category === currentCategory);
  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    items = items.filter(i => parseItemName(i).toLowerCase().includes(q) || i.ownerName.toLowerCase().includes(q));
  }
  if (currentSort === 'price_asc') items.sort((a, b) => a.price - b.price);
  else if (currentSort === 'price_desc') items.sort((a, b) => b.price - a.price);
  else if (currentSort === 'seller') items.sort((a, b) => a.ownerName.localeCompare(b.ownerName));
  filteredItems = items;
  currentPage = 1;
  renderGrid();
}

window.setCategory = cat => { currentCategory = cat; renderCats(); applyFilters(); };

function renderCats() {
  if (!stats) return;
  let html = `<div class="cat-pill${currentCategory === 'ALL' ? ' active' : ''}" onclick="setCategory('ALL')">
    <span class="cat-pill-name">Tout</span><span class="cat-pill-count">${allItems.length}</span><span class="cat-pill-avg">&nbsp;</span></div>`;
  stats.byCategory.forEach(c => {
    const fb = CAT_FALLBACK[c.category] || { emoji: '📦' };
    html += `<div class="cat-pill${currentCategory === c.category ? ' active' : ''}" onclick="setCategory('${c.category}')">
      <span class="cat-pill-name">${fb.emoji} ${c.category.toLowerCase()}</span>
      <span class="cat-pill-count">${c.count}</span>
      <span class="cat-pill-avg">moy. ${formatPrice(Math.round(c.avgPrice))}</span></div>`;
  });
  document.getElementById('catsBar').innerHTML = html;
}

async function loadAll() {
  try {
    const res = await fetch(`${EXCALIA_API}?page=1&pageSize=30`, { headers: { 'User-Agent': UA } });
    const data = await res.json();
    stats = data.stats;
    document.getElementById('statActive').textContent = data.stats.activeCount.toLocaleString('fr-FR');
    document.getElementById('statSold').textContent = data.stats.soldLast24h.toLocaleString('fr-FR');
    const pages = Math.ceil(data.list.total / 30);
    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, i) =>
        fetch(`${EXCALIA_API}?page=${i + 2}&pageSize=30`, { headers: { 'User-Agent': UA } }).then(r => r.json())
      )
    );
    allItems = [data, ...rest].flatMap(r => r.list.items);
    filteredItems = allItems.slice();
    renderCats();
    renderGrid();
    loadPriceHistoryForAutocomplete();
  } catch (e) {
    document.getElementById('grid').innerHTML = '<div class="empty">⚠ Erreur de connexion</div>';
  }
}

document.getElementById('searchInput').addEventListener('input', e => { currentSearch = e.target.value.trim(); applyFilters(); });
document.getElementById('sortSelect').addEventListener('change', e => { currentSort = e.target.value; applyFilters(); });

// ── PRICE HISTORY ──

async function loadPriceHistoryForAutocomplete() {
  if (priceHistoryAll.length) return;
  try {
    const snap = await getDocs(query(collection(db, 'price_history'), orderBy('updatedAt', 'desc')));
    priceHistoryAll = snap.docs.map(d => d.data());
  } catch (e) { console.warn('Price history not loaded:', e.message); }
}

async function loadPriceHistory() {
  const el = document.getElementById('pricesList');
  el.innerHTML = '<div class="loading"><div class="loader"></div>Chargement…</div>';
  await loadPriceHistoryForAutocomplete();
  renderPricesList();
}

function renderPricesList() {
  const el = document.getElementById('pricesList');
  const q = document.getElementById('priceSearch').value.toLowerCase();
  let data = priceHistoryAll;
  if (q) data = data.filter(d => d.name?.toLowerCase().includes(q));
  if (!data.length) {
    el.innerHTML = '<div class="empty">Aucun historique — le tracker GitHub Actions tourne toutes les 5 min.</div>';
    return;
  }
  el.innerHTML = data.map((d, i) => `
    <div class="price-card" style="animation-delay:${i * 0.02}s" onclick="openChart('${d.key}','${(d.name || d.key).replace(/'/g, "\\'")}')">
      <div class="price-card-name">${d.name || d.key}</div>
      <div class="price-card-stats">
        <div class="price-stat"><span class="price-stat-label">Moy.</span><span class="price-stat-value">${formatPrice(d.lastAvg)}</span></div>
        <div class="price-stat"><span class="price-stat-label">Min</span><span class="price-stat-value green">${formatPrice(d.lastMin)}</span></div>
        <div class="price-stat"><span class="price-stat-label">Max</span><span class="price-stat-value">${formatPrice(d.lastMax)}</span></div>
      </div>
      <div class="price-card-count">${d.lastCount || 0} annonces · ${d.updatedAt ? new Date(d.updatedAt).toLocaleTimeString('fr-FR') : '—'}</div>
    </div>`).join('');
}

document.getElementById('priceSearch').addEventListener('input', renderPricesList);

// ── CHART MODAL ──

window.openChart = async (key, name) => {
  currentModalKey = key;
  currentModalName = name;
  document.getElementById('modalTitle').textContent = '📈 ' + name;
  document.getElementById('chartModal').classList.add('open');
  document.getElementById('modalStats').innerHTML = '';
  await renderChart(key, currentChartRange);
};

window.closeModal = () => {
  document.getElementById('chartModal').classList.remove('open');
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
};

window.setChartRange = h => {
  currentChartRange = h;
  document.querySelectorAll('.chart-tab').forEach((t, i) => t.classList.toggle('active', [24, 168, 720][i] === h));
  if (currentModalKey) renderChart(currentModalKey, h);
};

async function renderChart(key, hours) {
  try {
    const cutoff = Date.now() - hours * 3600000;
    const lim = Math.min(hours * 2, 500);
    const snap = await getDocs(
      query(collection(db, 'price_history', key, 'snapshots'), orderBy('ts', 'desc'), limit(lim))
    );
    const raw = snap.docs.map(d => d.data()).reverse().filter(d => d.ts >= cutoff);
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    const canvas = document.getElementById('priceChart');
    const ctx = canvas.getContext('2d');
    if (!raw.length) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#7a7060'; ctx.font = '14px Cinzel'; ctx.textAlign = 'center';
      ctx.fillText('Pas encore de données pour cette période', canvas.width / 2, canvas.height / 2);
      document.getElementById('modalStats').innerHTML = '';
      return;
    }
    const labels = raw.map(d => new Date(d.ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Moy.', data: raw.map(d => d.avg), borderColor: '#FACC15', backgroundColor: 'rgba(250,204,21,0.08)', tension: 0.3, pointRadius: 2, borderWidth: 2 },
          { label: 'Min', data: raw.map(d => d.min), borderColor: '#22C55E', backgroundColor: 'transparent', tension: 0.3, pointRadius: 0, borderWidth: 1, borderDash: [4, 4] },
          { label: 'Max', data: raw.map(d => d.max), borderColor: '#ef4444', backgroundColor: 'transparent', tension: 0.3, pointRadius: 0, borderWidth: 1, borderDash: [4, 4] },
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: '#7a7060', font: { family: 'Cinzel', size: 10 } } } },
        scales: {
          x: { ticks: { color: '#7a7060', font: { size: 10 }, maxTicksLimit: 8 }, grid: { color: 'rgba(250,204,21,0.06)' } },
          y: { ticks: { color: '#7a7060', font: { size: 10 }, callback: v => formatPrice(v) }, grid: { color: 'rgba(250,204,21,0.06)' } }
        }
      }
    });
    const last = raw[raw.length - 1];
    const trend = raw[0].avg > 0 ? Math.round(((last.avg - raw[0].avg) / raw[0].avg) * 100) : 0;
    document.getElementById('modalStats').innerHTML = `
      <div class="modal-stat"><span class="modal-stat-label">Moy. actuelle</span><span class="modal-stat-value">${formatPrice(last.avg)}</span></div>
      <div class="modal-stat"><span class="modal-stat-label">Min observé</span><span class="modal-stat-value" style="color:#22C55E">${formatPrice(Math.min(...raw.map(d => d.min)))}</span></div>
      <div class="modal-stat"><span class="modal-stat-label">Max observé</span><span class="modal-stat-value" style="color:#ef4444">${formatPrice(Math.max(...raw.map(d => d.max)))}</span></div>
      <div class="modal-stat"><span class="modal-stat-label">Tendance</span><span class="modal-stat-value" style="color:${trend >= 0 ? '#ef4444' : '#22C55E'}">${trend >= 0 ? '▲' : '▼'} ${Math.abs(trend)}%</span></div>`;
  } catch (e) { console.error(e); }
}

window.openAlertFromModal = () => {
  if (!currentModalKey) return;
  closeModal();
  showPage('alerts');
  setTimeout(() => {
    document.getElementById('alertItemInput').value = currentModalName || '';
    selectedAlertItem = { key: currentModalKey, name: currentModalName };
    document.getElementById('alertPrice').focus();
  }, 100);
};

// ── ALERTS ──

async function loadAlerts() {
  const el = document.getElementById('alertsList');
  el.innerHTML = '<div class="loading"><div class="loader"></div>Chargement…</div>';
  try {
    const snap = await getDocs(query(collection(db, 'alerts'), orderBy('createdAt', 'desc')));
    const alerts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!alerts.length) { el.innerHTML = '<div class="empty">Aucune alerte configurée</div>'; return; }
    el.innerHTML = alerts.map(a => {
      const lastTrig = a.lastTriggered ? 'Déclenché ' + new Date(a.lastTriggered).toLocaleString('fr-FR') : 'Jamais déclenché';
      const wh = a.webhookUrl.replace('https://discord.com/api/webhooks/', '…/');
      return `<div class="alert-row">
        <div class="alert-item-name">${a.itemName}</div>
        <div class="alert-price">≤ ${formatPrice(a.maxPrice)}</div>
        <div class="alert-webhook" title="${a.webhookUrl}">${wh}</div>
        <div class="alert-last">${lastTrig}${a.lastPrice ? ' à ' + formatPrice(a.lastPrice) : ''}</div>
        <span class="alert-status ${a.active ? 'active' : 'paused'}">${a.active ? 'actif' : 'pause'}</span>
        <div class="alert-actions">
          <button class="btn-sm" onclick="toggleAlert('${a.id}',${!a.active})">${a.active ? 'Pause' : 'Activer'}</button>
          <button class="btn-sm danger" onclick="deleteAlert('${a.id}')">Suppr.</button>
        </div>
      </div>`;
    }).join('');
  } catch (e) { el.innerHTML = '<div class="empty">⚠ ' + e.message + '</div>'; }
}

window.createAlert = async () => {
  const itemInput = document.getElementById('alertItemInput').value.trim();
  const maxPrice = document.getElementById('alertPrice').value;
  const webhookUrl = document.getElementById('alertWebhook').value.trim();
  if (!itemInput || !maxPrice || !webhookUrl) { alert('Tous les champs sont requis'); return; }
  if (!webhookUrl.startsWith('https://discord.com/api/webhooks/')) { alert('URL de webhook Discord invalide'); return; }
  const item = selectedAlertItem || { key: itemInput.toLowerCase().replace(/ /g, '_'), name: itemInput };
  try {
    await addDoc(collection(db, 'alerts'), {
      itemKey: item.key, itemName: item.name,
      maxPrice: Number(maxPrice), webhookUrl,
      active: true, createdAt: Date.now(),
      lastTriggered: null, lastPrice: null
    });
    document.getElementById('alertItemInput').value = '';
    document.getElementById('alertPrice').value = '';
    document.getElementById('alertWebhook').value = '';
    selectedAlertItem = null;
    loadAlerts();
  } catch (e) { alert('Erreur: ' + e.message); }
};

window.deleteAlert = async id => {
  if (!confirm('Supprimer cette alerte ?')) return;
  await deleteDoc(doc(db, 'alerts', id));
  loadAlerts();
};

window.toggleAlert = async (id, active) => {
  await updateDoc(doc(db, 'alerts', id), { active });
  loadAlerts();
};

document.getElementById('alertItemInput').addEventListener('input', function() {
  const q = this.value.toLowerCase();
  const dd = document.getElementById('alertAutocomplete');
  if (!q || q.length < 2) { dd.classList.remove('open'); return; }
  const matches = priceHistoryAll.filter(d => d.name?.toLowerCase().includes(q)).slice(0, 8);
  if (!matches.length) { dd.classList.remove('open'); return; }
  dd.innerHTML = matches.map(d =>
    `<div class="autocomplete-item" onclick="selectAlertItem('${d.key}','${d.name.replace(/'/g, "\\'")}')">${d.name} <small style="color:var(--text-dim)">moy. ${formatPrice(d.lastAvg)}</small></div>`
  ).join('');
  dd.classList.add('open');
});

window.selectAlertItem = (key, name) => {
  selectedAlertItem = { key, name };
  document.getElementById('alertItemInput').value = name;
  document.getElementById('alertAutocomplete').classList.remove('open');
};

document.addEventListener('click', e => {
  if (!e.target.closest('.form-group')) document.getElementById('alertAutocomplete').classList.remove('open');
});

// ── ISLAND ──

window.searchIsland = async () => {
  const input = document.getElementById('islandInput').value.trim();
  const result = document.getElementById('islandResult');
  if (!input) return;
  result.innerHTML = '<div style="text-align:center;padding:3rem"><div class="loader" style="margin:0 auto"></div></div>';
  try {
    const res = await fetch('https://excalia.fr/api/island-stats/island/' + encodeURIComponent(input), { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    result.innerHTML = renderIslandData(data);
  } catch (e) {
    result.innerHTML = `<div class="island-error">⚠ Île introuvable ou erreur serveur<br><span style="font-size:0.6rem;opacity:0.5">${e.message}</span></div>`;
  }
};

function renderIslandData(data) {
  const members = data.members || [];
  const materials = data.materials || [];

  // ── Membres
  const roleLabel = { OWNER: '👑 Proprio', CO_OWNER: '⭐ Co-Proprio', MEMBER: '⚔ Membre', GUEST: '👤 Invité' };
  const membersHtml = members.length
    ? members.map(m => `
        <div class="member-row">
          <div class="member-name">
            <img class="member-avatar" src="https://mc-heads.net/avatar/${m.name}/24" alt="" onerror="this.style.display='none'">
            ${m.name}
          </div>
          <span class="member-role role-${m.role || 'MEMBER'}">${roleLabel[m.role] || m.role}</span>
        </div>`).join('')
    : '<div class="empty-section">Aucun membre</div>';

  // ── Matériaux (agrégés par type)
  const matAgg = {};
  for (const m of materials) {
    if (!matAgg[m.material]) matAgg[m.material] = { stock: 0, totalValue: 0, unitValue: m.unitValue };
    matAgg[m.material].stock += m.stock;
    matAgg[m.material].totalValue += m.totalValue;
  }
  const totalValue = Object.values(matAgg).reduce((s, m) => s + m.totalValue, 0);
  const materialsHtml = Object.entries(matAgg).length
    ? `<table style="width:100%;border-collapse:collapse;font-size:0.75rem">
        <thead><tr style="color:var(--text-dim);text-align:left">
          <th style="padding:4px 8px">Matériau</th>
          <th style="padding:4px 8px;text-align:right">Stock</th>
          <th style="padding:4px 8px;text-align:right">Val. unit.</th>
          <th style="padding:4px 8px;text-align:right">Val. totale</th>
        </tr></thead>
        <tbody>
          ${Object.entries(matAgg).sort((a, b) => b[1].totalValue - a[1].totalValue).map(([mat, v]) => `
            <tr style="border-top:1px solid rgba(250,204,21,0.06)">
              <td style="padding:4px 8px;color:var(--gold)">${mat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</td>
              <td style="padding:4px 8px;text-align:right">${v.stock}</td>
              <td style="padding:4px 8px;text-align:right;color:var(--text-dim)">${v.unitValue}</td>
              <td style="padding:4px 8px;text-align:right;color:#22C55E">${v.totalValue}</td>
            </tr>`).join('')}
          <tr style="border-top:1px solid rgba(250,204,21,0.15);font-weight:bold">
            <td style="padding:6px 8px" colspan="3">Total</td>
            <td style="padding:6px 8px;text-align:right;color:#22C55E">${totalValue}</td>
          </tr>
        </tbody>
      </table>`
    : '<div class="empty-section">Aucun matériau</div>';

  // ── Réputation
  const rep = data.reputation || {};
  const repHtml = `<div style="display:flex;gap:1.5rem;font-size:0.8rem">
    <div><span style="color:var(--text-dim)">Moyenne</span><br><span style="color:var(--gold);font-size:1.1rem">${rep.avg ?? '—'}</span></div>
    <div><span style="color:var(--text-dim)">Votes</span><br><span style="color:var(--gold);font-size:1.1rem">${rep.count ?? '—'}</span></div>
  </div>`;

  // ── Stats rapides
  const statsHtml = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.6rem;margin-bottom:0.5rem">
      ${[
        ['📐 Taille', data.size ?? '—'],
        ['👥 Membres max', data.maxMembers ?? '—'],
        ['⚙ Générateur', data.generator ?? '—'],
        ['🚀 Warps', data.warps ?? '—'],
        ['⭐ Valeur', data.value ?? '—'],
        ['💰 Balance', formatPrice(data.balance)],
      ].map(([label, val]) => `
        <div style="background:rgba(250,204,21,0.04);border:1px solid rgba(250,204,21,0.1);border-radius:8px;padding:0.5rem 0.75rem">
          <div style="font-size:0.65rem;color:var(--text-dim)">${label}</div>
          <div style="font-size:0.9rem;color:var(--gold);font-weight:bold">${val}</div>
        </div>`).join('')}
    </div>`;

  const owner = members.find(m => m.role === 'OWNER');

  return `<div class="island-result">
    <div class="island-hero"><div class="island-hero-top">
      <div>
        <div class="island-owner">⚑ ${owner?.name || data.ownerName || '?'}</div>
        <div class="island-id">ID : ${data.islandId || data.id || '—'}</div>
        <div style="font-size:0.65rem;color:var(--text-dim);margin-top:2px">
          Créée le ${data.createdAt ? new Date(data.createdAt).toLocaleDateString('fr-FR') : '—'}
        </div>
      </div>
      <div style="text-align:right">
        <div class="island-balance-value">${formatPrice(data.balance)}</div>
        <div class="island-balance-label">Balance</div>
      </div>
    </div></div>
    <div class="island-sections">
      <div class="island-section"><div class="section-title">📊 Statistiques</div>${statsHtml}</div>
      <div class="island-section"><div class="section-title">⭐ Réputation</div>${repHtml}</div>
      <div class="island-section"><div class="section-title">⚔ Membres (${members.length}/${data.maxMembers ?? '?'})</div>${membersHtml}</div>
      <div class="island-section"><div class="section-title">🧱 Matériaux (valeur totale : ${totalValue})</div>${materialsHtml}</div>
    </div>
  </div>`;
}

// ── PLAYERS ──

async function loadPlayers() {
  try {
    const res = await fetch('https://excalia.fr/api/online-players', { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    playersData = await res.json();
    renderPlayers();
    if (playersRefreshTimer) clearTimeout(playersRefreshTimer);
    playersRefreshTimer = setTimeout(() => {
      if (document.getElementById('playersPage').classList.contains('visible')) loadPlayers();
    }, 15000);
  } catch (e) {
    document.getElementById('playersContent').innerHTML = `<div class="empty">⚠ ${e.message}</div>`;
  }
}

window.toggleMenu = function() {
  const nav = document.getElementById('mainNav');
  const btn = document.getElementById('burgerBtn');
  nav.classList.toggle('open');
  btn.classList.toggle('open');
};

const originalShowPage = window.showPage;
window.showPage = function(page) {
  ['market', 'prices', 'alerts', 'island', 'players'].forEach(p => {
    const el = document.getElementById(p + 'Page');
    const nav = document.getElementById('nav' + p.charAt(0).toUpperCase() + p.slice(1));
    if (el) {
      if (p === 'market') el.classList.toggle('hidden', page !== 'market');
      else el.classList.toggle('visible', page === p);
    }
    if (nav) nav.classList.toggle('active', page === p);  // ← guard ajouté
  });
  if (page === 'prices') loadPriceHistory();
  if (page === 'alerts') { loadAlerts(); loadPriceHistoryForAutocomplete(); }
  if (page === 'players') loadPlayers();
};

function renderPlayers() {
  if (!playersData) return;
  const d = playersData;
  let players = d.players || [];
  if (playersServerFilter !== 'all') players = players.filter(p => p.serverIds?.includes(playersServerFilter));
  if (playersSearch) { const q = playersSearch.toLowerCase(); players = players.filter(p => p.name.toLowerCase().includes(q)); }
  const byServer = d.byServer || {};
  const serverKeys = Object.keys(byServer);
  const serverPillsHtml = serverKeys.map(s => `<div class="server-pill"><div class="server-pill-name">${s}</div><div class="server-pill-count">${byServer[s]}</div></div>`).join('');
  let filterHtml = `<button class="filter-btn${playersServerFilter === 'all' ? ' active' : ''}" onclick="setPlayersServer('all')">Tous</button>`;
  serverKeys.forEach(s => { filterHtml += `<button class="filter-btn${playersServerFilter === s ? ' active' : ''}" onclick="setPlayersServer('${s}')">${s}</button>`; });
  const cardsHtml = players.length
    ? players.map((p, i) => `<div class="player-card" style="animation-delay:${i * 0.015}s">
        <img class="player-avatar" src="https://mc-heads.net/avatar/${p.uuid}/36" alt="" onerror="this.src='https://mc-heads.net/avatar/${p.name}/36'">
        <div class="player-info">
          <div class="player-name">${p.name}</div>
          <div class="player-grade" style="color:${p.grade ? p.grade.color : 'var(--text-dim)'}">${p.grade ? p.grade.name : 'Sans grade'}</div>
          <div class="player-servers">${(p.serverIds || []).map(s => `<span class="server-tag">${s}</span>`).join('')}</div>
        </div>
      </div>`).join('')
    : '<div class="empty">Aucun joueur trouvé</div>';
  document.getElementById('playersContent').innerHTML = `
    <div class="players-header">
      <div><div class="players-title"><span class="online-dot"></span>Joueurs en ligne</div><div class="total-online">${d.total} <span style="font-size:0.9rem;color:var(--text-dim)">connectés</span></div></div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.4rem">
        <button class="refresh-btn" onclick="loadPlayersManual()">↺ Actualiser</button>
        <div class="last-update">Mis à jour à ${new Date().toLocaleTimeString('fr-FR')}</div>
      </div>
    </div>
    <div class="server-pills">${serverPillsHtml}</div>
    <div class="players-filters">
      <input class="players-search" type="text" placeholder="Chercher un joueur…" value="${playersSearch}" oninput="setPlayersSearch(this.value)">
      ${filterHtml}
    </div>
    <div class="players-grid">${cardsHtml}</div>`;
}

window.loadPlayersManual = loadPlayers;
window.setPlayersSearch = val => { playersSearch = val; renderPlayers(); };
window.setPlayersServer = s => { playersServerFilter = s; renderPlayers(); };

loadAll();
