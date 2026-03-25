/**
 * VitalSync — Type definitions only.
 * All mock data generators and demo users have been removed.
 * Data comes exclusively from the Node.js backend API.
 */

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
  email: string;
  status: string;
  created_at: string;
  last_seen: string | null;
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
