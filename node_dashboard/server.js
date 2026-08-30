const express = require('express');
const path = require('path');
const cors = require('cors');
const { runSimulationPipeline } = require('./public/js/engine');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint for running simulation on server
app.post('/api/simulate', (req, res) => {
    try {
        const params = req.body || {};
        const results = runSimulationPipeline(params);
        res.json({ success: true, results });
    } catch (err) {
        console.error("Simulation error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'online', system: 'Counter-UAS C2 Digital Twin Engine' });
});

app.listen(PORT, () => {
    console.log(`\n================================================================`);
    console.log(`🛡️  COUNTER-DRONE C2 DIGITAL TWIN DASHBOARD (NODE.JS) ONLINE`);
    console.log(`📡  Tactical Interface: http://localhost:${PORT}`);
    console.log(`================================================================\n`);
});
