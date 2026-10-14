# Produção

Como colocar o site no ar, na Vercel ou num servidor seu, e como testar a
versão de produção no seu computador antes.

## Sumário

-   [Testar a versão de produção localmente](#testar-a-versão-de-produção-localmente)
-   [Vercel](#vercel)
-   [Servidor próprio](#servidor-próprio)

## Testar a versão de produção localmente

```shell
pnpm build
pnpm start
```

Depois abra [localhost:3000](http://localhost:3000). Três diferenças em
relação ao `pnpm dev`:

-   **Banco:** sem `DATABASE_URL`, a produção usa um banco em memória, que
    recomeça do zero a cada `pnpm start`. Para usar os dados do
    desenvolvimento, pare o `pnpm dev` e rode
    `PGLITE_DIR=.data/pglite pnpm start`.
-   **Cookies:** o login usa cookies `Secure`. O Chrome aceita em
    `http://localhost`; o Safari, não.
-   **Internet:** o `pnpm build` baixa as fontes do Google Fonts.

## Vercel

1.  **Importe o repositório** na [Vercel](https://vercel.com/new). O Next.js
    é detectado sozinho.
1.  **Banco de dados:** em **Storage**, adicione um **Neon** (Postgres). A
    integração cria o `DATABASE_URL`, e as migrações rodam a cada deploy pelo
    script `vercel-build`.
1.  **Mídia:** em **Storage**, crie um **Blob** e conecte ao projeto. Isso
    cria o `BLOB_READ_WRITE_TOKEN`.
1.  **Conta do dono:** no seu computador, rode `pnpm admin:hash` com a senha
    de produção. Em **Settings → Environment Variables**, cadastre:

    | Variável              | Valor                                               |
    | --------------------- | --------------------------------------------------- |
    | `ADMIN_USERNAME`      | o usuário do dono                                   |
    | `ADMIN_PASSWORD_HASH` | a linha gerada pelo `pnpm admin:hash`               |
    | `AUTH_SECRET`         | um valor novo; trocar depois derruba todas as sessões |

1.  **Faça o deploy.** No primeiro acesso ao banco, o site cria a conta do
    dono, importa os posts de `content/posts/` e cria as páginas Sobre e
    Apoie.
1.  **Entre** em `https://seu-dominio/admin`.

O plano gratuito da Vercel é para uso não comercial. O Neon gratuito tem
0,5 GB, e o Blob gratuito, 1 GB de armazenamento e 10 GB de transferência por
mês, por isso vídeos longos vão melhor no YouTube.

## Servidor próprio

O site também roda numa VPS, num container LXC do Proxmox, em Docker ou no
Coolify. É o caso de [gaspar.vorn.fun](https://gaspar.vorn.fun), atrás do
Cloudflare.

1.  **Variáveis de ambiente.** Além de `ADMIN_USERNAME`,
    `ADMIN_PASSWORD_HASH` e `AUTH_SECRET`, defina:

    | Variável       | Para quê                                                   |
    | -------------- | ---------------------------------------------------------- |
    | `DATABASE_URL` | um Postgres (recomendado)                                  |
    | `PGLITE_DIR`   | sem Postgres: pasta persistente do banco embutido          |
    | `UPLOADS_DIR`  | pasta persistente das imagens e vídeos                     |

    Sem `DATABASE_URL` nem `PGLITE_DIR`, a produção usa um banco em memória,
    e tudo o que for criado no painel some quando o servidor reinicia. O log
    avisa com `[db] ATENÇÃO: banco em memória em produção`.

1.  **Gere e suba o site:**

    ```shell
    pnpm install --frozen-lockfile
    pnpm build
    pnpm db:migrate   # só com DATABASE_URL; o banco embutido migra sozinho
    pnpm start        # porta 3000; para outra, PORT=8080 pnpm start
    ```

1.  **Container:** monte um volume em `/data` para o banco e os uploads
    sobreviverem a cada deploy.

1.  **Um processo por banco embutido:** não rode duas instâncias com o mesmo
    `PGLITE_DIR`. Para mais de uma, use Postgres.

A rota `/uploads/…` entrega os arquivos com cache de um ano. Os nomes têm um
sufixo aleatório, então o conteúdo de um endereço nunca muda e o Cloudflare
pode guardá-los na borda.
