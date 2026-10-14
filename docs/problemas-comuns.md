# Problemas comuns

Soluções para o que mais acontece ao rodar o projeto. Não achou o seu caso?
Abra uma [issue](https://github.com/gasparzeon/gasparz1/issues) com a
mensagem de erro.

## Sumário

-   [Usuário ou senha inválidos com a senha certa](#usuário-ou-senha-inválidos-com-a-senha-certa)
-   [Muitas tentativas](#muitas-tentativas)
-   [O painel ainda não foi configurado](#o-painel-ainda-não-foi-configurado)
-   [Nenhuma conta ainda](#nenhuma-conta-ainda)
-   [A porta 3000 já está em uso](#a-porta-3000-já-está-em-uso)
-   [Erro 500 depois de atualizar o código](#erro-500-depois-de-atualizar-o-código)
-   [O build falha nas fontes](#o-build-falha-nas-fontes)
-   [O pnpm avisa de scripts ignorados](#o-pnpm-avisa-de-scripts-ignorados)
-   [Usar um Postgres seu](#usar-um-postgres-seu)

## Usuário ou senha inválidos com a senha certa

A conta do dono é criada só na primeira execução. Depois disso, a senha fica
no banco, e mudar o `ADMIN_PASSWORD_HASH` no `.env.local` não tem efeito.

-   Se você lembra da senha antiga, entre e troque em **Meu perfil**.
-   Se não lembra, recomece o banco local. Os posts e usuários criados
    localmente somem, mas os posts de `content/posts/` voltam:

    ```shell
    # pare o pnpm dev (Ctrl+C) e depois:
    rm -rf .data/pglite
    pnpm dev
    ```

## Muitas tentativas

Depois de 5 senhas erradas para o mesmo usuário, o login bloqueia por até 15
minutos. Espere e tente de novo.

## O painel ainda não foi configurado

As mensagens "Defina AUTH_SECRET com pelo menos 32 caracteres" ou "O painel
ainda não foi configurado no servidor" significam que o `AUTH_SECRET` está
vazio ou curto no `.env.local`. Rode `pnpm admin:hash`, cole o valor e
reinicie o `pnpm dev`.

## Nenhuma conta ainda

A mensagem "Nenhuma conta ainda. Defina ADMIN_USERNAME e ADMIN_PASSWORD_HASH"
aparece quando o `ADMIN_PASSWORD_HASH` está vazio. Cole o valor gerado pelo
`pnpm admin:hash` e reinicie o `pnpm dev`; a conta é criada na hora.

## A porta 3000 já está em uso

Rode `pnpm dev -p 3001` e abra `http://localhost:3001`. O login funciona em
qualquer porta.

## Erro 500 depois de atualizar o código

Uma mensagem como `column "…" does not exist` indica uma migração nova que o
banco ainda não recebeu.

-   **Banco embutido (`pnpm dev`):** as migrações novas são aplicadas sozinhas
    na próxima requisição. Recarregue a página.
-   **Postgres (`DATABASE_URL`):** rode `pnpm db:migrate`.

## O build falha nas fontes

O `pnpm build` baixa as fontes do Google Fonts. Confira a conexão com a
internet e rode de novo.

## O pnpm avisa de scripts ignorados

O aviso "Ignored build scripts" aparece quando entra uma dependência com
script de instalação. Acrescente o pacote em `pnpm-workspace.yaml`:

-   com `false`, se ele funciona sem o script (o caso comum);
-   com `true`, se o script for mesmo necessário.

## Usar um Postgres seu

1.  Coloque o endereço no `.env.local`:

    ```shell
    DATABASE_URL=postgres://usuario:senha@localhost:5432/gaspar
    ```

1.  Aplique as migrações uma vez. O comando não lê o `.env.local`, então
    passe o endereço na linha:

    ```shell
    DATABASE_URL=postgres://usuario:senha@localhost:5432/gaspar pnpm db:migrate
    ```

1.  Rode `pnpm dev`. A conta do dono e os posts antigos entram na primeira
    requisição.
