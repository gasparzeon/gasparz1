import { currentState, isAdminPath } from '../navigation';

describe('isAdminPath', () => {
  it.each([
    ['/admin', true],
    ['/admin/perfil', true],
    ['/admin/posts/new', true],
    ['/', false],
    ['/administracao', false],
    ['/posts/admin', false],
    [null, false],
    [undefined, false],
  ])('%s → %s', (pathname, expected) => {
    expect(isAdminPath(pathname)).toBe(expected);
  });
});

describe('currentState (aria-current dos menus)', () => {
  it('"page" na própria página', () => {
    expect(currentState('/posts', '/posts')).toBe('page');
    expect(currentState('/', '/')).toBe('page');
    expect(currentState('/creators', '/creators?ordem=az')).toBe('page');
  });

  it('"true" dentro da seção do link', () => {
    expect(currentState('/posts/h4ck34ndo-as-urnas', '/posts')).toBe('true');
    expect(currentState('/admin/paginas/123', '/admin/paginas')).toBe('true');
  });

  it('o início não é "pai" de tudo, nem prefixo parecido conta', () => {
    expect(currentState('/posts', '/')).toBeUndefined();
    expect(currentState('/postsantigos', '/posts')).toBeUndefined();
  });

  it('links externos e âncoras nunca marcam a página atual', () => {
    expect(currentState('/', 'https://github.com/gasparzeon')).toBeUndefined();
    expect(currentState('/', '//cdn.example.com/')).toBeUndefined();
    expect(currentState('/', 'mailto:oi@x.com')).toBeUndefined();
    expect(currentState('/', '#secoes')).toBeUndefined();
    // Trecho da página inicial: estar no início não é estar em "Seções".
    expect(currentState('/', '/#secoes')).toBeUndefined();
  });
});
