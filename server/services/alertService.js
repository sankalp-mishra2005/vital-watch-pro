const db = require('../config/db');
const { sendCriticalAlertEmail } = require('./emailService');

const THRESHOLDS = {
  heartRate: { criticalLow: 50, criticalHigh: 120 },
  spo2: { criticalLow: 90 },
  temperature: { criticalHigh: 38.5 },
};

/**
 * Evaluate vitals and trigger alerts if critical.
 * Returns 'normal' | 'warning' | 'critical'.
 */
async function evaluateVitals({ patientId, heartRate, spo2, temperature, motionStatus }, io) {
  const isCritical =
    motionStatus === 'fall_detected' ||
    heartRate < THRESHOLDS.heartRate.criticalLow ||
    heartRate > THRESHOLDS.heartRate.criticalHigh ||
    spo2 < THRESHOLDS.spo2.criticalLow ||
    temperature > THRESHOLDS.temperature.criticalHigh;

  if (!isCritical) return 'normal';

  // Build alert message
  const parts = [];
  if (heartRate < THRESHOLDS.heartRate.criticalLow || heartRate > THRESHOLDS.heartRate.criticalHigh)
    parts.push(`HR ${heartRate} BPM`);
  if (spo2 < THRESHOLDS.spo2.criticalLow) parts.push(`SpO2 ${spo2}%`);
  if (temperature > THRESHOLDS.temperature.criticalHigh) parts.push(`Temp ${temperature}°C`);
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
    `SELECT full_name FROM users WHERE id = $1`,
    [patientId]
  );
  const patientName = patients[0]?.full_name || 'Unknown';

  // Send email
  const emailSent = await sendCriticalAlertEmail({
    patientName,
    heartRate,
    spo2,
    temperature,
    timestamp: new Date(),
  });

  // Update alert notification status
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

  return 'critical';
}

module.exports = { evaluateVitals };
