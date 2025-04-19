const express = require('express');
const app = express();
const path = require('path');
const PORT = process.env.PORT || 8000;

let code = require('./JS/pair');
const router = require('./JS/qr');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/code', code);
app.use('/qr', router);

app.use('/pair', (req, res) => {
    res.sendFile(path.join(__dirname, 'html&css', 'pair.html'));
});

app.use('/qrcode', (req, res) => {
    res.sendFile(path.join(__dirname, 'html&css', 'qr.html'));
});

app.use('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'html&css', 'main.html'));
});

app.listen(PORT, () => {
    console.log(`Serveur en cours d'exécution sur http://localhost:${PORT}`);
});

module.exports = app;
