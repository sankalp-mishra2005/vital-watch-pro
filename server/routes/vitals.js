const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { ingestVitals, getVitals, getLatestVitals } = require('../controllers/vitalsController');

// ESP32 ingestion — authenticate with API key or JWT
router.post('/', authenticate, ingestVitals);

// Admin or self can read vitals
router.get('/:patientId', authenticate, getVitals);
router.get('/:patientId/latest', authenticate, getLatestVitals);

module.exports = router;
