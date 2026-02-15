-- VitalSync Database Schema
-- Run: psql -d vitalsync -f schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table (replaces Supabase auth.users + profiles + user_roles)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  phone_number TEXT,
  role TEXT NOT NULL DEFAULT 'patient' CHECK (role IN ('admin', 'patient')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'suspended')),
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vitals table
CREATE TABLE IF NOT EXISTS vitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  heart_rate DOUBLE PRECISION,
  spo2 DOUBLE PRECISION,
  temperature DOUBLE PRECISION,
  motion_status TEXT,
  ecg_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vitals_patient ON vitals(patient_id);
CREATE INDEX idx_vitals_created ON vitals(created_at DESC);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'warning' CHECK (level IN ('warning', 'critical')),
  notified_email BOOLEAN NOT NULL DEFAULT false,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alerts_patient ON alerts(patient_id);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);

-- Seed admin account (password: admin123 — change in production!)
-- Hash generated with bcrypt rounds=10
-- INSERT INTO users (full_name, email, password_hash, role, status)
-- VALUES ('Admin', 'admin@vitalsync.app', '$2b$10$...', 'admin', 'approved');
