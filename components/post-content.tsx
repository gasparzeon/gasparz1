'use client'

import { DocumentRenderer } from '@keystatic/core/renderer'
import { CodeBlock } from '@/components/mdx/code-block'
import { Callout } from '@/components/mdx/callout'

interface PostContentProps {
  content: any
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

export function PostContent({
  content,
}: PostContentProps) {
  if (!content) {
    return null
  }

  return (
    <DocumentRenderer
      document={content}
      renderers={{
        block: {
          code: (props: any) => (
            <CodeBlock
              language={
                props.language || 'text'
              }
            >
              {props.children}
            </CodeBlock>
          ),

          heading: ({
            level,
            children,
          }: any) => {
            const Tag =
              `h${level}` as keyof JSX.IntrinsicElements

            const text =
              typeof children === 'string'
                ? children
                : Array.isArray(children)
                ? children.join('')
                : ''

            const id = slugify(text)

            return (
              <Tag
                id={id}
                className="scroll-mt-28"
              >
                {children}
              </Tag>
            )
          },

          blockquote: ({
            children,
          }: any) => (
            <Callout type="info">
              {children}
            </Callout>
          ),
        },
      }}
    />
  )
}