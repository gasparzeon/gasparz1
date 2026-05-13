import { MDXRemote } from 'next-mdx-remote/rsc'

interface PostContentProps {
  content: string
}

export function PostContent({
  content,
}: PostContentProps) {
  if (!content) {
    return (
      <div className="prose prose-invert max-w-none">
        <p>Sem conteúdo.</p>
      </div>
    )
  }

  return (
    <div className="prose prose-invert max-w-none">
      <MDXRemote source={content} />
    </div>
  )
}