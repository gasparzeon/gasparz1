import { Info, AlertTriangle, Lightbulb, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type CalloutType = 'info' | 'warning' | 'tip' | 'danger';

interface CalloutProps {
  type?: CalloutType;
  title?: string;
  children: React.ReactNode;
}

const calloutConfig = {
  info: {
    icon: Info,
    className: 'border-link bg-secondary',
    iconClassName: 'text-link',
  },
  warning: {
    icon: AlertTriangle,
    className: 'border-yellow-600 bg-yellow-500/5 dark:border-yellow-400',
    iconClassName: 'text-yellow-700 dark:text-yellow-400',
  },
  tip: {
    icon: Lightbulb,
    className: 'border-green-700 bg-green-500/5 dark:border-green-400',
    iconClassName: 'text-green-700 dark:text-green-400',
  },
  danger: {
    icon: XCircle,
    className: 'border-red-600 bg-red-500/5 dark:border-red-400',
    iconClassName: 'text-red-600 dark:text-red-400',
  },
};

export function Callout({ type = 'info', title, children }: CalloutProps) {
  // `type` vem do MDX: valida antes de indexar e cai para 'info'.
  // eslint-disable-next-line security/detect-object-injection -- protegido por Object.hasOwn
  const config = Object.hasOwn(calloutConfig, type) ? calloutConfig[type] : calloutConfig.info;
  const Icon = config.icon;

  return (
    <div className={cn('my-6 rounded-sm border-2 p-4', config.className)}>
      <div className="flex gap-3">
        <Icon aria-hidden="true" className={cn('mt-0.5 h-5 w-5 shrink-0', config.iconClassName)} />
        <div className="flex-1">
          {title && <p className="mb-2 font-bold">{title}</p>}
          <div className="text-[0.92em] text-foreground [&>p]:m-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
