const express = require('express');
const axios = require('axios');  
const fs = require('fs');
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    DisconnectReason
} = require("ovl_wa_baileys");
const app = express.Router();
const PORT = process.env.PORT || 3000;

app.get('/', async (req, res) => {
  let num = req.query.number;

  if (!num) return res.json({ error: 'Veuillez fournir un numéro de téléphone' });

  try {
    const code = await ovlPair(num);
    res.send({ code: code });
  } catch (error) {
    console.error('Erreur d’authentification WhatsApp :', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});


module.exports = app;
