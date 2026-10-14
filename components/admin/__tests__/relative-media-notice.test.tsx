/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { resolveRef } from '@/lib/admin/github-ref';

import { RelativeMediaNotice } from '../relative-media-notice';

// A busca do branch no GitHub é mock: aqui só interessa o comportamento do aviso.
jest.mock('@/lib/admin/github-ref', () => ({ resolveRef: jest.fn() }));

const mockResolve = resolveRef as jest.Mock;

const README = [
  '<img src="docs/logo.png" alt="logo">',
  '',
  'Veja o [guia](docs/GUIA.md) e o código em https://github.com/dono/projeto.',
].join('\n');

function setup(content = README) {
  const onFix = jest.fn();
  const view = render(<RelativeMediaNotice content={content} onFix={onFix} />);
  return { onFix, ...view };
}

const repoInput = () => screen.getByLabelText('Repositório do GitHub de onde o texto veio');
const fixButton = () => screen.getByRole('button', { name: 'Apontar para o GitHub' });

describe('<RelativeMediaNotice />', () => {
  it('não aparece quando todas as mídias têm URL completa', () => {
    const { container } = setup('![a](https://exemplo.com/a.png) [b](/posts/b)');
    expect(container).toBeEmptyDOMElement();
  });

  it('conta imagens e links relativos e já sugere o repositório citado no texto', () => {
    setup();
    expect(screen.getByText(/1 imagem e 1 link com caminho relativo/)).toBeInTheDocument();
    expect(screen.getByText('docs/logo.png')).toBeInTheDocument();
    expect(repoInput()).toHaveValue('dono/projeto');
  });

  it('acha o branch, fixa as imagens no commit e mantém os links no branch', async () => {
    mockResolve.mockResolvedValue({ name: 'dev', pinned: 'abc1234' });
    const { onFix } = setup();

    fireEvent.click(fixButton());

    await waitFor(() => expect(onFix).toHaveBeenCalled());
    expect(mockResolve).toHaveBeenCalledWith(
      { owner: 'dono', repo: 'projeto' },
      'docs/logo.png',
      undefined,
    );
    const [content, changed, repo, ref] = onFix.mock.calls[0];
    expect(content).toContain(
      'src="https://raw.githubusercontent.com/dono/projeto/abc1234/docs/logo.png"',
    );
    expect(content).toContain('[guia](https://github.com/dono/projeto/blob/dev/docs/GUIA.md)');
    expect(changed).toBe(2);
    expect(repo).toEqual({ owner: 'dono', repo: 'projeto' });
    expect(ref).toEqual({ name: 'dev', pinned: 'abc1234' });
  });

  it('respeita o branch digitado (dono/repo@branch)', async () => {
    mockResolve.mockResolvedValue({ name: 'v2', pinned: 'v2' });
    const { onFix } = setup();

    fireEvent.change(repoInput(), { target: { value: 'dono/projeto@v2' } });
    fireEvent.click(fixButton());

    await waitFor(() => expect(onFix).toHaveBeenCalled());
    expect(mockResolve).toHaveBeenCalledWith(
      { owner: 'dono', repo: 'projeto', ref: 'v2' },
      'docs/logo.png',
      'v2',
    );
  });

  it('não altera o texto quando a imagem não existe em nenhum branch', async () => {
    mockResolve.mockResolvedValue(null);
    const { onFix } = setup();

    fireEvent.click(fixButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não encontrei docs/logo.png em nenhum branch de dono/projeto',
    );
    expect(onFix).not.toHaveBeenCalled();
  });

  it('só com links (sem imagens) reescreve direto, sem consultar o GitHub', () => {
    const { onFix } = setup(
      'Leia o [CONTRIBUTING](CONTRIBUTING.md) de https://github.com/dono/projeto',
    );
    fireEvent.click(fixButton());

    expect(mockResolve).not.toHaveBeenCalled();
    expect(onFix.mock.calls[0][0]).toContain(
      'https://github.com/dono/projeto/blob/HEAD/CONTRIBUTING.md',
    );
  });

  it('desabilita o botão com repositório inválido', () => {
    setup();
    fireEvent.change(repoInput(), { target: { value: 'isso não é repo' } });
    expect(fixButton()).toBeDisabled();
  });

  it('"Ignorar" esconde o aviso até aparecerem caminhos novos', () => {
    const { rerender, onFix } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Ignorar' }));
    expect(screen.queryByRole('button', { name: 'Ignorar' })).not.toBeInTheDocument();

    rerender(
      <RelativeMediaNotice content={`${README}\n\n![outra](docs/outra.png)`} onFix={onFix} />,
    );
    expect(screen.getByText(/2 imagens e 1 link/)).toBeInTheDocument();
  });
});
