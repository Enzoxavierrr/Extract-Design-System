require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { extract } = require('./controllers/extractController');
const { analyzeDesignSystem } = require('./controllers/geminiController');
const { rateLimiter } = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Rate limiters (Playwright is heavy — strict limit on /api/extract)
const extractLimiter = rateLimiter({ windowMs: 60_000, maxHits: 3, message: 'Limite de extrações atingido. Aguarde 1 minuto.' });
const geminiLimiter  = rateLimiter({ windowMs: 60_000, maxHits: 10, message: 'Limite de análises IA atingido. Aguarde 1 minuto.' });

// API Endpoint para extração
app.post('/api/extract', extractLimiter, extract);

// API Endpoint para análise Gemini (proxy seguro)
app.post('/api/gemini', geminiLimiter, analyzeDesignSystem);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🎨 Design Token Extractor                           ║
║                                                       ║
║   Server running at http://localhost:${PORT}            ║
║                                                       ║
║   Open your browser and start extracting!             ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
    `);
});

module.exports = app;
