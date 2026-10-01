const express = require('express');
const router = express.Router();
const { triggerSOS } = require('../controllers/sosController');
const { getRoutes } = require('../controllers/routeController');

// Health Check
router.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'NavShield Backend API' });
});

// SOS Endpoint
router.post('/sos', triggerSOS);

// Routing Endpoint
router.get('/routes', getRoutes);

module.exports = router;
