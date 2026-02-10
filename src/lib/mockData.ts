export type VitalStatus = 'normal' | 'warning' | 'critical';

export interface VitalSigns {
  heartRate: number;
  spo2: number;
  temperature: number;
  motionStatus: 'resting' | 'active' | 'fall_detected';
  ecgData: number[];
  timestamp: Date;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: 'M' | 'F';
  room: string;
  admittedDate: string;
  vitals: VitalSigns;
  status: VitalStatus;
}

export interface Alert {
  id: string;
  patientId: string;
  patientName: string;
  type: string;
  message: string;
  level: VitalStatus;
  timestamp: Date;
}

// Thresholds
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

function generateECGCycle(): number[] {
  const cycle: number[] = [];
  // P wave
  for (let i = 0; i < 8; i++) cycle.push(Math.sin(i / 8 * Math.PI) * 0.15);
  // PR segment
  for (let i = 0; i < 4; i++) cycle.push(0);
  // QRS complex
  cycle.push(-0.1, -0.2, 1.0, -0.3, -0.1);
  // ST segment
  for (let i = 0; i < 6; i++) cycle.push(0.02);
  // T wave
  for (let i = 0; i < 10; i++) cycle.push(Math.sin(i / 10 * Math.PI) * 0.25);
  // Baseline
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

export function generatePatients(): Patient[] {
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

export function generateAlerts(patients: Patient[]): Alert[] {
  const alerts: Alert[] = [];
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

// Demo users
export const DEMO_USERS = [
  { username: 'admin', password: 'admin123', role: 'admin' as const, name: 'Dr. Admin' },
  { username: 'patient', password: 'patient123', role: 'patient' as const, name: 'Rajesh Kumar', patientId: 'P-001' },
];
