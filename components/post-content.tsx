import { MDXRemote } from 'next-mdx-remote/rsc'

interface PostContentProps {
  content: string
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

const components = {
  h2: (props: any) => {
    const text = String(props.children)
    const id = slugify(text)

    return (
      <h2 id={id} className="scroll-mt-28">
        {props.children}
      </h2>
    )
  },

  h3: (props: any) => {
    const text = String(props.children)
    const id = slugify(text)

    return (
      <h3 id={id} className="scroll-mt-28">
        {props.children}
      </h3>
    )
  },
}

export function PostContent({ content }: PostContentProps) {
  if (!content || content.trim() === '') {
    return <p>Sem conteúdo.</p>
  }

  return <MDXRemote source={content} components={components} />
}