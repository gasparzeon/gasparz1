const titulos = () => cy.get('.gz-item-title a');

describe('Arquivo (/posts)', () => {
  beforeEach(() => {
    cy.abrir('/posts');
  });

  it('lista todos os posts agrupados por mês', () => {
    titulos().should('have.length', 14);
    cy.get('h2.gz-month-h').should('have.length.at.least', 2);
    cy.semErrosNoConsole();
  });

  it('busca sem diferenciar acentos e guarda a busca no endereço', () => {
    cy.get('#gz-busca').type('nino');
    titulos().should('have.length', 1).first().should('contain.text', 'El Niño');
    cy.location('search').should('contain', 'q=nino');

    cy.contains('button', 'Limpar').click();
    titulos().should('have.length', 14);
    cy.focused().should('have.id', 'gz-busca');
  });

  it('filtra por seção com botões de estado (aria-pressed)', () => {
    cy.get('[aria-labelledby="gz-secao-t"]').within(() => {
      cy.contains('button', 'Investigações')
        .click()
        .should('have.attr', 'aria-pressed', 'true')
        .and('contain.text', '(3)');
      cy.contains('button', 'Todas').should('have.attr', 'aria-pressed', 'false');
    });
    titulos().should('have.length', 3);
    cy.location('search').should('contain', 'secao=investigacoes');
  });

  it('ordena do mais antigo para o mais recente', () => {
    titulos()
      .first()
      .invoke('text')
      .then((maisRecente) => {
        cy.get('#gz-ordem').select('Mais antigos primeiro');
        titulos().last().should('have.text', maisRecente);
        cy.location('search').should('contain', 'ordem=antigos');
      });
  });

  it('diz quando nada foi encontrado e oferece limpar os filtros', () => {
    cy.get('#gz-busca').type('xyzzy-sem-resultado');
    cy.contains('Nenhum post encontrado.').should('be.visible');
    cy.contains('button', 'Limpar filtros').click();
    titulos().should('have.length', 14);
  });

  it('abre já filtrado a partir do endereço (?secao=&tag=)', () => {
    cy.abrir('/posts?secao=reflexoes');
    cy.contains('button', 'Reflexões').should('have.attr', 'aria-pressed', 'true');
    titulos().should('have.length', 4);
  });
});
