const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export type YouTubeRef = { id: string; start?: number };

function parseStart(value: string | null) {
  if (!value) return undefined;
  if (/^\d+s?$/.test(value)) return parseInt(value, 10) || undefined;

  if (value.length > 16) return undefined;
  // eslint-disable-next-line security/detect-unsafe-regex -- entrada limitada a 16 caracteres e grupos separados por h/m/s
  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!match) return undefined;

  const [, h = '0', m = '0', s = '0'] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s) || undefined;
}

// Aceita o ID puro ou links watch, youtu.be, embed, shorts e live.
export function parseYouTube(input: string | null | undefined): YouTubeRef | null {
  const value = input?.trim();
  if (!value) return null;
  if (VIDEO_ID_RE.test(value)) return { id: value };

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  const host = url.hostname.replace(/^(www|m|music)\./, '');
  let id: string | null = null;

  if (host === 'youtu.be') {
    id = url.pathname.split('/')[1] ?? null;
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id =
      url.pathname === '/watch'
        ? url.searchParams.get('v')
        : (url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/]+)/)?.[1] ?? null);
  }

  if (!id || !VIDEO_ID_RE.test(id)) return null;

  const start = parseStart(url.searchParams.get('t') ?? url.searchParams.get('start'));
  return start ? { id, start } : { id };
}

export function isYouTubeUrl(input: string) {
  return /^https?:\/\//i.test(input.trim()) && parseYouTube(input) !== null;
}
