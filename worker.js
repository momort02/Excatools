const fetch = require('node-fetch');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ... (Copie ici tes fonctions parseItemName, getItemKey, fetchAllListings du server.js original)

async function run() {
    console.log("Début du cycle...");
    const items = await fetchAllListings();
    
    // 1. Sauvegarde les prix moyens par item
    // Tu peux regrouper par itemKey et faire la moyenne
    
    // 2. Vérification des alertes
    const alertsSnap = await db.collection('alerts').where('active', '==', true).get();
    for (const alertDoc of alertsSnap.docs) {
        const alert = alertDoc.data();
        const matches = items.filter(i => getItemKey(i.displayName) === alert.itemKey && i.price <= alert.maxPrice);
        
        if (matches.length > 0) {
            console.log(`Alerte déclenchée pour ${alert.itemName}`);
            // Envoi Webhook Discord ici
        }
    }
}

run();
