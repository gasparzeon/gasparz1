import { eligibleHeirs, type ManagedUserView } from '../users-manager';

const user = (overrides: Partial<ManagedUserView>): ManagedUserView => ({
  id: overrides.id ?? 'u',
  username: 'x',
  name: 'X',
  email: null,
  avatarUrl: '',
  role: 'author',
  status: 'active',
  requestNote: '',
  createdAt: '',
  requestedAt: '',
  reviewedAt: null,
  reviewedBy: null,
  lastLoginAt: null,
  postCount: 0,
  ...overrides,
});

describe('eligibleHeirs (transferência de posts)', () => {
  it('só ativos que escrevem, sem o próprio removido e sem leitor', () => {
    const users = [
      user({ id: 'autor', role: 'author' }),
      user({ id: 'leitor', role: 'reader' }),
      user({ id: 'suspenso', status: 'suspended' }),
      user({ id: 'saindo', postCount: 2 }),
    ];
    expect(eligibleHeirs(users, 'saindo').map((heir) => heir.id)).toEqual(['autor']);
  });
});
