# VitalSync Deployment Guide

## Option 1: Docker Compose (Recommended)

```bash
cd server
cp .env.example .env  # Edit with production values
docker-compose up -d
```

## Option 2: Railway

1. Push `server/` to a Git repo
2. Create new Railway project → "Deploy from GitHub"
3. Add PostgreSQL plugin
4. Set environment variables:
   - `DATABASE_URL` (auto-set by Railway PostgreSQL)
   - `JWT_SECRET`, `CLIENT_URL`, SMTP vars
5. Set start command: `npm start`
6. Run `config/schema.sql` via Railway's DB console

## Option 3: Render

1. Create **Web Service** → connect repo, set root to `server/`
2. Build: `npm install`, Start: `node server.js`
3. Create **PostgreSQL** database
4. Set env vars (Render auto-provides `DATABASE_URL`)
5. Run schema via Render's PSQL shell

## Option 4: VPS (PM2)

```bash
# Install Node.js 20+, PostgreSQL 16+
sudo apt update && sudo apt install -y nodejs postgresql

# Setup database
sudo -u postgres createdb vitalsync
psql -d vitalsync -f config/schema.sql

# Seed admin
node -e "const b=require('bcrypt');b.hash('admin123',10).then(h=>console.log(h))"
psql -d vitalsync -c "INSERT INTO users (full_name,email,password_hash,role,status) VALUES ('Admin','admin@vitalsync.app','PASTE_HASH','admin','approved')"

# Install & start
npm install
cp .env.example .env  # Edit values
npm install -g pm2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

## Post-Deploy Checklist

- [ ] Set strong `JWT_SECRET` (32+ chars)
- [ ] Configure SMTP for email alerts
- [ ] Set `CLIENT_URL` to your frontend domain
- [ ] Set `NODE_ENV=production`
- [ ] Run database schema migration
- [ ] Seed admin account
- [ ] Verify `/api/health` returns `{ status: "ok" }`
- [ ] Configure SSL (nginx reverse proxy or platform-provided)
