import '@testing-library/jest-dom';

// Segredo fixo só para os testes (os módulos de auth leem do ambiente).
process.env.AUTH_SECRET ??= 'test-secret-with-at-least-32-characters-0123456789';

// Banco: PGlite em memória (um por arquivo de teste), sem importar os posts .mdx.
process.env.PGLITE_DIR = 'memory://';
process.env.SKIP_LEGACY_IMPORT = '1';
