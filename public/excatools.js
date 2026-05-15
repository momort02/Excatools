// --- CONFIGURATION ET IMPORTS FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10/7/firebase-app.js";
import { 
    getFirestore, collection, addDoc, getDocs, query, orderBy, limit, 
    where, deleteDoc, doc, updateDoc, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10/7/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "TON_API_KEY",
    authDomain: "excatools.firebaseapp.com",
    projectId: "excatools",
    storageBucket: "excatools.appspot.com",
    messagingSenderId: "ID_MESSAGERIE",
    appId: "TON_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- VARIABLES GLOBALES ---
const API = 'https://excalia.fr/api/hotel';
const PAGE_SIZE = 30;
const UA = 'ExcaTools/1.0 (excatools)';

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
