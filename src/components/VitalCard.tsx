import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { VitalStatus } from '@/services/vitalsService';
import { LucideIcon } from 'lucide-react';

interface Props {
  title: string;
  value: string | number;
  unit: string;
  icon: LucideIcon;
  status: VitalStatus;
  subtitle?: string;
}

export default function VitalCard({ title, value, unit, icon: Icon, status, subtitle }: Props) {
  return (
    <Card
      className={cn(
        'relative overflow-hidden border-border/50 transition-shadow duration-300',
        status === 'normal' && 'glow-green',
        status === 'warning' && 'glow-amber',
        status === 'critical' && 'glow-red',
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-3xl font-bold tracking-tight">{value}</span>
              <span className="text-sm text-muted-foreground">{unit}</span>
            </div>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div
            className={cn(
              'p-2 rounded-lg',
              status === 'normal' && 'bg-success/10 text-success',
              status === 'warning' && 'bg-warning/10 text-warning',
              status === 'critical' && 'bg-critical/10 text-critical',
            )}
          >
            <Icon className={cn('w-5 h-5', status === 'critical' && 'animate-pulse-glow')} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
