import Link from 'next/link';
import { ArrowLeft, Search } from 'lucide-react';

import { getSiteSettings } from '@/lib/site/service';

// Textos editáveis em /admin/site → Página 404.
export default async function NotFound() {
  const { notFound } = await getSiteSettings();

  return (
    <div className="gz-root">
      <div className="gz-wrap" style={{ paddingBlock: '5rem 6rem' }}>
        <div className="gz-status">
          <span className="gz-live">
            <span className="gz-dot" aria-hidden="true" />
            erro 404
          </span>
          <span>registro não encontrado no arquivo</span>
        </div>
        <div className="grid max-w-3xl gap-6 pt-10">
          <p className="gz-bignum" aria-hidden="true">
            <span>404</span>
          </p>
          <h1 className="gz-h1" data-gz-scramble="intro">
            {notFound.title}
          </h1>
          {notFound.text && <p className="gz-lead">{notFound.text}</p>}
          <div className="flex flex-wrap gap-2">
            <Link href="/" className="gz-btn gz-btn--primary">
              <ArrowLeft className="gz-ico" aria-hidden="true" />
              {notFound.buttonLabel || 'Voltar'}
            </Link>
            <Link href="/posts" className="gz-btn">
              <Search className="gz-ico" aria-hidden="true" />
              Procurar no arquivo
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
