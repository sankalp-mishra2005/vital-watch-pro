# VitalSync — Node.js Backend v2.0

Production-ready IoT Health Monitoring API.

## Quick Start

```bash
cd server
cp .env.example .env   # Edit with your credentials
npm install
npm run db:setup       # Requires PostgreSQL running
npm run dev
```

## Architecture

```
ESP32 Sensors ──► POST /api/vitals (X-API-Key auth)
                         │
React Frontend ◄── REST + Socket.IO ──► Express.js
                         │
                    PostgreSQL
                         │
              ┌──────────┼──────────┐
          Vitals DB   Alert Engine   Email (Nodemailer)
```

## Key Features

- **JWT Auth** with refresh token rotation (15m access / 30d refresh)
- **Device Management** — secure API key per ESP32, revocable
- **Configurable Thresholds** — admin-adjustable alert levels
- **Alert Cooldown** — prevents duplicate alert spam (5min per patient)
- **Rate Limiting** — 100 req/15min API, 60 req/min vitals, 20 req/15min auth
- **Helmet** security headers
- **Winston** structured logging
- **Joi** request validation

## Docs

- [API Documentation](./API_DOCUMENTATION.md)
- [Deployment Guide](./DEPLOYMENT.md)
