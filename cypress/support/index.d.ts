/// <reference types="cypress" />

// Comandos próprios (cypress/support/commands.ts).
declare namespace Cypress {
  interface AbrirOptions {
    /** Tema salvo no navegador antes de abrir (padrão: escuro). */
    tema?: 'dark' | 'light';
    /** Preferência de animações do leitor (padrão: desligadas, para testes estáveis). */
    animacoes?: 'on' | 'off';
    /** Registra cada passo da decodificação dos títulos (para cy.decodificou). */
    gravarDecodificacao?: boolean;
    /** Página do painel: não espera as preferências do rodapé do site. */
    painel?: boolean;
    /** A página responde com erro de propósito (ex.: 404). */
    aceitarErroHttp?: boolean;
  }

  interface Chainable {
    /** Entra no painel com a conta de teste (sem senha) ou com a senha dada. */
    entrarNoPainel(senha?: string): Chainable<void>;
    /** Abre a página com tema e animações definidos e vigia o console. */
    abrir(path: string, options?: AbrirOptions): Chainable<void>;
    /** "Reduzir movimento" do sistema (Chrome/Electron, via DevTools Protocol). */
    reduzirMovimento(ligado: boolean): Chainable<void>;
    /** Confere o elemento: decodificou (símbolos no lugar das letras, mesmo tamanho,
     * nome real em aria-label durante o efeito) e terminou com o texto intacto. */
    decodificou(selector: string): Chainable<void>;
    /** Espera o efeito no elemento terminar e nada mudar por um instante. */
    decodificacaoParou(selector: string): Chainable<void>;
    /** Esquece os registros da decodificação feitos até aqui. */
    limparDecodificacao(): Chainable<void>;
    /** Garante que nenhum título foi decodificado. */
    nadaDecodificou(): Chainable<void>;
    /** axe-core com as regras WCAG 2.2 A e AA; lista as violações no terminal. */
    acessivel(contexto?: string): Chainable<void>;
    /** Nenhum erro de hidratação (nem outro console.error) desde que a página abriu. */
    semErrosNoConsole(): Chainable<void>;
  }
}
