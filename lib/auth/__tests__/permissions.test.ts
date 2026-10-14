import {
  allowedStatuses,
  assignableRoles,
  canAccessPanel,
  canDeletePost,
  canEditPost,
  canManageUser,
  canManageUsers,
  canModerateComments,
  canPublish,
  canSetStatus,
  isRole,
  type Actor,
  type Role,
} from '../permissions';

const actor = (role: Role, id = 'eu'): Actor => ({ id, role });
const mine = (status: 'draft' | 'review' | 'published') => ({ authorId: 'eu', status });
const others = (status: 'draft' | 'review' | 'published') => ({ authorId: 'outro', status });

describe('posts', () => {
  it('colaborador escreve e edita os próprios rascunhos, mas não publica', () => {
    const contributor = actor('contributor');
    expect(canPublish('contributor')).toBe(false);
    expect(allowedStatuses('contributor')).toEqual(['draft', 'review']);
    expect(canEditPost(contributor, mine('draft'))).toBe(true);
    expect(canEditPost(contributor, mine('review'))).toBe(true);
    expect(canSetStatus(contributor, mine('draft'), 'review')).toBe(true);
    expect(canSetStatus(contributor, mine('draft'), 'published')).toBe(false);
    expect(canSetStatus(contributor, null, 'published')).toBe(false);
  });

  it('colaborador não mexe no post depois de publicado nem em posts alheios', () => {
    const contributor = actor('contributor');
    expect(canEditPost(contributor, mine('published'))).toBe(false);
    expect(canDeletePost(contributor, mine('published'))).toBe(false);
    expect(canEditPost(contributor, others('draft'))).toBe(false);
  });

  it('autor publica e apaga os próprios posts, nunca os de outros', () => {
    const author = actor('author');
    expect(canSetStatus(author, mine('draft'), 'published')).toBe(true);
    expect(canEditPost(author, mine('published'))).toBe(true);
    expect(canDeletePost(author, mine('published'))).toBe(true);
    expect(canEditPost(author, others('review'))).toBe(false);
    expect(canSetStatus(author, others('review'), 'published')).toBe(false);
  });

  it.each<Role>(['editor', 'admin', 'owner'])('%s edita, publica e apaga qualquer post', (role) => {
    const user = actor(role);
    expect(canEditPost(user, others('published'))).toBe(true);
    expect(canSetStatus(user, others('review'), 'published')).toBe(true);
    expect(canDeletePost(user, others('draft'))).toBe(true);
  });
});

describe('usuários', () => {
  it('só administradores e o dono gerenciam usuários', () => {
    expect(canManageUsers('editor')).toBe(false);
    expect(canManageUsers('admin')).toBe(true);
    expect(canManageUsers('owner')).toBe(true);
  });

  it('administrador gerencia quem está abaixo dele, mas não outros administradores', () => {
    const admin = actor('admin');
    expect(canManageUser(admin, { id: 'x', role: 'editor' })).toBe(true);
    expect(canManageUser(admin, { id: 'x', role: 'contributor' })).toBe(true);
    expect(canManageUser(admin, { id: 'x', role: 'reader' })).toBe(true);
    expect(canManageUser(admin, { id: 'x', role: 'admin' })).toBe(false);
    expect(assignableRoles('admin')).toEqual(['editor', 'author', 'contributor', 'reader']);
  });

  it('o dono gerencia todos, mas ninguém mexe no dono nem em si mesmo', () => {
    const owner = actor('owner');
    expect(canManageUser(owner, { id: 'x', role: 'admin' })).toBe(true);
    expect(assignableRoles('owner')).toContain('admin');
    expect(assignableRoles('owner')).not.toContain('owner');
    expect(canManageUser(owner, { id: 'outro-dono', role: 'owner' })).toBe(false);
    expect(canManageUser(actor('admin', 'a1'), { id: 'a1', role: 'admin' })).toBe(false);
  });

  it('papéis abaixo de administrador não atribuem papéis', () => {
    expect(assignableRoles('editor')).toEqual([]);
    expect(assignableRoles('author')).toEqual([]);
    expect(assignableRoles('reader')).toEqual([]);
  });

  it('leitor não entra no painel nem publica, mas é papel válido', () => {
    expect(isRole('reader')).toBe(true);
    expect(canAccessPanel('reader')).toBe(false);
    expect(canAccessPanel('contributor')).toBe(true);
    expect(canPublish('reader')).toBe(false);
    expect(allowedStatuses('reader')).toEqual(['draft', 'review']);
    const reader = actor('reader');
    expect(canEditPost(reader, others('draft'))).toBe(false);
    expect(canSetStatus(reader, null, 'published')).toBe(false);
  });

  it('só editores e acima moderam comentários', () => {
    expect(canModerateComments('reader')).toBe(false);
    expect(canModerateComments('contributor')).toBe(false);
    expect(canModerateComments('author')).toBe(false);
    expect(canModerateComments('editor')).toBe(true);
    expect(canModerateComments('admin')).toBe(true);
    expect(canModerateComments('owner')).toBe(true);
  });

  it('valida nomes de papel vindos de fora', () => {
    expect(isRole('editor')).toBe(true);
    expect(isRole('superuser')).toBe(false);
    expect(isRole('constructor')).toBe(false);
  });
});
