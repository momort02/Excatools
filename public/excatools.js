const API = 'https://excalia.fr/api/hotel';
const PAGE_SIZE = 30;

let allItems = [];
let filteredItems = [];
let currentPage = 1;
let currentCategory = 'ALL';
let currentSearch = '';
let currentSort = 'default';
let stats = null;

const ORAXEN_ICONS = {
  rune_strength_3: { emoji: '\u2694', color: '#3B82F6' },
  rune_speed_3: { emoji: '\ud83d\udca8', color: '#3B82F6' },
  rune_fall_3: { emoji: '\ud83c\udff9', color: '#3B82F6' },
  cristal_marin: { emoji: '\ud83d\udc8e', color: '#38BDF8' },
  pierre_celeste: { emoji: '\ud83d\udca0', color: '#FFD700' },
  pierre_mystique: { emoji: '\ud83d\udca0', color: '#FF9EBB' },
  premium_houe: { emoji: '\ud83d\udd25', color: '#7DD3FC' },
  ice_key: { emoji: '\ud83d\udd11', color: '#FACC15' },
  plume_fly_60m: { emoji: '\ud83e\udeb6', color: '#01ACE1' },
  potion_generale_t3: { emoji: '\u2728', color: '#8B5CF6' },
  delicate_hook: { emoji: '\ud83c\udfa3', color: '#FACC15' },
};

const CAT_FALLBACK = {
  BLOCKS: { emoji: '\ud83e\uddf1', color: '#a16207' },
  TOOLS: { emoji: '\u26cf\ufe0f', color: '#7DD3FC' },
  WEAPON: { emoji: '\u2694\ufe0f', color: '#ef4444' },
  ARMOR: { emoji: '\ud83d\udee1\ufe0f', color: '#6366f1' },
  FOOD: { emoji: '\ud83e\udd56', color: '#f97316' },
  POTIONS: { emoji: '\ud83e\uddea', color: '#a855f7' },
  MISCELLANEOUS: { emoji: '\u2728', color: '#FACC15' },
};

function getItemImage(item) {
  const dn = item.displayName;
  const BASE_PJS = 'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.21.11/';

  const oraxenMatch = dn.match(/oraxen:([a-z_0-9]+)/);
  if (oraxenMatch) {
    const id = oraxenMatch[1];
    const fb = CAT_FALLBACK[item.category] || { emoji: '\u2736', color: '#FACC15' };
    return { type: 'sprite', value: 'textures/' + id + '.png', fallback: fb.emoji, fallbackUrl: BASE_PJS + 'items/' + id + '.png' };
  }

  const vanillaMatch = dn.match(/show_item:([a-z_]+)/);
  if (vanillaMatch) {
    const id = vanillaMatch[1];
    const folder = item.category === 'BLOCKS' ? 'blocks' : 'items';
    const pjsUrl = BASE_PJS + folder + '/' + id + '.png';
    const fb = CAT_FALLBACK[item.category] || { emoji: '\ud83d\udce6', color: '#666' };
    return { type: 'sprite', value: pjsUrl, fallback: fb.emoji, fallbackUrl: 'textures/' + id + '.png' };
  }

  const fb = CAT_FALLBACK[item.category] || { emoji: '\ud83d\udce6', color: '#666' };
  return { type: 'emoji', value: fb.emoji, color: fb.color };
}

function parseName(displayName) {
  const langMatch = displayName.match(/<lang:([^>]+)>/);
  if (langMatch) {
    const key = langMatch[1];
    const map = {
      'block.minecraft.jungle_sapling': 'Pousse de Jungle',
      'block.minecraft.beacon': 'Balise',
      'item.minecraft.splash_potion.effect.weakness': 'Potion de Faiblesse',
      'item.minecraft.enchanted_book': 'Livre Enchant\u00e9',
    };
    if (map[key]) return map[key];
    const parts = key.split('.');
    return parts[parts.length - 1].replace(/_/g, ' ').replace(/\b\w/g, function(c){ return c.toUpperCase(); });
  }
  const nameMatch = displayName.match(/text:\\"([^"\\]+)\\"/);
  if (nameMatch) return nameMatch[1];
  const customNameMatch = displayName.match(/item_name:'[^']*text:"([^"]+)"/);
  if (customNameMatch) return customNameMatch[1];
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

function parseItemName(item) {
  const dn = item.displayName;
  if (dn.includes('oraxen:')) {
    const oraxenMatch = dn.match(/oraxen:([a-z_0-9]+)/);
    if (oraxenMatch) {
      const id = oraxenMatch[1];
      const names = {
        rune_strength_3: 'Rune de Tranchant VI',
        rune_speed_3: 'Rune de Ch\u00e2timent VI',
        rune_fall_3: 'Rune de Puissance VII',
        cristal_marin: 'Cristal Marin',
        pierre_celeste: 'Pierre C\u00e9leste',
        pierre_mystique: 'Pierre Mystique',
        premium_houe: 'Houe des Flammes Glaciales',
        ice_key: 'Cl\u00e9 Premium+',
        plume_fly_60m: 'Plume de Fly 60min',
        potion_generale_t3: 'Potion G\u00e9n\u00e9rale 15%',
        delicate_hook: 'Hame\u00e7on L\u00e9ger',
      };
      if (names[id]) return names[id];
      return id.replace(/_/g, ' ').replace(/\b\w/g, function(c){ return c.toUpperCase(); });
    }
  }
  return parseName(dn);
}

function getQuantity(displayName) {
  const match = displayName.match(/show_item:[a-z_]+:(\d+)/);
  if (match && match[1] !== '1') return parseInt(match[1]);
  return null;
}

function formatPrice(p) {
  if (p >= 1000000) return (p / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (p >= 1000) return (p / 1000).toFixed(0) + 'k';
  return p.toLocaleString('fr-FR');
}

function timeLeft(expiresAt) {
  const diff = new Date(expiresAt) - Date.now();
  if (diff < 0) return { text: 'Expir\u00e9', soon: true };
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(h / 24);
  if (d > 0) return { text: d + 'j ' + (h % 24) + 'h', soon: d < 1 };
  return { text: h + 'h', soon: h < 6 };
}

function renderCard(item, idx) {
  const rarity = parseRarity(item.displayName);
  const name = parseItemName(item);
  const qty = getQuantity(item.displayName);
  const exp = timeLeft(item.expiresAt);
  const img = getItemImage(item);

  let iconInner;
  if (img.type === 'sprite') {
    const fallbackUrl = img.fallbackUrl || null;
    const fallbackEmoji = img.fallback || '\ud83d\udce6';
    const onerror = fallbackUrl
      ? "if(!this.dataset.fb){this.dataset.fb=1;this.src='" + fallbackUrl + "'}else{this.outerHTML='<span style=font-size:1.4rem>" + fallbackEmoji + "</span>'}"
      : "this.outerHTML='<span style=font-size:1.4rem>" + fallbackEmoji + "</span>'";
    iconInner = '<img src="' + img.value + '" alt="" onerror="' + onerror + '" style="width:32px;height:32px;image-rendering:pixelated;object-fit:contain;">';
  } else {
    iconInner = '<span style="font-size:1.4rem;filter:drop-shadow(0 0 8px ' + img.color + '88)">' + img.value + '</span>';
  }

  const qtyHtml = qty ? '<span class="qty-badge">\u00d7' + qty + '</span>' : '';
  const soonClass = exp.soon ? ' soon' : '';

  return '<div class="card" style="animation-delay:' + ((idx % PAGE_SIZE) * 0.02) + 's">' +
    '<div class="card-header">' +
      '<div class="item-icon">' + iconInner + qtyHtml + '</div>' +
      '<div style="flex:1;min-width:0">' +
        '<div class="item-name">' + name + '</div>' +
        '<div class="item-seller">Vendu par <span>' + item.ownerName + '</span></div>' +
      '</div>' +
      '<div class="rarity-badge rarity-' + rarity + '">' + rarity + '</div>' +
    '</div>' +
    '<div class="card-footer">' +
      '<div>' +
        '<div class="price"><span class="price-value">' + formatPrice(item.price) + '</span><span class="price-currency">' + item.currency + '</span></div>' +
        '<div class="category-tag">' + item.category + '</div>' +
      '</div>' +
      '<div class="expires' + soonClass + '">\u23f1 ' + exp.text + '</div>' +
    '</div>' +
  '</div>';
}

function renderGrid() {
  const grid = document.getElementById('grid');
  const start = (currentPage - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const page = filteredItems.slice(start, end);

  if (page.length === 0) {
    grid.innerHTML = '<div class="empty">\u2736 Aucun objet trouv\u00e9 \u2736</div>';
    return;
  }

  grid.innerHTML = page.map(function(item, i){ return renderCard(item, i); }).join('');
  document.getElementById('totalCount').innerHTML =
    '<span>' + filteredItems.length + '</span> objets trouv\u00e9s sur <span>' + allItems.length + '</span> actifs';
  renderPagination();
}

function renderPagination() {
  const total = Math.ceil(filteredItems.length / PAGE_SIZE);
  const pag = document.getElementById('pagination');
  if (total <= 1) { pag.innerHTML = ''; return; }

  let html = '<button class="page-btn" onclick="goPage(' + (currentPage-1) + ')"' + (currentPage===1?' disabled':'') + '>\u25c4</button>';

  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - currentPage) <= 2) {
      html += '<button class="page-btn' + (i===currentPage?' active':'') + '" onclick="goPage(' + i + ')">' + i + '</button>';
    } else if (Math.abs(i - currentPage) === 3) {
      html += '<span class="page-info">\u2026</span>';
    }
  }

  html += '<button class="page-btn" onclick="goPage(' + (currentPage+1) + ')"' + (currentPage===total?' disabled':'') + '>\u25ba</button>';
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

  if (currentCategory !== 'ALL') {
    items = items.filter(function(i){ return i.category === currentCategory; });
  }

  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    items = items.filter(function(i){
      return parseItemName(i).toLowerCase().includes(q) || i.ownerName.toLowerCase().includes(q);
    });
  }

  if (currentSort === 'price_asc') items.sort(function(a,b){ return a.price - b.price; });
  else if (currentSort === 'price_desc') items.sort(function(a,b){ return b.price - a.price; });
  else if (currentSort === 'seller') items.sort(function(a,b){ return a.ownerName.localeCompare(b.ownerName); });

  filteredItems = items;
  currentPage = 1;
  renderGrid();
}

function renderCats() {
  if (!stats) return;
  const bar = document.getElementById('catsBar');
  const all = allItems.length;

  let html = '<div class="cat-pill' + (currentCategory==='ALL'?' active':'') + '" onclick="setCategory(\'ALL\')">' +
    '<span class="cat-pill-name">Tout</span>' +
    '<span class="cat-pill-count">' + all + '</span>' +
    '<span class="cat-pill-avg">&nbsp;</span>' +
    '</div>';

  stats.byCategory.forEach(function(c) {
    const fb = CAT_FALLBACK[c.category] || { emoji: '\ud83d\udce6' };
    html += '<div class="cat-pill' + (currentCategory===c.category?' active':'') + '" onclick="setCategory(\'' + c.category + '\')">' +
      '<span class="cat-pill-name">' + fb.emoji + ' ' + c.category.toLowerCase() + '</span>' +
      '<span class="cat-pill-count">' + c.count + '</span>' +
      '<span class="cat-pill-avg">moy. ' + formatPrice(Math.round(c.avgPrice)) + '</span>' +
      '</div>';
  });

  bar.innerHTML = html;
}

function setCategory(cat) {
  currentCategory = cat;
  renderCats();
  applyFilters();
}

async function loadAll() {
  try {
    const res = await fetch(API + '?page=1&pageSize=30');
    const data = await res.json();

    stats = data.stats;
    document.getElementById('statActive').textContent = data.stats.activeCount.toLocaleString('fr-FR');
    document.getElementById('statSold').textContent = data.stats.soldLast24h.toLocaleString('fr-FR');
    document.getElementById('statCats').textContent = data.stats.byCategory.length;

    const total = data.list.total;
    const pages = Math.ceil(total / 30);
    const fetches = [];
    for (let p = 1; p <= pages; p++) {
      fetches.push(fetch(API + '?page=' + p + '&pageSize=30').then(function(r){ return r.json(); }));
    }

    const results = await Promise.all(fetches);
    allItems = results.reduce(function(acc, r){ return acc.concat(r.list.items); }, []);
    filteredItems = allItems.slice();

    renderCats();
    renderGrid();
  } catch(e) {
    document.getElementById('grid').innerHTML = '<div class="empty">\u26a0 Erreur de connexion au serveur</div>';
    console.error(e);
  }
}

document.getElementById('searchInput').addEventListener('input', function(e) {
  currentSearch = e.target.value.trim();
  applyFilters();
});

document.getElementById('sortSelect').addEventListener('change', function(e) {
  currentSort = e.target.value;
  applyFilters();
});


function _showPage(page) {
  const market = document.getElementById('marketPage');
  const island = document.getElementById('islandPage');
  const players = document.getElementById('playersPage');
  const navM = document.getElementById('navMarket');
  const navI = document.getElementById('navIsland');
  const navP = document.getElementById('navPlayers');

  market.classList.toggle('hidden', page !== 'market');
  island.classList.toggle('visible', page === 'island');
  players.classList.toggle('visible', page === 'players');
  navM.classList.toggle('active', page === 'market');
  navI.classList.toggle('active', page === 'island');
  navP.classList.toggle('active', page === 'players');

  if (page === 'players') loadPlayers();
}

function formatNum(n) {
  if (!n && n !== 0) return '—';
  if (n >= 1000000) return (n/1000000).toFixed(1).replace(/\.0$/,'') + 'M';
  if (n >= 1000) return (n/1000).toFixed(1).replace(/\.0$/,'') + 'k';
  return Number(n).toLocaleString('fr-FR');
}

function renderIslandData(data) {
  const members = data.members || [];
  const warps = data.warps || [];

  const owner = members.find(function(m){ return m.role === 'OWNER'; });

  let membersHtml = members.length === 0
    ? '<div class="empty-section">Aucun membre</div>'
    : members.map(function(m) {
        const role = m.role || 'MEMBER';
        return '<div class="member-row">' +
          '<div class="member-name">' +
            '<img class="member-avatar" src="https://mc-heads.net/avatar/' + m.name + '/24" alt="" onerror="this.style.display=\'none\'">' +
            m.name +
          '</div>' +
          '<span class="member-role role-' + role + '">' + role + '</span>' +
        '</div>';
      }).join('');

  let warpsHtml = warps.length === 0
    ? '<div class="empty-section">Aucun warp public</div>'
    : warps.map(function(w) {
        const coords = (w.x !== undefined) ? w.x + ', ' + w.y + ', ' + w.z : '—';
        return '<div class="warp-row">' +
          '<div class="warp-name">' + (w.name || 'warp') + '</div>' +
          '<div class="warp-coords">' + coords + '</div>' +
        '</div>';
      }).join('');

  const extraKeys = Object.keys(data).filter(function(k){
    return !['id','ownerName','balance','members','warps'].includes(k);
  });

  let extraSections = '';
  if (extraKeys.length > 0) {
    extraKeys.forEach(function(k) {
      const val = data[k];
      let inner = '';
      if (Array.isArray(val)) {
        if (val.length === 0) {
          inner = '<div class="empty-section">Vide</div>';
        } else if (typeof val[0] === 'object') {
          inner = '<div class="json-section">' + JSON.stringify(val, null, 2) + '</div>';
        } else {
          inner = '<div class="tag-list">' + val.map(function(v){ return '<span class="tag">' + v + '</span>'; }).join('') + '</div>';
        }
      } else if (typeof val === 'object' && val !== null) {
        inner = '<div class="json-section">' + JSON.stringify(val, null, 2) + '</div>';
      } else {
        inner = '<div style="font-family:Cinzel,serif;font-size:1.1rem;color:var(--gold)">' + val + '</div>';
      }
      extraSections += '<div class="island-section">' +
        '<div class="section-title">✦ ' + k + '</div>' +
        inner +
        '</div>';
    });
  }

  return '<div class="island-result">' +
    '<div class="island-hero">' +
      '<div class="island-hero-top">' +
        '<div>' +
          '<div class="island-owner">' + (data.ownerName || owner && owner.name || '?') + '</div>' +
          '<div class="island-id">ID : ' + (data.id || '—') + '</div>' +
        '</div>' +
        '<div class="island-balance">' +
          '<div class="island-balance-value">' + formatNum(data.balance) + '</div>' +
          '<div class="island-balance-label">Balance</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="island-sections">' +
      '<div class="island-section">' +
        '<div class="section-title">⚔ Membres (' + members.length + ')</div>' +
        membersHtml +
      '</div>' +
      '<div class="island-section">' +
        '<div class="section-title">⚑ Warps (' + warps.length + ')</div>' +
        warpsHtml +
      '</div>' +
      extraSections +
    '</div>' +
  '</div>';
}

async function searchIsland() {
  const input = document.getElementById('islandInput').value.trim();
  const result = document.getElementById('islandResult');
  if (!input) return;

  result.innerHTML = '<div style="text-align:center;padding:3rem"><div class="loader" style="margin:0 auto"></div></div>';

  try {
    const res = await fetch('https://excalia.fr/api/island-stats/island/' + encodeURIComponent(input));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    result.innerHTML = renderIslandData(data);
  } catch(e) {
    result.innerHTML = '<div class="island-error">\u26a0 Île introuvable ou erreur serveur<br><span style="font-size:0.6rem;opacity:0.5;margin-top:0.5rem;display:block">' + e.message + '</span></div>';
  }
}


let playersData = null;
let playersSearch = '';
let playersServerFilter = 'all';
let playersRefreshTimer = null;

async function loadPlayers() {
  try {
    const res = await fetch('https://excalia.fr/api/online-players', {
      headers: { 'User-Agent': 'ExcaliaHotelSite/1.0 (excalia.fr)' }
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    playersData = await res.json();
    renderPlayers();
    schedulePlayersRefresh();
  } catch(e) {
    document.getElementById('playersContent').innerHTML =
      '<div class="empty">\u26a0 Erreur de chargement : ' + e.message + '</div>';
  }
}

function schedulePlayersRefresh() {
  if (playersRefreshTimer) clearTimeout(playersRefreshTimer);
  playersRefreshTimer = setTimeout(function() {
    if (document.getElementById('playersPage').classList.contains('visible')) {
      loadPlayers();
    }
  }, 15000);
}

function renderPlayers() {
  if (!playersData) return;
  const d = playersData;
  const now = new Date().toLocaleTimeString('fr-FR');

  let players = d.players || [];

  if (playersServerFilter !== 'all') {
    players = players.filter(function(p) {
      return p.serverIds && p.serverIds.includes(playersServerFilter);
    });
  }

  if (playersSearch) {
    const q = playersSearch.toLowerCase();
    players = players.filter(function(p) { return p.name.toLowerCase().includes(q); });
  }

  const byServer = d.byServer || {};
  const serverKeys = Object.keys(byServer);

  let serverPillsHtml = serverKeys.map(function(s) {
    return '<div class="server-pill">' +
      '<div class="server-pill-name">' + s + '</div>' +
      '<div class="server-pill-count">' + byServer[s] + '</div>' +
    '</div>';
  }).join('');

  let serverFilterHtml = '<button class="filter-btn ' + (playersServerFilter==='all'?'active':'') + '" data-server="all">Tous</button>';
  serverKeys.forEach(function(s) {
    serverFilterHtml += '<button class="filter-btn ' + (playersServerFilter===s?'active':'') + '" data-server="' + s + '">' + s + '</button>';
  });

  let cardsHtml = players.length === 0
    ? '<div class="empty">Aucun joueur trouvé</div>'
    : players.map(function(p, i) {
        const grade = p.grade;
        const gradeHtml = grade
          ? '<div class="player-grade" style="color:' + grade.color + '">' + grade.name + '</div>'
          : '<div class="player-grade" style="color:var(--text-dim)">Sans grade</div>';
        const serversHtml = (p.serverIds || []).map(function(s) {
          return '<span class="server-tag">' + s + '</span>';
        }).join('');
        return '<div class="player-card" style="animation-delay:' + (i * 0.015) + 's">' +
          '<img class="player-avatar" src="https://mc-heads.net/avatar/' + p.uuid + '/36" alt="" onerror="this.onerror=null;this.src=\'https://mc-heads.net/avatar/' + p.name + '/36\'">' +
          '<div class="player-info">' +
            '<div class="player-name">' + p.name + '</div>' +
            gradeHtml +
            '<div class="player-servers">' + serversHtml + '</div>' +
          '</div>' +
        '</div>';
      }).join('');

  document.getElementById('playersContent').innerHTML =
    '<div class="players-header">' +
      '<div>' +
        '<div class="players-title"><span class="online-dot"></span>Joueurs en ligne</div>' +
        '<div class="total-online">' + d.total + ' <span style="font-size:0.9rem;color:var(--text-dim)">connectés</span></div>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.4rem">' +
        '<button class="refresh-btn" id="playersRefreshBtn">↺ Actualiser</button>' +
        '<div class="last-update">Mis à jour à ' + now + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="server-pills">' + serverPillsHtml + '</div>' +
    '<div class="players-filters">' +
      '<input class="players-search" type="text" placeholder="Chercher un joueur…" value="' + playersSearch + '" oninput="setPlayersSearch(this.value)">' +
      serverFilterHtml +
    '</div>' +
    '<div class="players-grid">' + cardsHtml + '</div>';
}

function setPlayersSearch(val) {
  playersSearch = val;
  renderPlayers();
}

function setPlayersServer(s) {
  playersServerFilter = s;
  renderPlayers();
}


function showPage(page) {
  var ids = {market:'marketPage', island:'islandPage', players:'playersPage'};
  var navIds = {market:'navMarket', island:'navIsland', players:'navPlayers'};
  Object.keys(ids).forEach(function(p) {
    var el = document.getElementById(ids[p]);
    var nav = document.getElementById(navIds[p]);
    if (!el || !nav) return;
    if (p === 'market') { el.classList.toggle('hidden', page !== 'market'); }
    else { el.classList.toggle('visible', page === p); }
    nav.classList.toggle('active', page === p);
  });
  if (page === 'players') loadPlayers();
}

loadAll();
if(window._pendingPage){ _showPage(window._pendingPage); window._pendingPage=null; }
