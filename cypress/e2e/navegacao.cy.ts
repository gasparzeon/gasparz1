describe('Navegação: menu, busca, tema e animações', () => {
  it('menu abre como diálogo, prende o foco, fecha com Esc e devolve o foco', () => {
    cy.viewport(390, 844);
    cy.abrir('/');
    cy.contains('button', 'Menu').click();
    cy.get('[role="dialog"]').should('be.visible');
    // Modal: o resto da página sai da árvore de acessibilidade enquanto o menu está aberto.
    cy.get('main').should('have.attr', 'aria-hidden', 'true');
    cy.focused().should('have.text', 'Fechar');

    cy.get('[role="dialog"]').within(() => {
      cy.contains('a', 'Investigações').should('have.attr', 'href', '/posts?secao=investigacoes');
      cy.contains('[role="group"]', 'Tema').should('exist');
    });

    cy.press(Cypress.Keyboard.Keys.ESC);
    cy.get('[role="dialog"]').should('not.exist');
    cy.focused().should('contain.text', 'Menu');
  });

  it('Ctrl+K abre a busca; Enter abre o post escolhido', () => {
    cy.abrir('/');
    cy.get('body').type('{ctrl}k');
    cy.get('[role="dialog"]').should('be.visible');
    cy.focused()
      .should('have.attr', 'role', 'combobox')
      .and('have.attr', 'aria-labelledby')
      .then((id) =>
        cy.get(`#${CSS.escape(String(id))}`).should('have.text', 'Buscar posts e etiquetas'),
      );

    cy.focused().type('superguia');
    cy.get('[role="option"]').should('have.length', 1).and('contain.text', 'El Niño');
    cy.focused().type('{enter}');
    cy.location('pathname').should('eq', '/posts/el-nino-2026-superguia-do-ciclo-enos');
  });

  // Regressão do erro de hidratação (aria-pressed das preferências).
  it('tema claro fica salvo e a página volta clara, sem erro de hidratação', () => {
    cy.abrir('/');
    cy.get('html').should('have.class', 'dark');
    cy.get('header').contains('button', 'Alternar tema').click();
    cy.get('html').should('have.class', 'light');

    cy.reload();
    cy.get('html').should('have.class', 'light');
    cy.contains('footer button', 'Claro').should('have.attr', 'aria-pressed', 'true');
    cy.contains('footer button', 'Escuro').should('have.attr', 'aria-pressed', 'false');
    cy.semErrosNoConsole();

    cy.abrir('/posts', { tema: 'light' });
    cy.contains('footer button', 'Claro').should('have.attr', 'aria-pressed', 'true');
    cy.semErrosNoConsole();
  });

  it('desligar as animações vale para as próximas páginas', () => {
    cy.abrir('/', { animacoes: 'on' });
    cy.contains('footer button', 'Desligadas').click().should('have.attr', 'aria-pressed', 'true');
    cy.get('html').should('have.attr', 'data-motion', 'off');

    cy.visit('/posts');
    cy.get('html').should('have.attr', 'data-motion', 'off');
    cy.contains('footer button', 'Desligadas').should('have.attr', 'aria-pressed', 'true');
  });

  it('trilha "Você está em" no arquivo, nos posts e nas páginas; seção marcada no menu', () => {
    cy.abrir('/posts');
    cy.get('nav[aria-label="Você está em"]').within(() => {
      cy.contains('a', 'Início').should('have.attr', 'href', '/');
      cy.contains('[aria-current="page"]', 'Arquivo');
    });

    cy.abrir('/posts/h4ck34ndo-as-urnas');
    cy.get('nav[aria-label="Você está em"]')
      .contains('a', 'Investigações')
      .should('have.attr', 'href', '/posts?secao=investigacoes');
    cy.get('nav[aria-label="Principal"]')
      .contains('a', 'Arquivo')
      .should('have.attr', 'aria-current', 'true');

    cy.abrir('/about');
    cy.get('nav[aria-label="Você está em"]').contains('[aria-current="page"]', 'Sobre');
    cy.get('nav[aria-label="Principal"]')
      .contains('a', 'Sobre')
      .should('have.attr', 'aria-current', 'page');
    cy.get('main').should('have.length', 1);
  });
});
