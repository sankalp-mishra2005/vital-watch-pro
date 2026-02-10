

# IoT Health Monitoring Dashboard

## Overview
A real-time IoT-based health monitoring web application with dark medical-themed UI, featuring separate Admin and Patient dashboards. Starting with mock/simulated sensor data, designed to later connect to Supabase + ESP32.

---

## Phase 1: Frontend with Mock Data (Current Build)

### 1. Authentication & Routing
- Login page with role selection (Admin / Patient)
- Mock authentication (hardcoded demo users)
- Protected routes: `/admin/*` and `/patient/*`
- Redirect based on user role after login

### 2. Patient Dashboard (`/patient`)
- **Vital Signs Cards** — Heart Rate (BPM), SpO₂ (%), Body Temperature (°C), Motion/Fall status with color-coded indicators (Normal/Warning/Critical)
- **Live ECG Waveform** — Animated real-time line chart simulating ECG data using Recharts
- **Heart Rate & SpO₂ Trends** — Line charts showing last 24 hours of data
- **Historical View** — Toggle between daily and weekly chart views
- **Alert Banner** — Shows warnings when vitals exceed safe thresholds

### 3. Admin Dashboard (`/admin`)
- **Patient List** — Table of all registered patients with live status badges (Normal / Warning / Critical)
- **Search & Filter** — Filter patients by name or status
- **Alert/Notification Panel** — Shows recent threshold violations across all patients
- **Patient Detail View** (`/admin/patient/:id`) — Same vital signs display as patient dashboard, viewable by admin for any patient

### 4. UI Design (Dark Medical Theme)
- Dark background with subtle card elevation
- Glowing accent colors: green (normal), amber (warning), red (critical)
- Monospace fonts for numerical readings
- Pulsing animations on live heart rate indicator
- Medical-grade feel inspired by ICU monitors

### 5. Mock Data Engine
- Simulated sensor data that updates every 2-3 seconds
- Randomized but realistic values within medical ranges
- Occasional threshold violations to demonstrate alerts
- Pre-generated historical data for charts

---

## Phase 2: Backend Integration (Future)
- Connect Supabase for PostgreSQL database, auth, and real-time subscriptions
- Role-based access control with user_roles table
- Edge Function endpoint for ESP32 HTTP POST ingestion
- Real-time subscriptions replacing mock data
- Threshold-based alert storage and notification system

---

## Key Pages
| Route | Description |
|---|---|
| `/login` | Login page with role selection |
| `/patient` | Patient vitals dashboard |
| `/patient/history` | Historical charts view |
| `/admin` | Admin patient list + alerts |
| `/admin/patient/:id` | Admin view of individual patient |

