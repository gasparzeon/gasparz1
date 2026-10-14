import type { Element, Root, RootContent } from 'hast';

// Listas de tarefas do GFM ("- [x] feito") vêm como <input type="checkbox"
// disabled>: um campo de formulário sem rótulo, que o leitor de tela anuncia
// como "caixa de seleção" sem nome (falha de acessibilidade apontada pelo axe).
// Viram uma marca visual (decorativa) e um texto para leitores de tela.
// Roda depois da sanitização: os elementos são criados pelo próprio pipeline.
export function rehypeTaskList() {
  const walk = (node: Root | Element) => {
    node.children = node.children.flatMap((child): RootContent[] => {
      if (child.type !== 'element') return [child];
      if (child.tagName === 'input' && child.properties?.type === 'checkbox') {
        const done = Boolean(child.properties.checked);
        return [
          {
            type: 'element',
            tagName: 'span',
            properties: { className: ['task-mark'], dataDone: String(done), ariaHidden: 'true' },
            children: [],
          },
          {
            type: 'element',
            tagName: 'span',
            properties: { className: ['sr-only'] },
            children: [{ type: 'text', value: done ? 'Feito:' : 'A fazer:' }],
          },
        ];
      }
      walk(child);
      return [child];
    }) as typeof node.children;
  };
  return (tree: Root) => walk(tree);
}
