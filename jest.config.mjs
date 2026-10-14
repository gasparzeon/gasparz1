import nextJest from 'next/jest.js';

// next/jest compila TS/TSX com o SWC do Next, carrega o tsconfig (alias
// `@/`) e já mapeia `server-only` para um módulo vazio.
//
// Dois projetos:
// - unit (este arquivo): tudo, menos *.db.test.ts. Banco e serviços externos
//   entram como mocks.
// - db (jest.db.config.mjs): *.db.test.ts contra um Postgres de verdade
//   (PGlite em memória). Precisa de --experimental-vm-modules, porque o PGlite
//   faz import() dinâmico por dentro.
const createJestConfig = nextJest({ dir: './' });

// Vários pacotes (jose, unified/remark/rehype e dependências) só existem como
// ESM: em vez de listar cada um, transforma o node_modules e pula só os
// grandes pacotes CommonJS.
const SKIP = [
  'next',
  '@next',
  'react',
  'react-dom',
  'scheduler',
  'typescript',
  '@types',
  'jest[^/@]*',
  '@jest',
  'jsdom',
  '@testing-library',
  '@babel',
  '@swc',
  'caniuse-lite',
  'lucide-react',
  'drizzle-orm',
  '@electric-sql',
  'postgres',
  'zod',
  '@radix-ui',
  'recharts',
  'date-fns',
].join('|');

export function buildConfig(kind) {
  /** @type {import('jest').Config} */
  const config = {
    displayName: kind,
    testEnvironment: 'node',
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    // O SWC reescreve `@/` nos imports, mas não dentro de jest.mock().
    moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
    testMatch:
      kind === 'db'
        ? ['<rootDir>/**/__tests__/**/*.db.test.ts']
        : ['<rootDir>/**/__tests__/**/*.test.{ts,tsx}'],
    testPathIgnorePatterns: [
      '/node_modules/',
      '/.next/',
      ...(kind === 'db' ? [] : ['\\.db\\.test\\.ts$']),
    ],
    clearMocks: true,
    restoreMocks: true,
    coverageDirectory: `coverage/${kind}`,
    collectCoverageFrom: [
      'lib/**/*.ts',
      'app/api/**/*.ts',
      'components/admin/**/*.tsx',
      'components/markdown/**/*.tsx',
      '!**/__tests__/**',
      '!**/*.d.ts',
    ],
  };

  return async () => {
    const resolved = await createJestConfig(config)();
    resolved.transformIgnorePatterns = [
      `/node_modules/\\.pnpm/(?:${SKIP.replace(/\//g, '\\+')})@`,
      '^.+\\.module\\.(css|sass|scss)$',
    ];
    return resolved;
  };
}

export default buildConfig('unit');
