import { defaultSchema, type Options as SanitizeSchema } from 'rehype-sanitize';

// Base: o schema do GitHub (o mesmo que sanitiza READMEs). Com vários
// autores, o HTML dos posts é conteúdo não confiável: nada de <script>,
// <iframe>, <style>, atributos on*, style= ou URLs javascript:.
const base = defaultSchema;
const attributes = base.attributes ?? {};

export const sanitizeSchema: SanitizeSchema = {
  ...base,
  tagNames: [
    ...(base.tagNames ?? []),
    'figure',
    'figcaption',
    'video',
    'mark',
    'u',
    'abbr',
    'cite',
    'small',
  ],
  attributes: {
    ...attributes,
    // remark-math marca fórmulas como code.language-math (+ math-inline/display).
    code: [['className', /^language-./, 'math-inline', 'math-display']],
    img: [...(attributes.img ?? []), 'alt', 'title', 'width', 'height', 'loading'],
    video: ['src', 'poster', 'controls', 'loop', 'muted', 'playsInline', 'width', 'height'],
    source: [...(attributes.source ?? []), 'src', 'type'],
    abbr: ['title'],
  },
  // Removidos junto com o conteúdo (senão o CSS/JS sobraria como texto).
  strip: [...(base.strip ?? []), 'style', 'template', 'noscript'],
  protocols: {
    ...base.protocols,
    src: ['http', 'https'],
    poster: ['http', 'https'],
  },
};
