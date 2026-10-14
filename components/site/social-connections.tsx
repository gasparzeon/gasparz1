import { ArrowUpRight } from 'lucide-react';

import { networkInfo, socialDisplayName, type ProfileSocial } from '@/lib/users/socials';
import { cn } from '@/lib/utils';

import { ProfileNetworkIcon } from './icons';

// Redes do perfil no estilo das conexões do Discord: ícone da rede, nome da
// conta e a seta de link externo. A linha inteira é o link (alvo grande) e o
// nome acessível diz a conta, a rede e que abre em outra aba.
export function SocialConnections({
  socials,
  owner,
  compact = false,
  className,
}: {
  socials: ProfileSocial[];
  owner: string;
  compact?: boolean;
  className?: string;
}) {
  if (socials.length === 0) return null;

  return (
    <ul
      className={cn('gz-conns', compact && 'gz-conns--compact', className)}
      aria-label={`Redes de ${owner}`}
    >
      {socials.map((social) => (
        <li key={social.network}>
          <a className="gz-conn" href={social.url} target="_blank" rel="me noopener noreferrer">
            <span className={`gz-conn-ico gz-conn-ico--${social.network}`}>
              <ProfileNetworkIcon network={social.network} className="gz-brand" />
            </span>
            <span className="gz-conn-text">
              <span className="gz-conn-name">{socialDisplayName(social)}</span>
              <span className="gz-conn-net">{networkInfo(social.network).label}</span>
            </span>
            <ArrowUpRight className="gz-ico gz-conn-go" aria-hidden="true" />
            <span className="gz-sr">(abre em nova aba)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
