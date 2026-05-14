
# Gaspar Labs

> Research, systems, cybersecurity and underground web.

Gaspar Labs é um blog técnico e experimental focado em:
- arquitetura de software
- cybersecurity
- investigações digitais
- internet culture
- inteligência artificial
- filosofia tecnológica
- engenharia de sistemas

O projeto mistura estética underground minimalista com artigos profundos, explorando tanto tecnologia quanto comportamento digital moderno.

---

## Stack

- Next.js 16
- TypeScript
- TailwindCSS
- Keystatic CMS
- MDX
- Vercel
- Plausible Analytics

---

## Estrutura

```bash
app/
components/
content/posts/
lib/
public/
````

---

## Rodando localmente

Clone o projeto:

```bash
git clone https://github.com/gasparzeon/gasparz1.git
```

Instale as dependências:

```bash
pnpm install
```

Inicie o ambiente local:

```bash
pnpm dev
```

---

## Build

```bash
pnpm build
```

---

## Deploy

O deploy é feito automaticamente pela Vercel após push na branch principal.

---

## Criando Posts

Os artigos ficam em:

```bash
content/posts/
```

Cada post utiliza `.mdx`.

Exemplo:

```md
---
title: "Título"
excerpt: "Descrição"
publishedAt: "2026-05-13"
tags:
  - tecnologia
draft: false
---

# Conteúdo
```

---

## Filosofia do Projeto

Gaspar Labs não foi criado para produzir conteúdo rápido.

A proposta é construir:

* arquivos digitais
* pesquisas
* investigações
* reflexões técnicas
* documentação cultural da internet moderna

Um laboratório digital sobre sistemas, comportamento e tecnologia.

---

## Autor

Gaspar

---

## License

MIT

```

