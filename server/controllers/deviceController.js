const crypto = require('crypto');
const db = require('../config/db');
const logger = require('../config/logger');

function generateApiKey() {
  return `vs_${crypto.randomBytes(32).toString('hex')}`;
}

async function createDevice(req, res) {
  try {
    const { patientId, deviceName } = req.body;

    // Verify patient exists
    const { rows: check } = await db.query(
      "SELECT id FROM users WHERE id = $1 AND role = 'patient'", [patientId]
    );
    if (check.length === 0) return res.status(404).json({ error: 'Patient not found' });

    const apiKey = generateApiKey();
    const { rows } = await db.query(
      `INSERT INTO devices (patient_id, device_name, api_key)
       VALUES ($1, $2, $3) RETURNING id, patient_id, device_name, status, created_at`,
      [patientId, deviceName, apiKey]
    );

    await db.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)`,
      [req.user.id, 'device_created', JSON.stringify({ deviceId: rows[0].id, patientId })]
    );

    logger.info(`Device created for patient ${patientId}`);
    // Only return API key once at creation time
    res.status(201).json({ ...rows[0], apiKey });
  } catch (err) {
    logger.error('Create device error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function listDevices(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT d.id, d.patient_id, d.device_name, d.status, d.last_seen, d.created_at,
              u.full_name as patient_name
       FROM devices d JOIN users u ON d.patient_id = u.id
       ORDER BY d.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    logger.error('List devices error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function revokeDevice(req, res) {
  try {
    const { id } = req.params;
    const { rowCount } = await db.query(
      "UPDATE devices SET status = 'revoked' WHERE id = $1", [id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Device not found' });

    await db.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)`,
      [req.user.id, 'device_revoked', JSON.stringify({ deviceId: id })]
    );

    logger.info(`Device ${id} revoked`);
    res.json({ message: 'Device revoked' });
  } catch (err) {
    logger.error('Revoke device error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getPatientDevice(req, res) {
  try {
    const patientId = req.user.id;
    const { rows } = await db.query(
      `SELECT id, device_name, status, last_seen, created_at
       FROM devices WHERE patient_id = $1 AND status = 'active'
       ORDER BY created_at DESC LIMIT 1`,
      [patientId]
    );
    res.json(rows[0] || null);
  } catch (err) {
    logger.error('Get patient device error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { createDevice, listDevices, revokeDevice, getPatientDevice };
