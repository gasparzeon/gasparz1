// Decodificação: letras viram símbolos e se resolvem; leitores de tela recebem
// o texto real em aria-label durante o efeito; no fim, o texto é o original.
describe('Animações de decodificação', () => {
  it('o título da página decodifica ao abrir', () => {
    cy.abrir('/', { animacoes: 'on', gravarDecodificacao: true });
    cy.decodificou('h1');
    cy.get('h1').should('have.text', 'Um arquivo vivo da internet moderna.');
  });

  it('cada parte do post decodifica ao aparecer, sem estragar o índice', () => {
    cy.abrir('/posts/h4ck34ndo-as-urnas', { animacoes: 'on', gravarDecodificacao: true });
    cy.get('[data-gz-decode] h2:not(.sr-only)')
      .eq(3)
      .then(($h2) => {
        const id = $h2.attr('id');
        const texto = $h2.text().replace(/#$/, '');
        $h2[0].scrollIntoView({ block: 'center' });
        cy.decodificou(`#${id}`);
        cy.get(`#${id}`).should('have.text', `${texto}#`);
        cy.get(`.gz-toc a[href="#${id}"]`).should('contain.text', texto);
      });
  });

  // Só quem tem mouse (hover + ponteiro fino) vê o efeito de novo ao passar por
  // cima; em tela de toque, e no Chrome headless de alguns Linux, não há hover.
  it('título de post decodifica de novo ao passar o mouse (quem tem mouse)', () => {
    const titulo = '.gz-item-title a:eq(1)';
    cy.abrir('/posts', { animacoes: 'on', gravarDecodificacao: true });
    cy.get(titulo).scrollIntoView();
    cy.decodificacaoParou(titulo);
    cy.limparDecodificacao();

    cy.window().then((win) => {
      const mouse = win.matchMedia('(hover: hover) and (pointer: fine)').matches;
      cy.task('log', `[e2e] hover: ${mouse ? 'com mouse' : 'sem mouse (hover: none)'}`);
      cy.get(titulo).trigger('pointerenter');
      if (mouse) {
        cy.decodificou(titulo);
      } else {
        cy.wait(800);
        cy.nadaDecodificou();
      }
    });
  });

  it('ao filtrar o arquivo, os títulos da nova lista decodificam', () => {
    cy.abrir('/posts', { animacoes: 'on', gravarDecodificacao: true });
    cy.contains('[aria-labelledby="gz-secao-t"] button', 'Pesquisas').click();
    cy.decodificou('.gz-item-title a:eq(0)');
  });

  it('com "reduzir movimento" no sistema, nada decodifica nem fica escondido', () => {
    cy.reduzirMovimento(true);
    cy.abrir('/', { animacoes: 'on', gravarDecodificacao: true });
    cy.get('html').should('not.have.class', 'gz-js');
    cy.get('[data-gz-intro]').first().should('be.visible');
    cy.wait(1500);
    cy.nadaDecodificou();
  });

  it('com as animações desligadas pelo leitor, também não', () => {
    cy.abrir('/posts/h4ck34ndo-as-urnas', { animacoes: 'off', gravarDecodificacao: true });
    cy.get('[data-gz-decode] h2:not(.sr-only)').eq(2).scrollIntoView();
    cy.wait(1500);
    cy.nadaDecodificou();
  });
});
