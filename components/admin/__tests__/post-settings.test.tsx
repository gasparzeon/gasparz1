/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';

import { todayISO } from '@/lib/cms/schema';

import { PostSettings, type EditorFields } from '../post-settings';

const fields: EditorFields = {
  title: 'LLM local em casa',
  slug: 'llm-local-em-casa',
  excerpt: 'Resumo curto.',
  content: '',
  publishedAt: '2026-10-12',
  updatedAt: '',
  tags: ['ia'],
  section: '',
  coverImage: '',
};

function setup(overrides: Partial<Parameters<typeof PostSettings>[0]> = {}) {
  const props = {
    open: true,
    onOpenChange: jest.fn(),
    fields,
    onChange: jest.fn(),
    savedSlug: null,
    status: 'draft' as const,
    canDelete: true,
    busy: false,
    tagSuggestions: [],
    authorId: 'u1',
    onAuthorChange: jest.fn(),
    onPickCover: jest.fn(),
    onUnpublish: jest.fn(),
    onDelete: jest.fn(),
    ...overrides,
  };
  render(<PostSettings {...props} />);
  return props;
}

describe('<PostSettings /> — URL', () => {
  it('normaliza o slug enquanto digita e gera a partir do título', () => {
    const props = setup();
    fireEvent.change(screen.getByLabelText('Slug'), { target: { value: 'Meu Post Novo' } });
    expect(props.onChange).toHaveBeenLastCalledWith({ slug: 'meu-post-novo' });

    fireEvent.click(screen.getByLabelText('Gerar slug a partir do título'));
    expect(props.onChange).toHaveBeenLastCalledWith({ slug: 'llm-local-em-casa' });
  });

  it('avisa sobre slug inválido', () => {
    setup({ fields: { ...fields, slug: 'pôst_errado' } });
    expect(screen.getByText('Use letras minúsculas, números e hífens.')).toBeInTheDocument();
  });

  it('avisa que mudar a URL de um post publicado quebra links', () => {
    setup({ status: 'published', savedSlug: 'url-antiga' });
    expect(screen.getByText(/quebra links já compartilhados/)).toBeInTheDocument();
  });
});

describe('<PostSettings /> — capa', () => {
  it('sem capa: "Adicionar capa" abre a escolha da imagem', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: /Adicionar capa/ }));
    expect(props.onPickCover).toHaveBeenCalled();
  });

  it('com capa: mostra a prévia em 2:1 e permite trocar ou remover', () => {
    const props = setup({ fields: { ...fields, coverImage: '/uploads/2026/10/capa.png' } });

    const preview = document.querySelector('img[src="/uploads/2026/10/capa.png"]');
    expect(preview).toHaveClass('aspect-[2/1]');

    fireEvent.click(screen.getByRole('button', { name: 'Trocar' }));
    expect(props.onPickCover).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
    expect(props.onChange).toHaveBeenLastCalledWith({ coverImage: '' });
  });
});

describe('<PostSettings /> — datas, autor e prévia', () => {
  it('marca como atualizado hoje e limpa a data', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como atualizado hoje' }));
    expect(props.onChange).toHaveBeenLastCalledWith({ updatedAt: todayISO() });
  });

  it('limpa a data de atualização', () => {
    const props = setup({ fields: { ...fields, updatedAt: '2026-10-13' } });
    fireEvent.click(screen.getByLabelText('Limpar data de atualização'));
    expect(props.onChange).toHaveBeenLastCalledWith({ updatedAt: '' });
  });

  it('só mostra a escolha de autor para quem pode atribuir', () => {
    expect(setup().onAuthorChange).toBeDefined();
    expect(screen.queryByLabelText('Autor do post')).not.toBeInTheDocument();
  });

  it('editores trocam o autor', () => {
    const props = setup({
      authors: [
        { id: 'u1', name: 'Ana', username: 'ana' },
        { id: 'u2', name: 'Bia', username: 'bia' },
      ],
    });
    fireEvent.change(screen.getByLabelText('Autor do post'), { target: { value: 'u2' } });
    expect(props.onAuthorChange).toHaveBeenCalledWith('u2');
  });

  it('a prévia em buscadores mostra título, URL e resumo, com contador de limite', () => {
    setup({ fields: { ...fields, title: 'x'.repeat(61) } });
    expect(screen.getByText(/› posts › llm-local-em-casa/)).toBeInTheDocument();
    expect(screen.getByText('Resumo curto.')).toBeInTheDocument();
    expect(screen.getByText('61/60')).toHaveClass('text-yellow-700');
  });
});

describe('<PostSettings /> — zona de perigo', () => {
  it('não aparece em post novo', () => {
    setup();
    expect(screen.queryByText('Excluir post')).not.toBeInTheDocument();
  });

  it('post publicado pode ser despublicado e excluído', () => {
    const props = setup({ savedSlug: 'llm-local-em-casa', status: 'published' });
    fireEvent.click(screen.getByRole('button', { name: /Despublicar/ }));
    expect(props.onUnpublish).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Excluir post/ }));
    expect(props.onDelete).toHaveBeenCalled();
  });

  it('sem permissão de excluir, o botão não aparece; durante o salvamento fica desabilitado', () => {
    setup({ savedSlug: 'x', status: 'review', canDelete: false, busy: true });
    expect(screen.queryByRole('button', { name: /Excluir post/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tirar da revisão/ })).toBeDisabled();
  });
});
