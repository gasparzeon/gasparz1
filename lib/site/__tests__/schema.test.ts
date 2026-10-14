import {
  CREATORS_LINK,
  DEFAULT_SITE_SETTINGS,
  fillTemplate,
  isSafeLink,
  resolveSiteUrl,
  siteNavLinks,
  siteSettingsSchema,
  withDefaults,
  type SiteSettings,
} from '../schema';

const clone = (): SiteSettings => structuredClone(DEFAULT_SITE_SETTINGS);

describe('padrões', () => {
  it('reproduzem o site original e passam na validação', () => {
    expect(siteSettingsSchema.parse(DEFAULT_SITE_SETTINGS)).toEqual(DEFAULT_SITE_SETTINGS);
    expect(DEFAULT_SITE_SETTINGS.general.name).toBe('Gaspar Labs');
    expect(DEFAULT_SITE_SETTINGS.navigation.links.map((link) => link.href)).toEqual([
      '/posts',
      '/#secoes',
      '/about',
    ]);
    expect(DEFAULT_SITE_SETTINGS.footer.cta.href).toBe('/support');
  });
});

describe('isSafeLink', () => {
  it.each([
    ['/posts', true],
    ['#contato', true],
    ['https://exemplo.com', true],
    ['mailto:eu@exemplo.com', true],
    ['javascript:alert(1)', false],
    ['data:text/html,oi', false],
    ['//evil.example', false],
    ['#', false],
    ['exemplo.com', false],
  ])('%s → %s', (value, expected) => {
    expect(isSafeLink(value)).toBe(expected);
  });
});

describe('validação', () => {
  it('recusa links perigosos no menu, no rodapé e nas redes', () => {
    const settings = clone();
    settings.navigation.links[0].href = 'javascript:alert(1)';
    expect(siteSettingsSchema.safeParse(settings).success).toBe(false);

    const footer = clone();
    footer.footer.cta.href = 'data:text/html,x';
    expect(siteSettingsSchema.safeParse(footer).success).toBe(false);

    const social = clone();
    social.social[0].url = 'javascript:void(0)';
    expect(siteSettingsSchema.safeParse(social).success).toBe(false);
  });

  it('exige endereço completo e tira a barra final', () => {
    const settings = clone();
    settings.general.url = 'exemplo.com';
    expect(siteSettingsSchema.safeParse(settings).success).toBe(false);

    settings.general.url = 'https://gaspar.vorn.fun/';
    expect(siteSettingsSchema.parse(settings).general.url).toBe('https://gaspar.vorn.fun');
  });

  it('limita quantidade de posts e links do menu', () => {
    const count = clone();
    count.home.recentCount = 0;
    expect(siteSettingsSchema.safeParse(count).success).toBe(false);

    const links = clone();
    links.navigation.links = Array.from({ length: 13 }, (_, i) => ({ label: `L${i}`, href: '/' }));
    expect(siteSettingsSchema.safeParse(links).success).toBe(false);
  });

  it('comentários do próprio site: só liga/desliga e título', () => {
    const settings = clone();
    expect(siteSettingsSchema.safeParse(settings).success).toBe(true);
    expect(settings.integrations.comments).toEqual({ enabled: true, title: 'Comentários' });

    const off = clone();
    off.integrations.comments.enabled = false;
    expect(siteSettingsSchema.safeParse(off).success).toBe(true);
  });

  it('configuração antiga do Giscus é ignorada sem quebrar', () => {
    const legacy = clone() as unknown as Record<string, unknown>;
    (legacy as { integrations: { comments: Record<string, unknown> } }).integrations.comments = {
      enabled: true,
      title: 'Comentários',
      repo: 'dono/repo',
      repoId: 'x',
      category: 'General',
      categoryId: 'y',
      mapping: 'pathname',
      reactions: true,
      inputPosition: 'bottom',
      lang: 'pt',
    };
    expect(withDefaults(legacy).integrations.comments).toEqual({
      enabled: true,
      title: 'Comentários',
    });
  });

  it('exige script do Plausible em https', () => {
    const settings = clone();
    settings.integrations.plausible.scriptUrl = 'http://plausible.io/js/script.js';
    expect(siteSettingsSchema.safeParse(settings).success).toBe(false);
  });
});

describe('withDefaults', () => {
  it('sem nada salvo, devolve os padrões', () => {
    expect(withDefaults(undefined)).toEqual(DEFAULT_SITE_SETTINGS);
    expect(withDefaults(null)).toEqual(DEFAULT_SITE_SETTINGS);
  });

  it('completa campos que não existiam quando a configuração foi salva', () => {
    const merged = withDefaults({ general: { name: 'Outro Blog' }, home: { recentCount: 8 } });
    expect(merged.general.name).toBe('Outro Blog');
    expect(merged.general.description).toBe(DEFAULT_SITE_SETTINGS.general.description);
    expect(merged.home.recentCount).toBe(8);
    expect(merged.footer).toEqual(DEFAULT_SITE_SETTINGS.footer);
  });

  it('listas salvas substituem as padrão (inclusive vazias)', () => {
    const merged = withDefaults({ navigation: { links: [] }, social: [] });
    expect(merged.navigation.links).toEqual([]);
    expect(merged.social).toEqual([]);
  });

  it('uma seção corrompida volta ao padrão sem afetar as outras', () => {
    const merged = withDefaults({
      general: { name: 'Meu Blog' },
      navigation: { links: [{ label: 'X', href: 'javascript:alert(1)' }] },
    });
    expect(merged.general.name).toBe('Meu Blog');
    expect(merged.navigation).toEqual(DEFAULT_SITE_SETTINGS.navigation);
  });

  it('ignora chaves desconhecidas', () => {
    const merged = withDefaults({
      general: { name: 'A', hacker: true },
      extra: 1,
    }) as unknown as Record<string, unknown>;
    expect(merged).not.toHaveProperty('extra');
    expect(merged.general).not.toHaveProperty('hacker');
  });
});

describe('aba Creators', () => {
  it('site salvo antes da aba existir ganha a aba ligada (sem perder os links salvos)', () => {
    const merged = withDefaults({
      navigation: {
        logo: { text: 'Gaspar', accent: '' },
        links: [{ label: 'Arquivo', href: '/posts' }],
        showSearch: true,
        showThemeToggle: true,
        showAccountButtons: false,
      },
    });
    expect(merged.navigation.showCreators).toBe(true);
    expect(siteNavLinks(merged.navigation)).toEqual([
      { label: 'Arquivo', href: '/posts' },
      { label: 'Creators', href: '/creators' },
    ]);
  });

  it('desligada no painel, some do menu', () => {
    const navigation = { ...clone().navigation, showCreators: false };
    expect(siteNavLinks(navigation)).toEqual(navigation.links);
  });

  it('não repete se o link já foi posto à mão', () => {
    const navigation = {
      ...clone().navigation,
      links: [{ label: 'Quem escreve', href: CREATORS_LINK.href }],
    };
    expect(siteNavLinks(navigation)).toEqual([{ label: 'Quem escreve', href: '/creators' }]);
  });
});

describe('fillTemplate', () => {
  it('troca {ano} e {site}', () => {
    expect(
      fillTemplate(
        '© {ano} {site}. {site} ok',
        DEFAULT_SITE_SETTINGS,
        new Date('2030-05-01T12:00:00Z'),
      ),
    ).toBe('© 2030 Gaspar Labs. Gaspar Labs ok');
  });
});

describe('resolveSiteUrl', () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = previous;
  });

  it('usa o endereço do painel, depois a variável de ambiente, depois localhost', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(resolveSiteUrl(DEFAULT_SITE_SETTINGS)).toBe('http://localhost:3000');

    process.env.NEXT_PUBLIC_SITE_URL = 'https://env.exemplo.com/';
    expect(resolveSiteUrl(DEFAULT_SITE_SETTINGS)).toBe('https://env.exemplo.com');

    const settings = clone();
    settings.general.url = 'https://painel.exemplo.com';
    expect(resolveSiteUrl(settings)).toBe('https://painel.exemplo.com');
  });
});
