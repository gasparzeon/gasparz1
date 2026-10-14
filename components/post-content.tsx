import { markdownToHast } from '@/lib/markdown/pipeline';
import { renderMarkdownTree } from '@/components/markdown/render';

interface PostContentProps {
  content: string;
}

export async function PostContent({ content }: PostContentProps) {
  if (!content || content.trim() === '') {
    return <p>Sem conteúdo.</p>;
  }

  return renderMarkdownTree(await markdownToHast(content));
}
