import Link from 'next/link';
import { ShieldX } from 'lucide-react';

export function NoPermission({ message }: { message: string }) {
  return (
    <div className="gz-root gz-admin-page gz-admin-page--narrow">
      <div className="gz-panel grid justify-items-start gap-4">
        <span className="gz-sec-ico gz-cut" aria-hidden="true">
          <ShieldX className="gz-ico" />
        </span>
        <h1 className="gz-h2">Sem permissão</h1>
        <p className="gz-small">{message}</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin" className="gz-btn">
            Voltar ao painel
          </Link>
          <Link href="/" className="gz-btn gz-btn--ghost">
            Voltar ao site
          </Link>
        </div>
      </div>
    </div>
  );
}
