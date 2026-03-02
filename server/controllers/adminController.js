const db = require('../config/db');
const logger = require('../config/logger');
const { invalidateThresholdCache } = require('../services/alertService');

async function getPatients(req, res) {
  try {
    const { status } = req.query;
    let query = `
      SELECT u.id, u.full_name, u.email, u.phone_number, u.status, u.last_seen, u.created_at,
             d.device_name, d.status as device_status, d.last_seen as device_last_seen,
             (SELECT created_at FROM vitals WHERE patient_id = u.id ORDER BY created_at DESC LIMIT 1) as last_vitals_at
      FROM users u
      LEFT JOIN devices d ON d.patient_id = u.id AND d.status = 'active'
      WHERE u.role = 'patient'`;
    const params = [];
    if (status) { query += ` AND u.status = $1`; params.push(status); }
    query += ` ORDER BY u.created_at DESC`;
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    logger.error('Get patients error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function approvePatient(req, res) {
  try {
    const { id } = req.params;
    const { rows: check } = await db.query('SELECT role FROM users WHERE id = $1', [id]);
    if (check.length === 0) return res.status(404).json({ error: 'User not found' });
    if (check[0].role !== 'patient') return res.status(403).json({ error: 'Cannot modify admin accounts' });

    await db.query("UPDATE users SET status = 'approved' WHERE id = $1", [id]);
    await db.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)`,
      [req.user.id, 'patient_approved', JSON.stringify({ patientId: id })]
    );

    logger.info(`Patient ${id} approved by ${req.user.id}`);
    res.json({ message: 'Patient approved' });
  } catch (err) {
    logger.error('Approve error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function suspendPatient(req, res) {
  try {
    const { id } = req.params;
    const { rows: check } = await db.query('SELECT role FROM users WHERE id = $1', [id]);
    if (check.length === 0) return res.status(404).json({ error: 'User not found' });
    if (check[0].role !== 'patient') return res.status(403).json({ error: 'Cannot modify admin accounts' });

    await db.query("UPDATE users SET status = 'suspended' WHERE id = $1", [id]);
    await db.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)`,
      [req.user.id, 'patient_suspended', JSON.stringify({ patientId: id })]
    );
    res.json({ message: 'Patient suspended' });
  } catch (err) {
    logger.error('Suspend error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getAlerts(req, res) {
  try {
    const { resolved } = req.query;
    let query = `SELECT a.*, u.full_name as patient_name
       FROM alerts a JOIN users u ON a.patient_id = u.id`;
    const params = [];
    if (resolved !== undefined) {
      query += ` WHERE a.resolved = $1`;
      params.push(resolved === 'true');
    }
    query += ` ORDER BY a.created_at DESC LIMIT 100`;
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    logger.error('Get alerts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function resolveAlert(req, res) {
  try {
    const { id } = req.params;
    const { rowCount } = await db.query(
      `UPDATE alerts SET resolved = true, resolved_by = $1, resolved_at = now() WHERE id = $2`,
      [req.user.id, id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Alert not found' });
    res.json({ message: 'Alert resolved' });
  } catch (err) {
    logger.error('Resolve alert error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getAlertAnalytics(req, res) {
  try {
    const { rows } = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours') as last_24h,
        COUNT(*) FILTER (WHERE created_at > now() - interval '7 days') as last_7d,
        COUNT(*) FILTER (WHERE resolved = false) as unresolved,
        COUNT(*) as total
      FROM alerts
    `);
    res.json(rows[0]);
  } catch (err) {
    logger.error('Alert analytics error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getSystemHealth(req, res) {
  try {
    const [patients, devices, vitals] = await Promise.all([
      db.query("SELECT COUNT(*) as count FROM users WHERE role = 'patient' AND status = 'approved'"),
      db.query("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE last_seen > now() - interval '5 minutes') as online FROM devices WHERE status = 'active'"),
      db.query("SELECT COUNT(*) as count FROM vitals WHERE created_at > now() - interval '1 hour'"),
    ]);
    res.json({
      approvedPatients: parseInt(patients.rows[0].count),
      totalDevices: parseInt(devices.rows[0].total),
      onlineDevices: parseInt(devices.rows[0].online),
      vitalsLastHour: parseInt(vitals.rows[0].count),
      serverUptime: process.uptime(),
      timestamp: new Date(),
    });
  } catch (err) {
    logger.error('System health error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getThresholds(req, res) {
  try {
    const { rows } = await db.query('SELECT * FROM alert_thresholds ORDER BY metric');
    res.json(rows);
  } catch (err) {
    logger.error('Get thresholds error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function updateThreshold(req, res) {
  try {
    const { metric, warningLow, warningHigh, criticalLow, criticalHigh } = req.body;
    await db.query(
      `UPDATE alert_thresholds SET warning_low = $1, warning_high = $2, critical_low = $3, critical_high = $4,
       updated_by = $5, updated_at = now() WHERE metric = $6`,
      [warningLow, warningHigh, criticalLow, criticalHigh, req.user.id, metric]
    );
    invalidateThresholdCache();
    res.json({ message: 'Threshold updated' });
  } catch (err) {
    logger.error('Update threshold error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getAuditLogs(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT al.*, u.full_name as user_name
       FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id
       ORDER BY al.created_at DESC LIMIT 200`
    );
    res.json(rows);
  } catch (err) {
    logger.error('Get audit logs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getPatients, approvePatient, suspendPatient,
  getAlerts, resolveAlert, getAlertAnalytics,
  getSystemHealth, getThresholds, updateThreshold,
  getAuditLogs,
};
