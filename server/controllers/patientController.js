const db = require('../config/db');

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
    console.error('Get profile error:', err);
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
    console.error('Get alerts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getProfile, getMyAlerts };
