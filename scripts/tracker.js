import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fetch from 'node-fetch';

const UA = 'ExcaTools/1.0 (github.com/excatools)';
const EXCALIA_API = 'https://excalia.fr/api/hotel';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

function getItemKey(displayName) {
  const oraxen = displayName.match(/oraxen:([a-z_0-9]+)/);
  if (oraxen) return oraxen[1];
  const vanilla = displayName.match(/show_item:([a-z_]+)/);
  if (vanilla) return vanilla[1];
  return null;
}

function getItemName(displayName) {
  const oraxen = displayName.match(/oraxen:([a-z_0-9]+)/);
  if (oraxen) {
    const names = {
      rune_strength_3: 'Rune de Tranchant VI', rune_speed_3: 'Rune de Châtiment VI',
      rune_fall_3: 'Rune de Puissance VII', cristal_marin: 'Cristal Marin',
      pierre_celeste: 'Pierre Céleste', pierre_mystique: 'Pierre Mystique',
      premium_houe: 'Houe des Flammes Glaciales', ice_key: 'Clé Premium+',
      plume_fly_60m: 'Plume de Fly 60min', potion_generale_t3: 'Potion Générale 15%',
      delicate_hook: 'Hameçon Léger',
    };
    return names[oraxen[1]] || oraxen[1].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  const lang = displayName.match(/<lang:([^>]+)>/);
  if (lang) {
    const map = {
      'block.minecraft.jungle_sapling': 'Pousse de Jungle',
      'block.minecraft.beacon': 'Balise',
      'item.minecraft.splash_potion.effect.weakness': 'Potion de Faiblesse',
      'item.minecraft.enchanted_book': 'Livre Enchanté',
    };
    if (map[lang[1]]) return map[lang[1]];
    const parts = lang[1].split('.');
    return parts[parts.length - 1].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  return 'Unknown';
}

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
        description: data.count > 1 ? `**${data.count}** annonces disponibles à ce prix ou moins.` : 'Une annonce disponible.',
        color: 0xFACC15,
        fields: [
          { name: '💰 Prix', value: '**' + data.price.toLocaleString('fr-FR') + ' ' + data.currency + '**', inline: true },
          { name: '🎯 Seuil', value: data.maxPrice.toLocaleString('fr-FR') + ' ' + data.currency, inline: true },
          { name: '📉 Économie', value: saved.toLocaleString('fr-FR') + ' (' + pct + '% sous seuil)', inline: true },
          { name: '👤 Vendeur', value: data.seller, inline: true },
        ],
        footer: { text: 'ExcaTools • Excalia.fr' },
        timestamp: new Date().toISOString(),
      }],
    }),
  });
  if (!res.ok) console.error('[tracker] Discord webhook error:', res.status, await res.text());
}

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
