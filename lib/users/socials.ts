import { z } from 'zod';

// Redes que cada pessoa liga ao perfil, como as "conexões" do Discord: ícone,
// nome da conta e um botão que leva ao perfil.
//
// Segurança: o link nunca é guardado como foi digitado. Lemos o usuário (ou o
// id) do que a pessoa colou, conferimos que o endereço é mesmo da rede e
// montamos o link oficial. Um "Instagram" no site sempre leva ao Instagram.

export const PROFILE_NETWORKS = ['spotify', 'x', 'facebook', 'tiktok', 'instagram'] as const;
export type ProfileNetwork = (typeof PROFILE_NETWORKS)[number];

export type ProfileSocial = {
  network: ProfileNetwork;
  // Usuário na rede, sem "@". Vazio quando o link não tem um (perfil do
  // Facebook por número, artista do Spotify).
  handle: string;
  // Endereço montado por nós a partir do usuário ou id.
  url: string;
  // Nome exibido escolhido pela pessoa (opcional).
  label: string;
};

type Found = { handle: string; url: string };

type NetworkInfo = {
  label: string;
  placeholder: string;
  hosts: readonly string[];
  fromHandle: (handle: string) => Found | null;
  fromPath: (segments: string[], params: URLSearchParams) => Found | null;
};

const lower = (value: string) => value.toLowerCase();

// ——— Regras de cada rede ———

const IG_HANDLE = /^[A-Za-z0-9._]{1,30}$/;
const IG_RESERVED = new Set([
  'p',
  'reel',
  'reels',
  'explore',
  'stories',
  'accounts',
  'tv',
  'direct',
]);
const instagram = (handle: string): Found | null =>
  IG_HANDLE.test(handle) && !IG_RESERVED.has(lower(handle))
    ? { handle, url: `https://www.instagram.com/${handle}/` }
    : null;

const X_HANDLE = /^[A-Za-z0-9_]{1,15}$/;
const X_RESERVED = new Set([
  'home',
  'i',
  'intent',
  'search',
  'explore',
  'share',
  'settings',
  'messages',
  'notifications',
  'compose',
  'hashtag',
  'login',
  'signup',
]);
const x = (handle: string): Found | null =>
  X_HANDLE.test(handle) && !X_RESERVED.has(lower(handle))
    ? { handle, url: `https://x.com/${handle}` }
    : null;

const TIKTOK_HANDLE = /^[A-Za-z0-9._]{2,24}$/;
const tiktok = (handle: string): Found | null =>
  TIKTOK_HANDLE.test(handle) ? { handle, url: `https://www.tiktok.com/@${handle}` } : null;

const FB_HANDLE = /^[A-Za-z0-9.]{5,50}$/;
const FB_ID = /^\d{5,20}$/;
const FB_RESERVED = new Set([
  'groups',
  'pages',
  'watch',
  'events',
  'marketplace',
  'share',
  'sharer',
  'sharer.php',
  'login',
  'login.php',
  'gaming',
  'help',
  'policies',
  'photo.php',
  'story.php',
  'permalink.php',
]);
const facebook = (handle: string): Found | null =>
  FB_HANDLE.test(handle) && !FB_RESERVED.has(lower(handle))
    ? { handle, url: `https://www.facebook.com/${handle}` }
    : null;

const SPOTIFY_USER = /^[A-Za-z0-9._-]{1,64}$/;
const SPOTIFY_ARTIST = /^[A-Za-z0-9]{22}$/;
const spotifyUser = (id: string): Found | null =>
  SPOTIFY_USER.test(id) ? { handle: id, url: `https://open.spotify.com/user/${id}` } : null;

const NETWORKS = new Map<ProfileNetwork, NetworkInfo>([
  [
    'spotify',
    {
      label: 'Spotify',
      placeholder: 'open.spotify.com/user/… ou /artist/…',
      hosts: ['open.spotify.com'],
      fromHandle: spotifyUser,
      fromPath(segments) {
        // Links com idioma: open.spotify.com/intl-pt/artist/…
        const [kind, id] = segments[0]?.startsWith('intl-') ? segments.slice(1) : segments;
        if (kind === 'user' && id) return spotifyUser(id);
        if (kind === 'artist' && id && SPOTIFY_ARTIST.test(id)) {
          return { handle: '', url: `https://open.spotify.com/artist/${id}` };
        }
        return null;
      },
    },
  ],
  [
    'x',
    {
      label: 'X (Twitter)',
      placeholder: '@usuario ou x.com/usuario',
      hosts: [
        'x.com',
        'www.x.com',
        'mobile.x.com',
        'twitter.com',
        'www.twitter.com',
        'mobile.twitter.com',
      ],
      fromHandle: x,
      fromPath: ([first]) => (first ? x(first) : null),
    },
  ],
  [
    'facebook',
    {
      label: 'Facebook',
      placeholder: 'facebook.com/usuario',
      hosts: ['facebook.com', 'www.facebook.com', 'm.facebook.com', 'fb.com', 'www.fb.com'],
      fromHandle: facebook,
      fromPath([first], params) {
        if (first === 'profile.php') {
          const id = params.get('id') ?? '';
          return FB_ID.test(id)
            ? { handle: '', url: `https://www.facebook.com/profile.php?id=${id}` }
            : null;
        }
        return first ? facebook(first) : null;
      },
    },
  ],
  [
    'tiktok',
    {
      label: 'TikTok',
      placeholder: '@usuario ou tiktok.com/@usuario',
      hosts: ['tiktok.com', 'www.tiktok.com', 'm.tiktok.com'],
      fromHandle: tiktok,
      fromPath: ([first]) => (first?.startsWith('@') ? tiktok(first.slice(1)) : null),
    },
  ],
  [
    'instagram',
    {
      label: 'Instagram',
      placeholder: '@usuario ou instagram.com/usuario',
      hosts: ['instagram.com', 'www.instagram.com'],
      fromHandle: instagram,
      fromPath: ([first]) => (first ? instagram(first) : null),
    },
  ],
]);

export function isProfileNetwork(value: unknown): value is ProfileNetwork {
  return typeof value === 'string' && NETWORKS.has(value as ProfileNetwork);
}

export function networkInfo(network: ProfileNetwork) {
  const info = NETWORKS.get(network);
  if (!info) throw new Error(`Rede desconhecida: ${network}`);
  return { label: info.label, placeholder: info.placeholder, hosts: info.hosts };
}

// ——— Leitura do que a pessoa digitou ———

export type ParseResult = ({ ok: true } & Found) | { ok: false; error: string };

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

function segmentsOf(pathname: string) {
  return pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });
}

// Aceita o link do perfil (com ou sem https://) ou só o @usuário.
export function parseSocialInput(network: ProfileNetwork, raw: string): ParseResult {
  const info = NETWORKS.get(network);
  const value = raw.trim();
  if (!info || !value) return { ok: false, error: 'Informe o link ou o @usuário.' };

  const looksLikeLink = HAS_SCHEME.test(value) || value.includes('/');
  if (!looksLikeLink) {
    const found = info.fromHandle(value.replace(/^@/, ''));
    return found
      ? { ok: true, ...found }
      : { ok: false, error: `Usuário do ${info.label} inválido.` };
  }

  let url: URL;
  try {
    url = new URL(HAS_SCHEME.test(value) ? value : `https://${value.replace(/^\/+/, '')}`);
  } catch {
    return { ok: false, error: `Link do ${info.label} inválido.` };
  }
  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password) {
    return { ok: false, error: `Link do ${info.label} inválido.` };
  }
  if (!info.hosts.includes(url.hostname.toLowerCase())) {
    return { ok: false, error: `Esse link não é do ${info.label}.` };
  }

  const found = info.fromPath(segmentsOf(url.pathname), url.searchParams);
  return found
    ? { ok: true, ...found }
    : {
        ok: false,
        error: `Não achamos o perfil nesse link do ${info.label}. Cole o link do perfil ou só o @usuário.`,
      };
}

// Nome que aparece no botão: o escolhido, senão o @usuário da rede.
export function socialDisplayName(social: Pick<ProfileSocial, 'network' | 'handle' | 'label'>) {
  if (social.label) return social.label;
  if (social.handle) return social.network === 'spotify' ? social.handle : `@${social.handle}`;
  return social.network === 'spotify'
    ? 'Artista no Spotify'
    : `Perfil no ${networkInfo(social.network).label}`;
}

const ORDER = new Map(PROFILE_NETWORKS.map((network, index) => [network, index]));
const byNetwork = (a: ProfileSocial, b: ProfileSocial) =>
  (ORDER.get(a.network) ?? 0) - (ORDER.get(b.network) ?? 0);

// ——— Entrada do formulário do perfil ———

const labelSchema = z
  .string()
  .max(60, 'Nome exibido muito longo.')
  .transform((value) => value.replace(/\p{Cc}/gu, '').trim());

export const socialInputSchema = z.object({
  network: z.enum(PROFILE_NETWORKS),
  value: z.string().trim().max(300, 'Link muito longo.'),
  label: labelSchema.default(''),
});

// Lista do formulário: uma linha por rede; linha sem link é ignorada.
export const profileSocialsSchema = z
  .array(socialInputSchema)
  .max(PROFILE_NETWORKS.length, 'Redes demais.')
  .superRefine((items, ctx) => {
    const seen = new Set<ProfileNetwork>();
    items.forEach((item, index) => {
      if (seen.has(item.network)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'network'],
          message: `${networkInfo(item.network).label} aparece mais de uma vez.`,
        });
      }
      seen.add(item.network);
      if (!item.value) return;
      const parsed = parseSocialInput(item.network, item.value);
      if (!parsed.ok) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'value'],
          message: parsed.error,
        });
      }
    });
  })
  .transform((items): ProfileSocial[] =>
    items
      .flatMap((item) => {
        const parsed = item.value ? parseSocialInput(item.network, item.value) : null;
        return parsed?.ok
          ? [{ network: item.network, handle: parsed.handle, url: parsed.url, label: item.label }]
          : [];
      })
      .sort(byNetwork),
  );

// ——— Leitura do banco ———

// O jsonb do banco é conferido de novo: entrada estranha (editada à mão, de
// uma versão antiga) é descartada e o link é sempre remontado.
export function readSocials(value: unknown): ProfileSocial[] {
  if (!Array.isArray(value)) return [];
  const result: ProfileSocial[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const { network, url, label } = item as Record<string, unknown>;
    if (!isProfileNetwork(network) || typeof url !== 'string') continue;
    if (result.some((social) => social.network === network)) continue;
    const parsed = parseSocialInput(network, url);
    if (!parsed.ok) continue;
    result.push({
      network,
      handle: parsed.handle,
      url: parsed.url,
      label: typeof label === 'string' ? labelSchema.catch('').parse(label) : '',
    });
  }
  return result.sort(byNetwork);
}
