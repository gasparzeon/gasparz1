// axe-core (WCAG 2.2 A/AA + boas práticas) nas páginas principais, nos dois
// temas. Contraste, nomes de botões e links, rótulos de campos, marcos etc.
const PAGINAS = ['/', '/posts', '/posts/h4ck34ndo-as-urnas', '/autores/e2e', '/creators'];

describe('Acessibilidade (axe)', () => {
  (['dark', 'light'] as const).forEach((tema) => {
    describe(`tema ${tema === 'dark' ? 'escuro' : 'claro'}`, () => {
      PAGINAS.forEach((pagina) => {
        it(pagina, () => {
          cy.abrir(pagina, { tema });
          cy.acessivel();
        });
      });

      it('página não encontrada (404)', () => {
        cy.abrir('/pagina-que-nao-existe', { tema, aceitarErroHttp: true });
        cy.get('h1').should('be.visible');
        cy.acessivel();
      });

      it('/admin/login', () => {
        cy.abrir('/api/auth/login', { tema, painel: true });
        cy.get('form').should('be.visible');
        cy.acessivel();
      });

      it('menu e busca abertos', () => {
        cy.abrir('/', { tema });
        cy.contains('button', 'Menu').click();
        cy.get('[role="dialog"]').should('be.visible');
        cy.acessivel('[role="dialog"]');
        cy.press(Cypress.Keyboard.Keys.ESC);

        cy.get('body').type('{ctrl}k');
        cy.get('[role="dialog"]').should('be.visible');
        cy.acessivel('[role="dialog"]');
      });
    });
  });

  it('no celular, nenhuma página principal rola para o lado', () => {
    cy.viewport(390, 844);
    ['/', '/posts', '/posts/h4ck34ndo-as-urnas'].forEach((pagina) => {
      cy.abrir(pagina);
      cy.document().its('documentElement.scrollWidth').should('be.lte', 390);
    });
  });
});
