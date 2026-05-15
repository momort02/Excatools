import { initializeApp } from "https://www.gstatic.com/firebasejs/10/7/firebase-app.js";
import { 
    getFirestore, collection, addDoc, getDocs, query, orderBy, limit, 
    where, deleteDoc, doc, updateDoc, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10/7/firebase-firestore.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA831PoGY1dzGaI0MgNCI92NmXsEtiW9LU",
  authDomain: "excatools.firebaseapp.com",
  projectId: "excatools",
  storageBucket: "excatools.firebasestorage.app",
  messagingSenderId: "471103011145",
  appId: "1:471103011145:web:da2d972cd7d0224b89c298",
  measurementId: "G-R7RBX78ZD6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- VARIABLES ---
const API = 'https://excalia.fr/api/hotel';
const PAGE_SIZE = 30;
const UA = 'ExcaTools/1.0';
const BASE_PJS = 'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.21.11/';

let allItems = [], filteredItems = [], priceHistoryAll = [];
let currentPage = 1, currentCategory = 'ALL', currentSearch = '', currentSort = 'default';
let chartInstance = null;

const CAT_FALLBACK = {
    BLOCKS: { emoji: '🧱', color: '#a16207' },
    TOOLS: { emoji: '⛏️', color: '#7DD3FC' },
    WEAPON: { emoji: '⚔️', color: '#ef4444' },
    ARMOR: { emoji: '🛡️', color: '#6366f1' },
    FOOD: { emoji: '🍖', color: '#f97316' },
    POTIONS: { emoji: '🧪', color: '#a855f7' },
    MISCELLANEOUS: { emoji: '✨', color: '#FACC15' },
};

// --- NAVIGATION ---
window.showPage = function(page) {
    document.querySelectorAll('[id$="Page"]').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    const target = document.getElementById(page + 'Page');
    if(target) target.classList.remove('hidden');
    if(page !== 'market') target?.classList.add('visible');

    const nav = document.getElementById('nav' + page.charAt(0).toUpperCase() + page.slice(1));
    if(nav) nav.classList.add('active');

    if (page === 'prices') loadPriceHistory();
    if (page === 'alerts') loadAlerts();
};

// --- LOGIQUE MARCHÉ ---
async function loadAll() {
    try {
        const res = await fetch(API + '?page=1&pageSize=50');
        const data = await res.json();
        allItems = data.list.items;
        filteredItems = allItems;
        renderCats(data.stats);
        renderGrid();
    } catch (e) { console.error("Erreur API:", e); }
}

function renderGrid() {
    const grid = document.getElementById('grid');
    if(!grid) return;
    const start = (currentPage - 1) * PAGE_SIZE;
    const items = filteredItems.slice(start, start + PAGE_SIZE);
    
    grid.innerHTML = items.map(item => `
        <div class="card" onclick="window.openChart('${getItemKey(item.displayName)}', '${parseItemName(item).replace(/'/g, "\\'")}')">
            <div class="item-name">${parseItemName(item)}</div>
            <div class="price">${formatPrice(item.price)} ${item.currency}</div>
            <div class="item-seller">Par ${item.ownerName}</div>
        </div>
    `).join('');
}

function renderCats(stats) {
    const bar = document.getElementById('catsBar');
    if(!bar || !stats) return;
    bar.innerHTML = stats.byCategory.map(c => `
        <div class="cat-pill ${currentCategory === c.category ? 'active' : ''}" onclick="window.setCategory('${c.category}')">
            ${c.category} (${c.count})
        </div>
    `).join('');
}

window.setCategory = function(cat) {
    currentCategory = cat;
    applyFilters();
};

function applyFilters() {
    filteredItems = allItems.filter(i => {
        const matchCat = currentCategory === 'ALL' || i.category === currentCategory;
        const matchSearch = parseItemName(i).toLowerCase().includes(currentSearch.toLowerCase());
        return matchCat && matchSearch;
    });
    renderGrid();
}

// --- PRIX & GRAPHIQUES ---
async function loadPriceHistory() {
    const q = query(collection(db, "price_history"), orderBy("updatedAt", "desc"), limit(50));
    const snap = await getDocs(q);
    priceHistoryAll = snap.docs.map(d => d.data());
    renderPricesList();
}

window.openChart = async function(key, name) {
    document.getElementById('modalTitle').innerText = name;
    document.getElementById('chartModal').classList.add('open');
    
    const q = query(collection(db, "history_points"), where("key", "==", key), orderBy("ts", "asc"), limit(50));
    const snap = await getDocs(q);
    const data = snap.docs.map(d => d.data());

    if(chartInstance) chartInstance.destroy();
    const ctx = document.getElementById('priceChart').getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => new Date(d.ts).toLocaleTimeString()),
            datasets: [{ label: 'Moyenne', data: data.map(d => d.avg), borderColor: '#FACC15' }]
        }
    });
};

window.closeModal = () => document.getElementById('chartModal').classList.remove('open');

// --- ALERTES ---
window.loadAlerts = function() {
    const el = document.getElementById('alertsList');
    onSnapshot(collection(db, "alerts"), (snap) => {
        const alerts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        el.innerHTML = alerts.map(a => `
            <div class="alert-row">
                <span>${a.itemName} (≤ ${formatPrice(a.maxPrice)})</span>
                <button onclick="window.deleteAlert('${a.id}')">Supprimer</button>
            </div>
        `).join('');
    });
};

// --- HELPERS ---
function getItemKey(dn) { return dn.includes('oraxen') ? dn.match(/oraxen:([a-z_0-9]+)/)[1] : 'vanilla'; }
function parseItemName(item) { return item.displayName.split(':').pop().replace(/>|_/g, ' '); }
function formatPrice(p) { return p?.toLocaleString('fr-FR') || '0'; }

// Init
loadAll();
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

// --- FONCTIONS DE NAVIGATION (EXPORTÉES POUR LE HTML) ---
window.showPage = function(page) {
    const pages = ['market', 'prices', 'alerts', 'island', 'players'];
    pages.forEach(p => {
        const el = document.getElementById(p + 'Page');
        const nav = document.getElementById('nav' + p.charAt(0).toUpperCase() + p.slice(1));
        if (!el) return;
        if (p === 'market') el.classList.toggle('hidden', page !== 'market');
        else el.classList.toggle('visible', page === p);
        if (nav) nav.classList.toggle('active', page === p);
    });
    if (page === 'prices') loadPriceHistory();
    if (page === 'alerts') loadAlerts();
    if (page === 'players') loadPlayers();
};

// --- LOGIQUE CORE (PARSING) ---
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
        const parts = langMatch[1].split('.');
        return parts[parts.length - 1].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
    return 'Objet Inconnu';
}

function formatPrice(p) {
    if (!p && p !== 0) return '—';
    if (p >= 1000000) return (p / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (p >= 1000) return (p / 1000).toFixed(0) + 'k';
    return p.toLocaleString('fr-FR');
}

// --- MARCHÉ (HÔTEL DES VENTES) ---
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
            fetches.push(fetch(API + '?page=' + p + '&pageSize=30', { headers: { 'User-Agent': UA } }).then(r => r.json()));
        }
        const results = await Promise.all(fetches);
        allItems = [data, ...results].flatMap(r => r.list.items);
        filteredItems = allItems.slice();
        renderCats();
        renderGrid();
    } catch (e) {
        document.getElementById('grid').innerHTML = '<div class="empty">⚠ Erreur de connexion API</div>';
    }
}

// --- HISTORIQUE DES PRIX (FIRESTORE) ---
async function loadPriceHistory() {
    const el = document.getElementById('pricesList');
    el.innerHTML = '<div class="loading"><div class="loader"></div>Chargement Firestore…</div>';
    try {
        const q = query(collection(db, "price_history"), orderBy("updatedAt", "desc"), limit(100));
        const snap = await getDocs(q);
        priceHistoryAll = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderPricesList();
    } catch (e) {
        el.innerHTML = '<div class="empty">⚠ ' + e.message + '</div>';
    }
}

function renderPricesList() {
    const el = document.getElementById('pricesList');
    const q = document.getElementById('priceSearch').value.toLowerCase();
    let data = priceHistoryAll;
    if (q) data = data.filter(d => d.name && d.name.toLowerCase().includes(q));
    
    if (data.length === 0) {
        el.innerHTML = '<div class="empty">Aucun historique disponible</div>';
        return;
    }
    
    el.innerHTML = data.map((d, i) => `
        <div class="price-card" style="animation-delay:${i * 0.02}s" onclick="openChart('${d.key}','${(d.name || d.key).replace(/'/g, "\\'")}')">
            <div class="price-card-name">${d.name || d.key}</div>
            <div class="price-card-stats">
                <div class="price-stat"><span class="price-stat-label">Moy.</span><span class="price-stat-value">${formatPrice(d.lastAvg)}</span></div>
                <div class="price-stat"><span class="price-stat-label">Min</span><span class="price-stat-value green">${formatPrice(d.lastMin)}</span></div>
            </div>
            <div class="price-card-count">${d.lastCount || 0} annonces · ${new Date(d.updatedAt).toLocaleTimeString('fr-FR')}</div>
        </div>
    `).join('');
}

// --- ALERTES (TEMPS RÉEL FIRESTORE) ---
window.loadAlerts = function() {
    const el = document.getElementById('alertsList');
    onSnapshot(collection(db, "alerts"), (snap) => {
        const alerts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (alerts.length === 0) {
            el.innerHTML = '<div class="empty">Aucune alerte configurée</div>';
            return;
        }
        el.innerHTML = alerts.map(a => `
            <div class="alert-row">
                <div class="alert-item-name">${a.itemName}</div>
                <div class="alert-price">≤ ${formatPrice(a.maxPrice)}</div>
                <span class="alert-status ${a.active ? 'active' : 'paused'}">${a.active ? 'actif' : 'pause'}</span>
                <div class="alert-actions">
                    <button class="btn-sm" onclick="toggleAlert('${a.id}', ${!a.active})">${a.active ? 'Activer' : 'Pause'}</button>
                    <button class="btn-sm danger" onclick="deleteAlert('${a.id}')">Suppr.</button>
                </div>
            </div>
        `).join('');
    });
};

window.createAlert = async function() {
    const itemInput = document.getElementById('alertItemInput').value.trim();
    const maxPrice = document.getElementById('alertPrice').value;
    const webhookUrl = document.getElementById('alertWebhook').value.trim();

    if (!itemInput || !maxPrice || !webhookUrl) return alert('Champs requis');

    try {
        await addDoc(collection(db, "alerts"), {
            itemKey: itemInput.toLowerCase().replace(/ /g, '_'),
            itemName: itemInput,
            maxPrice: Number(maxPrice),
            webhookUrl: webhookUrl,
            active: true,
            createdAt: Date.now()
        });
        alert("Alerte créée !");
    } catch (e) { alert(e.message); }
};

window.toggleAlert = async function(id, active) {
    await updateDoc(doc(db, "alerts", id), { active });
};

window.deleteAlert = async function(id) {
    if (confirm("Supprimer l'alerte ?")) await deleteDoc(doc(db, "alerts", id));
};

// --- AUTRES FONCTIONS (MISC) ---
window.setCategory = function(cat) { currentCategory = cat; renderCats(); applyFilters(); };
window.goPage = function(p) { currentPage = p; renderGrid(); window.scrollTo(0,0); };

// Lancement initial
loadAll();
