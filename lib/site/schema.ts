import { z } from 'zod';

import { isSafeMediaUrl } from '@/lib/cms/schema';

// Configurações do site editáveis no painel (/admin/site). Compartilhado entre
// o painel (cliente) e o servidor. Os padrões reproduzem o site original:
// um banco novo mostra exatamente o mesmo blog até alguém mudar algo.

// Link de menu, rodapé ou botão: caminho do próprio site, âncora, http(s) ou
// mailto:. Bloqueia javascript:, data: e afins.
export function isSafeLink(value: string) {
  if (value.startsWith('/')) return !value.startsWith('//');
  if (value.startsWith('#')) return value.length > 1;
  try {
    return ['http:', 'https:', 'mailto:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export const isExternalLink = (href: string) => /^(https?:|mailto:)/i.test(href);

function isHttpUrl(value: string) {
  if (/\s/.test(value)) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== '';
  } catch {
    return false;
  }
}

const text = (max: number) => z.string().trim().max(max, `Use no máximo ${max} caracteres.`);
const required = (max: number, message: string) => text(max).min(1, message);

const link = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) => value !== '' && isSafeLink(value),
    'Link inválido: use /caminho, https://… ou mailto:',
  );

const optionalLink = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) => value === '' || isSafeLink(value),
    'Link inválido: use /caminho, https://… ou mailto:',
  );

const image = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) => value === '' || isSafeMediaUrl(value),
    'Imagem inválida: use /caminho ou https://…',
  );

export const SOCIAL_NETWORKS = [
  'instagram',
  'discord',
  'email',
  'github',
  'x',
  'linkedin',
  'youtube',
  'bluesky',
  'mastodon',
  'telegram',
  'rss',
  'website',
] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

export const SOCIAL_LABELS: Record<SocialNetwork, string> = {
  instagram: 'Instagram',
  discord: 'Discord',
  email: 'E-mail',
  github: 'GitHub',
  x: 'X (Twitter)',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
  telegram: 'Telegram',
  rss: 'RSS',
  website: 'Site',
};

export const navLinkSchema = z.object({
  label: required(40, 'Informe o texto do link.'),
  href: link,
});

export const socialLinkSchema = z.object({
  network: z.enum(SOCIAL_NETWORKS),
  label: text(60),
  url: link,
  // Aparece como ícone no rodapé (os contatos das páginas mostram todos).
  footer: z.boolean(),
});

export const siteSettingsSchema = z.object({
  general: z.object({
    name: required(60, 'Informe o nome do site.'),
    description: text(300),
    // Endereço público (canônico): RSS, sitemap, robots e prévias de links.
    url: z
      .string()
      .trim()
      .max(200)
      .refine(
        (value) => value === '' || isHttpUrl(value),
        'Use o endereço completo, como https://seu-dominio.com',
      )
      .transform((value) => value.replace(/\/+$/, '')),
    author: text(80),
    keywords: z
      .array(required(40, 'Palavra-chave vazia.'))
      .max(30, 'Use no máximo 30 palavras-chave.'),
    // Imagem das prévias ao compartilhar (Open Graph / Twitter).
    shareImage: image,
  }),
  navigation: z.object({
    logo: z.object({
      text: required(40, 'Informe o texto do logo.'),
      accent: text(40),
    }),
    links: z.array(navLinkSchema).max(12, 'Use no máximo 12 links no menu.'),
    showSearch: z.boolean(),
    showThemeToggle: z.boolean(),
    showAccountButtons: z.boolean(),
    // Aba "Creators" (/creators) depois dos links do menu.
    showCreators: z.boolean(),
  }),
  home: z.object({
    kicker: text(60),
    title: required(60, 'Informe o título da página inicial.'),
    titleAccent: text(60),
    lead: text(800),
    topics: z.array(required(30, 'Tema vazio.')).max(12, 'Use no máximo 12 temas.'),
    recentKicker: text(60),
    recentTitle: text(80),
    recentCount: z
      .number()
      .int()
      .min(1, 'Mostre pelo menos 1 post.')
      .max(20, 'Mostre no máximo 20 posts.'),
    viewAllLabel: text(40),
    emptyText: text(200),
    // Bloco "Sobre" no fim da página inicial. *palavra* fica destacada.
    about: text(400),
  }),
  postsPage: z.object({
    title: required(60, 'Informe o título da página de posts.'),
    description: text(300),
  }),
  footer: z.object({
    // {ano} vira o ano atual e {site} o nome do site.
    copyright: text(200),
    note: text(200),
    cta: z.object({ enabled: z.boolean(), label: text(60), href: optionalLink }),
  }),
  social: z.array(socialLinkSchema).max(20, 'Use no máximo 20 redes.'),
  integrations: z.object({
    // Comentários do próprio site (conta de leitor + moderação no painel).
    comments: z.object({
      enabled: z.boolean(),
      title: text(60),
    }),
    plausible: z.object({
      enabled: z.boolean(),
      domain: text(200),
      scriptUrl: z
        .string()
        .trim()
        .max(500)
        .refine((value) => /^https:\/\/\S+$/.test(value), 'Use um endereço https://'),
    }),
    // Só tem efeito na Vercel (fora dela o script não existe).
    vercelAnalytics: z.object({ enabled: z.boolean() }),
    share: z.object({ x: z.boolean(), linkedin: z.boolean() }),
  }),
  notFound: z.object({
    title: required(80, 'Informe o título da página 404.'),
    text: text(300),
    buttonLabel: text(40),
  }),
});

export type SiteSettings = z.infer<typeof siteSettingsSchema>;
export type NavLink = z.infer<typeof navLinkSchema>;
export type SocialLink = z.infer<typeof socialLinkSchema>;

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  general: {
    name: 'Gaspar Labs',
    description: 'Research, systems, cybersecurity, IA e underground web.',
    url: '',
    author: 'Gaspar',
    keywords: [
      'gaspar labs',
      'desenvolvimento',
      'programacao',
      'software',
      'tecnologia',
      'arquitetura',
      'sistemas',
      'cybersecurity',
      'hacking',
      'ia',
      'internet',
    ],
    shareImage: '/icon.png',
  },
  navigation: {
    logo: { text: 'Gaspar Labs', accent: '' },
    links: [
      { label: 'Arquivo', href: '/posts' },
      { label: 'Seções', href: '/#secoes' },
      { label: 'Sobre', href: '/about' },
    ],
    showSearch: true,
    showThemeToggle: true,
    showAccountButtons: true,
    showCreators: true,
  },
  home: {
    kicker: 'blog de pesquisa e investigação',
    title: 'Um arquivo vivo da internet moderna.',
    titleAccent: 'vivo',
    lead: 'Pesquisas, investigações e reflexões técnicas, explicadas com fontes e sem enrolação.',
    topics: [],
    recentKicker: 'índice',
    recentTitle: 'Posts recentes',
    recentCount: 6,
    viewAllLabel: 'Ver o arquivo completo',
    emptyText: 'Nenhum post publicado ainda.',
    about:
      'Links morrem, posts somem e o contexto se perde. Aqui a gente investiga, anota as fontes e *arquiva*, para que o que aconteceu continue verificável.',
  },
  postsPage: {
    title: 'Arquivo',
    description: 'Todos os posts publicados, com busca e filtros por seção.',
  },
  footer: {
    copyright: '© {ano} {site}. Todos os direitos reservados.',
    note: 'Sem cookies de rastreio · Sem anúncios · Sem scripts invasivos',
    cta: { enabled: true, label: 'Seja um apoiador', href: '/support' },
  },
  social: [
    {
      network: 'instagram',
      label: 'Gasparzeon',
      url: 'https://instagram.com/gasparzeon',
      footer: true,
    },
    {
      network: 'discord',
      label: 'gasparzeon',
      url: 'https://discord.com/users/1360367947385798810',
      footer: false,
    },
    {
      network: 'email',
      label: 'h4xcats@gmail.com',
      url: 'mailto:h4xcats@gmail.com',
      footer: false,
    },
    { network: 'rss', label: 'RSS', url: '/rss.xml', footer: true },
  ],
  integrations: {
    comments: {
      enabled: true,
      title: 'Comentários',
    },
    plausible: { enabled: false, domain: '', scriptUrl: 'https://plausible.io/js/script.js' },
    vercelAnalytics: { enabled: true },
    share: { x: true, linkedin: true },
  },
  notFound: {
    title: 'Página não encontrada',
    text: 'A página que você está procurando não existe ou foi movida para outro endereço.',
    buttonLabel: 'Voltar para o início',
  },
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Campos ausentes vêm do padrão; listas salvas substituem as do padrão.
function mergeDefaults(base: unknown, stored: unknown): unknown {
  if (!isPlainObject(base)) return stored === undefined ? base : stored;
  if (!isPlainObject(stored)) return base;
  return Object.fromEntries(
    Object.entries(base).map(([key, value]) => [
      key,
      // eslint-disable-next-line security/detect-object-injection -- as chaves vêm do objeto de padrões (código), não do que foi salvo
      mergeDefaults(value, stored[key]),
    ]),
  );
}

// O que está salvo no banco, completado com os padrões. Uma seção corrompida
// (ou de uma versão antiga incompatível) volta ao padrão sem derrubar o site.
export function withDefaults(stored: unknown): SiteSettings {
  const merged = mergeDefaults(DEFAULT_SITE_SETTINGS, stored) as Record<string, unknown>;
  const result = siteSettingsSchema.safeParse(merged);
  if (result.success) return result.data;

  const sections = Object.keys(DEFAULT_SITE_SETTINGS) as (keyof SiteSettings)[];
  const repaired = Object.fromEntries(
    sections.map((section) => {
      /* eslint-disable security/detect-object-injection -- seções fixas do schema (código), não entrada do usuário */
      const parsed = siteSettingsSchema.shape[section].safeParse(merged[section]);
      return [section, parsed.success ? parsed.data : DEFAULT_SITE_SETTINGS[section]];
      /* eslint-enable security/detect-object-injection */
    }),
  );
  return repaired as SiteSettings;
}

export const CREATORS_LINK = { label: 'Creators', href: '/creators' } as const;

// Links do menu (cabeçalho, menu do celular e rodapé): os do painel e, se
// ligada, a aba Creators no fim (sem repetir se alguém já pôs o link à mão).
export function siteNavLinks(navigation: SiteSettings['navigation']): NavLink[] {
  const { links, showCreators } = navigation;
  if (!showCreators || links.some((link) => link.href === CREATORS_LINK.href)) return links;
  return [...links, { ...CREATORS_LINK }];
}

// Troca {ano} e {site} em textos como o copyright do rodapé.
export function fillTemplate(template: string, settings: SiteSettings, now = new Date()) {
  return template
    .replaceAll('{ano}', String(now.getFullYear()))
    .replaceAll('{site}', settings.general.name);
}

// Endereço público: o do painel, senão NEXT_PUBLIC_SITE_URL, senão localhost.
export function resolveSiteUrl(settings: SiteSettings) {
  return (
    settings.general.url ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '') ||
    'http://localhost:3000'
  );
}

export const saveSiteSettingsSchema = z.object({
  settings: siteSettingsSchema,
  // Data da versão que o painel carregou; evita sobrescrever a edição de outra pessoa.
  expectedUpdatedAt: z.string().datetime().nullable(),
});
