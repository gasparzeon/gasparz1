import 'cypress-axe';

import './commands';

// Cada teste começa com "reduzir movimento" desligado (o padrão do sistema).
beforeEach(() => {
  cy.reduzirMovimento(false);
});
