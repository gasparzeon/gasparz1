import { MDXRemote } from 'next-mdx-remote/rsc'

interface PostContentProps {
  content: string
}

export function PostContent({ content }: PostContentProps) {
  if (!content || content.trim() === '') {
    return <p>Sem conteúdo.</p>
  }

  return <MDXRemote source={content} />
}