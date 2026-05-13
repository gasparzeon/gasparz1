'use client'

import { DocumentRenderer } from '@keystatic/core/renderer'
import { CodeBlock } from '@/components/mdx/code-block'
import { Callout } from '@/components/mdx/callout'

interface PostContentProps {
  content: any
}

export function PostContent({ content }: PostContentProps) {
  if (!content || !Array.isArray(content)) {
    return (
      <div className="prose prose-invert max-w-none">
        <p>Conteúdo inválido.</p>
      </div>
    )
  }

  return (
    <DocumentRenderer
      document={content}
      renderers={{
        block: {
          code: (props: any) => (
            <CodeBlock language={props.language || 'text'}>
              {props.children}
            </CodeBlock>
          ),

          heading: ({ level, children }: any) => {
            const Tag = `h${level}` as keyof JSX.IntrinsicElements

            const id = String(children)
              .toLowerCase()
              .replace(/\s+/g, '-')
              .replace(/[^\w-]/g, '')

            return (
              <Tag id={id} className="scroll-mt-24">
                {children}
              </Tag>
            )
          },

          blockquote: ({ children }: any) => (
            <Callout type="info">{children}</Callout>
          ),
        },
      }}
    />
  )
}