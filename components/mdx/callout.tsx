import { Info, AlertTriangle, Lightbulb, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type CalloutType = 'info' | 'warning' | 'tip' | 'danger'

interface CalloutProps {
  type?: CalloutType
  title?: string
  children: React.ReactNode
}

const calloutConfig = {
  info: {
    icon: Info,
    className: 'border-accent/50 bg-accent/5',
    iconClassName: 'text-accent',
  },
  warning: {
    icon: AlertTriangle,
    className: 'border-yellow-500/50 bg-yellow-500/5',
    iconClassName: 'text-yellow-500',
  },
  tip: {
    icon: Lightbulb,
    className: 'border-green-500/50 bg-green-500/5',
    iconClassName: 'text-green-500',
  },
  danger: {
    icon: XCircle,
    className: 'border-red-500/50 bg-red-500/5',
    iconClassName: 'text-red-500',
  },
}

export function Callout({ type = 'info', title, children }: CalloutProps) {
  const config = calloutConfig[type]
  const Icon = config.icon

  return (
    <div
      className={cn(
        'my-6 rounded-lg border p-4',
        config.className
      )}
    >
      <div className="flex gap-3">
        <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', config.iconClassName)} />
        <div className="flex-1">
          {title && (
            <p className="mb-2 font-medium">{title}</p>
          )}
          <div className="text-sm text-muted-foreground [&>p]:m-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
