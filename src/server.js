const express = require('express');
const cors = require('cors');
const path = require('path');
const { extract } = require('./controllers/extractController');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// API Endpoint para extração
app.post('/api/extract', extract);

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
