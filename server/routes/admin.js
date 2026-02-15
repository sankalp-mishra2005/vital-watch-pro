const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth');
const { getPatients, approvePatient, suspendPatient, getAlerts, getAuditLogs } = require('../controllers/adminController');

router.use(authenticate, authorize('admin'));

router.get('/patients', getPatients);
router.put('/approve/:id', approvePatient);
router.put('/suspend/:id', suspendPatient);
router.get('/alerts', getAlerts);
router.get('/audit-logs', getAuditLogs);

module.exports = router;
