# Como contribuir

Obrigado por querer ajudar o Gaspar Labs! Este guia mostra como preparar o
ambiente, o que o CI confere e as convenções do projeto, para que o seu pull
request seja revisado e aceito rápido.

## Sumário

-   [Antes de começar](#antes-de-começar)
-   [Fluxo de trabalho](#fluxo-de-trabalho)
-   [O que conferir antes do pull request](#o-que-conferir-antes-do-pull-request)
-   [Testes](#testes)
-   [Convenções de código](#convenções-de-código)
-   [Acessibilidade](#acessibilidade)
-   [Segurança](#segurança)
-   [Banco de dados e migrações](#banco-de-dados-e-migrações)
-   [CI no GitHub e no Forgejo](#ci-no-github-e-no-forgejo)
-   [Dúvidas](#dúvidas)

## Antes de começar

Siga o [começo rápido do README](README.md#começo-rápido) até o site rodar em
`localhost:3000`. Use o **pnpm**, que é o gerenciador de pacotes do projeto;
o `package-lock.json` não é usado.

Para mudanças grandes, como uma funcionalidade nova ou uma troca de
biblioteca, abra uma issue antes e conte a ideia. Assim combinamos o caminho
antes de você investir tempo no código.

## Fluxo de trabalho

1.  Faça um fork e crie um branch a partir da `main`, com um nome curto que
    diga o que muda:

    ```shell
    git switch -c feat/redes-github
    ```

1.  Faça commits pequenos no padrão
    [Conventional Commits](https://www.conventionalcommits.org/pt-br/), em
    português, como no histórico do projeto:

    ```text
    feat: redes sociais no perfil e aba Creators
    fix(db): aplica migrações novas no next dev sem reiniciar
    test(e2e): hover espera a decodificação de entrada terminar
    docs: guia de publicação com vídeos
    ```

    Os tipos mais usados são `feat`, `fix`, `test`, `docs`, `refactor` e
    `ci`.

1.  Abra o pull request contra a `main`. Explique o que mudou, por quê e como
    testar. Em mudanças de interface, inclua capturas de tela nos temas
    escuro e claro, e no celular.

1.  Acompanhe o CI e a revisão. Quando tudo estiver verde e aprovado, o pull
    request entra.

## O que conferir antes do pull request

Rode o mesmo que o CI roda. Se tudo passar aqui, passa lá:

```shell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
```

Mudou alguma coisa na interface? Rode também os testes de ponta a ponta, que
incluem a verificação de acessibilidade:

```shell
pnpm e2e
```

Lista rápida para o pull request:

-   [ ] Os comandos acima passam sem erros nem avisos.
-   [ ] O código novo tem testes, e eles falham se o comportamento quebrar.
-   [ ] A interface funciona no teclado, nos dois temas e no celular.
-   [ ] Textos novos estão em português, claros e sem jargão desnecessário.
-   [ ] A documentação foi atualizada, se o comportamento mudou.

## Testes

São três níveis. Coloque cada teste no mais simples que dá conta do caso.

-   **Unitários (Jest, com mocks).** Ficam numa pasta `__tests__` ao lado do
    código, com o nome `*.test.ts` ou `*.test.tsx`. Componentes usam a
    Testing Library e começam com `/** @jest-environment jsdom */`. O banco
    entra como mock com o banco falso de `test/helpers/fake-db.ts`, e as APIs
    do navegador que faltam no jsdom vêm de `test/helpers/browser.ts`.
-   **Integração (`*.db.test.ts`).** Rodam contra um Postgres de verdade em
    memória (PGlite), com as migrações aplicadas. Use para consultas, schema e
    regras que dependem do banco.
-   **Ponta a ponta (Cypress, em `cypress/e2e/`).** Testam o site de verdade
    no Chrome. Os comandos próprios ficam em `cypress/support/commands.ts`:
    `cy.abrir` define tema e animações, `cy.acessivel` roda o axe e
    `cy.entrarNoPainel` faz o login de teste.

Um bom teste falha quando o comportamento quebra. Antes de terminar, mude o
código de propósito e confira se o teste acusa.

## Convenções de código

-   **TypeScript estrito.** Nada de `any` sem necessidade.
-   **Comentários em português**, explicando o porquê, e não o quê.
-   **Formatação e lint são automáticos.** O Prettier formata e o ESLint (com
    `eslint-plugin-security`) não aceita avisos.
-   **Visual.** Tailwind 4 nos componentes do painel e o sistema `gz-*` em
    `app/site.css` no site. As cores são variáveis CSS: o tema escuro é o
    padrão (`:root`) e o claro fica em `.light`.
-   **Animações** são declaradas no HTML com atributos `data-gz-*` e ligadas
    em `lib/motion/gz-motion.ts`. Toda animação precisa respeitar o "reduzir
    movimento" do sistema e o botão de desligar animações.
-   **Validação** com zod no servidor, mesmo quando o navegador já valida.

## Acessibilidade

O site segue a WCAG 2.2 nível AA, e o CI confere com o axe nos dois temas e
no celular. Ao mexer na interface:

-   Tudo precisa funcionar pelo teclado, com o foco sempre visível.
-   Alvos de toque e clique com pelo menos 44 px.
-   Contraste mínimo de 4,5:1 para texto e 3:1 para ícones e bordas que
    informam algo.
-   Imagens com texto alternativo; ícones decorativos com `aria-hidden`.
-   Botões e links com nome claro. Links que abrem outra aba avisam leitores
    de tela.
-   Menus marcam a página atual com `aria-current`. Use as regras de
    `lib/navigation.ts`.
-   Informação nunca depende só de cor ou de movimento.

## Segurança

-   Todo conteúdo escrito por usuários é sanitizado. Use os pipelines de
    `lib/markdown/` e nunca `dangerouslySetInnerHTML` com texto de usuário.
-   Links informados por usuários são validados. As redes do perfil, por
    exemplo, são remontadas a partir do nome de usuário
    (`lib/users/socials.ts`).
-   Não coloque segredos no código nem nos testes.

Encontrou uma vulnerabilidade? Não abra uma issue pública. Use o relato
privado do GitHub, na aba **Security** do repositório.

## Banco de dados e migrações

1.  Altere o schema em `lib/db/schema.ts`.
1.  Gere a migração com um nome que descreva a mudança:

    ```shell
    pnpm db:generate --name redes_sociais
    ```

1.  Confira o SQL gerado em `drizzle/`. Migrações precisam funcionar com os
    dados que já existem, e não só num banco vazio.

O `pnpm dev` com o banco embutido aplica as migrações novas sozinho, sem
reiniciar. Com Postgres (`DATABASE_URL`), rode `pnpm db:migrate`.

## CI no GitHub e no Forgejo

O CI roda a cada push na `main` e em pull requests, em dois espelhos que
devem ficar iguais:

-   `.github/workflows/ci.yml`, no GitHub Actions;
-   `.forgejo/workflows/ci.yml`, no Forgejo Runner.

Cada um tem três jobs:

-   **Qualidade:** formatação, lint, tipos, testes unitários e de integração,
    e build.
-   **Postgres 17:** aplica as migrações duas vezes e roda os testes de
    integração num Postgres de verdade.
-   **Ponta a ponta:** Cypress no Chrome, com axe.

No Forgejo não há upload de artefatos (sem suporte ao `upload-artifact` v4),
o Postgres é acessado pelo nome do serviço (`postgres:5432`) e o job de ponta
a ponta roda na imagem oficial do Cypress.

## Dúvidas

Abra uma [issue](https://github.com/gasparzeon/gasparz1/issues) com a sua
pergunta. Não existe pergunta boba, e a resposta pode virar documentação.
