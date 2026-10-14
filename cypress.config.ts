import { defineConfig } from 'cypress';

// Testes de ponta a ponta: o site de verdade num navegador. Rode com `pnpm e2e`
// (scripts/e2e.mjs), que faz o build e sobe um servidor isolado, com banco em
// memória e conta de teste, antes de chamar o Cypress.
export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3123',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    viewportWidth: 1280,
    viewportHeight: 860,
    video: false,
    screenshotOnRunFailure: true,
    // As capturas antigas são apagadas pelo scripts/e2e.mjs: a lixeira do
    // Cypress no macOS falha com um binário de outra arquitetura.
    trashAssetsBeforeRuns: false,
    defaultCommandTimeout: 8000,
    retries: { runMode: 1, openMode: 0 },
    setupNodeEvents(on) {
      on('task', {
        // Violações do axe e outros avisos aparecem no terminal do `cypress run`.
        log(message: string) {
          console.log(message);
          return null;
        },
      });
    },
  },
});
