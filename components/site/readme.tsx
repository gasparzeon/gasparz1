import type { Root } from 'hast';
import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';

import { cn } from '@/lib/utils';

// README já sanitizado (lib/markdown/readme.ts) virando React. Sem componentes
// especiais: roda igual no servidor (site) e no navegador (prévia do perfil).
export function ReadmeView({ tree, className }: { tree: Root; className?: string }) {
  return (
    <div className={cn('gz-readme-body', className)}>
      {toJsxRuntime(tree, { Fragment, jsx, jsxs, passKeys: true })}
    </div>
  );
}
