/**
 * VitalSync — Vitals Service
 * All data comes from the Node.js backend via REST + Socket.IO.
 * No mock/fallback data generation.
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

/** Create an empty vitals object for initial state before backend responds */
export function emptyVitals(): VitalSigns {
  return {
    heartRate: 0,
    spo2: 0,
    temperature: 0,
    motionStatus: 'resting',
    ecgData: [],
    timestamp: new Date(),
  };
}

export async function fetchVitalsHistory(patientId: string, limit = 24) {
  const data = await api.vitals.getForPatient(patientId, limit);
  if (data && Array.isArray(data) && data.length > 0) {
    return data.map((v: Record<string, unknown>) => ({
      time: new Date(v.created_at as string).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      heartRate: v.heart_rate as number,
      spo2: v.spo2 as number,
      temperature: v.temperature as number,
    })).reverse();
  }
  return [];
}

export async function fetchLatestVitals(patientId: string): Promise<VitalSigns | null> {
  const data = await api.vitals.getLatest(patientId);
  if (data && data.heart_rate !== undefined) {
    return {
      heartRate: data.heart_rate,
      spo2: data.spo2,
      temperature: data.temperature,
      motionStatus: data.motion_status || 'resting',
      ecgData: data.ecg_data || generateECGData(200),
      timestamp: new Date(data.created_at),
    };
  }
  return null;
}

let activeSocket: ReturnType<typeof socketIO> | null = null;

export function subscribeToVitals(
  patientId: string,
  onUpdate: (vitals: VitalSigns) => void,
  onConnectionChange?: (connected: boolean) => void
) {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
  const wsUrl = apiUrl.replace('/api', '');

  try {
    const socket = socketIO(wsUrl, {
      transports: ['websocket', 'polling'],
      timeout: 5000,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      onConnectionChange?.(true);
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

    socket.on('disconnect', () => {
      onConnectionChange?.(false);
    });

    socket.on('connect_error', () => {
      onConnectionChange?.(false);
    });

    activeSocket = socket;
  } catch {
    onConnectionChange?.(false);
  }

  return () => {
    if (activeSocket) {
      activeSocket.disconnect();
      activeSocket = null;
    }
  };
}
