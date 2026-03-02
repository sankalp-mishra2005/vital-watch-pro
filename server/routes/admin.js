const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { createDeviceSchema, updateThresholdsSchema } = require('../validators/schemas');
const {
  getPatients, approvePatient, suspendPatient,
  getAlerts, resolveAlert, getAlertAnalytics,
  getSystemHealth, getThresholds, updateThreshold,
  getAuditLogs,
} = require('../controllers/adminController');
const { createDevice, listDevices, revokeDevice } = require('../controllers/deviceController');

router.use(authenticate, authorize('admin'));

// Patients
router.get('/patients', getPatients);
router.put('/approve/:id', approvePatient);
router.put('/suspend/:id', suspendPatient);

// Alerts
router.get('/alerts', getAlerts);
router.put('/alerts/:id/resolve', resolveAlert);
router.get('/alerts/analytics', getAlertAnalytics);

// Thresholds
router.get('/thresholds', getThresholds);
router.put('/thresholds', validate(updateThresholdsSchema), updateThreshold);

// Devices
router.get('/devices', listDevices);
router.post('/devices', validate(createDeviceSchema), createDevice);
router.put('/devices/:id/revoke', revokeDevice);

// System
router.get('/system-health', getSystemHealth);
router.get('/audit-logs', getAuditLogs);

module.exports = router;
