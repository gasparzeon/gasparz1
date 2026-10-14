import Link from 'next/link';
import { MessageSquareText } from 'lucide-react';

// Para onde o leitor cai ao abrir o painel: ele comenta no site,
// não escreve — então o painel mostra só este aviso (e o perfil).
export function ReaderLanding({ name }: { name: string }) {
  return (
    <div className="gz-root gz-admin-page gz-admin-page--narrow">
      <div className="gz-panel grid justify-items-start gap-5">
        <span className="gz-sec-ico gz-cut" aria-hidden="true">
          <MessageSquareText className="gz-ico" />
        </span>
        <p className="gz-kicker">
          <b>~/</b>conta de leitor
        </p>
        <h1 className="gz-h1" data-gz-scramble="intro">
          Olá, {name.split(' ')[0]}
        </h1>
        <p className="gz-lead">
          Sua conta é de leitor: dá para comentar nos posts. O painel de escrita é só para quem
          publica.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/" className="gz-btn gz-btn--primary">
            Ver site
          </Link>
          <Link href="/admin/perfil" className="gz-btn">
            Meu perfil
          </Link>
        </div>
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="gz-textlink">
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}
