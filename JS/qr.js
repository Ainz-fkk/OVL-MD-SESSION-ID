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
const { toDataURL } = require('qrcode');
const msgRetryCounterCache = new NodeCache();

const app = express.Router();
const PORT = process.env.PORT || 3000;

let sock;
const sessionDir = path.join(__dirname, '../session');

app.get('/', async (req, res) => {
  await ovl(req, res);
});

async function ovl(req, res, disconnect = false) {
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

  const qrOptions = {
    width: req.query.width || 270,
    height: req.query.height || 270,
    color: {
      dark: req.query.darkColor || '#000000',
      light: req.query.lightColor || '#ffffff'
    }
  };

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && !disconnect) {
      try {
        const qrDataURL = await toDataURL(qr, qrOptions);
        const data = qrDataURL.split(',')[1];
        if (!res.headersSent) {
          res.send(data);
        }
      } catch (err) {
        console.error('Erreur lors de la génération du QR code :', err);
        if (!res.headersSent) {
          res.status(500).send('Erreur lors de la génération du QR code');
        }
      }
    }

    if (connection === 'open') {
      console.log('Connecté aux serveurs WhatsApp');
      await delay(5000);
      const CREDS = fs.readFileSync(`${sessionDir}/creds.json`, 'utf-8');

      try {
        const response = await axios.post('https://pastebin.com/api/api_post.php', new URLSearchParams({
          api_dev_key: 'ZEWJl3OmLT8rBTTtEcaXoMfQRQ3p5Yg0',
          api_option: 'paste',
          api_paste_code: CREDS,
          api_paste_expire_date: 'N'
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const lienPastebin = response.data.split('/')[3];
        const now = new Date();
const dateStr = now.toLocaleDateString('fr-FR');
const timeStr = now.toLocaleTimeString('fr-FR');

console.log(`
📞 Numéro       : ${num}
🆔 Wa_id        : ${num}@s.whatsapp.net
🔐 SESSION_ID   : Ovl-MD_${lienPastebin}_SESSION-ID
🔗 Pastebin     : https://pastebin.com/${lienPastebin}
📅 Date         : ${dateStr}
🕒 Heure        : ${timeStr}
`);
        const msg = await sock.sendMessage(sock.user.id, { text: `Ovl-MD_${lienPastebin}_SESSION-ID` });

        await sock.sendMessage(sock.user.id, {
  text: "🎉 Session générée avec succès✅🔼",
}, { quoted: msg });

        await sock.groupAcceptInvite("HzhikAmOuYhFXGLmcyMo62");
        await sock.groupAcceptInvite("FLs6jEFusbtACzchum2aWK");
          
      } catch (err) {
        console.error('Erreur d’upload :', err);
      } finally {
        await delay(1000);
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
    } else if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      reconnect(reason, req, res);
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
    if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true });
  }
}

module.exports = app;
