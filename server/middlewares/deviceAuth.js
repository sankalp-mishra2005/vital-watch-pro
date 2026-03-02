const db = require('../config/db');
const logger = require('../config/logger');

/**
 * Authenticate ESP32 devices via X-API-Key header.
 * Attaches device and patient info to req.
 */
async function authenticateDevice(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing X-API-Key header' });
  }

  try {
    const { rows } = await db.query(
      `SELECT d.id as device_id, d.patient_id, d.device_name, d.status, u.full_name as patient_name
       FROM devices d JOIN users u ON d.patient_id = u.id
       WHERE d.api_key = $1`,
      [apiKey]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const device = rows[0];
    if (device.status !== 'active') {
      return res.status(403).json({ error: 'Device has been revoked' });
    }

    // Update device last_seen
    await db.query('UPDATE devices SET last_seen = now() WHERE id = $1', [device.device_id]);

    req.device = device;
    next();
  } catch (err) {
    logger.error('Device auth error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { authenticateDevice };
