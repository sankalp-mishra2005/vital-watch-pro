const db = require('../config/db');
const { sendCriticalAlertEmail } = require('./emailService');
const logger = require('../config/logger');

// In-memory cooldown tracker: { patientId: lastAlertTimestamp }
const alertCooldowns = new Map();
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between alerts per patient

/**
 * Load thresholds from DB (cached for 60s).
 */
let cachedThresholds = null;
let thresholdsCachedAt = 0;

async function getThresholds() {
  if (cachedThresholds && Date.now() - thresholdsCachedAt < 60000) {
    return cachedThresholds;
  }
  const { rows } = await db.query('SELECT * FROM alert_thresholds');
  const map = {};
  for (const r of rows) {
    map[r.metric] = {
      warningLow: r.warning_low,
      warningHigh: r.warning_high,
      criticalLow: r.critical_low,
      criticalHigh: r.critical_high,
    };
  }
  cachedThresholds = map;
  thresholdsCachedAt = Date.now();
  return map;
}

/**
 * Evaluate vitals and trigger alerts if critical.
 * Returns 'normal' | 'warning' | 'critical'.
 */
async function evaluateVitals({ patientId, heartRate, spo2, temperature, motionStatus }, io) {
  const thresholds = await getThresholds();
  const hr = thresholds.heart_rate || { criticalLow: 50, criticalHigh: 120 };
  const sp = thresholds.spo2 || { criticalLow: 90 };
  const tmp = thresholds.temperature || { criticalHigh: 38.5 };

  const isCritical =
    motionStatus === 'fall_detected' ||
    (heartRate != null && (heartRate < hr.criticalLow || heartRate > hr.criticalHigh)) ||
    (spo2 != null && spo2 < sp.criticalLow) ||
    (temperature != null && temperature > tmp.criticalHigh);

  if (!isCritical) return 'normal';

  // Cooldown check
  const lastAlert = alertCooldowns.get(patientId);
  if (lastAlert && Date.now() - lastAlert < COOLDOWN_MS) {
    logger.info(`Alert cooldown active for patient ${patientId}, skipping`);
    return 'critical'; // Still critical, but don't spam
  }
  alertCooldowns.set(patientId, Date.now());

  // Build alert message
  const parts = [];
  if (heartRate != null && (heartRate < hr.criticalLow || heartRate > hr.criticalHigh))
    parts.push(`HR ${heartRate} BPM`);
  if (spo2 != null && spo2 < sp.criticalLow) parts.push(`SpO2 ${spo2}%`);
  if (temperature != null && temperature > tmp.criticalHigh) parts.push(`Temp ${temperature}°C`);
  if (motionStatus === 'fall_detected') parts.push('Fall detected');

  const message = `CRITICAL: ${parts.join(', ')}`;

  // Insert alert
  const { rows } = await db.query(
    `INSERT INTO alerts (patient_id, message, level) VALUES ($1, $2, 'critical') RETURNING id`,
    [patientId, message]
  );
  const alertId = rows[0].id;

  // Get patient info
  const { rows: patients } = await db.query(
    `SELECT full_name FROM users WHERE id = $1`, [patientId]
  );
  const patientName = patients[0]?.full_name || 'Unknown';

  // Send email
  const emailSent = await sendCriticalAlertEmail({
    patientName, heartRate, spo2, temperature, timestamp: new Date(),
  });

  await db.query(`UPDATE alerts SET notified_email = $1 WHERE id = $2`, [emailSent, alertId]);

  // Audit log
  await db.query(
    `INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)`,
    [patientId, 'critical_alert_triggered', JSON.stringify({ alertId, message, emailSent })]
  );

  // Emit to all connected clients
  if (io) {
    io.emit('critical_alert', { alertId, patientId, patientName, message, timestamp: new Date() });
  }

  logger.warn(`Critical alert for ${patientName}: ${message}`);
  return 'critical';
}

// Invalidate threshold cache when admin updates
function invalidateThresholdCache() {
  cachedThresholds = null;
}

module.exports = { evaluateVitals, getThresholds, invalidateThresholdCache };
