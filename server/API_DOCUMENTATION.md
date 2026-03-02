# VitalSync API Documentation v2.0

Base URL: `https://your-domain.com/api`

## Authentication

All protected endpoints require: `Authorization: Bearer <access_token>`

### POST /auth/register
Register a new patient account.
```json
// Request
{ "email": "patient@example.com", "password": "securePass123", "fullName": "John Doe", "phoneNumber": "+1234567890" }
// Response 201
{ "message": "Registration successful. Awaiting admin approval.", "user": { "id": "uuid", "full_name": "John Doe", "email": "patient@example.com", "role": "patient", "status": "pending" } }
```

### POST /auth/login
```json
// Request
{ "email": "patient@example.com", "password": "securePass123" }
// Response 200
{ "accessToken": "jwt...", "refreshToken": "hex...", "user": { "id": "uuid", "fullName": "John Doe", "role": "patient", "status": "approved" } }
```

### POST /auth/refresh
```json
// Request
{ "refreshToken": "hex..." }
// Response 200
{ "accessToken": "new-jwt...", "refreshToken": "new-hex..." }
```

### POST /auth/reset-password
```json
// Request
{ "email": "patient@example.com", "newPassword": "newSecure123" }
// Response 200
{ "message": "Password updated successfully" }
```

---

## Admin Endpoints (requires admin role)

### GET /admin/patients?status=approved
Returns patients with device info and latest vitals timestamp.

### PUT /admin/approve/:id
### PUT /admin/suspend/:id

### GET /admin/alerts?resolved=false
### PUT /admin/alerts/:id/resolve
### GET /admin/alerts/analytics
```json
// Response
{ "last_24h": 5, "last_7d": 23, "unresolved": 3, "total": 150 }
```

### GET /admin/thresholds
### PUT /admin/thresholds
```json
{ "metric": "heart_rate", "warningLow": 60, "warningHigh": 100, "criticalLow": 50, "criticalHigh": 120 }
```

### GET /admin/devices
### POST /admin/devices
```json
// Request
{ "patientId": "uuid", "deviceName": "ESP32-Room101" }
// Response 201 — includes apiKey (shown only once)
{ "id": "uuid", "patient_id": "uuid", "device_name": "ESP32-Room101", "apiKey": "vs_abc123..." }
```
### PUT /admin/devices/:id/revoke

### GET /admin/system-health
### GET /admin/audit-logs

---

## Patient Endpoints (requires patient role)

### GET /patient/profile
### GET /patient/vitals?limit=100
### GET /patient/vitals/latest
### GET /patient/alerts
### GET /patient/device

---

## Device Vitals Ingestion (ESP32)

### POST /vitals
**Auth:** `X-API-Key: vs_your_device_api_key`

```json
// Request
{
  "heartRate": 72,
  "spo2": 98,
  "temperature": 36.6,
  "motionStatus": "resting",
  "ecgData": [0.1, 0.2, 1.0, -0.3, ...]
}
// Response 201
{ "id": "uuid", "status": "normal" }
```

**Status values:** `normal`, `warning`, `critical`

---

## Health Check (no auth)

### GET /health
```json
{ "status": "ok", "version": "2.0.0", "uptime": 3600, "timestamp": "2026-03-02T..." }
```

---

## WebSocket Events (Socket.IO)

Connect: `io("wss://your-domain.com")`

| Event | Direction | Payload |
|-------|-----------|---------|
| `join_patient` | Client→Server | `patientId` (string) |
| `join_admin` | Client→Server | — |
| `vitals_update` | Server→Client | `{ patientId, heartRate, spo2, temperature, motionStatus, timestamp }` |
| `critical_alert` | Server→Client | `{ alertId, patientId, patientName, message, timestamp }` |

---

## ESP32 Device Payload Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "heartRate": { "type": "number", "minimum": 0, "maximum": 300, "description": "BPM from MAX30100" },
    "spo2": { "type": "number", "minimum": 0, "maximum": 100, "description": "% from MAX30100" },
    "temperature": { "type": "number", "minimum": 20, "maximum": 50, "description": "°C from MLX90614" },
    "motionStatus": { "type": "string", "enum": ["resting", "active", "fall_detected"], "description": "MPU6050 analysis" },
    "ecgData": { "type": "array", "items": { "type": "number" }, "description": "AD8232 waveform samples" }
  }
}
```

## Device Authentication Flow

1. Admin creates device via `POST /admin/devices` → receives one-time `apiKey`
2. Flash `apiKey` to ESP32 firmware
3. ESP32 sends vitals with `X-API-Key` header
4. Server validates key, links to patient, stores vitals
5. Admin can revoke device at any time via `PUT /admin/devices/:id/revoke`
