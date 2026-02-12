import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  generateVitals, generateHistoricalData, classifyStatus,
  subscribeToVitals,
  type VitalSigns,
} from '@/services/vitalsService';
import VitalCard from '@/components/VitalCard';
import ECGWaveform from '@/components/ECGWaveform';
import VitalTrendChart from '@/components/VitalTrendChart';
import AlertPanel, { type VitalAlert } from '@/components/AlertPanel';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Heart, Droplets, Thermometer, Move, LogOut, Activity } from 'lucide-react';

export default function PatientDashboard() {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();
  const [vitals, setVitals] = useState<VitalSigns>(generateVitals());
  const [historicalData] = useState(() => generateHistoricalData(24));
  const [alerts, setAlerts] = useState<VitalAlert[]>([]);

  useEffect(() => {
    // Subscribe to vitals updates via service abstraction
    // HARDWARE SWAP: This automatically switches when vitalsService changes
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

  const status = classifyStatus(vitals);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

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
        <AlertPanel alerts={alerts} />
      </div>
    </div>
  );
}
