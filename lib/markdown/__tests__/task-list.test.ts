import type { Element, Root } from 'hast';

import { rehypeTaskList } from '../task-list';

const el = (
  tagName: string,
  properties: Element['properties'],
  children: Element['children'] = [],
) => ({ type: 'element', tagName, properties, children }) as Element;
const text = (value: string) => ({ type: 'text' as const, value });

// Árvore como o remark-gfm produz para "- [x] feito\n- [ ] a fazer".
function taskList(): Root {
  return {
    type: 'root',
    children: [
      el('ul', { className: ['contains-task-list'] }, [
        el('li', { className: ['task-list-item'] }, [
          el('input', { type: 'checkbox', checked: true, disabled: true }),
          text(' feito'),
        ]),
        el('li', { className: ['task-list-item'] }, [
          el('input', { type: 'checkbox', checked: false, disabled: true }),
          text(' a fazer'),
        ]),
      ]),
    ],
  };
}

const run = (tree: Root) => {
  rehypeTaskList()(tree);
  return tree;
};

describe('rehypeTaskList', () => {
  it('troca a caixa de seleção por marca decorativa + texto para leitores de tela', () => {
    const tree = run(taskList());
    const [done, todo] = (tree.children[0] as Element).children as Element[];

    expect(done.children).toEqual([
      el('span', { className: ['task-mark'], dataDone: 'true', ariaHidden: 'true' }),
      el('span', { className: ['sr-only'] }, [text('Feito:')]),
      text(' feito'),
    ]);
    expect(todo.children[0]).toMatchObject({ properties: { dataDone: 'false' } });
    expect(todo.children[1]).toMatchObject({ children: [text('A fazer:')] });
  });

  it('não sobra nenhum <input> na árvore', () => {
    const html = JSON.stringify(run(taskList()));
    expect(html).not.toContain('"input"');
  });

  it('não mexe em outros campos nem no resto do conteúdo', () => {
    const tree: Root = {
      type: 'root',
      children: [el('p', {}, [text('texto')]), el('input', { type: 'text', name: 'busca' })],
    };
    const before = structuredClone(tree);
    expect(run(tree)).toEqual(before);
  });
});
