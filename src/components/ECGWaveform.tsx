import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { generateECGData } from '@/lib/mockData';
import { LineChart, Line, YAxis, ResponsiveContainer } from 'recharts';
import { Activity } from 'lucide-react';

export default function ECGWaveform() {
  const [data, setData] = useState(() => generateECGData(200).map((v, i) => ({ idx: i, value: v })));
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setData(generateECGData(200).map((v, i) => ({ idx: i, value: v })));
    }, 2000);
    return () => clearInterval(intervalRef.current);
  }, []);

  return (
    <Card className="border-border/50 col-span-full">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-success animate-pulse-glow" />
          <CardTitle className="text-sm font-medium">ECG Waveform — Lead II</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <YAxis domain={[-0.5, 1.2]} hide />
              <Line
                type="monotone"
                dataKey="value"
                stroke="hsl(142, 70%, 45%)"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
