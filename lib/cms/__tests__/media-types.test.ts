import {
  contentTypeForExtension,
  extensionFor,
  formatBytes,
  isVideoUrl,
  mediaKindOf,
  safeBaseName,
  uploadFolder,
} from '../media-types';

describe('tipos de mídia', () => {
  it('classifica imagens e vídeos suportados', () => {
    expect(mediaKindOf('image/webp')).toBe('image');
    expect(mediaKindOf('video/mp4')).toBe('video');
    expect(mediaKindOf('image/svg+xml')).toBeNull();
    expect(mediaKindOf('text/html')).toBeNull();
    // Content-Type vem do cliente: chaves do prototype não podem passar.
    expect(mediaKindOf('constructor')).toBeNull();
    expect(mediaKindOf('__proto__')).toBeNull();
  });

  it('converte entre extensão e content-type', () => {
    expect(extensionFor('image/jpeg')).toBe('jpg');
    expect(contentTypeForExtension('.JPEG')).toBe('image/jpeg');
    expect(contentTypeForExtension('webm')).toBe('video/webm');
    expect(contentTypeForExtension('exe')).toBeNull();
    // Chaves herdadas do prototype não são formatos.
    expect(extensionFor('constructor')).toBeNull();
  });

  it.each([
    ['/uploads/clip.mp4', true],
    ['https://cdn.com/a.webm?token=1', true],
    ['https://cdn.com/a.MOV#t=10', true],
    ['/uploads/foto.png', false],
    ['https://cdn.com/mp4', false],
  ])('isVideoUrl(%s) = %s', (url, expected) => {
    expect(isVideoUrl(url)).toBe(expected);
  });

  it('gera nomes de arquivo seguros', () => {
    expect(safeBaseName('Foto da Praia (1).JPG')).toBe('foto-da-praia-1');
    expect(safeBaseName('../../etc/passwd')).toMatch(/^[a-z0-9-]+$/);
    expect(safeBaseName('..\\..\\win.ini')).toMatch(/^[a-z0-9-]+$/);
    expect(safeBaseName('???.png')).toBe('arquivo');
  });

  it('organiza uploads por ano/mês', () => {
    expect(uploadFolder(new Date(2026, 0, 5))).toBe('uploads/2026/01');
  });

  it('formata tamanhos', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(15 * 1024 * 1024)).toBe('15.0 MB');
  });
});
