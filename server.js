const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3030; // Changed port to 3030 to avoid conflicts

// Middleware
app.use(cors());
app.use(express.json());

// Static folder for Frontend
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// Fallback to serve the Frontend app for any other route
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Export for serverless environments (Vercel)
module.exports = app;

// Only bind to local port if not running on Vercel
if (!process.env.VERCEL) {
    app.listen(PORT, '127.0.0.1', () => {
        console.log(`\n========================================`);
        console.log(`🚀 NavShield Backend Server Running!`);
        console.log(`🌐 Local URL: http://127.0.0.1:${PORT}`);
        console.log(`========================================\n`);
    });
}
