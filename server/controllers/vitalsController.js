const db = require('../config/db');
const { evaluateVitals } = require('../services/alertService');
const logger = require('../config/logger');

/**
 * POST /api/vitals — Device ingestion endpoint.
 * Authenticated via X-API-Key (device middleware).
 */
async function ingestVitals(req, res) {
  try {
    const { heartRate, spo2, temperature, motionStatus, ecgData } = req.body;
    const { device_id, patient_id } = req.device;

    const { rows } = await db.query(
      `INSERT INTO vitals (patient_id, device_id, heart_rate, spo2, temperature, motion_status, ecg_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [patient_id, device_id, heartRate, spo2, temperature, motionStatus, ecgData ? JSON.stringify(ecgData) : null]
    );

    const vital = rows[0];
    const io = req.app.get('io');

    if (io) {
      io.to(`patient_${patient_id}`).emit('vitals_update', {
        patientId: patient_id,
        heartRate, spo2, temperature, motionStatus, ecgData,
        timestamp: vital.created_at,
      });
      // Also broadcast to admin room
      io.to('admin').emit('vitals_update', {
        patientId: patient_id,
        heartRate, spo2, temperature, motionStatus,
        timestamp: vital.created_at,
      });
    }

    const status = await evaluateVitals(
      { patientId: patient_id, heartRate, spo2, temperature, motionStatus }, io
    );

    res.status(201).json({ id: vital.id, status });
  } catch (err) {
    logger.error('Ingest vitals error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/vitals/:patientId — Fetch vitals history.
 */
async function getVitals(req, res) {
  try {
    const { patientId } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
    const { rows } = await db.query(
      `SELECT * FROM vitals WHERE patient_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [patientId, limit]
    );
    res.json(rows);
  } catch (err) {
    logger.error('Get vitals error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/vitals/:patientId/latest — Latest single reading.
 */
async function getLatestVitals(req, res) {
  try {
    const { patientId } = req.params;
    const { rows } = await db.query(
      `SELECT * FROM vitals WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [patientId]
    );
    res.json(rows[0] || null);
  } catch (err) {
    logger.error('Get latest vitals error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { ingestVitals, getVitals, getLatestVitals };
