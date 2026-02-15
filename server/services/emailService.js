const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send a critical alert email to the admin.
 */
async function sendCriticalAlertEmail({ patientName, heartRate, spo2, temperature, timestamp }) {
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#1a1a2e;color:#e0e0e0;border-radius:12px;">
      <h2 style="color:#ff4444;margin:0 0 16px;">🚨 CRITICAL ALERT – ${patientName}</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px;border-bottom:1px solid #333;">Heart Rate</td><td style="padding:8px;border-bottom:1px solid #333;font-weight:bold;">${heartRate} BPM</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #333;">SpO2</td><td style="padding:8px;border-bottom:1px solid #333;font-weight:bold;">${spo2}%</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #333;">Temperature</td><td style="padding:8px;border-bottom:1px solid #333;font-weight:bold;">${temperature}°C</td></tr>
        <tr><td style="padding:8px;">Time</td><td style="padding:8px;font-weight:bold;">${new Date(timestamp).toLocaleString()}</td></tr>
      </table>
      <p style="margin-top:16px;color:#999;font-size:12px;">VitalSync Automated Alert System</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.ALERT_FROM_EMAIL || process.env.SMTP_USER,
      to: process.env.ADMIN_ALERT_EMAIL,
      subject: `CRITICAL ALERT – ${patientName}`,
      html,
    });
    return true;
  } catch (err) {
    console.error('Email send failed:', err.message);
    return false;
  }
}

module.exports = { sendCriticalAlertEmail };
