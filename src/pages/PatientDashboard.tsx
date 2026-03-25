import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import {
  classifyStatus, subscribeToVitals, fetchVitalsHistory, fetchLatestVitals, emptyVitals,
  type VitalSigns,
} from '@/services/vitalsService';
import VitalCard from '@/components/VitalCard';
import ECGWaveform from '@/components/ECGWaveform';
import VitalTrendChart from '@/components/VitalTrendChart';
import AlertPanel, { type VitalAlert } from '@/components/AlertPanel';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Heart, Droplets, Thermometer, Move, LogOut, Activity, Wifi, WifiOff, Clock, AlertTriangle } from 'lucide-react';
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
  const [vitals, setVitals] = useState<VitalSigns | null>(null);
  const [historicalData, setHistoricalData] = useState<Array<{ time: string; heartRate: number; spo2: number; temperature: number }>>([]);
  const [alerts, setAlerts] = useState<VitalAlert[]>([]);
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [dbAlerts, setDbAlerts] = useState<Array<{ id: string; message: string; level: string; created_at: string }>>([]);
  const [socketConnected, setSocketConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const d = await api.patient.getDevice();
        setDevice(d);
      } catch { /* no device */ }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const a = await api.patient.getAlerts();
        setDbAlerts(a);
      } catch { /* backend unavailable */ }
    })();
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const data = await fetchVitalsHistory(user.id, 24);
        setHistoricalData(data);
      } catch {
        setError('Unable to load vitals history.');
      }
    })();
  }, [user?.id]);

  // Load latest vitals from DB
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const latest = await fetchLatestVitals(user.id);
        if (latest) setVitals(latest);
      } catch {
        // No vitals yet
      }
    })();
  }, [user?.id]);

  // Subscribe to realtime vitals
  useEffect(() => {
    if (!user?.id) return;
    const unsubscribe = subscribeToVitals(
      user.id,
      (newVitals) => {
        setVitals(newVitals);
        const status = classifyStatus(newVitals);
        if (status !== 'normal') {
          setAlerts(prev => [{
            id: `A-${Math.random().toString(36).slice(2, 8)}`,
            patientId: user.id,
            patientName: profile?.fullName || 'Patient',
            type: status === 'critical' ? 'CRITICAL' : 'WARNING',
            message: `${status === 'critical' ? 'Critical' : 'Abnormal'} vitals — HR: ${newVitals.heartRate}, SpO₂: ${newVitals.spo2}%`,
            level: status,
            timestamp: new Date(),
          }, ...prev].slice(0, 10));
        }
      },
      setSocketConnected
    );
    return unsubscribe;
  }, [user?.id, profile?.fullName]);

  const currentVitals = vitals || emptyVitals();
  const isDeviceOnline = device?.last_seen
    ? Date.now() - new Date(device.last_seen).getTime() < 5 * 60 * 1000
    : false;

  const status = vitals ? classifyStatus(vitals) : 'normal';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

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
            {socketConnected && (
              <Badge variant="default" className="gap-1 bg-primary/20 text-primary border-primary/30 text-xs">
                Realtime Connected
              </Badge>
            )}
          </div>
          {device?.last_seen && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              Last sync: {new Date(device.last_seen).toLocaleString()}
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <p className="text-sm text-warning">{error}</p>
          </CardContent>
        </Card>
      )}

      {!vitals && (
        <Card className="border-border/50">
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground">No vitals data available yet. Waiting for device data...</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <VitalCard title="Heart Rate" value={currentVitals.heartRate} unit="BPM" icon={Heart}
          status={currentVitals.heartRate < 60 || currentVitals.heartRate > 100 ? (currentVitals.heartRate < 50 || currentVitals.heartRate > 120 ? 'critical' : 'warning') : 'normal'}
          subtitle="MAX30100" />
        <VitalCard title="SpO₂" value={currentVitals.spo2} unit="%" icon={Droplets}
          status={currentVitals.spo2 < 90 ? 'critical' : currentVitals.spo2 < 95 ? 'warning' : 'normal'}
          subtitle="MAX30100" />
        <VitalCard title="Temperature" value={currentVitals.temperature} unit="°C" icon={Thermometer}
          status={currentVitals.temperature > 38.5 ? 'critical' : currentVitals.temperature > 37.5 ? 'warning' : 'normal'}
          subtitle="MLX90614" />
        <VitalCard title="Motion" value={currentVitals.motionStatus === 'fall_detected' ? 'FALL!' : currentVitals.motionStatus === 'active' ? 'Active' : 'Resting'} unit="" icon={Move}
          status={currentVitals.motionStatus === 'fall_detected' ? 'critical' : 'normal'}
          subtitle="MPU6050" />
      </div>

      <ECGWaveform />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {historicalData.length > 0 ? (
            <>
              <VitalTrendChart data={historicalData} title="Heart Rate & SpO₂ — Last 24h" dataKeys={['heartRate', 'spo2']} />
              <VitalTrendChart data={historicalData} title="Temperature — Last 24h" dataKeys={['temperature']} />
            </>
          ) : (
            <Card className="border-border/50">
              <CardContent className="p-8 text-center">
                <p className="text-sm text-muted-foreground">No historical data available yet.</p>
              </CardContent>
            </Card>
          )}
        </div>
        <AlertPanel alerts={allAlerts} />
      </div>
    </div>
  );
}
