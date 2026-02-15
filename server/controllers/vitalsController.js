const db = require('../config/db');
const { evaluateVitals } = require('../services/alertService');

/**
 * POST /api/vitals — ESP32 ingestion endpoint.
 * Expects: { patientId, heartRate, spo2, temperature, motionStatus, ecgData }
 */
async function ingestVitals(req, res) {
  try {
    const { patientId, heartRate, spo2, temperature, motionStatus, ecgData } = req.body;

    if (!patientId) {
      return res.status(400).json({ error: 'patientId is required' });
    }

    // Insert vitals
    const { rows } = await db.query(
      `INSERT INTO vitals (patient_id, heart_rate, spo2, temperature, motion_status, ecg_data)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [patientId, heartRate, spo2, temperature, motionStatus, ecgData ? JSON.stringify(ecgData) : null]
    );

    const vital = rows[0];

    // Get Socket.IO instance from app
    const io = req.app.get('io');

    // Emit realtime update
    if (io) {
      io.emit('vitals_update', {
        patientId,
        heartRate,
        spo2,
        temperature,
        motionStatus,
        ecgData,
        timestamp: vital.created_at,
      });
    }

    // Evaluate thresholds and trigger alerts
    const status = await evaluateVitals(
      { patientId, heartRate, spo2, temperature, motionStatus },
      io
    );

    res.status(201).json({ id: vital.id, status });
  } catch (err) {
    console.error('Ingest vitals error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/vitals/:patientId — Fetch vitals history.
 */
async function getVitals(req, res) {
  try {
    const { patientId } = req.params;
    const limit = parseInt(req.query.limit) || 100;

    const { rows } = await db.query(
      `SELECT * FROM vitals WHERE patient_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [patientId, limit]
    );

    res.json(rows);
  } catch (err) {
    console.error('Get vitals error:', err);
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
    console.error('Get latest vitals error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { ingestVitals, getVitals, getLatestVitals };
