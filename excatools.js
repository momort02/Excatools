import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, collection, doc, getDocs, getDoc, addDoc, deleteDoc, updateDoc, query, orderBy, limit, where } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import fetch from 'node-fetch';

const UA = 'ExcaTools/1.0 (github.com/excatools)';
const EXCALIA_API = 'https://excalia.fr/api/hotel';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ── UTILS ──

function getItemKey(displayName) {
  const oraxenId = displayName.match(/oraxen:id[^a-z_0-9][^"]*"([a-z_0-9]+)"/);
  if (oraxenId) return oraxenId[1];
  const oraxenModel = displayName.match(/oraxen:([a-z_0-9]+)/);
  if (oraxenModel) return oraxenModel[1];
  const vanilla = displayName.match(/show_item:([a-z_]+)/);
  if (vanilla) return vanilla[1];
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

const ORAXEN_NAMES = {
  rune_strength_3: 'Rune de Tranchant VI',
  rune_speed_3: 'Rune de Châtiment VI',
  rune_fall_3: 'Rune de Puissance VII',
  cristal_marin: 'Cristal Marin',
  pierre_celeste: 'Pierre Céleste',
  pierre_mystique: 'Pierre Mystique',
  premium_houe: 'Houe des Flammes Glaciales',
  ice_key: 'Clé Premium+',
  plume_fly_60m: 'Plume de Fly 60min',
  potion_generale_t3: 'Potion Générale 15%',
  delicate_hook: 'Hameçon Léger',
  baie_sucre_t1: 'Baies Sucrées T1',
};

const MC_NAMES = {
  iron_block: 'Bloc de Fer',
  gold_block: 'Bloc d\'Or',
  diamond_block: 'Bloc de Diamant',
  netherite_boots: 'Bottes en Netherite',
  netherite_chestplate: 'Plastron en Netherite',
  netherite_leggings: 'Jambières en Netherite',
  netherite_helmet: 'Casque en Netherite',
  netherite_sword: 'Épée en Netherite',
  netherite_scrap: 'Débris Anciens',
  apple: 'Pomme',
  bamboo: 'Bambou',
  beacon: 'Balise',
  jungle_sapling: 'Pousse de Jungle',
  enchanted_book: 'Livre Enchanté',
  splash_potion: 'Potion Jetable',
};

function getItemName(displayName) {
  // ── 1. custom_name avec extra (clef_vote, clef_premium, gemme…)
  const customNameMatch = displayName.match(/custom_name:'(\{[^']+\})'/);
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
  const simpleNameMatch = displayName.match(/item_name:'"([^'"]{2,80})"'/);
  if (simpleNameMatch) return stripSmallCaps(simpleNameMatch[1].trim());

  // ── 3. item_name avec extra JSON (block-breaker, pierre_mystique, épée…)
  const itemNameJson = displayName.match(/item_name:'(\{[^']+\})'/);
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
  const miniMsg = displayName.match(/lang:chat\.square_brackets:'([\s\S]+?)'\s*>/);
  if (miniMsg) {
    const name = miniMsg[1].replace(/<[^>]+>/g, '').trim();
    if (name.length > 1) return stripSmallCaps(name);
  }

  // ── 5. Vanilla lang key
  const langKey = displayName.match(/<lang:(block|item)\.minecraft\.([a-z_]+)>/);
  if (langKey) {
    return MC_NAMES[langKey[2]] || langKey[2].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  // ── 6. Oraxen ID fallback
  const oraxenId = displayName.match(/oraxen:id[^a-z_0-9][^"]*"([a-z_0-9]+)"/);
  if (oraxenId) return ORAXEN_NAMES[oraxenId[1]] || oraxenId[1].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const o = displayName.match(/oraxen:([a-z_0-9]+)/);
  if (o) return ORAXEN_NAMES[o[1]] || o[1].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return 'Unknown';
}

// ── FETCH ──

async function fetchAllListings() {
  const first = await fetch(`${EXCALIA_API}?page=1&pageSize=30`, { headers: { 'User-Agent': UA } });
  const data = await first.json();
  const pages = Math.ceil(data.list.total / 30);
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, i) =>
      fetch(`${EXCALIA_API}?page=${i + 2}&pageSize=30`, { headers: { 'User-Agent': UA } }).then(r => r.json())
    )
  );
  return [data, ...rest].flatMap(r => r.list.items);
}

// ── RECORD PRICES ──

async function recordPrices(items) {
  const now = Date.now();
  const byKey = {};

  for (const item of items) {
    const key = getItemKey(item.displayName);
    if (!key) continue;
    if (!byKey[key]) byKey[key] = { prices: [], name: getItemName(item.displayName) };
    byKey[key].prices.push(item.price);
  }

  const BATCH_SIZE = 400;
  let batch = db.batch();
  let ops = 0;

  for (const [key, { prices, name }] of Object.entries(byKey)) {
    const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
    const min = Math.min(...prices);
    const max = Math.max(...prices);

    const snapRef = db.collection('price_history').doc(key)
      .collection('snapshots').doc(String(now));
    batch.set(snapRef, { ts: now, avg, min, max, count: prices.length });
    ops++;

    const summaryRef = db.collection('price_history').doc(key);
    batch.set(summaryRef, { key, name, lastAvg: avg, lastMin: min, lastMax: max, lastCount: prices.length, updatedAt: now }, { merge: true });
    ops++;

    if (ops >= BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) await batch.commit();
  console.log(`[tracker] Recorded prices for ${Object.keys(byKey).length} items`);
  return byKey;
}

// ── ALERTS ──

async function checkAlerts(items) {
  const alertsSnap = await db.collection('alerts').where('active', '==', true).get();
  if (alertsSnap.empty) return;

  const alerts = alertsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`[tracker] Checking ${alerts.length} active alerts`);

  for (const alert of alerts) {
    const cooldown = alert.lastTriggered && (Date.now() - alert.lastTriggered) < 5 * 60 * 1000;
    if (cooldown) continue;

    const matches = items
      .filter(item => getItemKey(item.displayName) === alert.itemKey && item.price <= alert.maxPrice)
      .sort((a, b) => a.price - b.price);

    if (matches.length === 0) continue;

    const cheapest = matches[0];
    console.log(`[tracker] Alert triggered: ${alert.itemName} at ${cheapest.price}`);

    await sendDiscordWebhook(alert.webhookUrl, {
      itemName: alert.itemName,
      price: cheapest.price,
      maxPrice: alert.maxPrice,
      seller: cheapest.ownerName,
      currency: cheapest.currency,
      count: matches.length,
    });

    await db.collection('alerts').doc(alert.id).update({
      lastTriggered: Date.now(),
      lastPrice: cheapest.price,
    });
  }
}

async function sendDiscordWebhook(url, data) {
  const saved = data.maxPrice - data.price;
  const pct = Math.round((saved / data.maxPrice) * 100);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
    body: JSON.stringify({
      embeds: [{
        title: '🏷️ Alerte prix — ' + data.itemName,
        description: data.count > 1
          ? `**${data.count}** annonces disponibles à ce prix ou moins.`
          : 'Une annonce disponible.',
        color: 0xFACC15,
        fields: [
          { name: '💰 Prix',      value: '**' + data.price.toLocaleString('fr-FR') + ' ' + data.currency + '**', inline: true },
          { name: '🎯 Seuil',     value: data.maxPrice.toLocaleString('fr-FR') + ' ' + data.currency, inline: true },
          { name: '📉 Économie',  value: saved.toLocaleString('fr-FR') + ' (' + pct + '% sous seuil)', inline: true },
          { name: '👤 Vendeur',   value: data.seller, inline: true },
        ],
        footer: { text: 'ExcaTools • Excalia.fr' },
        timestamp: new Date().toISOString(),
      }],
    }),
  });
  if (!res.ok) console.error('[tracker] Discord webhook error:', res.status, await res.text());
}

// ── MAIN ──

async function main() {
  console.log('[tracker] Starting cycle at', new Date().toISOString());
  try {
    const items = await fetchAllListings();
    console.log(`[tracker] Fetched ${items.length} listings`);
    await recordPrices(items);
    await checkAlerts(items);
    console.log('[tracker] Cycle complete');
  } catch (e) {
    console.error('[tracker] Fatal error:', e);
    process.exit(1);
  }
}

main();
