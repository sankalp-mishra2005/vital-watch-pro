# VitalSync — Node.js Backend

## Quick Start

```bash
cd server
cp .env.example .env   # Edit with your credentials
npm install
```

### Database Setup

```bash
createdb vitalsync
psql -d vitalsync -f config/schema.sql
```

### Seed Admin Account

```bash
node -e "const bcrypt=require('bcrypt'); bcrypt.hash('admin123',10).then(h=>console.log(h))"
# Copy the hash, then:
psql -d vitalsync -c "INSERT INTO users (full_name,email,password_hash,role,status) VALUES ('Admin','admin@vitalsync.app','PASTE_HASH_HERE','admin','approved')"
```

### Run

```bash
npm run dev    # Development (nodemon)
npm start      # Production
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/register | No | Register patient |
| POST | /api/auth/login | No | Login → JWT |
| POST | /api/auth/reset-password | No | Reset password |
| GET | /api/admin/patients?status=pending | Admin | List patients |
| PUT | /api/admin/approve/:id | Admin | Approve patient |
| PUT | /api/admin/suspend/:id | Admin | Suspend patient |
| GET | /api/admin/alerts | Admin | All alerts |
| GET | /api/admin/audit-logs | Admin | Audit logs |
| GET | /api/patient/profile | Patient | Own profile |
| GET | /api/patient/vitals | Patient | Own vitals |
| POST | /api/vitals | Auth | ESP32 ingestion |
| GET | /api/vitals/:patientId | Auth | Vitals history |

## Socket.IO Events

| Event | Direction | Description |
|-------|-----------|-------------|
| vitals_update | Server → Client | New vitals reading |
| critical_alert | Server → Client | Critical threshold alert |
| join_patient | Client → Server | Subscribe to patient updates |

## Architecture

```
React (Frontend) → REST + WebSocket → Express (Node.js) → PostgreSQL
                                          ↓
                                    Socket.IO realtime
                                          ↓
                                    Email (Nodemailer)
```
