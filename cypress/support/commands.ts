import type { Result } from 'axe-core';

type Registro = { el: Element; texto: string; rotulo: string | null };
type JanelaGravada = Window & { __decodificacao?: Registro[] };

const ALVOS = '[data-gz-scramble], [data-gz-decode] h2, [data-gz-decode] h3';
const COM_NOME = 'a, button, h1, h2, h3, h4, h5, h6';

// Observa o DOM desde o carregamento: cada troca de texto (ou de aria-label)
// num título que decodifica vira um registro com o texto da hora e o nome
// acessível naquele instante.
function gravar(win: JanelaGravada) {
  const registros: Registro[] = [];
  win.__decodificacao = registros;
  win.document.addEventListener('DOMContentLoaded', () => {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const node = mutation.target;
        const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
        const alvo = el?.closest(ALVOS);
        if (!alvo) continue;
        const dono = alvo.closest(COM_NOME) ?? alvo;
        registros.push({
          el: alvo,
          texto: alvo.textContent ?? '',
          rotulo: dono.getAttribute('aria-label'),
        });
      }
    });
    observer.observe(win.document.body, {
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['aria-label'],
    });
  });
}

Cypress.Commands.add('abrir', (path: string, options: Cypress.AbrirOptions = {}) => {
  const {
    tema = 'dark',
    animacoes = 'off',
    gravarDecodificacao = false,
    painel = false,
    aceitarErroHttp = false,
  } = options;
  cy.visit(path, {
    failOnStatusCode: !aceitarErroHttp,
    onBeforeLoad(win) {
      win.localStorage.setItem('theme', tema);
      win.localStorage.setItem('gz-motion', animacoes);
      cy.spy(win.console, 'error').as('erroConsole');
      if (gravarDecodificacao) gravar(win);
    },
  });
  // Hidratado: o botão do tema só ganha aria-pressed depois da hidratação.
  if (!painel) cy.contains('footer button', 'Escuro').should('have.attr', 'aria-pressed');
});

// Login OAuth do painel com a conta de teste do scripts/e2e.mjs (cy.env).
Cypress.Commands.add('entrarNoPainel', (senha?: string) => {
  cy.env(['adminUser', 'adminPassword']).then(({ adminUser, adminPassword }) => {
    cy.abrir('/api/auth/login', { painel: true });
    cy.location('pathname').should('eq', '/admin/login');
    cy.get('#username').type(adminUser);
    cy.get('#password').type(senha ?? adminPassword, { log: false });
    cy.contains('button[type="submit"]', 'Entrar').click();
  });
});

Cypress.Commands.add('reduzirMovimento', (ligado: boolean) => {
  cy.wrap(
    Cypress.automation('remote:debugger:protocol', {
      command: 'Emulation.setEmulatedMedia',
      params: {
        features: [{ name: 'prefers-reduced-motion', value: ligado ? 'reduce' : 'no-preference' }],
      },
    }),
    { log: false },
  );
});

const GLIFOS = /[#%&*+=<>/\\[\]{}_\-01]/;
const enxuto = (texto: string) => texto.replace(/\s+/g, ' ').trim();

const registrosDe = (win: Window, el: Element) =>
  ((win as JanelaGravada).__decodificacao ?? []).filter((registro) => registro.el === el);

Cypress.Commands.add('decodificou', (selector: string) => {
  cy.get(selector).then(($el) => {
    const el = $el[0];
    // Começou (algum passo registrado) e terminou (sem o aria-label provisório).
    cy.window({ timeout: 10000 }).should((win) => {
      expect(registrosDe(win, el), `decodificação de ${selector}`).to.not.be.empty;
    });
    cy.wrap($el, { timeout: 10000 }).should('not.have.attr', 'aria-label');
    cy.window().then((win) => {
      const final = el.textContent ?? '';
      const registros = registrosDe(win, el);

      const embaralhados = registros.filter((registro) => registro.texto !== final);
      expect(embaralhados, 'passos com símbolos no lugar das letras').to.not.be.empty;
      embaralhados.forEach((registro) => {
        expect(registro.texto).to.have.length(final.length);
        expect(registro.texto).to.match(GLIFOS);
      });

      const nomes = registros.map((registro) => registro.rotulo).filter(Boolean);
      expect(nomes, 'nome acessível durante o efeito').to.not.be.empty;
      nomes.forEach((nome) => expect(nome).to.not.match(/[%&*+=<>{}]/));
      expect(enxuto(nomes[0] ?? '')).to.contain(enxuto(final).replace(/#$/, '').slice(0, 12));
    });
  });
});

// Espera o elemento ficar quieto: sem o aria-label provisório (que já aparece
// durante o atraso antes do efeito) e sem nenhum passo novo por um tempo. Um
// tempo fixo não serve: numa máquina lenta (CI) o efeito de entrada termina depois.
Cypress.Commands.add('decodificacaoParou', (selector: string) => {
  cy.get(selector).then(($el) => {
    const el = $el[0];
    let vistos = -1;
    let desde = Date.now();
    cy.window({ timeout: 15000 }).should((win) => {
      const total = registrosDe(win, el).length;
      if (total !== vistos) {
        vistos = total;
        desde = Date.now();
      }
      expect(el.hasAttribute('aria-label'), `${selector} decodificando`).to.equal(false);
      expect(Date.now() - desde, 'tempo sem mudanças (ms)').to.be.at.least(700);
    });
  });
});

Cypress.Commands.add('limparDecodificacao', () => {
  cy.window().then((win) => {
    (win as JanelaGravada).__decodificacao?.splice(0);
  });
});

Cypress.Commands.add('nadaDecodificou', () => {
  cy.window().then((win) => {
    const registros = (win as JanelaGravada).__decodificacao ?? [];
    const embaralhados = registros.filter((registro) => registro.rotulo !== null);
    expect(embaralhados, 'títulos decodificados').to.have.length(0);
  });
});

const descrever = (violations: Result[]) =>
  violations
    .map(
      (violation) =>
        `[axe] ${violation.id} (${violation.impact}): ${violation.help}\n` +
        violation.nodes.map((node) => `   ${node.target.join(' ')}`).join('\n'),
    )
    .join('\n');

Cypress.Commands.add('acessivel', (contexto?: string) => {
  cy.injectAxe();
  cy.checkA11y(
    contexto ?? undefined,
    {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
      },
    },
    (violations) => {
      cy.task('log', descrever(violations));
    },
  );
});

Cypress.Commands.add('semErrosNoConsole', () => {
  cy.get('@erroConsole').then((spy) => {
    const chamadas = (spy as unknown as sinon.SinonSpy)
      .getCalls()
      .map((call) => call.args.map(String).join(' '));
    expect(chamadas, 'console.error').to.deep.equal([]);
  });
});
