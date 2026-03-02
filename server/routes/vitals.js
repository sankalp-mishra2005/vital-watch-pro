const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const { authenticateDevice } = require('../middlewares/deviceAuth');
const { validate } = require('../middlewares/validate');
const { vitalsIngestSchema } = require('../validators/schemas');
const { ingestVitals, getVitals, getLatestVitals } = require('../controllers/vitalsController');
const { vitalsLimiter } = require('../middlewares/rateLimiter');

// ESP32 device ingestion — authenticated via API key
router.post('/', vitalsLimiter, authenticateDevice, validate(vitalsIngestSchema), ingestVitals);

// Admin or self can read vitals (JWT auth)
router.get('/:patientId', authenticate, getVitals);
router.get('/:patientId/latest', authenticate, getLatestVitals);

module.exports = router;
