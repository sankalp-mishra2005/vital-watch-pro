/**
 * VitalSync — Vitals Service Abstraction Layer
 *
 * This service abstracts all vitals data access. Currently returns mock data.
 *
 * === HARDWARE INTEGRATION POINT ===
 * When ESP32 + sensors (MPU6050, MAX30100, AD8232, MLX90614) are connected:
 * 1. Replace generateVitals() with a Supabase SELECT from the `vitals` table
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

// ──────────────────────────────────────────────
// Thresholds (shared between mock and future real data)
// ──────────────────────────────────────────────
export const THRESHOLDS = {
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
