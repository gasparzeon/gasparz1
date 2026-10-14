import { buildConfig } from './jest.config.mjs';

// Testes de integração com Postgres real (PGlite em memória, um por arquivo).
export default buildConfig('db');
