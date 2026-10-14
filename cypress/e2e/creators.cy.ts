// Aba Creators e redes do perfil (como as conexões do Discord). Conta de teste
// "e2e" do scripts/e2e.mjs, dona dos posts importados de content/posts.
describe('Creators e redes sociais', () => {
  it('a aba Creators está no menu e mostra quem escreve', () => {
    cy.abrir('/');
    cy.get('nav[aria-label="Principal"]').contains('a', 'Creators').click();
    cy.location('pathname').should('eq', '/creators');
    cy.get('h1').should('have.text', 'Creators');

    cy.contains('article.gz-creator', '@e2e').within(() => {
      cy.get('h2 a').should('have.attr', 'href', '/autores/e2e');
      cy.get('.gz-creator-stats').should('contain.text', '14 posts');
      cy.get('[aria-label="Escreve em"] li').should('have.length', 5);
    });
    cy.semErrosNoConsole();
  });

  it('a pessoa liga as redes no perfil e elas aparecem no site', () => {
    cy.entrarNoPainel();
    cy.location('pathname', { timeout: 15000 }).should('eq', '/admin');
    cy.get('nav').contains('a', 'Perfil').click();
    cy.location('pathname').should('eq', '/admin/perfil');

    cy.get('#social-instagram').type('instagram.com/gaspar.labs');
    cy.get('#social-instagram-nome').type('Gaspar Labs');
    cy.get('#social-x').type('@gasparzeon');

    // Link de outro site: erro ligado ao campo, e nada é salvo.
    cy.get('#social-tiktok').type('https://evil.com/@gaspar').blur();
    cy.get('#social-tiktok')
      .should('have.attr', 'aria-invalid', 'true')
      .invoke('attr', 'aria-describedby')
      .then((id) => cy.get(`#${id}`).should('have.text', 'Esse link não é do TikTok.'));
    cy.get('#social-tiktok').clear().type('@gaspar_labs');

    cy.contains('legend', 'Redes sociais')
      .parent()
      .find('[aria-label^="Redes de"] a')
      .should('have.length', 3);
    cy.contains('button', 'Salvar perfil').click();
    cy.contains('Perfil atualizado.');

    cy.visit('/creators');
    cy.contains('article.gz-creator', '@e2e')
      .find('a[href="https://www.instagram.com/gaspar.labs/"]')
      .should('have.attr', 'target', '_blank')
      .and('have.attr', 'rel', 'me noopener noreferrer')
      .and('contain.text', 'Gaspar Labs')
      .and('contain.text', 'Instagram');

    cy.visit('/autores/e2e');
    cy.get('ul[aria-label^="Redes de"] a')
      .should('have.length', 3)
      .then(($links) => [...$links].map((link) => link.getAttribute('href')))
      .should('deep.equal', [
        'https://x.com/gasparzeon',
        'https://www.tiktok.com/@gaspar_labs',
        'https://www.instagram.com/gaspar.labs/',
      ]);

    cy.visit('/posts/h4ck34ndo-as-urnas');
    cy.contains('.gz-endcard h2', 'Quem escreveu')
      .parent()
      .within(() => {
        cy.contains('a', 'e2e').should('have.attr', 'href', '/autores/e2e');
        cy.get('a[href="https://x.com/gasparzeon"]').should('contain.text', '@gasparzeon');
      });

    cy.abrir('/creators');
    cy.acessivel();
  });

  it('README: a pessoa escreve no perfil e ele aparece na página de autor', () => {
    cy.entrarNoPainel();
    cy.location('pathname', { timeout: 15000 }).should('eq', '/admin');
    cy.visit('/admin/perfil#readme');

    cy.get('#profile-readme')
      .should('have.attr', 'maxLength', '1200')
      .clear()
      .type(
        '# Sobre mim\nPesquiso **urnas** e segurança.\n\n- [x] eleições\n- privacidade\n\n[meu site](https://gaspar.dev)',
        { delay: 0 },
      );
    cy.get('#readme-contador').should('contain.text', '/ 1.200 caracteres');

    cy.contains('[role="tab"]', 'Visualizar').click();
    cy.get('#readme .gz-readme-body h3').should('have.text', 'Sobre mim');
    cy.contains('[role="tab"]', 'Escrever').click();

    cy.contains('button', 'Salvar perfil').click();
    cy.contains('Perfil atualizado.');

    cy.visit('/autores/e2e');
    cy.get('section#readme')
      .should('have.attr', 'aria-labelledby')
      .then((id) => cy.get(`#${id}`).should('have.text', 'README.md'));
    cy.get('section#readme').within(() => {
      cy.get('h3').should('have.text', 'Sobre mim');
      cy.get('strong').should('have.text', 'urnas');
      cy.get('input').should('not.exist');
      cy.get('.task-mark[data-done="true"]').should('have.attr', 'aria-hidden', 'true');
      cy.contains('li', 'eleições').should('contain.text', 'Feito:');
      cy.contains('a', 'meu site')
        .should('have.attr', 'href', 'https://gaspar.dev')
        .and('have.attr', 'rel', 'nofollow ugc noopener noreferrer');
      // Só a própria pessoa vê o atalho para editar.
      cy.contains('a', 'Editar meu README').should('have.attr', 'href', '/admin/perfil#readme');
    });
    cy.acessivel();

    // Visitante (sem sessão) não vê o atalho; Creators leva ao README.
    cy.clearCookies();
    cy.abrir('/creators');
    cy.contains('article.gz-creator', '@e2e')
      .contains('a', 'Ler o README')
      .should('have.attr', 'href', '/autores/e2e#readme')
      .click();
    cy.location('hash').should('eq', '#readme');
    cy.get('section#readme').should('exist');
    cy.contains('Editar meu README').should('not.exist');
  });

  it('o cursor não aparece mais como coordenadas na abertura', () => {
    cy.abrir('/', { animacoes: 'on' });
    cy.get('.gz-hero').trigger('pointermove', { clientX: 300, clientY: 200 });
    cy.get('.gz-hero .gz-status').should('not.contain.text', 'cursor');
  });
});
