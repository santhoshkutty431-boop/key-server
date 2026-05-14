const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Octokit } = require("@octokit/rest");
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 7860;

// GitHub Configuration (Zero Setup DB)
const GITHUB_TOKEN = process.env.GH_TOKEN;
const REPO_OWNER = 'santhoshkutty431-boop';
const REPO_NAME = 'key-server';
const FILE_PATH = 'keys.json';

const octokit = new Octokit({ auth: GITHUB_TOKEN });

app.use(cors());
app.use(bodyParser.json());

// Helper to Load Keys from GitHub
async function loadKeys() {
        try {
                    const { data } = await octokit.repos.getContent({
                                    owner: REPO_OWNER,
                                    repo: REPO_NAME,
                                    path: FILE_PATH,
                    });
                    const content = Buffer.from(data.content, 'base64').toString();
                    return { keys: JSON.parse(content), sha: data.sha };
        } catch (err) {
                    return { keys: {}, sha: null };
        }
}

// Helper to Save Keys to GitHub
async function saveKeys(keys, sha) {
        const content = Buffer.from(JSON.stringify(keys, null, 2)).toString('base64');
        await octokit.repos.createOrUpdateFileContents({
                    owner: REPO_OWNER,
                    repo: REPO_NAME,
                    path: FILE_PATH,
                    message: 'Update keys database',
                    content: content,
                    sha: sha
        });
}

// --- CLIENT ENDPOINTS ---

app.get('/verify', async (req, res) => {
        const { key, hwid } = req.query;
        const { keys } = await loadKeys();

            if (!keys[key]) return res.status(401).send("Invalid key");
        if (keys[key].is_banned) return res.status(403).send("Suspended");

            if (keys[key].hwid === null) {
                        keys[key].hwid = hwid;
                        const { sha } = await loadKeys();
                        await saveKeys(keys, sha);
                        return res.status(200).send("OK");
            }

            if (keys[key].hwid !== hwid) return res.status(403).send("HWID mismatch");

            res.status(200).send("OK");
});

// --- ADMIN API ---

app.get('/api/admin/stats', async (req, res) => {
        const { keys } = await loadKeys();
        const list = Object.values(keys);
        res.json({
                    total: list.length,
                    banned: list.filter(u => u.is_banned).length,
                    by_plan: {
                                    Normal: list.filter(u => u.plan === 'Normal').length,
                                    Pro: list.filter(u => u.plan === 'Pro').length,
                                    Ultra: list.filter(u => u.plan === 'Ultra').length,
                                    Admin: list.filter(u => u.plan === 'Admin').length
                    },
                    tokens_today: 0
        });
});

            app.get('/api/admin/users', async (req, res) => {
                    const { keys } = await loadKeys();
                    res.json(Object.keys(keys).map(k => ({ id: k, username: k, ...keys[k] })));
            });

app.post('/api/admin/users', async (req, res) => {
        const { username, email, password, plan } = req.body;
        const { keys, sha } = await loadKeys();
        keys[username] = { email, password, plan, hwid: null, is_banned: false, created_at: new Date().toISOString() };
        await saveKeys(keys, sha);
        res.json({ success: true });
});

app.delete('/api/admin/users/:id', async (req, res) => {
        const { keys, sha } = await loadKeys();
        delete keys[req.params.id];
        await saveKeys(keys, sha);
        res.json({ success: true });
});

app.post('/api/admin/users/:id/reset', async (req, res) => {
        const { keys, sha } = await loadKeys();
        if (keys[req.params.id]) {
                    keys[req.params.id].hwid = null;
                    await saveKeys(keys, sha);
        }
        res.json({ success: true });
});

app.get('/ping', (req, res) => res.send('24/7 Key Server Active'));

app.listen(PORT, () => console.log(`Server running on ${PORT}`));

app.get('
