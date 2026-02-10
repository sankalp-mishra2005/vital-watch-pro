import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface DataPoint {
  time: string;
  heartRate: number;
  spo2: number;
  temperature: number;
}

interface Props {
  data: DataPoint[];
  title: string;
  dataKeys?: ('heartRate' | 'spo2' | 'temperature')[];
}

const COLORS = {
  heartRate: 'hsl(0, 72%, 51%)',
  spo2: 'hsl(210, 80%, 55%)',
  temperature: 'hsl(38, 92%, 50%)',
};

const LABELS = {
  heartRate: 'Heart Rate (BPM)',
  spo2: 'SpO₂ (%)',
  temperature: 'Temp (°C)',
};

export default function VitalTrendChart({ data, title, dataKeys = ['heartRate', 'spo2'] }: Props) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: 'hsl(215, 15%, 55%)' }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(215, 15%, 55%)' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(220, 18%, 10%)',
                  border: '1px solid hsl(220, 14%, 18%)',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              {dataKeys.map(key => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={COLORS[key]}
                  strokeWidth={2}
                  dot={false}
                  name={LABELS[key]}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
