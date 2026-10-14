// Compartilhado entre o editor e a API de mídia.

export const IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
} as const;

export const VIDEO_TYPES = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
} as const;

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

export type MediaKind = 'image' | 'video';

export type MediaMode = 'blob' | 'local' | 'disabled';

export type MediaItem = {
  url: string;
  pathname: string;
  kind: MediaKind;
  size: number;
  uploadedAt: string;
  uploadedBy: { id: string; name: string } | null;
};

// Object.hasOwn: o Content-Type vem do cliente, e `in`/colchetes
// enxergariam chaves do prototype ("constructor", "toString"…).
export function mediaKindOf(contentType: string): MediaKind | null {
  if (Object.hasOwn(IMAGE_TYPES, contentType)) return 'image';
  if (Object.hasOwn(VIDEO_TYPES, contentType)) return 'video';
  return null;
}

export function extensionFor(contentType: string): string | null {
  if (Object.hasOwn(IMAGE_TYPES, contentType)) {
    return IMAGE_TYPES[contentType as keyof typeof IMAGE_TYPES];
  }
  if (Object.hasOwn(VIDEO_TYPES, contentType)) {
    return VIDEO_TYPES[contentType as keyof typeof VIDEO_TYPES];
  }
  return null;
}

export function contentTypeForExtension(extension: string) {
  const ext = extension.toLowerCase().replace(/^\./, '');
  const all = { ...IMAGE_TYPES, ...VIDEO_TYPES };
  const match = Object.entries(all).find(([, value]) => value === ext);
  if (match) return match[0];
  if (ext === 'jpeg') return 'image/jpeg';
  return null;
}

export function maxBytesFor(kind: MediaKind) {
  return kind === 'image' ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
}

export function isVideoUrl(url: string) {
  const path = url.split(/[?#]/, 1)[0];
  return /\.(mp4|webm|ogv|mov)$/i.test(path);
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Nome seguro para o arquivo: sem acentos, espaços ou caracteres especiais.
export function safeBaseName(fileName: string) {
  const base = fileName.replace(/\.[^.]+$/, '');
  const slug = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'arquivo';
}

export function uploadFolder(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `uploads/${date.getFullYear()}/${month}`;
}
