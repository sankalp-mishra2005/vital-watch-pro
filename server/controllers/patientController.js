const db = require('../config/db');
const logger = require('../config/logger');

async function getProfile(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT id, full_name, email, phone_number, role, status, last_seen, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
    res.json(rows[0]);
  } catch (err) {
    logger.error('Get profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getMyAlerts(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT * FROM alerts WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    logger.error('Get alerts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getMyDevice(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT id, device_name, status, last_seen, created_at
       FROM devices WHERE patient_id = $1 AND status = 'active'
       ORDER BY created_at DESC LIMIT 1`,
      [req.user.id]
    );
    res.json(rows[0] || null);
  } catch (err) {
    logger.error('Get device error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getProfile, getMyAlerts, getMyDevice };
