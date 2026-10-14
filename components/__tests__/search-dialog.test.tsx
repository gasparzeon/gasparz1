/** @jest-environment jsdom */
import '@/test/helpers/browser';
import { act, fireEvent, render, screen, within } from '@testing-library/react';

import type { Post } from '@/lib/content';
import { useSearchStore } from '@/lib/search-store';

import { SearchDialog } from '../search-dialog';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));

const post = (overrides: Partial<Post>): Post => ({
  slug: 'post',
  title: 'Post',
  excerpt: '',
  publishedAt: '2026-05-01',
  updatedAt: '',
  tags: [],
  section: null,
  draft: false,
  coverImage: null,
  readingTime: '3 min',
  author: { name: 'Gaspar', username: 'gaspar', avatarUrl: '', bio: '' },
  ...overrides,
});

const POSTS = [
  post({ slug: 'urnas', title: 'H4CK34NDO AS URNAS!', section: 'investigacoes' }),
  post({
    slug: 'el-nino',
    title: 'O Superguia do El Niño',
    excerpt: 'Ciclo ENOS explicado.',
    section: 'pesquisas',
  }),
];
const TAGS = ['eleições', 'clima'];

function open() {
  render(<SearchDialog posts={POSTS} tags={TAGS} />);
  act(() => useSearchStore.getState().setOpen(true));
  return screen.getByRole('dialog', { name: 'Buscar no arquivo' });
}

afterEach(() => {
  act(() => useSearchStore.getState().setOpen(false));
});

describe('<SearchDialog />', () => {
  it('abre como diálogo, com o campo de busca focado e atalhos de navegação', () => {
    const dialog = open();
    expect(
      within(dialog).getByRole('combobox', { name: 'Buscar posts e etiquetas' }),
    ).toHaveFocus();
    expect(within(dialog).getByText('Arquivo completo')).toBeInTheDocument();
    expect(within(dialog).getByText('H4CK34NDO AS URNAS!')).toBeInTheDocument();
  });

  it('busca sem diferenciar acentos, em títulos, resumos e etiquetas', () => {
    const dialog = open();
    const input = within(dialog).getByRole('combobox');

    fireEvent.change(input, { target: { value: 'nino' } });
    expect(within(dialog).getByText('O Superguia do El Niño')).toBeInTheDocument();
    expect(within(dialog).queryByText('H4CK34NDO AS URNAS!')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Arquivo completo')).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'eleicoes' } });
    expect(within(dialog).getByText('#eleições')).toBeInTheDocument();
  });

  it('diz quando não acha nada', () => {
    const dialog = open();
    fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'zzz' } });
    expect(within(dialog).getByText('Nenhum post ou etiqueta para “zzz”.')).toBeInTheDocument();
  });

  it('Enter abre o resultado escolhido e fecha o diálogo', () => {
    const dialog = open();
    const input = within(dialog).getByRole('combobox');
    fireEvent.change(input, { target: { value: 'superguia' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockPush).toHaveBeenCalledWith('/posts/el-nino');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(useSearchStore.getState().open).toBe(false);
  });

  it('etiqueta leva ao arquivo filtrado', () => {
    const dialog = open();
    fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'clima' } });
    fireEvent.click(within(dialog).getByText('#clima'));
    expect(mockPush).toHaveBeenCalledWith('/posts?tag=clima');
  });

  it('fecha com Esc e com o botão "Fechar busca"', () => {
    let dialog = open();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    act(() => useSearchStore.getState().setOpen(true));
    dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar busca' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
