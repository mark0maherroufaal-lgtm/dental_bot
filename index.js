const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

// ==========================================
// CONFIGURATION
// ==========================================
const VERCEL_WEBHOOK_URL = 'https://dental-bot-drab.vercel.app/api/ingest'; 
const INGEST_SECRET = 'MarkoWaBridge2026'; 
// ==========================================

const fs = require('fs');

// Auto-detect local Chrome to avoid download issues
let chromePath = '';
const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];
for (let p of possiblePaths) {
    if (fs.existsSync(p)) {
        chromePath = p;
        break;
    }
}

console.log("Starting WhatsApp Bridge...");
if (chromePath) console.log("Using local browser: " + chromePath);

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: chromePath || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    console.log("\n[!] Please scan this QR code with your WhatsApp:\n");
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ Connected to WhatsApp successfully!');
});

client.on('message', async msg => {
    try {
        // Only process group messages (remote ID ends with @g.us)
        const isGroup = msg.from.endsWith('@g.us');
        if (!isGroup) return;

        const text = msg.body;
        if (!text || !text.trim()) return;

        console.log(`[📩 New Group Message]: ${text.substring(0, 50)}...`);

        // Send to Vercel
        await axios.post(VERCEL_WEBHOOK_URL, {
            text: text,
            source: 'WHATSAPP_GROUP'
        }, {
            headers: {
                'x-ingest-token': INGEST_SECRET,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Successfully forwarded to Vercel.');
    } catch (error) {
        console.error('❌ Error forwarding message:', error.message);
    }
});

client.initialize();
