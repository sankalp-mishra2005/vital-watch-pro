/**
 * VitalSync — Vitals Service Abstraction Layer
 * 
 * This service abstracts all vitals data access. Currently returns mock data.
 * 
 * === HARDWARE INTEGRATION POINT ===
 * When ESP32 + sensors (MPU6050, MAX30100, AD8232, MLX90614) are connected:
 * 1. Replace getMockVitals() with a Supabase SELECT from the `vitals` table
 * 2. Replace subscribeToVitals() with a Supabase Realtime subscription
 * 3. The ESP32 will POST data via an Edge Function that INSERTs into `vitals`
 * 4. No dashboard component changes needed — only this file changes
 * ===================================
 */

import { supabase } from '@/integrations/supabase/client';

export type VitalStatus = 'normal' | 'warning' | 'critical';

export interface VitalSigns {
  heartRate: number;
  spo2: number;
  temperature: number;
  motionStatus: 'resting' | 'active' | 'fall_detected';
  ecgData: number[];
  timestamp: Date;
}

export interface PatientWithVitals {
  id: string;
  name: string;
  age: number;
  gender: 'M' | 'F';
  room: string;
  admittedDate: string;
  vitals: VitalSigns;
  status: VitalStatus;
}

export interface VitalAlert {
  id: string;
  patientId: string;
  patientName: string;
  type: string;
  message: string;
  level: VitalStatus;
  timestamp: Date;
}

// ──────────────────────────────────────────────
// Thresholds (shared between mock and future real data)
// ──────────────────────────────────────────────
const THRESHOLDS = {
  heartRate: { low: 60, high: 100, criticalLow: 50, criticalHigh: 120 },
  spo2: { low: 95, criticalLow: 90 },
  temperature: { low: 36.1, high: 37.5, criticalHigh: 38.5 },
};

export function classifyStatus(vitals: VitalSigns): VitalStatus {
  const { heartRate, spo2, temperature, motionStatus } = vitals;
  if (
    motionStatus === 'fall_detected' ||
    heartRate < THRESHOLDS.heartRate.criticalLow || heartRate > THRESHOLDS.heartRate.criticalHigh ||
    spo2 < THRESHOLDS.spo2.criticalLow ||
    temperature > THRESHOLDS.temperature.criticalHigh
  ) return 'critical';
  if (
    heartRate < THRESHOLDS.heartRate.low || heartRate > THRESHOLDS.heartRate.high ||
    spo2 < THRESHOLDS.spo2.low ||
    temperature < THRESHOLDS.temperature.low || temperature > THRESHOLDS.temperature.high
  ) return 'warning';
  return 'normal';
}

// ──────────────────────────────────────────────
// ECG Simulation (will be replaced by AD8232 data)
// ──────────────────────────────────────────────
function generateECGCycle(): number[] {
  const cycle: number[] = [];
  for (let i = 0; i < 8; i++) cycle.push(Math.sin(i / 8 * Math.PI) * 0.15);
  for (let i = 0; i < 4; i++) cycle.push(0);
  cycle.push(-0.1, -0.2, 1.0, -0.3, -0.1);
  for (let i = 0; i < 6; i++) cycle.push(0.02);
  for (let i = 0; i < 10; i++) cycle.push(Math.sin(i / 10 * Math.PI) * 0.25);
  for (let i = 0; i < 12; i++) cycle.push(0);
  return cycle;
}

export function generateECGData(points = 200): number[] {
  const data: number[] = [];
  const cycle = generateECGCycle();
  while (data.length < points) {
    for (const v of cycle) {
      data.push(v + (Math.random() - 0.5) * 0.03);
      if (data.length >= points) break;
    }
  }
  return data;
}

function randomInRange(min: number, max: number) {
  return Math.round((min + Math.random() * (max - min)) * 10) / 10;
}

// ──────────────────────────────────────────────
// Mock Vitals Generator
// HARDWARE SWAP: Replace this function body with:
//   const { data } = await supabase.from('vitals').select('*')
//     .eq('patient_id', patientId).order('created_at', { ascending: false }).limit(1);
// ──────────────────────────────────────────────
export function generateVitals(biasTowardsAbnormal = false): VitalSigns {
  const abnormal = biasTowardsAbnormal && Math.random() < 0.3;
  return {
    heartRate: abnormal
      ? Math.random() < 0.5 ? randomInRange(45, 55) : randomInRange(110, 130)
      : randomInRange(62, 98),
    spo2: abnormal ? randomInRange(88, 94) : randomInRange(95, 100),
    temperature: abnormal ? randomInRange(37.8, 39.2) : randomInRange(36.2, 37.4),
    motionStatus: abnormal && Math.random() < 0.1 ? 'fall_detected' : Math.random() < 0.3 ? 'active' : 'resting',
    ecgData: generateECGData(200),
    timestamp: new Date(),
  };
}

export function generateHistoricalData(hours = 24) {
  const data = [];
  const now = Date.now();
  for (let i = hours; i >= 0; i--) {
    const t = new Date(now - i * 3600000);
    data.push({
      time: t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      heartRate: randomInRange(62, 100),
      spo2: randomInRange(94, 100),
      temperature: randomInRange(36.0, 37.6),
    });
  }
  return data;
}

// ──────────────────────────────────────────────
// Mock Patient List (for Admin dashboard)
// HARDWARE SWAP: Replace with Supabase query joining profiles + latest vitals
// ──────────────────────────────────────────────
const PATIENT_NAMES = [
  { name: 'Rajesh Kumar', age: 58, gender: 'M' as const },
  { name: 'Priya Sharma', age: 34, gender: 'F' as const },
  { name: 'Arun Patel', age: 72, gender: 'M' as const },
  { name: 'Meena Devi', age: 45, gender: 'F' as const },
  { name: 'Vikram Singh', age: 63, gender: 'M' as const },
  { name: 'Lakshmi Iyer', age: 51, gender: 'F' as const },
  { name: 'Suresh Reddy', age: 67, gender: 'M' as const },
  { name: 'Ananya Das', age: 29, gender: 'F' as const },
];

export function generatePatients(): PatientWithVitals[] {
  return PATIENT_NAMES.map((p, i) => {
    const vitals = generateVitals(i % 3 === 0);
    return {
      id: `P-${String(i + 1).padStart(3, '0')}`,
      name: p.name,
      age: p.age,
      gender: p.gender,
      room: `${100 + i + 1}`,
      admittedDate: new Date(Date.now() - (Math.random() * 7 + 1) * 86400000).toISOString().split('T')[0],
      vitals,
      status: classifyStatus(vitals),
    };
  });
}

export function generateAlerts(patients: PatientWithVitals[]): VitalAlert[] {
  const alerts: VitalAlert[] = [];
  patients.forEach(p => {
    if (p.status === 'critical') {
      alerts.push({
        id: `A-${Math.random().toString(36).slice(2, 8)}`,
        patientId: p.id,
        patientName: p.name,
        type: 'CRITICAL',
        message: p.vitals.motionStatus === 'fall_detected'
          ? `Fall detected for ${p.name} in Room ${p.room}`
          : `Critical vitals detected for ${p.name} — HR: ${p.vitals.heartRate}, SpO₂: ${p.vitals.spo2}%`,
        level: 'critical',
        timestamp: new Date(Date.now() - Math.random() * 600000),
      });
    } else if (p.status === 'warning') {
      alerts.push({
        id: `A-${Math.random().toString(36).slice(2, 8)}`,
        patientId: p.id,
        patientName: p.name,
        type: 'WARNING',
        message: `Abnormal vitals for ${p.name} — HR: ${p.vitals.heartRate}, SpO₂: ${p.vitals.spo2}%`,
        level: 'warning',
        timestamp: new Date(Date.now() - Math.random() * 1200000),
      });
    }
  });
  return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

// ──────────────────────────────────────────────
// Realtime Subscription Placeholder
// HARDWARE SWAP: Uncomment and use this when hardware sends data
// ──────────────────────────────────────────────
export function subscribeToVitals(
  patientId: string,
  onUpdate: (vitals: VitalSigns) => void
) {
  // === MOCK MODE: Simulate updates every 3 seconds ===
  const interval = setInterval(() => {
    onUpdate(generateVitals(true));
  }, 3000);

  return () => clearInterval(interval);

  // === HARDWARE MODE (uncomment when ready): ===
  // const channel = supabase
  //   .channel(`vitals-${patientId}`)
  //   .on('postgres_changes', {
  //     event: 'INSERT',
  //     schema: 'public',
  //     table: 'vitals',
  //     filter: `patient_id=eq.${patientId}`,
  //   }, (payload) => {
  //     const row = payload.new;
  //     onUpdate({
  //       heartRate: row.heart_rate,
  //       spo2: row.spo2,
  //       temperature: row.temperature,
  //       motionStatus: row.motion_status,
  //       ecgData: row.ecg_data || [],
  //       timestamp: new Date(row.created_at),
  //     });
  //   })
  //   .subscribe();
  //
  // return () => { supabase.removeChannel(channel); };
}
