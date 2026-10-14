import { getDb } from '@/lib/db';
import { createFakeDb, type FakeDb } from '@/test/helpers/fake-db';

import { getAuthor, getCreators } from '../content';

jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));

const author = (username: string, name: string, extra: Record<string, unknown> = {}) => ({
  name,
  username,
  avatarUrl: '',
  bio: '',
  socials: [],
  readme: '',
  ...extra,
});

// Linha de post como o banco devolve (getAllPosts).
const postRow = (slug: string, username: string, publishedAt: string, section: string | null) => ({
  slug,
  title: slug,
  excerpt: '',
  publishedAt,
  contentUpdatedAt: null,
  tags: [],
  section,
  coverImage: '',
  words: 400,
  author: author(username, username),
});

let fake: FakeDb;

beforeEach(() => {
  fake = createFakeDb();
  (getDb as jest.Mock).mockResolvedValue(fake.db);
});

describe('getCreators (/creators)', () => {
  it('quem escreve, com número de posts, último post, seções e redes conferidas', async () => {
    // 1º select: pessoas; 2º: posts públicos (do mais novo para o mais velho).
    fake.queue(
      'select',
      [
        author('ana', 'Ana', {
          socials: [
            { network: 'instagram', url: 'https://www.instagram.com/ana.pesquisa/' },
            { network: 'x', url: 'https://evil.com/ana' },
          ],
        }),
        author('gaspar', 'Gaspar', { bio: 'Investigação.', readme: '### Sobre mim' }),
        author('zeca', 'Zeca'),
      ],
      [
        postRow('urnas', 'gaspar', '2026-10-01', 'investigacoes'),
        postRow('el-nino', 'ana', '2026-09-20', 'pesquisas'),
        postRow('cicada', 'gaspar', '2026-08-01', 'investigacoes'),
        postRow('loterias', 'gaspar', '2026-07-01', 'pesquisas'),
      ],
    );

    const creators = await getCreators();

    expect(creators.map((creator) => creator.username)).toEqual(['gaspar', 'ana', 'zeca']);
    expect(creators[0]).toMatchObject({
      posts: 3,
      latest: '2026-10-01',
      sections: ['investigacoes', 'pesquisas'],
      bio: 'Investigação.',
      readme: '### Sobre mim',
    });
    expect(creators[1].socials).toEqual([
      {
        network: 'instagram',
        handle: 'ana.pesquisa',
        url: 'https://www.instagram.com/ana.pesquisa/',
        label: '',
      },
    ]);
    expect(creators[2]).toMatchObject({ posts: 0, latest: null, sections: [] });
  });

  it('empate no número de posts: ordem alfabética', async () => {
    fake.queue('select', [author('bia', 'Bia'), author('ana', 'Ana')], []);
    expect((await getCreators()).map((creator) => creator.name)).toEqual(['Ana', 'Bia']);
  });
});

describe('getAuthor', () => {
  it('traz as redes conferidas junto com o perfil público', async () => {
    fake.queue('select', [
      author('gaspar', 'Gaspar', {
        socials: [{ network: 'spotify', url: 'https://open.spotify.com/user/gasparzeon' }],
      }),
    ]);
    const found = await getAuthor('Gaspar');
    expect(found?.socials).toEqual([
      {
        network: 'spotify',
        handle: 'gasparzeon',
        url: 'https://open.spotify.com/user/gasparzeon',
        label: '',
      },
    ]);
  });

  it('traz o README como está no banco (a página monta o HTML)', async () => {
    fake.queue('select', [author('gaspar', 'Gaspar', { readme: '# Oi\n- [x] feito' })]);
    expect((await getAuthor('gaspar'))?.readme).toBe('# Oi\n- [x] feito');
    // O banco falso devolve o que for programado: conferir também que a
    // consulta pede as colunas do perfil público (README e redes).
    const [columns] = fake.argsOf('select', 'select')[0] ?? fake.calls[0].chain[0].args;
    expect(Object.keys(columns as object)).toEqual(
      expect.arrayContaining(['name', 'username', 'bio', 'socials', 'readme']),
    );
  });

  it('quem não existe (ou é leitor) → null', async () => {
    fake.queue('select', []);
    await expect(getAuthor('ninguem')).resolves.toBeNull();
  });
});
