// Login OAuth (código + PKCE) no painel com a conta de teste criada por
// scripts/e2e.mjs (banco em memória: nada aqui afeta o banco de verdade).
describe('Painel (/admin)', () => {
  it('tela de login com campos rotulados e senha que pode ser mostrada', () => {
    cy.abrir('/api/auth/login', { painel: true });
    cy.contains('label', 'Usuário ou e-mail').should('have.attr', 'for', 'username');
    cy.contains('label', 'Senha').should('have.attr', 'for', 'password');
    cy.get('#password').should('have.attr', 'type', 'password');
    cy.get('button[aria-label="Mostrar senha"]').click();
    cy.get('#password').should('have.attr', 'type', 'text');
    cy.get('button[aria-label="Ocultar senha"]').should('exist');
  });

  it('senha errada mostra o erro e não entra', () => {
    cy.entrarNoPainel('senha-errada-de-proposito');
    cy.get('[role="alert"]').should('be.visible');
    cy.location('pathname').should('eq', '/admin/login');
  });

  it('entra, vê os posts e navega pelo painel', () => {
    cy.entrarNoPainel();
    cy.location('pathname', { timeout: 15000 }).should('eq', '/admin');
    cy.get('h1').should('have.text', 'Posts');
    cy.contains('H4CK34NDO AS URNAS!').should('exist');
    cy.get('nav').contains('a', 'Posts').should('have.attr', 'aria-current', 'page');

    cy.acessivel();

    cy.get('nav').contains('a', 'Perfil').click();
    cy.location('pathname').should('eq', '/admin/perfil');
    cy.get('h1').should('have.text', 'Meu perfil');
    cy.get('nav').contains('a', 'Perfil').should('have.attr', 'aria-current', 'page');
  });

  it('"Voltar ao site" leva ao início do site, na mesma aba', () => {
    cy.entrarNoPainel();
    cy.location('pathname', { timeout: 15000 }).should('eq', '/admin');
    cy.contains('header a', 'Voltar ao site')
      .should('have.attr', 'href', '/')
      .and('not.have.attr', 'target');
    cy.contains('header a', 'Voltar ao site').click();
    cy.location('pathname').should('eq', '/');
    cy.get('h1').should('have.text', 'Um arquivo vivo da internet moderna.');
    // Logado, o site mostra o caminho de volta ao painel.
    cy.get('header').contains('a', 'Painel').should('have.attr', 'href', '/admin');
  });

  it('"Pular para o conteúdo" no painel leva à área principal', () => {
    cy.entrarNoPainel();
    cy.location('pathname', { timeout: 15000 }).should('eq', '/admin');
    cy.press(Cypress.Keyboard.Keys.TAB);
    cy.focused().should('have.text', 'Pular para o conteúdo').click();
    cy.focused().should('have.attr', 'id', 'painel');
    cy.get('main#painel').should('have.length', 1);
    cy.get('main').should('have.length', 1);
  });

  it('no celular o menu do painel fica à vista e nada rola para o lado', () => {
    cy.viewport(390, 844);
    cy.entrarNoPainel();
    cy.location('pathname', { timeout: 15000 }).should('eq', '/admin');
    cy.get('nav[aria-label="Painel"]').within(() => {
      ['Posts', 'Comentários', 'Usuários', 'Site', 'Páginas', 'Perfil'].forEach((item) => {
        cy.contains('a', item).should('be.visible');
      });
      cy.contains('a', 'Posts').should('have.attr', 'aria-current', 'page');
    });
    cy.contains('header a', 'site').should('be.visible').and('have.attr', 'href', '/');
    cy.document().its('documentElement.scrollWidth').should('be.lte', 390);
    cy.acessivel();

    cy.get('nav[aria-label="Painel"]').contains('a', 'Perfil').click();
    cy.location('pathname').should('eq', '/admin/perfil');
    cy.get('nav[aria-label="Painel"]')
      .contains('a', 'Perfil')
      .should('have.attr', 'aria-current', 'page');
  });

  it('painel no tema claro também passa no axe', () => {
    cy.entrarNoPainel();
    cy.location('pathname', { timeout: 15000 }).should('eq', '/admin');
    cy.visit('/admin/usuarios', {
      onBeforeLoad(win) {
        win.localStorage.setItem('theme', 'light');
        win.localStorage.setItem('gz-motion', 'off');
      },
    });
    cy.get('html').should('have.class', 'light');
    cy.get('h1').should('have.text', 'Usuários');
    cy.acessivel();
  });

  it('tela de login também tem o caminho de volta ao site', () => {
    cy.abrir('/api/auth/login', { painel: true });
    cy.get('header').contains('a', 'Voltar ao site').should('have.attr', 'href', '/').click();
    cy.location('pathname').should('eq', '/');
  });
});
