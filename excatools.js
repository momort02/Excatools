const API = 'https://excalia.fr/api/hotel';
const PAGE_SIZE = 30;
const UA = 'ExcaTools/1.0 (excatools)';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// On utilise une Map pour un accès ultra-rapide dans renderCard
let priceHistoryMap = new Map(); 
const firebaseConfig = {
    apiKey: "AIzaSyA831PoGY1dzGaI0MgNCI92NmXsEtiW9LU",
    authDomain: "excatools.firebaseapp.com",
    projectId: "excatools",
    storageBucket: "excatools.firebasestorage.app",
    messagingSenderId: "471103011145",
    appId: "1:471103011145:web:da2d972cd7d0224b89c298",
    measurementId: "G-R7RBX78ZD6"
  };
let allItems = [];
let filteredItems = [];
let currentPage = 1;
let currentCategory = 'ALL';
let currentSearch = '';
let currentSort = 'default';
let stats = null;
let priceHistoryAll = [];
let currentModalKey = null;
let currentModalName = null;
let currentChartRange = 24;
let chartInstance = null;
let playersData = null;
let playersSearch = '';
let playersServerFilter = 'all';
let playersRefreshTimer = null;

const BASE_PJS = 'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.21.11/';

const ORAXEN_ICONS = {
  rune_strength_3: { emoji: '⚔', color: '#3B82F6' },
  rune_speed_3: { emoji: '💨', color: '#3B82F6' },
  rune_fall_3: { emoji: '🏹', color: '#3B82F6' },
  cristal_marin: { emoji: '💎', color: '#38BDF8' },
  pierre_celeste: { emoji: '💠', color: '#FFD700' },
  pierre_mystique: { emoji: '💠', color: '#FF9EBB' },
  premium_houe: { emoji: '🔥', color: '#7DD3FC' },
  ice_key: { emoji: '🔑', color: '#FACC15' },
  plume_fly_60m: { emoji: '🪶', color: '#01ACE1' },
  potion_generale_t3: { emoji: '✨', color: '#8B5CF6' },
  delicate_hook: { emoji: '🎣', color: '#FACC15' },
};

const CAT_FALLBACK = {
  BLOCKS: { emoji: '🧱', color: '#a16207' },
  TOOLS: { emoji: '⛏️', color: '#7DD3FC' },
  WEAPON: { emoji: '⚔️', color: '#ef4444' },
  ARMOR: { emoji: '🛡️', color: '#6366f1' },
  FOOD: { emoji: '🍖', color: '#f97316' },
  POTIONS: { emoji: '🧪', color: '#a855f7' },
  MISCELLANEOUS: { emoji: '✨', color: '#FACC15' },
};

function showPage(page) {
  const pages = ['market', 'prices', 'alerts', 'island', 'players'];
  pages.forEach(function(p) {
    const el = document.getElementById(p + 'Page');
    const nav = document.getElementById('nav' + p.charAt(0).toUpperCase() + p.slice(1));
    if (!el) return;
    if (p === 'market') { el.classList.toggle('hidden', page !== 'market'); }
    else { el.classList.toggle('visible', page === p); }
    if (nav) nav.classList.toggle('active', page === p);
  });
  if (page === 'prices') loadPriceHistory();
  if (page === 'alerts') loadAlerts();
  if (page === 'players') loadPlayers();
}

function getItemKey(displayName) {
  const oraxenMatch = displayName.match(/oraxen:([a-z_0-9]+)/);
  if (oraxenMatch) return oraxenMatch[1];
  const vanillaMatch = displayName.match(/show_item:([a-z_]+)/);
  if (vanillaMatch) return vanillaMatch[1];
  return 'unknown';
}

function parseItemName(item) {
  const dn = item.displayName;
  const oraxenMatch = dn.match(/oraxen:([a-z_0-9]+)/);
  if (oraxenMatch) {
    const names = {
      rune_strength_3: 'Rune de Tranchant VI', rune_speed_3: 'Rune de Châtiment VI',
      rune_fall_3: 'Rune de Puissance VII', cristal_marin: 'Cristal Marin',
      pierre_celeste: 'Pierre Céleste', pierre_mystique: 'Pierre Mystique',
      premium_houe: 'Houe des Flammes Glaciales', ice_key: 'Clé Premium+',
      plume_fly_60m: 'Plume de Fly 60min', potion_generale_t3: 'Potion Générale 15%',
      delicate_hook: 'Hameçon Léger',
    };
    return names[oraxenMatch[1]] || oraxenMatch[1].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  const langMatch = dn.match(/<lang:([^>]+)>/);
  if (langMatch) {
    const map = {
      'block.minecraft.jungle_sapling': 'Pousse de Jungle',
      'block.minecraft.beacon': 'Balise',
      'item.minecraft.splash_potion.effect.weakness': 'Potion de Faiblesse',
      'item.minecraft.enchanted_book': 'Livre Enchanté',
    };
    if (map[langMatch[1]]) return map[langMatch[1]];
    const parts = langMatch[1].split('.');
    return parts[parts.length - 1].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  return 'Objet Inconnu';
}

function parseRarity(displayName) {
  if (displayName.includes('rarelvl3') || displayName.includes('rarity\\":\\"RARE')) return 'rare';
  if (displayName.includes('rarelvl5') || displayName.includes('epiclvl')) return 'epic';
  if (displayName.includes('mythic')) return 'mythic';
  if (displayName.includes('uncommonlvl') || displayName.includes('uncommon')) return 'uncommon';
  if (displayName.includes('elite')) return 'epic';
  return 'common';
}

function getItemImage(item) {
  const dn = item.displayName;
  const oraxenMatch = dn.match(/oraxen:([a-z_0-9]+)/);
  if (oraxenMatch) {
    const id = oraxenMatch[1];
    const fb = CAT_FALLBACK[item.category] || { emoji: '✦', color: '#FACC15' };
    return { type: 'sprite', value: 'textures/' + id + '.png', fallback: fb.emoji, fallbackUrl: BASE_PJS + 'items/' + id + '.png' };
  }
  const vanillaMatch = dn.match(/show_item:([a-z_]+)/);
  if (vanillaMatch) {
    const id = vanillaMatch[1];
    const folder = item.category === 'BLOCKS' ? 'blocks' : 'items';
    const fb = CAT_FALLBACK[item.category] || { emoji: '📦', color: '#666' };
    return { type: 'sprite', value: BASE_PJS + folder + '/' + id + '.png', fallback: fb.emoji, fallbackUrl: 'textures/' + id + '.png' };
  }
  const fb = CAT_FALLBACK[item.category] || { emoji: '📦', color: '#666' };
  return { type: 'emoji', value: fb.emoji, color: fb.color };
}

function getQuantity(displayName) {
  const match = displayName.match(/show_item:[a-z_]+:(\d+)/);
  if (match && match[1] !== '1') return parseInt(match[1]);
  return null;
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

function renderCard(item, idx) {
  const rarity = parseRarity(item.displayName);
  const name = parseItemName(item);
  const qty = getQuantity(item.displayName);
  const exp = timeLeft(item.expiresAt);
  const img = getItemImage(item);
  const key = getItemKey(item.displayName);

  let iconInner;
  if (img.type === 'sprite') {
    const fb2 = img.fallbackUrl
      ? 'if(!this.dataset.fb){this.dataset.fb=1;this.src=\'' + img.fallbackUrl + '\'}else{this.outerHTML=\'<span style=font-size:1.4rem>' + img.fallback + '</span>\'}'
      : 'this.outerHTML=\'<span style=font-size:1.4rem>' + img.fallback + '</span>\'';
    iconInner = '<img src="' + img.value + '" alt="" onerror="' + fb2 + '" style="width:32px;height:32px;image-rendering:pixelated;object-fit:contain;">';
  } else {
    iconInner = '<span style="font-size:1.4rem;filter:drop-shadow(0 0 8px ' + img.color + '88)">' + img.value + '</span>';
  }

  const hist = priceHistoryAll.find(function(h) { return h.key === key; });
  let priceHint = '';
  if (hist && hist.lastAvg) {
    const diff = Math.round(((item.price - hist.lastAvg) / hist.lastAvg) * 100);
    if (Math.abs(diff) >= 5) {
      priceHint = '<div class="card-price-hint' + (diff > 0 ? ' above' : '') + '">' +
        (diff > 0 ? '▲' : '▼') + ' ' + Math.abs(diff) + '% vs moy. ' + formatPrice(hist.lastAvg) +
        '</div>';
    }
  }

  return '<div class="card" style="animation-delay:' + ((idx % PAGE_SIZE) * 0.02) + 's" onclick="openChart(\'' + key + '\',\'' + name.replace(/'/g, "\\'") + '\')">' +
    '<div class="card-header">' +
      '<div class="item-icon">' + iconInner + (qty ? '<span class="qty-badge">×' + qty + '</span>' : '') + '</div>' +
      '<div style="flex:1;min-width:0">' +
        '<div class="item-name">' + name + '</div>' +
        '<div class="item-seller">Vendu par <span>' + item.ownerName + '</span></div>' +
      '</div>' +
      '<div class="rarity-badge rarity-' + rarity + '">' + rarity + '</div>' +
    '</div>' +
    '<div class="card-footer">' +
      '<div>' +
        '<div class="price"><span class="price-value">' + formatPrice(item.price) + '</span><span class="price-currency">' + item.currency + '</span></div>' +
        priceHint +
        '<div class="category-tag">' + item.category + '</div>' +
      '</div>' +
      '<div class="expires' + (exp.soon ? ' soon' : '') + '">⏱ ' + exp.text + '</div>' +
    '</div>' +
  '</div>';
}

function renderGrid() {
  const grid = document.getElementById('grid');
  const start = (currentPage - 1) * PAGE_SIZE;
  const page = filteredItems.slice(start, start + PAGE_SIZE);
  if (page.length === 0) { grid.innerHTML = '<div class="empty">✦ Aucun objet trouvé ✦</div>'; return; }
  grid.innerHTML = page.map(renderCard).join('');
  document.getElementById('totalCount').innerHTML = '<span>' + filteredItems.length + '</span> objets sur <span>' + allItems.length + '</span>';
  renderPagination();
}

function renderPagination() {
  const total = Math.ceil(filteredItems.length / PAGE_SIZE);
  const pag = document.getElementById('pagination');
  if (total <= 1) { pag.innerHTML = ''; return; }
  let html = '<button class="page-btn" onclick="goPage(' + (currentPage - 1) + ')"' + (currentPage === 1 ? ' disabled' : '') + '>◀</button>';
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - currentPage) <= 2) {
      html += '<button class="page-btn' + (i === currentPage ? ' active' : '') + '" onclick="goPage(' + i + ')">' + i + '</button>';
    } else if (Math.abs(i - currentPage) === 3) {
      html += '<span class="page-info">…</span>';
    }
  }
  html += '<button class="page-btn" onclick="goPage(' + (currentPage + 1) + ')"' + (currentPage === total ? ' disabled' : '') + '>▶</button>';
  pag.innerHTML = html;
}

function goPage(p) {
  const total = Math.ceil(filteredItems.length / PAGE_SIZE);
  if (p < 1 || p > total) return;
  currentPage = p;
  renderGrid();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function applyFilters() {
  let items = allItems.slice();
  if (currentCategory !== 'ALL') items = items.filter(function(i) { return i.category === currentCategory; });
  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    items = items.filter(function(i) { return parseItemName(i).toLowerCase().includes(q) || i.ownerName.toLowerCase().includes(q); });
  }
  if (currentSort === 'price_asc') items.sort(function(a, b) { return a.price - b.price; });
  else if (currentSort === 'price_desc') items.sort(function(a, b) { return b.price - a.price; });
  else if (currentSort === 'seller') items.sort(function(a, b) { return a.ownerName.localeCompare(b.ownerName); });
  filteredItems = items;
  currentPage = 1;
  renderGrid();
}

function renderCats() {
  if (!stats) return;
  const bar = document.getElementById('catsBar');
  let html = '<div class="cat-pill' + (currentCategory === 'ALL' ? ' active' : '') + '" onclick="setCategory(\'ALL\')">' +
    '<span class="cat-pill-name">Tout</span><span class="cat-pill-count">' + allItems.length + '</span><span class="cat-pill-avg">&nbsp;</span></div>';
  stats.byCategory.forEach(function(c) {
    const fb = CAT_FALLBACK[c.category] || { emoji: '📦' };
    html += '<div class="cat-pill' + (currentCategory === c.category ? ' active' : '') + '" onclick="setCategory(\'' + c.category + '\')">' +
      '<span class="cat-pill-name">' + fb.emoji + ' ' + c.category.toLowerCase() + '</span>' +
      '<span class="cat-pill-count">' + c.count + '</span>' +
      '<span class="cat-pill-avg">moy. ' + formatPrice(Math.round(c.avgPrice)) + '</span></div>';
  });
  bar.innerHTML = html;
}

function setCategory(cat) { currentCategory = cat; renderCats(); applyFilters(); }

async function loadAll() {
  try {
    const res = await fetch(API + '?page=1&pageSize=30', { headers: { 'User-Agent': UA } });
    const data = await res.json();
    stats = data.stats;
    document.getElementById('statActive').textContent = data.stats.activeCount.toLocaleString('fr-FR');
    document.getElementById('statSold').textContent = data.stats.soldLast24h.toLocaleString('fr-FR');
    const pages = Math.ceil(data.list.total / 30);
    const fetches = [];
    for (let p = 2; p <= pages; p++) {
      fetches.push(fetch(API + '?page=' + p + '&pageSize=30', { headers: { 'User-Agent': UA } }).then(function(r) { return r.json(); }));
    }
    const results = await Promise.all(fetches);
    allItems = [data, ...results].flatMap(function(r) { return r.list.items; });
    filteredItems = allItems.slice();
    renderCats();
    renderGrid();
  } catch (e) {
    document.getElementById('grid').innerHTML = '<div class="empty">⚠ Erreur de connexion</div>';
  }
}

document.getElementById('searchInput').addEventListener('input', function(e) { currentSearch = e.target.value.trim(); applyFilters(); });
document.getElementById('sortSelect').addEventListener('change', function(e) { currentSort = e.target.value; applyFilters(); });

// ── PRICE HISTORY ──

async function loadPriceHistory() {
  const el = document.getElementById('pricesList');
  if (el) el.innerHTML = '<div class="loading"><div class="loader"></div>Interrogation de Firestore…</div>';
  
  try {
    // On récupère la collection "price-history" (vérifie le nom dans ta console Firebase)
    const querySnapshot = await getDocs(collection(db, "price-history"));
    const data = [];
    
    querySnapshot.forEach((doc) => {
      data.push({ id: doc.id, ...doc.data() });
    });

    priceHistoryAll = data;
    
    // Création de la Map pour que renderCard() trouve les prix instantanément
    priceHistoryMap = new Map(data.map(item => [item.key, item]));
    
    console.log("Données Firestore chargées :", priceHistoryAll.length);
    renderPricesList();
    
  } catch (e) {
    console.error("Erreur Firestore :", e);
    if (el) el.innerHTML = '<div class="empty">⚠ Erreur de connexion base de données</div>';
  }
}

// ── CHART MODAL ──

async function openChart(key, name) {
  currentModalKey = key;
  currentModalName = name;
  document.getElementById('modalTitle').textContent = '📈 ' + name;
  document.getElementById('chartModal').classList.add('open');
  document.getElementById('modalStats').innerHTML = '';
  await renderChart(key, currentChartRange);
}

function closeModal() {
  document.getElementById('chartModal').classList.remove('open');
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
}

function setChartRange(h) {
  currentChartRange = h;
  document.querySelectorAll('.chart-tab').forEach(function(t, i) { t.classList.toggle('active', [24, 168, 720][i] === h); });
  if (currentModalKey) renderChart(currentModalKey, h);
}

async function renderChart(key, hours) {
  try {
    const limit = Math.ceil(hours * 2);
    const res = await fetch('/api/price-history/' + key + '?limit=' + limit);
    const data = await res.json();
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    const canvas = document.getElementById('priceChart');
    const ctx = canvas.getContext('2d');
    const cutoff = Date.now() - hours * 3600000;
    const filtered = data.filter(function(d) { return d.ts >= cutoff; });
    if (filtered.length === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#7a7060';
      ctx.font = '14px Cinzel';
      ctx.textAlign = 'center';
      ctx.fillText('Pas encore de données pour cette période', canvas.width / 2, canvas.height / 2);
      document.getElementById('modalStats').innerHTML = '';
      return;
    }
    const labels = filtered.map(function(d) { return new Date(d.ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); });
    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          { label: 'Moy.', data: filtered.map(function(d) { return d.avg; }), borderColor: '#FACC15', backgroundColor: 'rgba(250,204,21,0.08)', tension: 0.3, pointRadius: 2, borderWidth: 2 },
          { label: 'Min', data: filtered.map(function(d) { return d.min; }), borderColor: '#22C55E', backgroundColor: 'transparent', tension: 0.3, pointRadius: 0, borderWidth: 1, borderDash: [4, 4] },
          { label: 'Max', data: filtered.map(function(d) { return d.max; }), borderColor: '#ef4444', backgroundColor: 'transparent', tension: 0.3, pointRadius: 0, borderWidth: 1, borderDash: [4, 4] },
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: '#7a7060', font: { family: 'Cinzel', size: 10 } } } },
        scales: {
          x: { ticks: { color: '#7a7060', font: { size: 10 }, maxTicksLimit: 8 }, grid: { color: 'rgba(250,204,21,0.06)' } },
          y: { ticks: { color: '#7a7060', font: { size: 10 }, callback: function(v) { return formatPrice(v); } }, grid: { color: 'rgba(250,204,21,0.06)' } }
        }
      }
    });
    const last = filtered[filtered.length - 1];
    const first = filtered[0];
    const trend = first.avg > 0 ? Math.round(((last.avg - first.avg) / first.avg) * 100) : 0;
    document.getElementById('modalStats').innerHTML =
      '<div class="modal-stat"><span class="modal-stat-label">Moy. actuelle</span><span class="modal-stat-value">' + formatPrice(last.avg) + '</span></div>' +
      '<div class="modal-stat"><span class="modal-stat-label">Min observé</span><span class="modal-stat-value" style="color:#22C55E">' + formatPrice(Math.min(...filtered.map(function(d) { return d.min; }))) + '</span></div>' +
      '<div class="modal-stat"><span class="modal-stat-label">Max observé</span><span class="modal-stat-value" style="color:#ef4444">' + formatPrice(Math.max(...filtered.map(function(d) { return d.max; }))) + '</span></div>' +
      '<div class="modal-stat"><span class="modal-stat-label">Tendance</span><span class="modal-stat-value" style="color:' + (trend >= 0 ? '#ef4444' : '#22C55E') + '">' + (trend >= 0 ? '▲' : '▼') + ' ' + Math.abs(trend) + '%</span></div>';
  } catch (e) {
    console.error(e);
  }
}

function openAlertFromModal() {
  if (!currentModalKey) return;
  closeModal();
  showPage('alerts');
  setTimeout(function() {
    document.getElementById('alertItemInput').value = currentModalName || '';
    selectedAlertItem = { key: currentModalKey, name: currentModalName };
    document.getElementById('alertPrice').focus();
  }, 100);
}

// ── ALERTS ──

let selectedAlertItem = null;

async function loadAlerts() {
  const el = document.getElementById('alertsList');
  el.innerHTML = '<div class="loading"><div class="loader"></div>Chargement…</div>';
  try {
    const res = await fetch('/api/alerts');
    const alerts = await res.json();
    if (alerts.length === 0) {
      el.innerHTML = '<div class="empty">Aucune alerte configurée</div>';
      return;
    }
    el.innerHTML = alerts.map(function(a) {
      const lastTrig = a.lastTriggered ? 'Déclenché ' + new Date(a.lastTriggered).toLocaleString('fr-FR') : 'Jamais déclenché';
      const wh = a.webhookUrl.replace('https://discord.com/api/webhooks/', '…/');
      return '<div class="alert-row">' +
        '<div class="alert-item-name">' + a.itemName + '</div>' +
        '<div class="alert-price">≤ ' + formatPrice(a.maxPrice) + '</div>' +
        '<div class="alert-webhook" title="' + a.webhookUrl + '">' + wh + '</div>' +
        '<div class="alert-last">' + lastTrig + (a.lastPrice ? ' à ' + formatPrice(a.lastPrice) : '') + '</div>' +
        '<span class="alert-status ' + (a.active ? 'active' : 'paused') + '">' + (a.active ? 'actif' : 'pause') + '</span>' +
        '<div class="alert-actions">' +
          '<button class="btn-sm" onclick="toggleAlert(\'' + a.id + '\',' + !a.active + ')">' + (a.active ? 'Pause' : 'Activer') + '</button>' +
          '<button class="btn-sm danger" onclick="deleteAlert(\'' + a.id + '\')">Suppr.</button>' +
        '</div>' +
      '</div>';
    }).join('');
  } catch (e) {
    el.innerHTML = '<div class="empty">⚠ ' + e.message + '</div>';
  }
}

async function createAlert() {
  const itemInput = document.getElementById('alertItemInput').value.trim();
  const maxPrice = document.getElementById('alertPrice').value;
  const webhookUrl = document.getElementById('alertWebhook').value.trim();
  if (!itemInput || !maxPrice || !webhookUrl) { alert('Tous les champs sont requis'); return; }
  if (!webhookUrl.startsWith('https://discord.com/api/webhooks/')) { alert('URL de webhook Discord invalide'); return; }
  const item = selectedAlertItem || { key: itemInput.toLowerCase().replace(/ /g, '_'), name: itemInput };
  try {
    const res = await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemKey: item.key, itemName: item.name, maxPrice: Number(maxPrice), webhookUrl })
    });
    if (!res.ok) throw new Error('Erreur serveur');
    document.getElementById('alertItemInput').value = '';
    document.getElementById('alertPrice').value = '';
    document.getElementById('alertWebhook').value = '';
    selectedAlertItem = null;
    loadAlerts();
  } catch (e) { alert('Erreur: ' + e.message); }
}

async function deleteAlert(id) {
  if (!confirm('Supprimer cette alerte ?')) return;
  await fetch('/api/alerts/' + id, { method: 'DELETE' });
  loadAlerts();
}

async function toggleAlert(id, active) {
  await fetch('/api/alerts/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }) });
  loadAlerts();
}

document.getElementById('alertItemInput').addEventListener('input', function() {
  const q = this.value.toLowerCase();
  const dd = document.getElementById('alertAutocomplete');
  if (!q || q.length < 2) { dd.classList.remove('open'); return; }
  const matches = priceHistoryAll.filter(function(d) { return d.name && d.name.toLowerCase().includes(q); }).slice(0, 8);
  if (matches.length === 0) { dd.classList.remove('open'); return; }
  dd.innerHTML = matches.map(function(d) {
    return '<div class="autocomplete-item" onclick="selectAlertItem(\'' + d.key + '\',\'' + d.name.replace(/'/g, "\\'") + '\')">' + d.name + ' <small style="color:var(--text-dim)">moy. ' + formatPrice(d.lastAvg) + '</small></div>';
  }).join('');
  dd.classList.add('open');
});

function selectAlertItem(key, name) {
  selectedAlertItem = { key, name };
  document.getElementById('alertItemInput').value = name;
  document.getElementById('alertAutocomplete').classList.remove('open');
}

document.addEventListener('click', function(e) {
  if (!e.target.closest('.form-group')) {
    document.getElementById('alertAutocomplete').classList.remove('open');
  }
});

// ── ISLAND ──

async function searchIsland() {
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
    result.innerHTML = '<div class="island-error">⚠ Île introuvable ou erreur serveur<br><span style="font-size:0.6rem;opacity:0.5">' + e.message + '</span></div>';
  }
}

function renderIslandData(data) {
  const members = data.members || [];
  const warps = data.warps || [];
  const membersHtml = members.length === 0
    ? '<div class="empty-section">Aucun membre</div>'
    : members.map(function(m) {
      return '<div class="member-row"><div class="member-name"><img class="member-avatar" src="https://mc-heads.net/avatar/' + m.name + '/24" alt="" onerror="this.style.display=\'none\'">' + m.name + '</div><span class="member-role role-' + (m.role || 'MEMBER') + '">' + (m.role || 'MEMBER') + '</span></div>';
    }).join('');
  const warpsHtml = warps.length === 0
    ? '<div class="empty-section">Aucun warp public</div>'
    : warps.map(function(w) {
      return '<div class="warp-row"><div class="warp-name">' + (w.name || 'warp') + '</div><div class="warp-coords">' + (w.x !== undefined ? w.x + ', ' + w.y + ', ' + w.z : '—') + '</div></div>';
    }).join('');
  const extra = Object.keys(data).filter(function(k) { return !['id','ownerName','balance','members','warps'].includes(k); });
  let extraHtml = extra.map(function(k) {
    const val = data[k];
    let inner = Array.isArray(val)
      ? (val.length === 0 ? '<div class="empty-section">Vide</div>' : typeof val[0] === 'object' ? '<div class="json-section">' + JSON.stringify(val, null, 2) + '</div>' : '<div class="tag-list">' + val.map(function(v) { return '<span class="tag">' + v + '</span>'; }).join('') + '</div>')
      : typeof val === 'object' && val !== null ? '<div class="json-section">' + JSON.stringify(val, null, 2) + '</div>'
      : '<div style="font-family:Cinzel,serif;font-size:1.1rem;color:var(--gold)">' + val + '</div>';
    return '<div class="island-section"><div class="section-title">✦ ' + k + '</div>' + inner + '</div>';
  }).join('');
  return '<div class="island-result">' +
    '<div class="island-hero"><div class="island-hero-top"><div><div class="island-owner">⚑ ' + (data.ownerName || '?') + '</div><div class="island-id">ID : ' + (data.id || '—') + '</div></div>' +
    '<div style="text-align:right"><div class="island-balance-value">' + formatPrice(data.balance) + '</div><div class="island-balance-label">Balance</div></div></div></div>' +
    '<div class="island-sections"><div class="island-section"><div class="section-title">⚔ Membres (' + members.length + ')</div>' + membersHtml + '</div>' +
    '<div class="island-section"><div class="section-title">⚑ Warps (' + warps.length + ')</div>' + warpsHtml + '</div>' + extraHtml + '</div></div>';
}

// ── PLAYERS ──

async function loadPlayers() {
  try {
    const res = await fetch('https://excalia.fr/api/online-players', { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    playersData = await res.json();
    renderPlayers();
    if (playersRefreshTimer) clearTimeout(playersRefreshTimer);
    playersRefreshTimer = setTimeout(function() {
      if (document.getElementById('playersPage').classList.contains('visible')) loadPlayers();
    }, 15000);
  } catch (e) {
    document.getElementById('playersContent').innerHTML = '<div class="empty">⚠ ' + e.message + '</div>';
  }
}

function renderPlayers() {
  if (!playersData) return;
  const d = playersData;
  const now = new Date().toLocaleTimeString('fr-FR');
  let players = d.players || [];
  if (playersServerFilter !== 'all') players = players.filter(function(p) { return p.serverIds && p.serverIds.includes(playersServerFilter); });
  if (playersSearch) { const q = playersSearch.toLowerCase(); players = players.filter(function(p) { return p.name.toLowerCase().includes(q); }); }
  const byServer = d.byServer || {};
  const serverKeys = Object.keys(byServer);
  const serverPillsHtml = serverKeys.map(function(s) {
    return '<div class="server-pill"><div class="server-pill-name">' + s + '</div><div class="server-pill-count">' + byServer[s] + '</div></div>';
  }).join('');
  let filterHtml = '<button class="filter-btn ' + (playersServerFilter === 'all' ? 'active' : '') + '" onclick="setPlayersServer(\'all\')">Tous</button>';
  serverKeys.forEach(function(s) { filterHtml += '<button class="filter-btn ' + (playersServerFilter === s ? 'active' : '') + '" onclick="setPlayersServer(\'' + s + '\')">' + s + '</button>'; });
  const cardsHtml = players.length === 0 ? '<div class="empty">Aucun joueur trouvé</div>' : players.map(function(p, i) {
    const grade = p.grade;
    return '<div class="player-card" style="animation-delay:' + (i * 0.015) + 's">' +
      '<img class="player-avatar" src="https://mc-heads.net/avatar/' + p.uuid + '/36" alt="" onerror="this.src=\'https://mc-heads.net/avatar/' + p.name + '/36\'">' +
      '<div class="player-info"><div class="player-name">' + p.name + '</div>' +
      '<div class="player-grade" style="color:' + (grade ? grade.color : 'var(--text-dim)') + '">' + (grade ? grade.name : 'Sans grade') + '</div>' +
      '<div class="player-servers">' + (p.serverIds || []).map(function(s) { return '<span class="server-tag">' + s + '</span>'; }).join('') + '</div></div></div>';
  }).join('');
  document.getElementById('playersContent').innerHTML =
    '<div class="players-header"><div><div class="players-title"><span class="online-dot"></span>Joueurs en ligne</div><div class="total-online">' + d.total + ' <span style="font-size:0.9rem;color:var(--text-dim)">connectés</span></div></div>' +
    '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.4rem"><button class="refresh-btn" onclick="loadPlayers()">↺ Actualiser</button><div class="last-update">Mis à jour à ' + now + '</div></div></div>' +
    '<div class="server-pills">' + serverPillsHtml + '</div>' +
    '<div class="players-filters"><input class="players-search" type="text" placeholder="Chercher un joueur…" value="' + playersSearch + '" oninput="setPlayersSearch(this.value)">' + filterHtml + '</div>' +
    '<div class="players-grid">' + cardsHtml + '</div>';
}

function setPlayersSearch(val) { playersSearch = val; renderPlayers(); }
function setPlayersServer(s) { playersServerFilter = s; renderPlayers(); }

async function initApp() {
  // 1. On attend d'abord les données de prix (Firestore)
  await loadPriceHistory();
  
  // 2. Ensuite on charge les items de l'API (Market)
  await loadAll();
}

// On lance le tout une fois que le DOM est prêt
document.addEventListener('DOMContentLoaded', initApp);
