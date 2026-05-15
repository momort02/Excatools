/* ── CONFIGURATION & CONSTANTES ── */
const API = 'https://excalia.fr/api/hotel';
const PAGE_SIZE = 30;
const UA = 'ExcaTools/1.0 (excatools)';
const BASE_PJS = 'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.21.11/';

let allItems = [], filteredItems = [], currentPage = 1, currentCategory = 'ALL', currentSearch = '', currentSort = 'default';
let stats = null, priceHistoryAll = [], currentModalKey = null, currentModalName = null, currentChartRange = 24, chartInstance = null;
let playersData = null, playersSearch = '', playersServerFilter = 'all', playersRefreshTimer = null;

const CAT_FALLBACK = {
    BLOCKS: { emoji: '🧱', color: '#a16207' },
    TOOLS: { emoji: '⛏️', color: '#7DD3FC' },
    WEAPON: { emoji: '⚔️', color: '#ef4444' },
    ARMOR: { emoji: '🛡️', color: '#6366f1' },
    FOOD: { emoji: '🍖', color: '#f97316' },
    POTIONS: { emoji: '🧪', color: '#a855f7' },
    MISCELLANEOUS: { emoji: '✨', color: '#FACC15' }
};

/* ── UTILITAIRES ── */
const formatPrice = (p) => {
    if (!p && p !== 0) return '—';
    if (p >= 1000000) return (p / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (p >= 1000) return (p / 1000).toFixed(0) + 'k';
    return p.toLocaleString('fr-FR');
};

function parseItemName(item) {
    const dn = item.displayName || '';
    const oraxenMatch = dn.match(/oraxen:([a-z_0-9]+)/);
    if (oraxenMatch) return oraxenMatch[1].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    
    const langMatch = dn.match(/<lang:([^>]+)>/);
    if (langMatch) {
        const parts = langMatch[1].split('.');
        return parts[parts.length - 1].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
    return 'Objet Inconnu';
}

function getItemImage(item) {
    const dn = item.displayName || '';
    const oraxenMatch = dn.match(/oraxen:([a-z_0-9]+)/);
    if (oraxenMatch) {
        const id = oraxenMatch[1];
        return { type: 'sprite', value: 'textures/' + id + '.png', fallback: '✦' };
    }
    return { type: 'emoji', value: (CAT_FALLBACK[item.category] || { emoji: '📦' }).emoji };
}

/* ── LOGIQUE DE RENDU ── */
function renderGrid() {
    const grid = document.getElementById('grid');
    if (!grid) return;

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = filteredItems.slice(start, start + PAGE_SIZE);
    
    if (!pageItems.length) {
        grid.innerHTML = '<div class="empty">Aucun résultat trouvé</div>';
        return;
    }

    grid.innerHTML = pageItems.map((item) => {
        const name = parseItemName(item);
        const img = getItemImage(item);
        return `
            <div class="card">
                <div class="card-header">
                    <div class="item-icon">${img.type === 'sprite' ? `<img src="${img.value}" style="width:32px">` : img.value}</div>
                    <div>
                        <div class="item-name">${name}</div>
                        <div class="item-seller">Par ${item.ownerName}</div>
                    </div>
                </div>
                <div class="card-footer">
                    <div class="price">${formatPrice(item.price)} ${item.currency}</div>
                </div>
            </div>`;
    }).join('');

    const countEl = document.getElementById('totalCount');
    if (countEl) countEl.textContent = `${filteredItems.length} objets`;
}

function applyFilters() {
    filteredItems = allItems.filter(i => {
        const matchesCat = currentCategory === 'ALL' || i.category === currentCategory;
        const matchesSearch = !currentSearch || parseItemName(i).toLowerCase().includes(currentSearch.toLowerCase());
        return matchesCat && matchesSearch;
    });
    currentPage = 1;
    renderGrid();
}

/* ── CHARGEMENT & INITIALISATION SÉCURISÉE ── */
async function loadAll() {
    try {
        const res = await fetch(`${API}?page=1&pageSize=30`, { headers: { 'User-Agent': UA } });
        const data = await res.json();
        allItems = data.list.items || [];
        filteredItems = [...allItems];
        renderGrid();
    } catch (e) {
        console.error("Erreur API:", e);
    }
}

// Cette fonction remplace les addEventListener problématiques
function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearch = e.target.value;
            applyFilters();
        });
    }

    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            currentSort = e.target.value;
            applyFilters();
        });
    }
    
    // Ajoute ici les autres écouteurs (boutons, onglets, etc.)
}

// Initialisation globale
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadAll();
});
