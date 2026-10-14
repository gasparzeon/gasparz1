/** @jest-environment jsdom */
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { TagInput } from '../tag-input';

function Harness({ initial = [] as string[], suggestions = ['ia', 'web', 'cybersecurity'] }) {
  const [tags, setTags] = useState(initial);
  return (
    <>
      <TagInput value={tags} onChange={setTags} suggestions={suggestions} />
      <output data-testid="tags">{tags.join('|')}</output>
    </>
  );
}

// Sem placeholder quando já há tags: busca pelo papel.
const input = () => screen.getByRole('textbox') as HTMLInputElement;
const tags = () => screen.getByTestId('tags').textContent;

describe('<TagInput />', () => {
  it('adiciona com Enter, normalizando para minúsculas', () => {
    render(<Harness />);
    expect(input()).toHaveAttribute('placeholder', 'Adicionar tag…');
    fireEvent.change(input(), { target: { value: '  Machine   Learning ' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(tags()).toBe('machine learning');
  });

  it('adiciona várias de uma vez separadas por vírgula, sem repetir', () => {
    render(<Harness initial={['ia']} />);
    fireEvent.change(input(), { target: { value: 'IA, web,' } });
    expect(tags()).toBe('ia|web');
  });

  it('remove a última com Backspace no campo vazio e pelo botão da tag', () => {
    render(<Harness initial={['ia', 'web', 'rust']} />);

    fireEvent.keyDown(input(), { key: 'Backspace' });
    expect(tags()).toBe('ia|web');

    fireEvent.click(screen.getByRole('button', { name: 'Remover tag ia' }));
    expect(tags()).toBe('web');
  });

  it('sugere tags existentes que ainda não foram usadas', () => {
    render(<Harness initial={['web']} />);
    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: 'c' } });

    const options = screen.getAllByRole('button').map((b) => b.textContent);
    expect(options).toContain('cybersecurity');
    expect(options).not.toContain('web');

    fireEvent.mouseDown(screen.getByRole('button', { name: 'cybersecurity' }));
    expect(tags()).toBe('web|cybersecurity');
  });
});
