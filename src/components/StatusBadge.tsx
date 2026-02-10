import { VitalStatus } from '@/lib/mockData';
import { cn } from '@/lib/utils';

interface Props {
  status: VitalStatus;
  className?: string;
}

export default function StatusBadge({ status, className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider',
        status === 'normal' && 'bg-success/15 text-success',
        status === 'warning' && 'bg-warning/15 text-warning',
        status === 'critical' && 'bg-critical/15 text-critical',
        className,
      )}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full',
          status === 'normal' && 'bg-success',
          status === 'warning' && 'bg-warning animate-pulse',
          status === 'critical' && 'bg-critical animate-pulse-glow',
        )}
      />
      {status}
    </span>
  );
}
