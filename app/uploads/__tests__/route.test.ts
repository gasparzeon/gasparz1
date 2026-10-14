import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { GET, HEAD } from '../[...path]/route';

// Arquivos de verdade numa pasta temporária (UPLOADS_DIR), como num servidor
// próprio com os uploads num volume.
const root = mkdtempSync(path.join(tmpdir(), 'gaspar-uploads-'));
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5, 6, 7, 8]);
const previous = process.env.UPLOADS_DIR;

beforeAll(() => {
  process.env.UPLOADS_DIR = root;
  mkdirSync(path.join(root, '2026', '10'), { recursive: true });
  writeFileSync(path.join(root, '2026', '10', 'foto-ab12.png'), PNG);
  writeFileSync(path.join(root, '2026', '10', 'demo-cd34.mp4'), Buffer.alloc(1000, 7));
  writeFileSync(path.join(root, '2026', '10', 'envio.png.part'), PNG);
  writeFileSync(path.join(root, '2026', '10', 'logo.svg'), '<svg onload="alert(1)"/>');
  writeFileSync(path.join(root, '..', 'segredo.png'), PNG);
});

afterAll(() => {
  process.env.UPLOADS_DIR = previous;
  rmSync(root, { recursive: true, force: true });
  rmSync(path.join(root, '..', 'segredo.png'), { force: true });
});

const get = (segments: string[], headers: Record<string, string> = {}) =>
  GET(new Request(`http://localhost/uploads/${segments.join('/')}`, { headers }), {
    params: Promise.resolve({ path: segments }),
  });

describe('GET /uploads/[...path]', () => {
  it('entrega o arquivo enviado com o tipo certo e cache longo', async () => {
    const response = await get(['2026', '10', 'foto-ab12.png']);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('content-length')).toBe(String(PNG.length));
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(Buffer.from(await response.arrayBuffer())).toEqual(PNG);
  });

  it('responde a pedidos parciais (o Safari precisa disso para vídeo)', async () => {
    const partial = await get(['2026', '10', 'demo-cd34.mp4'], { range: 'bytes=100-199' });
    expect(partial.status).toBe(206);
    expect(partial.headers.get('content-range')).toBe('bytes 100-199/1000');
    expect(partial.headers.get('content-length')).toBe('100');
    expect((await partial.arrayBuffer()).byteLength).toBe(100);

    const tail = await get(['2026', '10', 'demo-cd34.mp4'], { range: 'bytes=-10' });
    expect(tail.headers.get('content-range')).toBe('bytes 990-999/1000');

    const open = await get(['2026', '10', 'demo-cd34.mp4'], { range: 'bytes=900-' });
    expect(open.headers.get('content-range')).toBe('bytes 900-999/1000');
  });

  it('intervalo fora do arquivo responde 416', async () => {
    const response = await get(['2026', '10', 'demo-cd34.mp4'], { range: 'bytes=5000-6000' });
    expect(response.status).toBe(416);
    expect(response.headers.get('content-range')).toBe('bytes */1000');
  });

  it('HEAD devolve só os cabeçalhos', async () => {
    const response = await HEAD(
      new Request('http://localhost/uploads/2026/10/foto-ab12.png', { method: 'HEAD' }),
      {
        params: Promise.resolve({ path: ['2026', '10', 'foto-ab12.png'] }),
      },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-length')).toBe(String(PNG.length));
    expect(response.body).toBeNull();
  });

  it.each([
    ['arquivo que não existe', ['2026', '10', 'nada.png']],
    ['upload interrompido (.part)', ['2026', '10', 'envio.png.part']],
    ['SVG', ['2026', '10', 'logo.svg']],
    ['subindo pastas', ['..', 'segredo.png']],
    ['subindo pastas no meio', ['2026', '..', '..', 'segredo.png']],
    ['barra codificada', ['2026%2F..%2F..%2Fsegredo.png']],
    ['pasta em vez de arquivo', ['2026', '10']],
  ])('404 para %s', async (_label, segments) => {
    expect((await get(segments)).status).toBe(404);
  });
});
