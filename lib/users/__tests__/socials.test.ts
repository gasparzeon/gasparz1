import {
  PROFILE_NETWORKS,
  isProfileNetwork,
  networkInfo,
  parseSocialInput,
  profileSocialsSchema,
  readSocials,
  socialDisplayName,
  type ProfileNetwork,
} from '../socials';

const ok = (network: ProfileNetwork, input: string) => {
  const result = parseSocialInput(network, input);
  if (!result.ok) throw new Error(`esperava aceitar ${input}: ${result.error}`);
  return { handle: result.handle, url: result.url };
};
const error = (network: ProfileNetwork, input: string) => {
  const result = parseSocialInput(network, input);
  if (result.ok) throw new Error(`esperava recusar ${input}`);
  return result.error;
};

describe('parseSocialInput: link ou @usuário vira o link oficial', () => {
  it.each([
    ['@gaspar.labs', 'gaspar.labs'],
    ['gaspar.labs', 'gaspar.labs'],
    ['https://www.instagram.com/gaspar.labs/', 'gaspar.labs'],
    ['instagram.com/gaspar.labs?igsh=abc', 'gaspar.labs'],
    ['http://instagram.com/gaspar.labs/reels', 'gaspar.labs'],
  ])('Instagram: %s', (input, handle) => {
    expect(ok('instagram', input)).toEqual({
      handle,
      url: `https://www.instagram.com/${handle}/`,
    });
  });

  it.each([
    ['@gasparzeon', 'gasparzeon'],
    ['https://twitter.com/gasparzeon', 'gasparzeon'],
    ['x.com/gasparzeon/status/123', 'gasparzeon'],
    ['https://mobile.twitter.com/gasparzeon', 'gasparzeon'],
  ])('X (Twitter): %s', (input, handle) => {
    expect(ok('x', input)).toEqual({ handle, url: `https://x.com/${handle}` });
  });

  it.each([
    ['@gaspar_labs', 'gaspar_labs'],
    ['https://www.tiktok.com/@gaspar_labs', 'gaspar_labs'],
    ['tiktok.com/@gaspar_labs/video/7300000000', 'gaspar_labs'],
  ])('TikTok: %s', (input, handle) => {
    expect(ok('tiktok', input)).toEqual({ handle, url: `https://www.tiktok.com/@${handle}` });
  });

  it('Facebook: usuário, link e perfil por número', () => {
    expect(ok('facebook', 'gaspar.labs')).toEqual({
      handle: 'gaspar.labs',
      url: 'https://www.facebook.com/gaspar.labs',
    });
    expect(ok('facebook', 'https://m.facebook.com/gaspar.labs/')).toEqual({
      handle: 'gaspar.labs',
      url: 'https://www.facebook.com/gaspar.labs',
    });
    expect(ok('facebook', 'https://www.facebook.com/profile.php?id=100012345678')).toEqual({
      handle: '',
      url: 'https://www.facebook.com/profile.php?id=100012345678',
    });
  });

  it('Spotify: usuário, link de usuário (com idioma) e artista', () => {
    expect(ok('spotify', 'gasparzeon')).toEqual({
      handle: 'gasparzeon',
      url: 'https://open.spotify.com/user/gasparzeon',
    });
    expect(ok('spotify', 'https://open.spotify.com/intl-pt/user/31abcxyz?si=1')).toEqual({
      handle: '31abcxyz',
      url: 'https://open.spotify.com/user/31abcxyz',
    });
    expect(ok('spotify', 'open.spotify.com/artist/0OdUWJ0sBjDrqHygGUXeCF')).toEqual({
      handle: '',
      url: 'https://open.spotify.com/artist/0OdUWJ0sBjDrqHygGUXeCF',
    });
  });
});

describe('parseSocialInput: segurança', () => {
  it('link de outro site nunca vira "Instagram"', () => {
    expect(error('instagram', 'https://evil.com/instagram.com/gaspar')).toMatch(
      /não é do Instagram/,
    );
    expect(error('instagram', 'https://instagram.com.evil.com/gaspar')).toMatch(/não é do/);
    expect(error('x', 'https://x.com.phishing.io/gaspar')).toMatch(/não é do X/);
    expect(error('spotify', 'https://spotify.com.evil.net/user/a')).toMatch(/não é do Spotify/);
  });

  it('recusa javascript:, data: e credenciais no link', () => {
    expect(error('instagram', 'javascript:alert(1)')).toMatch(/inválido/);
    expect(error('x', 'data:text/html,<script>1</script>')).toMatch(/inválido/);
    expect(error('facebook', 'https://user:pass@facebook.com/gaspar.labs')).toMatch(/inválido/);
  });

  it('caminhos que não são perfil (post, compartilhar, busca) são recusados', () => {
    expect(error('instagram', 'https://www.instagram.com/p/Cabc123/')).toMatch(/Não achamos/);
    expect(error('x', 'https://x.com/intent/tweet?text=oi')).toMatch(/Não achamos/);
    expect(error('facebook', 'https://facebook.com/sharer.php?u=x')).toMatch(/Não achamos/);
    expect(error('tiktok', 'https://www.tiktok.com/foryou')).toMatch(/Não achamos/);
    expect(error('spotify', 'https://open.spotify.com/track/abc')).toMatch(/Não achamos/);
  });

  it('usuário com caracteres fora do permitido pela rede', () => {
    expect(error('x', '@nome com espaço')).toMatch(/Usuário do X \(Twitter\) inválido/);
    expect(error('x', '@um_nome_grande_demais_para_o_x')).toMatch(/inválido/);
    expect(error('tiktok', '"><img src=x>')).toMatch(/inválido/);
    expect(error('instagram', '')).toMatch(/Informe/);
  });
});

describe('socialDisplayName (o nome no botão)', () => {
  it('usa o nome escolhido, senão o @usuário', () => {
    expect(socialDisplayName({ network: 'x', handle: 'gasparzeon', label: '' })).toBe(
      '@gasparzeon',
    );
    expect(socialDisplayName({ network: 'x', handle: 'gasparzeon', label: 'Gaspar' })).toBe(
      'Gaspar',
    );
  });

  it('sem usuário no link, um nome genérico da rede', () => {
    expect(socialDisplayName({ network: 'spotify', handle: '', label: '' })).toBe(
      'Artista no Spotify',
    );
    expect(socialDisplayName({ network: 'facebook', handle: '', label: '' })).toBe(
      'Perfil no Facebook',
    );
    expect(socialDisplayName({ network: 'spotify', handle: 'gasparzeon', label: '' })).toBe(
      'gasparzeon',
    );
  });
});

describe('profileSocialsSchema (o que o formulário manda)', () => {
  it('ignora linhas vazias, monta os links e ordena pela ordem das redes', () => {
    const result = profileSocialsSchema.parse([
      { network: 'instagram', value: '@gaspar.labs', label: '  Gaspar  ' },
      { network: 'spotify', value: '' },
      { network: 'x', value: 'twitter.com/gasparzeon' },
    ]);
    expect(result).toEqual([
      { network: 'x', handle: 'gasparzeon', url: 'https://x.com/gasparzeon', label: '' },
      {
        network: 'instagram',
        handle: 'gaspar.labs',
        url: 'https://www.instagram.com/gaspar.labs/',
        label: 'Gaspar',
      },
    ]);
  });

  it('erro aponta a linha e a rede', () => {
    const result = profileSocialsSchema.safeParse([
      { network: 'tiktok', value: 'https://evil.com/@gaspar' },
    ]);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: [0, 'value'],
      message: 'Esse link não é do TikTok.',
    });
  });

  it('a mesma rede duas vezes é recusada', () => {
    const result = profileSocialsSchema.safeParse([
      { network: 'x', value: '@a_a' },
      { network: 'x', value: '@b_b' },
    ]);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/mais de uma vez/);
  });

  it('nome exibido sem caracteres de controle e com limite de tamanho', () => {
    const [social] = profileSocialsSchema.parse([
      { network: 'x', value: '@gaspar', label: 'Gas\u0007par' },
    ]);
    expect(social.label).toBe('Gaspar');
    expect(
      profileSocialsSchema.safeParse([{ network: 'x', value: '@gaspar', label: 'a'.repeat(61) }])
        .success,
    ).toBe(false);
  });
});

describe('readSocials (o que vem do banco)', () => {
  it('confere tudo de novo: descarta lixo e remonta o link', () => {
    expect(
      readSocials([
        { network: 'instagram', url: 'https://www.instagram.com/gaspar.labs/', label: 'Gaspar' },
        { network: 'x', url: 'https://evil.com/x' },
        { network: 'myspace', url: 'https://myspace.com/a' },
        { network: 'x', url: 'javascript:alert(1)' },
        null,
        'texto',
        { network: 'instagram', url: 'https://www.instagram.com/outra/' },
        { network: 'spotify', url: 'https://open.spotify.com/user/abc', label: 42 },
      ]),
    ).toEqual([
      { network: 'spotify', handle: 'abc', url: 'https://open.spotify.com/user/abc', label: '' },
      {
        network: 'instagram',
        handle: 'gaspar.labs',
        url: 'https://www.instagram.com/gaspar.labs/',
        label: 'Gaspar',
      },
    ]);
  });

  it('valor que não é lista vira lista vazia', () => {
    expect(readSocials(null)).toEqual([]);
    expect(readSocials({ network: 'x' })).toEqual([]);
  });
});

describe('redes', () => {
  it('as cinco pedidas, com nome e domínios oficiais', () => {
    expect(PROFILE_NETWORKS).toEqual(['spotify', 'x', 'facebook', 'tiktok', 'instagram']);
    expect(networkInfo('x').hosts).toContain('twitter.com');
    expect(isProfileNetwork('tiktok')).toBe(true);
    expect(isProfileNetwork('myspace')).toBe(false);
    expect(() => networkInfo('myspace' as ProfileNetwork)).toThrow();
  });
});
