import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import security from 'eslint-plugin-security';
import prettier from 'eslint-config-prettier/flat';

// Next 16 ships native flat configs at `eslint-config-next/<sub>`. Import
// them directly — `@eslint/eslintrc` FlatCompat chokes on the legacy
// config's self-referential `react` plugin (circular structure JSON).
//
// Layer order (last wins on overlap):
//   1. Next core-web-vitals + typescript baselines
//   2. Security plugin (ALL rules at error)
//   3. eslint-config-prettier — disables stylistic rules that fight the
//      formatter. MUST be last.
const config = [
  {
    ignores: [
      '.next/**',
      '.data/**',
      '.pnpm-store/**',
      'node_modules/**',
      'next-env.d.ts',
      'out/**',
      'build/**',
      'coverage/**',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // O projeto não usa src/: as regras valem para todo o código TS.
    files: ['**/*.{ts,tsx}'],
    plugins: { security },
    rules: {
      // ── ALL security/* rules at ERROR ─────────────────────
      // Every finding must be either (a) fixed or (b) suppressed at the
      // call site with an inline eslint-disable + justification comment.
      'security/detect-pseudoRandomBytes': 'error',
      'security/detect-object-injection': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-non-literal-require': 'error',
      'security/detect-non-literal-fs-filename': 'error',
      'security/detect-non-literal-regexp': 'error',
      'security/detect-child-process': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-unsafe-regex': 'error',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-new-buffer': 'error',
      'security/detect-bidi-characters': 'error',
      'security/detect-possible-timing-attacks': 'error',
      'security/detect-no-csrf-before-method-override': 'error',

      // React Compiler-era rules from eslint-plugin-react-hooks 7. Both
      // fire on legitimate patterns (client-only hydration sync, async
      // fetch -> loading flag, third-party libs not yet compiler-compat).
      // Disabled outright so the project-wide `--max-warnings 0` CI gate
      // doesn't trip on documented false positives. Re-evaluate once the
      // rules stabilise.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/incompatible-library': 'off',

      // next.config usa `images.unoptimized: true`, então <Image> não otimiza
      // nada; e a mídia dos posts vem de URLs arbitrárias (Blob, externas)
      // sem dimensões conhecidas. <img> com loading/decoding é o correto aqui.
      '@next/next/no-img-element': 'off',

      // A rota de páginas app/[slug] faz a regra tratar qualquer caminho de um
      // segmento (/admin, /api/auth/login…) como página. Os <a> do login OAuth
      // e do painel são intencionais: precisam de navegação completa.
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
  {
    // Cypress: asserções do Chai em forma de propriedade (expect(x).to.be.empty).
    files: ['cypress/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
  {
    // Testes: diretórios temporários (mkdtemp), fixtures indexadas e
    // `require()` tardio para carregar módulos depois de mockar cwd/env.
    files: ['**/__tests__/**/*.{ts,tsx}', 'test/**/*.ts', 'jest.setup.ts'],
    rules: {
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-object-injection': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  prettier,
];

export default config;
