const db = require('../config/db');

async function getPatients(req, res) {
  try {
    const { status } = req.query; // ?status=approved or ?status=pending
    let query = `SELECT id, full_name, email, phone_number, status, last_seen, created_at
                 FROM users WHERE role = 'patient'`;
    const params = [];

    if (status) {
      query += ` AND status = $1`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC`;
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Get patients error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function approvePatient(req, res) {
  try {
    const { id } = req.params;

    // Ensure target is a patient
    const { rows: check } = await db.query('SELECT role FROM users WHERE id = $1', [id]);
    if (check.length === 0) return res.status(404).json({ error: 'User not found' });
    if (check[0].role !== 'patient') return res.status(403).json({ error: 'Cannot modify admin accounts' });

    await db.query("UPDATE users SET status = 'approved' WHERE id = $1", [id]);

    await db.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)`,
      [req.user.id, 'patient_approved', JSON.stringify({ patientId: id })]
    );

    res.json({ message: 'Patient approved' });
  } catch (err) {
    console.error('Approve error:', err);
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
    console.error('Suspend error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getAlerts(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT a.*, u.full_name as patient_name
       FROM alerts a JOIN users u ON a.patient_id = u.id
       ORDER BY a.created_at DESC LIMIT 100`
    );
    res.json(rows);
  } catch (err) {
    console.error('Get alerts error:', err);
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
    console.error('Get audit logs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { getPatients, approvePatient, suspendPatient, getAlerts, getAuditLogs };
