import { VitalAlert as Alert } from '@/services/vitalsService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, AlertTriangle, AlertOctagon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  alerts: Alert[];
}

export default function AlertPanel({ alerts }: Props) {
  if (alerts.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Alerts</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No active alerts</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-warning" />
          <CardTitle className="text-sm font-medium">Alerts ({alerts.length})</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 max-h-80 overflow-y-auto">
        {alerts.map(alert => (
          <div
            key={alert.id}
            className={cn(
              'flex items-start gap-3 p-3 rounded-lg border',
              alert.level === 'critical' && 'border-critical/30 bg-critical/5',
              alert.level === 'warning' && 'border-warning/30 bg-warning/5',
            )}
          >
            {alert.level === 'critical' ? (
              <AlertOctagon className="w-4 h-4 text-critical mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium">{alert.message}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {alert.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
