import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  generateVitals, generateHistoricalData, classifyStatus,
  subscribeToVitals, type VitalSigns,
} from '@/services/vitalsService';
import VitalCard from '@/components/VitalCard';
import ECGWaveform from '@/components/ECGWaveform';
import VitalTrendChart from '@/components/VitalTrendChart';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Heart, Droplets, Thermometer, Move, ArrowLeft, Loader2 } from 'lucide-react';

interface PatientProfile {
  id: string;
  full_name: string;
  status: string;
  created_at: string;
  last_seen: string | null;
  phone_number: string | null;
}

export default function AdminPatientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [vitals, setVitals] = useState<VitalSigns>(generateVitals());
  const [historicalData] = useState(() => generateHistoricalData(24));

  // Fetch patient profile from DB
  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, status, created_at, last_seen, phone_number')
        .eq('id', id)
        .single();
      if (data) setPatient(data as PatientProfile);
      setLoading(false);
    })();
  }, [id]);

  // Subscribe to mock vitals (will switch to real when hardware connected)
  useEffect(() => {
    const unsubscribe = subscribeToVitals(id || '', (newVitals) => {
      setVitals(newVitals);
    });
    return unsubscribe;
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
          <h1 className="text-xl font-bold">{patient.full_name || 'Unnamed'}</h1>
          <p className="text-xs text-muted-foreground">
            Registered: {new Date(patient.created_at).toLocaleDateString()}
            {patient.phone_number && ` · Phone: ${patient.phone_number}`}
          </p>
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
