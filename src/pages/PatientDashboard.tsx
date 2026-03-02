import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import {
  generateVitals, classifyStatus, subscribeToVitals, fetchVitalsHistory,
  type VitalSigns,
} from '@/services/vitalsService';
import VitalCard from '@/components/VitalCard';
import ECGWaveform from '@/components/ECGWaveform';
import VitalTrendChart from '@/components/VitalTrendChart';
import AlertPanel, { type VitalAlert } from '@/components/AlertPanel';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Heart, Droplets, Thermometer, Move, LogOut, Activity, Wifi, WifiOff, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface DeviceInfo {
  id: string;
  device_name: string;
  status: string;
  last_seen: string | null;
}

export default function PatientDashboard() {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();
  const [vitals, setVitals] = useState<VitalSigns>(generateVitals());
  const [historicalData, setHistoricalData] = useState<Array<{ time: string; heartRate: number; spo2: number; temperature: number }>>([]);
  const [alerts, setAlerts] = useState<VitalAlert[]>([]);
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [dbAlerts, setDbAlerts] = useState<Array<{ id: string; message: string; level: string; created_at: string }>>([]);

  // Fetch device info
  useEffect(() => {
    (async () => {
      try {
        const d = await api.patient.getDevice();
        setDevice(d);
      } catch { /* no device */ }
    })();
  }, []);

  // Fetch alert history
  useEffect(() => {
    (async () => {
      try {
        const a = await api.patient.getAlerts();
        setDbAlerts(a);
      } catch { /* backend unavailable */ }
    })();
  }, []);

  // Fetch vitals history
  useEffect(() => {
    (async () => {
      const data = await fetchVitalsHistory(user?.id || '', 24);
      setHistoricalData(data);
    })();
  }, [user?.id]);

  // Subscribe to realtime vitals
  useEffect(() => {
    const unsubscribe = subscribeToVitals(user?.id || '', (newVitals) => {
      setVitals(newVitals);
      const status = classifyStatus(newVitals);
      if (status !== 'normal') {
        setAlerts(prev => [{
          id: `A-${Math.random().toString(36).slice(2, 8)}`,
          patientId: user?.id || '',
          patientName: profile?.fullName || 'Patient',
          type: status === 'critical' ? 'CRITICAL' : 'WARNING',
          message: `${status === 'critical' ? 'Critical' : 'Abnormal'} vitals — HR: ${newVitals.heartRate}, SpO₂: ${newVitals.spo2}%`,
          level: status,
          timestamp: new Date(),
        }, ...prev].slice(0, 10));
      }
    });
    return unsubscribe;
  }, [user?.id, profile?.fullName]);

  const isDeviceOnline = device?.last_seen
    ? Date.now() - new Date(device.last_seen).getTime() < 5 * 60 * 1000
    : false;

  const status = classifyStatus(vitals);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Combine realtime alerts with DB alert history
  const allAlerts: VitalAlert[] = [
    ...alerts,
    ...dbAlerts.map(a => ({
      id: a.id,
      patientId: user?.id || '',
      patientName: profile?.fullName || 'Patient',
      type: a.level === 'critical' ? 'CRITICAL' : 'WARNING',
      message: a.message,
      level: a.level as 'warning' | 'critical',
      timestamp: new Date(a.created_at),
    })),
  ].slice(0, 20);

  return (
    <div className="min-h-screen p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">VitalSync</h1>
            <p className="text-xs text-muted-foreground">Welcome, {profile?.fullName || 'Patient'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Device Status Bar */}
      <Card className="border-border/50">
        <CardContent className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isDeviceOnline ? (
              <Badge variant="default" className="gap-1 bg-success/20 text-success border-success/30">
                <Wifi className="w-3 h-3" /> Device Online
              </Badge>
            ) : device ? (
              <Badge variant="secondary" className="gap-1">
                <WifiOff className="w-3 h-3" /> Device Offline
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                No device assigned
              </Badge>
            )}
            {device && <span className="text-xs text-muted-foreground">{device.device_name}</span>}
          </div>
          {device?.last_seen && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              Last sync: {new Date(device.last_seen).toLocaleString()}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <VitalCard title="Heart Rate" value={vitals.heartRate} unit="BPM" icon={Heart}
          status={vitals.heartRate < 60 || vitals.heartRate > 100 ? (vitals.heartRate < 50 || vitals.heartRate > 120 ? 'critical' : 'warning') : 'normal'}
          subtitle="MAX30100" />
        <VitalCard title="SpO₂" value={vitals.spo2} unit="%" icon={Droplets}
          status={vitals.spo2 < 90 ? 'critical' : vitals.spo2 < 95 ? 'warning' : 'normal'}
          subtitle="MAX30100" />
        <VitalCard title="Temperature" value={vitals.temperature} unit="°C" icon={Thermometer}
          status={vitals.temperature > 38.5 ? 'critical' : vitals.temperature > 37.5 ? 'warning' : 'normal'}
          subtitle="MLX90614" />
        <VitalCard title="Motion" value={vitals.motionStatus === 'fall_detected' ? 'FALL!' : vitals.motionStatus === 'active' ? 'Active' : 'Resting'} unit="" icon={Move}
          status={vitals.motionStatus === 'fall_detected' ? 'critical' : 'normal'}
          subtitle="MPU6050" />
      </div>

      <ECGWaveform />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <VitalTrendChart data={historicalData} title="Heart Rate & SpO₂ — Last 24h" dataKeys={['heartRate', 'spo2']} />
          <VitalTrendChart data={historicalData} title="Temperature — Last 24h" dataKeys={['temperature']} />
        </div>
        <AlertPanel alerts={allAlerts} />
      </div>
    </div>
  );
}
