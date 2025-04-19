const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    DisconnectReason,
    Browsers,
    msgRetryCounterCache
} = require("ovl_wa_baileys");

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', async (req, res) => {
  const num = req.query.number;
  if (!num) return res.json({ error: 'Veuillez fournir un numéro de téléphone' });
  await ovl(num, res);
});

async function ovl(num, res) {
  const sessionDir = path.join(__dirname, '../session');
  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir);

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const sock = makeWASocket({
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

  if (!sock.authState.creds.registered) {
    await delay(1500);
    const numero = num.replace(/[^0-9]/g, '');
    const code = await sock.requestPairingCode(numero);
    if (!res.headersSent) res.send({ code });
  }

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      console.log('Connecté aux serveurs WhatsApp');
      await delay(5000);
      const CREDS = fs.readFileSync(`${sessionDir}/creds.json`, 'utf-8');

      try {
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
      } catch (err) {
        console.error('Erreur d’upload :', err);
      } finally {
        await delay(1000);
        fs.rmdirSync(sessionDir, { recursive: true });
      }
    } else if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      reconnect(reason);
    }
  });
}

function reconnect(reason) {
  if ([DisconnectReason.connectionLost, DisconnectReason.connectionClosed, DisconnectReason.restartRequired].includes(reason)) {
    console.log('Connexion perdue, reconnexion en cours...');
    ovl();
  } else {
    console.log(`Déconnecté ! Motif : ${reason}`);
    sock.end();
  }
}

module.exports = app;
