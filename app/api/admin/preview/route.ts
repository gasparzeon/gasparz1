import { z } from 'zod';

import { adminRoute, json } from '@/lib/admin/api';
import { markdownToHast, stripPositions } from '@/lib/markdown/pipeline';
import { readmeToHast } from '@/lib/markdown/readme';

const bodySchema = z.object({
  content: z.string().max(1_000_000),
  // "readme": o Markdown restrito do README do perfil.
  kind: z.enum(['post', 'readme']).default('post'),
});

// Renderiza o Markdown com o mesmo pipeline do site (sanitização, Shiki,
// KaTeX) e devolve a árvore HTML para o editor montar o preview.
export const POST = adminRoute(
  'posts:write',
  async (request) => {
    const { content, kind } = bodySchema.parse(await request.json());
    const tree = kind === 'readme' ? await readmeToHast(content) : await markdownToHast(content);
    return json({ tree: stripPositions(tree) });
  },
  // Leitores também têm perfil (e README).
  { allowReader: true },
);
