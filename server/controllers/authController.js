const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/db');
const logger = require('../config/logger');
require('dotenv').config();

const SALT_ROUNDS = 10;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 30;

function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

async function register(req, res) {
  try {
    const { email, password, fullName, phoneNumber } = req.body;

    const { rows: existing } = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows } = await db.query(
      `INSERT INTO users (full_name, email, password_hash, phone_number, role, status)
       VALUES ($1, $2, $3, $4, 'patient', 'pending') RETURNING id, full_name, email, role, status, created_at`,
      [fullName, email, passwordHash, phoneNumber || null]
    );

    await db.query(
      `INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)`,
      [rows[0].id, 'user_registered', JSON.stringify({ email })]
    );

    logger.info(`New user registered: ${email}`);
    res.status(201).json({ message: 'Registration successful. Awaiting admin approval.', user: rows[0] });
  } catch (err) {
    logger.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    const { rows } = await db.query(
      'SELECT id, full_name, email, password_hash, role, status FROM users WHERE email = $1',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    await db.query('UPDATE users SET last_seen = now() WHERE id = $1', [user.id]);

    const accessToken = generateAccessToken(user);

    // Create refresh token
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    await db.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.id, refreshToken, expiresAt]
    );

    logger.info(`User logged in: ${email}`);
    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (err) {
    logger.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function refreshTokenHandler(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

    const { rows } = await db.query(
      `SELECT rt.*, u.email, u.role FROM refresh_tokens rt
       JOIN users u ON rt.user_id = u.id
       WHERE rt.token = $1 AND rt.expires_at > now()`,
      [refreshToken]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const tokenData = rows[0];

    // Rotate refresh token
    const newRefreshToken = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await db.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    await db.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [tokenData.user_id, newRefreshToken, expiresAt]
    );

    const accessToken = generateAccessToken({ id: tokenData.user_id, email: tokenData.email, role: tokenData.role });

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    logger.error('Refresh token error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function resetPassword(req, res) {
  try {
    const { email, newPassword } = req.body;

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const { rowCount } = await db.query(
      'UPDATE users SET password_hash = $1 WHERE email = $2',
      [passwordHash, email]
    );

    if (rowCount === 0) return res.status(404).json({ error: 'User not found' });

    // Invalidate all refresh tokens for this user
    await db.query(
      'DELETE FROM refresh_tokens WHERE user_id = (SELECT id FROM users WHERE email = $1)',
      [email]
    );

    logger.info(`Password reset for: ${email}`);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    logger.error('Reset password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { register, login, refreshTokenHandler, resetPassword };
