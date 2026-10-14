const POST = '/posts/h4ck34ndo-as-urnas';
const partes = () => cy.get('[data-gz-decode] h2:not(.sr-only)');

describe('Página do post', () => {
  it('cabeçalho com seção, autor, data e tempo de leitura', () => {
    cy.abrir(POST);
    cy.get('[data-gz-article] h1').should('have.text', 'H4CK34NDO AS URNAS!');
    cy.get('.gz-post-head').within(() => {
      cy.contains('a', 'Investigação').should('have.attr', 'href', '/posts?secao=investigacoes');
      cy.contains('a', 'Por ')
        .should('have.attr', 'href')
        .and('match', /^\/autores\//);
      cy.get('time').should('have.attr', 'dateTime');
      cy.contains(/min de leitura/);
    });
    cy.semErrosNoConsole();
  });

  it('cada parte do texto tem o rótulo "Parte N" e o índice conta as mesmas partes', () => {
    cy.abrir(POST);
    partes()
      .should('have.length.at.least', 3)
      .each(($h2) => {
        // Rótulo gerado pelo CSS (contador), decorativo: texto alternativo vazio.
        const rotulo = getComputedStyle($h2[0], '::before').content;
        expect(rotulo).to.contain('Parte').and.to.contain('counter(gz-part)');
      })
      .then(($partes) => {
        cy.get('.gz-toc-btn small').should('contain.text', `parte 1 de ${$partes.length}`);
      });
  });

  it('índice: lista as partes, leva a cada uma e marca a atual', () => {
    cy.abrir(POST);
    cy.get('nav[aria-labelledby]')
      .contains('Neste post')
      .closest('nav')
      .as('indice')
      .find('a[href^="#"]')
      .should('have.length.at.least', 3);

    partes()
      .eq(2)
      .invoke('attr', 'id')
      .then((id) => {
        cy.get('@indice').find(`a[href="#${id}"]`).click({ force: true });
        cy.location('hash').should((hash) => expect(decodeURIComponent(hash)).to.eq(`#${id}`));
        cy.get(`#${id}`).should(($h2) => {
          const top = $h2[0].getBoundingClientRect().top;
          expect(top).to.be.within(-5, 400);
        });
        cy.get('@indice').find(`a[href="#${id}"]`).should('have.attr', 'aria-current', 'location');
        cy.get('@indice').find('.gz-toc-btn small').should('contain.text', 'parte 3 de');
      });
  });

  it('tamanho do texto muda na hora e continua escolhido ao voltar', () => {
    cy.abrir(POST);
    cy.contains('[role="group"]', 'Tamanho do texto').within(() => {
      cy.contains('button', 'Maior').click().should('have.attr', 'aria-pressed', 'true');
    });
    cy.document().then((doc) => {
      expect(doc.documentElement.style.getPropertyValue('--gz-fs')).to.eq('1.26');
    });

    cy.reload();
    cy.contains('[role="group"]', 'Tamanho do texto')
      .contains('button', 'Maior')
      .should('have.attr', 'aria-pressed', 'true');
  });

  it('copia o link do post e avisa (região aria-live)', () => {
    cy.abrir(POST);
    cy.window().then((win) => {
      cy.stub(win.navigator.clipboard, 'writeText').as('copiar').resolves(undefined);
    });
    cy.contains('button', 'Copiar link').click();
    cy.get('@copiar').should('have.been.calledWithMatch', /\/posts\/h4ck34ndo-as-urnas$/);
    cy.contains('button', 'Link copiado');
    cy.get('[aria-live="polite"]').should('contain.text', 'Link do post copiado.');
  });

  it('etiquetas levam ao arquivo filtrado; anterior e próximo levam a outros posts', () => {
    cy.abrir(POST);
    cy.get('.gz-endcard .gz-tag')
      .first()
      .should('have.attr', 'href')
      .and('match', /^\/posts\?tag=/);
    cy.get('nav[aria-label="Outros posts"] a.gz-pn-card')
      .should('have.length.at.least', 1)
      .first()
      .should('have.attr', 'href')
      .and('match', /^\/posts\/[a-z0-9-]+$/);
  });
});
