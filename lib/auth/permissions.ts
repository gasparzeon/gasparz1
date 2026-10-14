// Papéis e permissões (inspirados no Ghost). Compartilhado entre servidor
// e interface: a interface só esconde botões, o servidor é quem decide.

export const ROLES = ['owner', 'admin', 'editor', 'author', 'contributor', 'reader'] as const;
export type Role = (typeof ROLES)[number];

export const POST_STATUSES = ['draft', 'review', 'published'] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const ROLE_INFO: Record<Role, { label: string; description: string }> = {
  owner: { label: 'Dono', description: 'Controle total, inclusive sobre administradores.' },
  admin: {
    label: 'Administrador',
    description: 'Aprova pedidos, convida e gerencia usuários e todos os posts.',
  },
  editor: { label: 'Editor', description: 'Edita, publica e remove posts de qualquer autor.' },
  author: { label: 'Autor', description: 'Escreve e publica os próprios posts.' },
  contributor: {
    label: 'Colaborador',
    description: 'Escreve rascunhos e envia para revisão; não publica.',
  },
  reader: {
    label: 'Leitor',
    description: 'Conta criada no site: comenta nos posts; não acessa o painel.',
  },
};

export const STATUS_LABELS: Record<PostStatus, string> = {
  draft: 'Rascunho',
  review: 'Em revisão',
  published: 'Publicado',
};

// Acesso centralizado (chaves tipadas; evita indexação espalhada).
export function roleInfo(role: Role) {
  // eslint-disable-next-line security/detect-object-injection -- papel tipado
  return ROLE_INFO[role];
}

export function statusLabel(status: PostStatus) {
  // eslint-disable-next-line security/detect-object-injection -- status tipado
  return STATUS_LABELS[status];
}

const RANK: Record<Role, number> = {
  reader: 0,
  contributor: 1,
  author: 2,
  editor: 3,
  admin: 4,
  owner: 5,
};

export type Actor = { id: string; role: Role };
export type PostRef = { authorId: string; status: PostStatus };

export function atLeast(role: Role, minimum: Role) {
  // eslint-disable-next-line security/detect-object-injection -- papéis tipados
  return RANK[role] >= RANK[minimum];
}

export const canManageUsers = (role: Role) => atLeast(role, 'admin');
// Configurações do site, menu, rodapé, integrações e páginas institucionais.
export const canManageSite = (role: Role) => atLeast(role, 'admin');
// Painel de escrita (/admin): só quem escreve. Leitores comentam no site,
// com sessão ativa, mas não entram no painel.
export const canAccessPanel = (role: Role) => atLeast(role, 'contributor');
// Moderação de comentários: editores já revisam posts de terceiros.
export const canModerateComments = (role: Role) => atLeast(role, 'editor');
export const canEditAllPosts = (role: Role) => atLeast(role, 'editor');
export const canPublish = (role: Role) => atLeast(role, 'author');

export function canEditPost(actor: Actor, post: PostRef) {
  if (canEditAllPosts(actor.role)) return true;
  if (post.authorId !== actor.id) return false;
  // Depois de publicado, o post do colaborador é responsabilidade do editor.
  return actor.role !== 'contributor' || post.status !== 'published';
}

export const canDeletePost = canEditPost;

// Transição para `next` em um post existente (ou novo, quando post = null).
export function canSetStatus(actor: Actor, post: PostRef | null, next: PostStatus) {
  if (post && !canEditPost(actor, post)) return false;
  if (next === 'published') return canPublish(actor.role);
  return true;
}

// Status inicial válido para quem cria: colaborador nunca publica.
export function allowedStatuses(role: Role): PostStatus[] {
  return canPublish(role) ? ['draft', 'review', 'published'] : ['draft', 'review'];
}

// Quem pode alterar quem: o dono gerencia todos; administradores gerenciam
// quem está abaixo deles. Ninguém mexe no dono.
export function canManageUser(actor: Actor, target: { id: string; role: Role }) {
  if (target.role === 'owner' || target.id === actor.id) return false;
  if (actor.role === 'owner') return true;
  return actor.role === 'admin' && RANK[target.role] < RANK.admin;
}

export function assignableRoles(role: Role): Exclude<Role, 'owner'>[] {
  if (role === 'owner') return ['admin', 'editor', 'author', 'contributor', 'reader'];
  if (role === 'admin') return ['editor', 'author', 'contributor', 'reader'];
  return [];
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}
