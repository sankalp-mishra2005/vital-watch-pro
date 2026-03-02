/**
 * VitalSync — Vitals Service Abstraction Layer
 *
 * Connected to Node.js backend via REST API + Socket.IO.
 * When ESP32 hardware is connected, vitals flow through the backend automatically.
 * For development/demo without hardware, falls back to mock data generation.
 */

import api from '@/lib/api';
import { io as socketIO } from 'socket.io-client';

export type VitalStatus = 'normal' | 'warning' | 'critical';

export interface VitalSigns {
  heartRate: number;
  spo2: number;
  temperature: number;
  motionStatus: 'resting' | 'active' | 'fall_detected';
  ecgData: number[];
  timestamp: Date;
}

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

export async function fetchVitalsHistory(patientId: string, limit = 24) {
  try {
    const data = await api.vitals.getForPatient(patientId, limit);
    if (data && data.length > 0) {
      return data.map((v: Record<string, unknown>) => ({
        time: new Date(v.created_at as string).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        heartRate: v.heart_rate as number,
        spo2: v.spo2 as number,
        temperature: v.temperature as number,
      })).reverse();
    }
  } catch {
    // Backend not available
  }
  return generateHistoricalData(limit);
}

export async function fetchLatestVitals(patientId: string): Promise<VitalSigns> {
  try {
    const data = await api.vitals.getLatest(patientId);
    if (data) {
      return {
        heartRate: data.heart_rate,
        spo2: data.spo2,
        temperature: data.temperature,
        motionStatus: data.motion_status || 'resting',
        ecgData: data.ecg_data || generateECGData(200),
        timestamp: new Date(data.created_at),
      };
    }
  } catch {
    // Backend not available
  }
  return generateVitals();
}

// Global socket ref for cleanup
let activeSocket: ReturnType<typeof socketIO> | null = null;

export function subscribeToVitals(
  patientId: string,
  onUpdate: (vitals: VitalSigns) => void
) {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
  const wsUrl = apiUrl.replace('/api', '');

  let interval: ReturnType<typeof setInterval> | null = null;
  let connected = false;

  function startMockUpdates() {
    if (!interval) {
      interval = setInterval(() => {
        onUpdate(generateVitals(true));
      }, 3000);
    }
  }

  try {
    const socket = socketIO(wsUrl, {
      transports: ['websocket', 'polling'],
      timeout: 3000,
      reconnectionAttempts: 3,
    });

    socket.on('connect', () => {
      connected = true;
      console.log('[VitalSync] Socket connected');
      socket.emit('join_patient', patientId);
    });

    socket.on('vitals_update', (data: Record<string, unknown>) => {
      if (data.patientId === patientId) {
        onUpdate({
          heartRate: data.heartRate as number,
          spo2: data.spo2 as number,
          temperature: data.temperature as number,
          motionStatus: (data.motionStatus as VitalSigns['motionStatus']) || 'resting',
          ecgData: (data.ecgData as number[]) || generateECGData(200),
          timestamp: new Date(data.timestamp as string),
        });
      }
    });

    socket.on('connect_error', () => {
      if (!connected) startMockUpdates();
    });

    activeSocket = socket;
  } catch {
    startMockUpdates();
  }

  // If no socket connects within 3s, start mock
  const mockTimeout = setTimeout(() => {
    if (!connected) startMockUpdates();
  }, 3000);

  return () => {
    clearTimeout(mockTimeout);
    if (interval) clearInterval(interval);
    if (activeSocket) {
      activeSocket.disconnect();
      activeSocket = null;
    }
  };
}
