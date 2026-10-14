import { AlertTriangle, GitBranch, HardDrive, Info } from 'lucide-react';

import { cn } from '@/lib/utils';

const ICONS = {
  info: Info,
  warning: AlertTriangle,
  github: GitBranch,
  local: HardDrive,
};

export function AdminNotice({
  tone = 'info',
  icon = 'info',
  children,
}: {
  tone?: 'info' | 'warning';
  icon?: keyof typeof ICONS;
  children: React.ReactNode;
}) {
  // eslint-disable-next-line security/detect-object-injection -- chave tipada (união literal do código), não vem de entrada externa
  const Icon = ICONS[icon];
  return (
    <div className={cn('gz-note', tone === 'warning' && 'gz-note--warning')} role="note">
      <Icon className="gz-ico" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
