// Regras de navegação compartilhadas pelo site e pelo painel.

const isExternal = (href: string) => /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//');

// O painel (/admin) tem cabeçalho, menu e área principal próprios.
export function isAdminPath(pathname: string | null | undefined) {
  return pathname === '/admin' || Boolean(pathname?.startsWith('/admin/'));
}

// aria-current de um link do menu: "page" na própria página; "true" quando a
// página atual fica dentro da seção do link (um post dentro de "Arquivo", um
// usuário dentro de "Usuários"). Links externos e para um trecho da página
// (#secoes, /#secoes) nunca marcam; o início ("/", que seria pai de tudo) só
// quando a página é exatamente ele.
export function currentState(pathname: string, href: string): 'page' | 'true' | undefined {
  if (isExternal(href) || href.includes('#')) return undefined;
  const path = href.split('?')[0] || '/';
  if (pathname === path) return 'page';
  if (path !== '/' && pathname.startsWith(`${path}/`)) return 'true';
  return undefined;
}
