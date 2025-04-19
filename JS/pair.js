const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const pino = require("pino");
const NodeCache = require('node-cache');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  makeCacheableSignalKeyStore,
  DisconnectReason,
  Browsers,
} = require("ovl_wa_baileys");

const app = express.Router();
const msgRetryCounterCache = new NodeCache();
const PORT = process.env.PORT || 3000;

let sock;

app.get('/', async (req, res) => {
  const num = req.query.number;
  if (!num) return res.json({ error: 'Veuillez fournir un numéro de téléphone' });
  await ovl(num, res);
});

async function ovl(num, res, disconnect = false) {
  const sessionDir = path.join(__dirname, '../session');

  if (!disconnect && !fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir);
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }).child({ level: 'fatal' }))
    },
    printQRInTerminal: false,
    logger: pino({ level: 'fatal' }).child({ level: 'fatal' }),
    browser: Browsers.macOS("Safari"),
    markOnlineOnConnect: true,
    msgRetryCounterCache
  });

  sock.ev.on('creds.update', saveCreds);

  const isFirstLogin = !sock.authState.creds.registered;

  if (isFirstLogin && !disconnect) {
    await delay(1500);
    const numero = num.replace(/[^0-9]/g, '');
    const code = await sock.requestPairingCode(numero);
    if (!res.headersSent) res.send({ code });
  }

  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      console.log('Connecté aux serveurs WhatsApp');

        await delay(5000);
        try {
          const CREDS = fs.readFileSync(`${sessionDir}/creds.json`, 'utf-8');
          const response = await axios.post('https://pastebin.com/api/api_post.php', new URLSearchParams({
            api_dev_key: '64TBS-HKyH1n5OL2ddx7DwtpOKMsRDXl',
            api_option: 'paste',
            api_paste_code: CREDS,
            api_paste_expire_date: 'N'
          }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

          const lienPastebin = response.data.split('/')[3];
          const msg = await sock.sendMessage(sock.user.id, { text: `Ovl-MD_${lienPastebin}_SESSION-ID` });

          await sock.sendMessage(sock.user.id, {
            image: { url: 'https://telegra.ph/file/4d918694f786d7acfa3bd.jpg' },
            caption: "Merci d’avoir choisi OVL-MD, voici votre SESSION-ID ⏏️"
          }, { quoted: msg });

          fs.rmSync(sessionDir, { recursive: true, force: true });

        } catch (err) {
          console.error('Erreur d’upload :', err);
        }
    } else if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      reconnect(reason, num, res);
    }
  });
}

function reconnect(reason, num, res) {
  if ([DisconnectReason.connectionLost, DisconnectReason.connectionClosed, DisconnectReason.restartRequired].includes(reason)) {
    console.log('Connexion perdue, reconnexion en cours...');
    ovl(num, res, true);
  } else {
    console.log(`Déconnecté ! Motif : ${reason}`);
    if (sock) sock.end();
    fs.rmSync(sessionDir, { recursive: true, force: true });
  }
}

module.exports = app;
