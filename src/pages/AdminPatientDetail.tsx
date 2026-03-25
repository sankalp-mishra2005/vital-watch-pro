import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import {
  classifyStatus, subscribeToVitals, fetchVitalsHistory, fetchLatestVitals, emptyVitals,
  type VitalSigns,
} from '@/services/vitalsService';
import VitalCard from '@/components/VitalCard';
import ECGWaveform from '@/components/ECGWaveform';
import VitalTrendChart from '@/components/VitalTrendChart';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Heart, Droplets, Thermometer, Move, ArrowLeft, Loader2 } from 'lucide-react';

interface PatientProfile {
  id: string;
  full_name: string;
  email: string;
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
  const [error, setError] = useState<string | null>(null);
  const [vitals, setVitals] = useState<VitalSigns | null>(null);
  const [historicalData, setHistoricalData] = useState<Array<{ time: string; heartRate: number; spo2: number; temperature: number }>>([]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const patients = await api.admin.getPatients();
        const found = patients.find((p: PatientProfile) => p.id === id);
        if (found) setPatient(found);
        else setError('Patient not found');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load patient');
      }
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const data = await fetchVitalsHistory(id, 24);
        setHistoricalData(data);
      } catch { /* no data */ }
    })();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const latest = await fetchLatestVitals(id);
        if (latest) setVitals(latest);
      } catch { /* no vitals */ }
    })();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const unsubscribe = subscribeToVitals(id, (newVitals) => {
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

  if (error || !patient) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-muted-foreground">{error || 'Patient not found'}</p>
          <Button variant="outline" onClick={() => navigate('/admin')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  const currentVitals = vitals || emptyVitals();
  const status = vitals ? classifyStatus(vitals) : 'normal';

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

      {!vitals && (
        <Card className="border-border/50">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">No vitals data available for this patient yet.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <VitalCard title="Heart Rate" value={currentVitals.heartRate} unit="BPM" icon={Heart}
          status={currentVitals.heartRate < 60 || currentVitals.heartRate > 100 ? (currentVitals.heartRate < 50 || currentVitals.heartRate > 120 ? 'critical' : 'warning') : 'normal'} />
        <VitalCard title="SpO₂" value={currentVitals.spo2} unit="%" icon={Droplets}
          status={currentVitals.spo2 < 90 ? 'critical' : currentVitals.spo2 < 95 ? 'warning' : 'normal'} />
        <VitalCard title="Temperature" value={currentVitals.temperature} unit="°C" icon={Thermometer}
          status={currentVitals.temperature > 38.5 ? 'critical' : currentVitals.temperature > 37.5 ? 'warning' : 'normal'} />
        <VitalCard title="Motion" value={currentVitals.motionStatus === 'fall_detected' ? 'FALL!' : currentVitals.motionStatus === 'active' ? 'Active' : 'Resting'} unit="" icon={Move}
          status={currentVitals.motionStatus === 'fall_detected' ? 'critical' : 'normal'} />
      </div>

      <ECGWaveform />

      {historicalData.length > 0 ? (
        <div className="grid lg:grid-cols-2 gap-4">
          <VitalTrendChart data={historicalData} title="Heart Rate & SpO₂ — Last 24h" dataKeys={['heartRate', 'spo2']} />
          <VitalTrendChart data={historicalData} title="Temperature — Last 24h" dataKeys={['temperature']} />
        </div>
      ) : (
        <Card className="border-border/50">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">No historical data available.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
