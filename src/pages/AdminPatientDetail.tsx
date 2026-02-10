import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { generateVitals, generateHistoricalData, classifyStatus, type VitalSigns } from '@/lib/mockData';
import VitalCard from '@/components/VitalCard';
import ECGWaveform from '@/components/ECGWaveform';
import VitalTrendChart from '@/components/VitalTrendChart';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Heart, Droplets, Thermometer, Move, ArrowLeft } from 'lucide-react';

const PATIENT_MAP: Record<string, { name: string; age: number; room: string }> = {
  'P-001': { name: 'Rajesh Kumar', age: 58, room: '101' },
  'P-002': { name: 'Priya Sharma', age: 34, room: '102' },
  'P-003': { name: 'Arun Patel', age: 72, room: '103' },
  'P-004': { name: 'Meena Devi', age: 45, room: '104' },
  'P-005': { name: 'Vikram Singh', age: 63, room: '105' },
  'P-006': { name: 'Lakshmi Iyer', age: 51, room: '106' },
  'P-007': { name: 'Suresh Reddy', age: 67, room: '107' },
  'P-008': { name: 'Ananya Das', age: 29, room: '108' },
};

export default function AdminPatientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const patient = id ? PATIENT_MAP[id] : null;
  const [vitals, setVitals] = useState<VitalSigns>(generateVitals());
  const [historicalData] = useState(() => generateHistoricalData(24));

  const refresh = useCallback(() => setVitals(generateVitals(true)), []);

  useEffect(() => {
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  if (!patient) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Patient not found</p>
      </div>
    );
  }

  const status = classifyStatus(vitals);

  return (
    <div className="min-h-screen p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{patient.name}</h1>
          <p className="text-xs text-muted-foreground">ID: {id} · Room {patient.room} · Age {patient.age}</p>
        </div>
        <StatusBadge status={status} />
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <VitalCard title="Heart Rate" value={vitals.heartRate} unit="BPM" icon={Heart}
          status={vitals.heartRate < 60 || vitals.heartRate > 100 ? (vitals.heartRate < 50 || vitals.heartRate > 120 ? 'critical' : 'warning') : 'normal'} />
        <VitalCard title="SpO₂" value={vitals.spo2} unit="%" icon={Droplets}
          status={vitals.spo2 < 90 ? 'critical' : vitals.spo2 < 95 ? 'warning' : 'normal'} />
        <VitalCard title="Temperature" value={vitals.temperature} unit="°C" icon={Thermometer}
          status={vitals.temperature > 38.5 ? 'critical' : vitals.temperature > 37.5 ? 'warning' : 'normal'} />
        <VitalCard title="Motion" value={vitals.motionStatus === 'fall_detected' ? 'FALL!' : vitals.motionStatus === 'active' ? 'Active' : 'Resting'} unit="" icon={Move}
          status={vitals.motionStatus === 'fall_detected' ? 'critical' : 'normal'} />
      </div>

      <ECGWaveform />

      <div className="grid lg:grid-cols-2 gap-4">
        <VitalTrendChart data={historicalData} title="Heart Rate & SpO₂ — Last 24h" dataKeys={['heartRate', 'spo2']} />
        <VitalTrendChart data={historicalData} title="Temperature — Last 24h" dataKeys={['temperature']} />
      </div>
    </div>
  );
}
