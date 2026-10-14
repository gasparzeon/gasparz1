describe('Início', () => {
  it('título, seções com contagem e posts recentes levando aos posts', () => {
    cy.abrir('/');
    cy.get('h1').should('have.text', 'Um arquivo vivo da internet moderna.');

    cy.get('section[aria-labelledby="gz-sec-t"]').within(() => {
      cy.get('a[href^="/posts?secao="]').should('have.length', 5);
      cy.contains('a', 'Investigações').should('have.attr', 'href', '/posts?secao=investigacoes');
    });

    cy.get('section[aria-labelledby="gz-rec-t"] .gz-item-title a')
      .should('have.length.at.least', 3)
      .first()
      .should('have.attr', 'href')
      .and('match', /^\/posts\/[a-z0-9-]+$/);

    cy.get('section[aria-labelledby="gz-rec-t"] .gz-item-title a').first().click();
    cy.location('pathname').should('match', /^\/posts\/[a-z0-9-]+$/);
    cy.get('[data-gz-article] h1').should('be.visible');
    cy.semErrosNoConsole();
  });

  it('o letreiro pode ser pausado (WCAG 2.2.2)', () => {
    cy.abrir('/', { animacoes: 'on' });
    cy.get('button[aria-label="Pausar letreiro de últimos posts"]')
      .as('pausa')
      .should('have.attr', 'aria-pressed', 'false');
    cy.get('@pausa').click().should('have.attr', 'aria-pressed', 'true');
    cy.get('[data-gz-marquee]').should('have.attr', 'data-gz-paused', 'true');
    cy.get('@pausa').click().should('have.attr', 'aria-pressed', 'false');
  });

  it('o primeiro Tab leva ao link "Pular para o conteúdo", que aparece na tela', () => {
    cy.abrir('/');
    cy.press(Cypress.Keyboard.Keys.TAB);
    cy.focused()
      .should('have.text', 'Pular para o conteúdo')
      .and('have.attr', 'href', '#conteudo')
      .then(($link) => {
        const box = $link[0].getBoundingClientRect();
        expect(box.width).to.be.greaterThan(40);
        expect(box.height).to.be.greaterThan(20);
      });
  });

  it('no celular cabe na largura da tela e o menu fica à mão', () => {
    cy.viewport(390, 844);
    cy.abrir('/');
    cy.document().its('documentElement.scrollWidth').should('be.lte', 390);
    cy.contains('button', 'Menu').should('be.visible');
  });
});
