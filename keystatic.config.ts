import { config, fields, collection } from '@keystatic/core'

export default config({
  storage: {
    kind: 'local',
  },

  ui: {
    brand: {
      name: 'Gaspar CMS',
    },
  },

  collections: {
    posts: collection({
      label: 'Posts',
      slugField: 'title',
      path: 'content/posts/*/index',

      format: {
        contentField: 'content',
        data: 'frontmatter',
      },

      schema: {
        title: fields.slug({
          name: {
            label: 'Título',
          },
        }),

        excerpt: fields.text({
          label: 'Resumo',
          description: 'Uma breve descrição do post',
          multiline: true,
        }),

        publishedAt: fields.date({
          label: 'Data de Publicação',
          defaultValue: {
            kind: 'today',
          },
        }),

        updatedAt: fields.text({
          label: 'Última Atualização',
          description: 'Opcional. Use o formato YYYY-MM-DD se quiser preencher.',
        }),

        tags: fields.array(
          fields.text({
            label: 'Tag',
          }),
          {
            label: 'Tags',
            itemLabel: (props) => props.value || 'Nova tag',
          }
        ),

        draft: fields.checkbox({
          label: 'Rascunho',
          defaultValue: false,
        }),

        coverImage: fields.image({
          label: 'Imagem de Capa',
          directory: 'public/images/posts',
          publicPath: '/images/posts/',
          description: 'Imagem exibida no topo do post',
          validation: {
            isRequired: false,
          },
        }),

        content: fields.mdx({
          label: 'Conteúdo',
          extension: 'mdx',
          options: {
            image: {
              directory: 'public/images/posts',
              publicPath: '/images/posts/',
            },
            divider: true,
            link: true,
          },
        }),
      },
    }),
  },
})