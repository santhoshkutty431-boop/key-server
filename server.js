const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 7860; // Hugging Face default port

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://admin:admin@cluster0.example.mongodb.net/keyserver?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch(err => console.error('MongoDB Connection Error:', err));

// User Schema
const userSchema = new mongoose.Schema({
        username: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        plan: { type: String, enum: ['Normal', 'Pro', 'Ultra', 'Admin'], default: 'Normal' },
        hwid: { type: String, default: null },
        tokens_used: { type: Number, default: 0 },
        token_limit: { type: Number, default: 1000 },
        is_banned: { type: Boolean, default: false },
        created_at: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// --- AUTHENTICATION (CLIENT) ---

// Verify Key (Key = Username in this simple setup, or we can use a dedicated field)
app.get('/verify', async (req, res) => {
        try {
                    const { key, hwid } = req.query;
                    if (!key || !hwid) return res.status(400).send("Missing parameters");

            const user = await User.findOne({ username: key });

            if (!user) return res.status(401).send("Invalid key");
                    if (user.is_banned) return res.status(403).send("Account suspended");

            // HWID Locking
            if (user.hwid === null) {
                            user.hwid = hwid;
                            await user.save();
                            return res.status(200).send("OK");
            }

            if (user.hwid !== hwid) {
                            return res.status(403).send("HWID mismatch");
            }

            // Token usage tracking (optional)
            user.tokens_used += 1;
                    await user.save();

            res.status(200).send("OK");
        } catch (err) {
                    res.status(500).send("Server Error");
        }
});

// --- ADMIN API (Matching admin_portal.html) ---

// Get Stats
app.get('/api/admin/stats', async (req, res) => {
        try {
                    const total = await User.countDocuments();
                    const banned = await User.countDocuments({ is_banned: true });

            const by_plan = {
                            Normal: await User.countDocuments({ plan: 'Normal' }),
                            Pro: await User.countDocuments({ plan: 'Pro' }),
                            Ultra: await User.countDocuments({ plan: 'Ultra' }),
                            Admin: await User.countDocuments({ plan: 'Admin' })
            };

            const tokensResult = await User.aggregate([{ $group: { _id: null, total: { $sum: "$tokens_used" } } }]);
                    const tokens_today = tokensResult[0]?.total || 0;

            res.json({ total, banned, by_plan, tokens_today });
        } catch (err) {
                    res.status(500).json({ error: err.message });
        }
});

// List Users
app.get('/api/admin/users', async (req, res) => {
        try {
                    const users = await User.find().sort({ created_at: -1 });
                    res.json(users);
        } catch (err) {
                    res.status(500).json({ error: err.message });
        }
});

// Get User
app.get('/api/admin/users/:id', async (req, res) => {
        try {
                    const user = await User.findById(req.params.id);
                    res.json(user);
        } catch (err) {
                    res.status(404).json({ error: "User not found" });
        }
});

// Create User
app.post('/api/admin/users', async (req, res) => {
        try {
                    const { username, email, password, plan } = req.body;

            const limits = { Normal: 1000, Pro: 5000, Ultra: 20000, Admin: 999999 };
                    const token_limit = limits[plan] || 1000;

            const newUser = new User({ username, email, password, plan, token_limit });
                    await newUser.save();
                    res.json(newUser);
        } catch (err) {
                    res.status(400).json({ error: err.message });
        }
});

// Update User
app.patch('/api/admin/users/:id', async (req, res) => {
        try {
                    const updates = req.body;
                    if (updates.plan) {
                                    const limits = { Normal: 1000, Pro: 5000, Ultra: 20000, Admin: 999999 };
                                    updates.token_limit = limits[updates.plan];
                    }
                    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true });
                    res.json(user);
        } catch (err) {
                    res.status(400).json({ error: err.message });
        }
});

// Reset HWID/Tokens
app.post('/api/admin/users/:id/reset', async (req, res) => {
        try {
                    const user = await User.findById(req.params.id);
                    user.hwid = null;
                    user.tokens_used = 0;
                    await user.save();
                    res.json({ success: true });
        } catch (err) {
                    res.status(400).json({ error: err.message });
        }
});

// Delete User
app.delete('/api/admin/users/:id', async (req, res) => {
        try {
                    await User.findByIdAndDelete(req.params.id);
                    res.json({ success: true });
        } catch (err) {
                    res.status(400).json({ error: err.message });
        }
});

// Ping (Keep Alive)
app.get('/ping', (req, res) => res.send('Pong! Server is 24/7.'));

app.listen(PORT, () => {
        console.log(`Key Server v2 running on port ${PORT}`);
});
