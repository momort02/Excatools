const fetch = require('node-fetch');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Connexion via le Secret GitHub
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const EXCALIA_API = 'https://excalia.fr/api/hotel';
const UA = 'ExcaTools/1.0 (excatools)';

// --- TES FONCTIONS DE PARSING (Gardées du code original) ---
function parseItemName(displayName) { /* ... */ }
function getItemKey(displayName) { /* ... */ }
async function fetchAllListings() { /* ... */ }
async function recordPrices(items) { /* ... */ }
async function checkAlerts(items) { /* ... */ }
async function sendDiscordWebhook(url, data) { /* ... */ }

// --- FONCTION PRINCIPALE ---
async function runCycle() {
  try {
    const items = await fetchAllListings();
    await recordPrices(items);
    await checkAlerts(items);
    console.log('✅ Cycle réussi');
  } catch (e) {
    console.error('❌ Erreur:', e.message);
    process.exit(1);
  }
}

runCycle();
