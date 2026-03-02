const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth');
const { getProfile, getMyAlerts, getMyDevice } = require('../controllers/patientController');
const { getVitals, getLatestVitals } = require('../controllers/vitalsController');

router.use(authenticate, authorize('patient'));

router.get('/profile', getProfile);
router.get('/vitals', (req, res) => { req.params.patientId = req.user.id; getVitals(req, res); });
router.get('/vitals/latest', (req, res) => { req.params.patientId = req.user.id; getLatestVitals(req, res); });
router.get('/alerts', getMyAlerts);
router.get('/device', getMyDevice);

module.exports = router;
