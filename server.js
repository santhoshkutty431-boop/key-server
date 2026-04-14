const express = require('express');
const fs = require('fs');
const app = express();

const DB_FILE = 'keys.json';

function loadKeys() {
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify({}));
    }
    return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveKeys(keys) {
    fs.writeFileSync(DB_FILE, JSON.stringify(keys, null, 2));
}

app.get('/verify', (req, res) => {
    const { key, hwid } = req.query;
    const keys = loadKeys();

    if (!keys.hasOwnProperty(key)) {
        return res.status(401).send("Invalid key");
    }

    if (keys[key] === null) {
        keys[key] = hwid;
        saveKeys(keys);
        return res.status(200).send("OK");
    }

    if (keys[key] !== hwid) {
        return res.status(403).send("HWID mismatch");
    }

    res.status(200).send("OK");
});

app.get('/addkey', (req, res) => {
    const { key } = req.query;
    const keys = loadKeys();

    if (keys.hasOwnProperty(key)) {
        return res.status(400).send("Key already exists");
    }

    keys[key] = null;
    saveKeys(keys);
    res.status(200).send(`Key ${key} added`);
});

app.get('/listkeys', (req, res) => {
    const keys = loadKeys();
    res.json(keys);
});

app.get('/resetkey', (req, res) => {
    const { key } = req.query;
    const keys = loadKeys();

    if (!keys.hasOwnProperty(key)) {
        return res.status(404).send("Key not found");
    }

    keys[key] = null;
    saveKeys(keys);
    res.status(200).send(`Key ${key} reset`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
