# Painel /admin

O painel é onde se escreve, publica e administra o site inteiro. Este guia
mostra o que cada parte faz, quem pode o quê e como o login protege tudo.

## Sumário

-   [Navegação](#navegação)
-   [Editor de posts](#editor-de-posts)
-   [Editar o site sem mexer no código](#editar-o-site-sem-mexer-no-código)
-   [Páginas por blocos](#páginas-por-blocos)
-   [Usuários e papéis](#usuários-e-papéis)
-   [Perfil, redes sociais e README](#perfil-redes-sociais-e-readme)
-   [Comentários](#comentários)
-   [Login e segurança](#login-e-segurança)

## Navegação

-   **Voltar ao site:** o primeiro botão do cabeçalho leva ao início do site,
    na mesma aba. No celular, aparece como "← site".
-   **Abas do painel:** Posts, Comentários, Usuários, Site, Páginas e Perfil.
    Cada pessoa vê só as abas do seu papel, e a aba atual fica destacada.
-   **Menu da conta** (a foto, no canto): meu perfil, minha página de autor,
    voltar ao site e sair.
-   **Pular para o conteúdo:** o primeiro item ao usar o `Tab` leva direto à
    área principal.

## Editor de posts

Um editor no estilo do Ghost e do Medium:

-   título e resumo escritos direto no topo do texto;
-   barra de formatação e atalhos (`⌘B`, `⌘I`, `⌘K`, `⌘E` e `⌘S`);
-   menu **`/`** para inserir imagem, vídeo, YouTube, títulos, listas,
    tabela, código, destaque, fórmula, nota de rodapé e bloco expansível,
    com um guia de Markdown embutido;
-   colar ou arrastar imagens e vídeos faz o upload na hora, e um link do
    YouTube numa linha vazia vira o player;
-   prévia lado a lado, gerada pelo mesmo motor que gera o site;
-   configurações do post: endereço, datas, autor, seção, tags, capa e prévia
    no Google;
-   rascunho guardado no navegador e aviso de conflito quando outra pessoa
    salva o mesmo post antes.

Ao publicar, o site regenera as páginas sozinho. O passo a passo de um post
está em [Como publicar](publicar.md).

## Editar o site sem mexer no código

Tudo o que o leitor vê é editado no painel por administradores e pelo dono.
Os valores iniciais reproduzem o site original.

| Onde                       | O que se edita                                                                   |
| -------------------------- | -------------------------------------------------------------------------------- |
| **Site → Geral**           | nome, descrição, autor, palavras-chave, endereço público e imagem de compartilhamento |
| **Site → Menu**            | logo, links do menu, aba Creators e os botões de busca, tema e Entrar/Criar conta |
| **Site → Página inicial**  | chamada, título, apresentação, posts recentes e a página do arquivo              |
| **Site → Rodapé e redes**  | copyright (com `{ano}` e `{site}`), nota, link de destaque e redes do site       |
| **Site → Integrações**     | comentários, estatísticas (Plausible e Vercel Analytics) e botões de compartilhar |
| **Site → Página 404**      | título, texto e botão                                                            |
| **Páginas**                | Sobre, Apoie e quantas páginas novas você quiser                                 |

Proteções:

-   links de menu, rodapé, redes e botões só aceitam `/caminho`, `https://`
    ou `mailto:`;
-   cada gravação passa pela mesma validação no navegador e no servidor;
-   se outra pessoa salvar antes, o painel avisa em vez de sobrescrever;
-   uma configuração corrompida no banco volta ao padrão só naquela seção.

Tudo fica no banco (tabelas `settings` e `pages`), então um backup do banco
leva o site inteiro junto.

## Páginas por blocos

Cada página é uma lista de blocos que pode ser reordenada:

-   **Abertura:** chamada, título grande e texto de apoio.
-   **Texto:** Markdown completo, com imagens, vídeos e YouTube, solto ou
    dentro de um cartão.
-   **Cartões:** grade com ícone, título e texto.
-   **Chamada:** caixa de destaque com um botão (link ou e-mail).
-   **Contatos:** botões com as redes sociais configuradas em **Site**.

Toda página mostra no topo a trilha "Início › nome da página". O endereço
fica em `/<endereço>`; os endereços do sistema (`admin`, `api`, `posts`,
`autores`, `creators`, `uploads` e outros) são recusados. Uma página em
rascunho só aparece no painel.

## Usuários e papéis

Quem escreve entra por convite ou promoção; quem comenta cria a conta
sozinho:

-   **Cadastro aberto** em `/admin/cadastro`: qualquer pessoa cria uma conta
    de leitor e comenta nos posts. O cadastro pode ser fechado no painel.
-   **Convite:** um link de uso único, válido por 7 dias, que já entra com um
    papel de escrita.
-   **Pedidos antigos** de acesso ficam em `/admin/pedido` até alguém aprovar
    ou recusar.

| Papel             | Pode                                                                     |
| ----------------- | ------------------------------------------------------------------------ |
| **Leitor**        | comentar nos posts e editar o próprio perfil                             |
| **Colaborador**   | escrever rascunhos e enviar para revisão                                 |
| **Autor**         | escrever, publicar e apagar os próprios posts                            |
| **Editor**        | editar e publicar posts de qualquer autor e moderar comentários          |
| **Administrador** | tudo do editor, mais aprovar, convidar, mudar papéis e suspender contas  |
| **Dono**          | tudo, inclusive gerenciar administradores (criado pelas variáveis `ADMIN_*`) |

Em **Usuários** também dá para gerar um link de redefinição de senha,
suspender uma conta (as sessões caem na hora) e remover uma conta,
transferindo os posts para outra pessoa.

## Perfil, redes sociais e README

Em **Meu perfil**, cada pessoa edita nome, usuário, e-mail, foto e bio, e
também:

-   **Redes sociais:** Spotify, X (Twitter), Facebook, TikTok e Instagram.
    Basta colar o link do perfil ou digitar o `@usuário`. O site confere se o
    endereço é mesmo da rede e monta o link oficial, então um botão de
    "Instagram" sempre leva ao Instagram.
-   **README:** um texto curto em Markdown, com até 1.200 caracteres e 30
    linhas, para contar o que você pesquisa, seus interesses e no que está
    trabalhando. Aceita títulos, listas, links, negrito e código, mas não
    imagens nem HTML. A aba **Visualizar** mostra como vai ficar.

As redes e o README aparecem na página de autor (`/autores/<usuário>`). As
redes também aparecem em **Creators** (`/creators`, que lista quem escreve) e
no fim de cada post. Na própria página de autor, a pessoa vê o atalho
**Editar meu README**.

## Comentários

Comentários do próprio site, sem serviço externo:

-   no fim de cada post, quem está logado comenta na hora (texto puro, até
    2.000 caracteres e 10 comentários a cada 10 minutos);
-   quem não está logado vê o convite para entrar ou criar conta e volta para
    o post depois;
-   cada pessoa edita ou apaga o que escreveu; editores e acima **ocultam**
    (sai do site, com registro de quem e quando) ou **apagam** de vez;
-   tudo pode ser desligado em **Site → Integrações**.

## Login e segurança

O login usa OAuth 2.0 com Authorization Code e PKCE (S256), seguindo o
OAuth 2.0 Security BCP (RFC 9700):

-   senhas com scrypt (parâmetros da OWASP) e comparação em tempo constante;
-   token de acesso de 15 minutos e token de renovação cifrado, com rotação e
    detecção de reuso, ambos em cookies `httpOnly`, `Secure` e
    `SameSite=Strict`;
-   limite de tentativas: 5 por usuário e 30 por IP a cada 15 minutos;
-   proteção contra CSRF e revogação dos tokens ao sair;
-   suspensão, troca ou redefinição de senha encerram todas as sessões;
-   endpoints `/api/oauth/token` e `/api/oauth/revoke` (RFC 6749 e 7009) para
    usar a API com `Authorization: Bearer`.
