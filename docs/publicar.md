# Como publicar

Este guia mostra como montar um post no painel, como o site trata cada tipo
de mídia e quais cuidados deixam o post leve, acessível e bonito.

## Sumário

-   [Passo a passo de um post](#passo-a-passo-de-um-post)
-   [Markdown](#markdown)
-   [Imagens](#imagens)
-   [Capa](#capa)
-   [Vídeos](#vídeos)
-   [Biblioteca de mídia](#biblioteca-de-mídia)
-   [Texto e estrutura](#texto-e-estrutura)
-   [Como o site trata o conteúdo](#como-o-site-trata-o-conteúdo)
-   [Ferramentas para capas, gráficos e vídeos](#ferramentas-para-capas-gráficos-e-vídeos)

## Passo a passo de um post

1.  Entre em `/admin` e clique em **Novo post**. O título e o resumo são
    escritos direto no topo do texto.
1.  Escreva em Markdown. Use a barra, os atalhos (`⌘B`, `⌘I`, `⌘K`) ou o
    menu **`/`** para inserir títulos, listas, tabelas, código, destaques,
    fórmulas, imagens, vídeos e YouTube.
1.  Abra **Configurações** e preencha o endereço, as datas, a seção, as tags,
    a capa e a prévia no Google.
1.  Confira a **prévia** lado a lado. Ela usa o mesmo motor que gera o site.
1.  Clique em **Publicar**. Colaboradores veem **Enviar para revisão**, e um
    editor publica depois.

O rascunho fica guardado no navegador enquanto você escreve.

## Markdown

Os posts são Markdown puro (CommonMark e GitHub Flavored Markdown):

````markdown
## Título (vira âncora, "Parte N" e item do índice lateral)

**negrito**, _itálico_, ~~riscado~~, `código`, [link](https://exemplo.com), :rocket:

- [x] checklist com marca visual (e "Feito:" para leitores de tela)

| Tabela | com alinhamento |
| :----- | :-------------: |

![Descrição da imagem](/uploads/foto.webp "Legenda")
![Legenda do vídeo](/uploads/video.mp4)
https://youtu.be/ID
![Legenda do YouTube](https://youtu.be/ID?t=42)

> [!TIP]
> Destaques: NOTE, TIP, IMPORTANT, WARNING e CAUTION.

Texto com nota[^1].

[^1]: A nota.

$$ E = mc^2 $$

```ts
const x = 1;
```

<details><summary>Mais</summary>Conteúdo opcional.</details>
````

Um `$` sozinho fica como texto, então `R$ 10` não vira fórmula. Como os posts
vêm de vários autores, o HTML é sanitizado com o esquema do GitHub: nada de
`<script>`, `<iframe>`, `style=`, atributos `on*` ou links `javascript:`.

## Imagens

Há três jeitos de inserir:

-   **Arraste ou cole** a imagem no editor. O upload acontece na hora e o
    texto alternativo é sugerido a partir do nome do arquivo.
-   **Menu `/` → Imagem** abre a janela com as abas **Enviar**, **URL** e
    **Biblioteca**, com campos para texto alternativo e legenda.
-   **Direto em Markdown:**

    ```markdown
    ![Texto alternativo](/uploads/2026/10/grafico.png "Legenda")
    ```

O que o site faz com elas:

-   uma imagem sozinha no parágrafo vira figura, e o título entre aspas vira
    a legenda;
-   todas carregam só quando a pessoa chega perto (`loading="lazy"`);
-   caminhos relativos colados de um README do GitHub (`docs/logo.png`) são
    detectados, e o botão **Apontar para o GitHub** corrige os endereços.

| Formato                    | Aceito         | Observação                                     |
| -------------------------- | -------------- | ---------------------------------------------- |
| JPEG, PNG, WebP, AVIF, GIF | sim, até 15 MB | tipo conferido pelo conteúdo (local) ou declarado (Blob) |
| SVG                        | não            | pode carregar scripts; exporte como PNG        |
| HEIC (iPhone)              | não            | exporte como JPEG ou WebP antes                |

Boas práticas:

-   **Cerca de 1600 px de largura.** A coluna de texto tem uns 830 px; o
    dobro deixa a imagem nítida em telas retina.
-   **WebP para fotos** (200 a 400 KB) e **PNG para prints e gráficos com
    texto**. Para reduzir e converter no Mac:

    ```shell
    sips -Z 1600 foto.jpg               # redimensiona no lugar: use uma cópia
    cwebp -q 80 foto.jpg -o foto.webp   # brew install webp
    ```

-   **Sempre escreva o texto alternativo,** descrevendo o que a imagem
    mostra, sem começar com "imagem de".
-   **Nomes de arquivo descritivos,** como `grafico-memoria.png`.
-   **Prefira a biblioteca a links externos,** que podem sumir.
-   **Use só imagens próprias ou com licença,** com o crédito na legenda.

## Capa

A capa fica em **Configurações → Imagem de capa**. Ela aparece no topo do
post e é a prévia quando o link é compartilhado. Sem capa, o site gera uma a
partir da seção do post.

-   Use **1600 × 800 px** (proporção 2:1); outras proporções são recortadas.
-   Mantenha o que importa longe das bordas e use textos grandes.
-   Não repita a capa no corpo do post.

## Vídeos

**Upload de MP4 ou WebM (até 500 MB).** Arraste o arquivo, use **`/` →
Vídeo** ou escreva:

```markdown
![Legenda do vídeo](/uploads/2026/10/demo.mp4)
```

O vídeo vira um player com controles, sem reprodução automática, que só
baixa os metadados até a pessoa dar play. Para escolher a miniatura, use
HTML:

```html
<video src="/uploads/2026/10/demo.mp4" poster="/uploads/2026/10/demo-capa.webp" controls></video>
```

**YouTube.** Cole o link sozinho numa linha ou use **`/` → YouTube**. A
página mostra só a miniatura; o player (`youtube-nocookie.com`) carrega
quando a pessoa clica, sem cookies de rastreamento antes disso.

Quando usar cada um:

-   **Upload** para clipes curtos, de até um minuto, como demonstrações e
    gravações de tela.
-   **YouTube** para vídeos longos. O Vercel Blob gratuito tem 10 GB de
    transferência por mês: um vídeo de 50 MB visto 200 vezes já consome
    tudo.

Para converter qualquer vídeo para H.264 + AAC, que toca em todo navegador e
começa antes de baixar tudo:

```shell
ffmpeg -i entrada.mov -vf "scale=1280:-2" -c:v libx264 -crf 23 -preset slow \
    -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart saida.mp4
```

Para trocar um GIF animado por MP4, que costuma ficar várias vezes menor:

```shell
ffmpeg -i animacao.gif -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" \
    -pix_fmt yuv420p -movflags +faststart animacao.mp4
```

## Biblioteca de mídia

-   Todo arquivo enviado aparece na aba **Biblioteca** da janela de mídia.
-   Cada pessoa remove o que enviou; editores e administradores removem
    qualquer arquivo.
-   No desenvolvimento, os arquivos ficam em `public/uploads/`, fora do git.
    Num servidor próprio, na pasta de `UPLOADS_DIR`. Na Vercel, no Vercel
    Blob, enviados direto pelo navegador.

## Texto e estrutura

-   **Resumo** de uma ou duas frases: ele aparece na página inicial, no
    Google e nas prévias de links.
-   **Seções com `##` e subseções com `###`,** sem pular níveis. Elas viram o
    índice lateral do post.
-   **Parágrafos curtos.** Listas para passos, tabelas para comparações e
    `<details>` para conteúdo longo e opcional.
-   **Código sempre com a linguagem** (` ```ts `), para ter destaque e o botão
    de copiar.
-   **Destaques com moderação:** um ou dois por post.
-   **Fontes primárias** com link e uma seção **Fontes** no fim.
-   **Tags:** de 3 a 5, em minúsculas, reaproveitando as que já existem.

## Como o site trata o conteúdo

O mesmo motor gera a prévia do editor e a página publicada:

```text
Markdown → remark (GFM, fórmulas, emoji) → rehype → sanitização → mídia → Shiki/KaTeX → React
```

| Etapa             | O que faz                                                    | Onde está                         |
| ----------------- | ------------------------------------------------------------ | --------------------------------- |
| Sanitização       | remove `<script>`, `<iframe>`, `style`, `on*` e URLs perigosas | `lib/markdown/sanitize-schema.ts` |
| Mídia             | figuras, player de vídeo, YouTube leve e destaques           | `lib/markdown/rehype-media.ts`    |
| Listas de tarefas | marca visual no lugar da caixa de seleção sem rótulo         | `lib/markdown/task-list.ts`       |
| Código e fórmulas | Shiki (temas claro e escuro) e KaTeX                         | `lib/markdown/pipeline.ts`        |
| Upload            | confere o tipo do arquivo, recusa SVG e registra quem enviou | `lib/cms/media.ts`                |

O README dos autores usa um Markdown mais restrito, sem HTML nem imagens, em
`lib/markdown/readme.ts`.

## Ferramentas para capas, gráficos e vídeos

O `scripts/post-kit/` gera capas e gráficos de barras a partir de um JSON, no
visual do site, e vídeos de uma resposta aparecendo em tempo real. Os scripts
precisam de Node 22, Google Chrome e ffmpeg.

| Script             | Para quê                                                         |
| ------------------ | ---------------------------------------------------------------- |
| `render-images.mjs` | capa (1600 × 800) e gráficos de barras a partir de um JSON      |
| `render-video.mjs` | vídeo de um terminal reproduzindo um texto no ritmo real         |
| `publish.mjs`      | envia a mídia e cria o post pela API (só no modo local)          |
| `verify.mjs`       | abre o post e confere imagens, vídeos e erros no console         |

```shell
node scripts/post-kit/render-images.mjs \
    scripts/post-kit/exemplos/llm-local/imagens.json .data/post-kit/meu-post
node scripts/post-kit/verify.mjs http://localhost:3000/posts/meu-post
```

Um post real feito com essas ferramentas está em
`scripts/post-kit/exemplos/llm-local/`.
